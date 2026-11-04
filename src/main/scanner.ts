import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, readdir, stat } from 'node:fs/promises'
import { basename, extname, join, relative } from 'node:path'
import { spawn } from 'node:child_process'
import sharp from 'sharp'
import ffmpegPath from 'ffmpeg-static'
import type { MediaFile, MediaKind, ScanProgress, ScanResult } from '../shared/types'
import { groupSimilarFiles, hasVisualDetail, perceptualHash } from './similarity'
import { resolveFolders } from './folders'

const probe = require('ffprobe-static') as { path: string }
const imageExtensions = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.tif',
  '.tiff',
  '.gif',
  '.heic',
  '.heif',
])
const videoExtensions = new Set(['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.mts', '.m2ts'])

export const mediaKind = (path: string): MediaKind | null => {
  const extension = extname(path).toLowerCase()
  return imageExtensions.has(extension) ? 'image' : videoExtensions.has(extension) ? 'video' : null
}

const unpackedPath = (path: string): string =>
  path.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')

const runBinary = (binary: string, args: string[], signal: AbortSignal): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const child = spawn(unpackedPath(binary), args, { windowsHide: true, signal })
    const chunks: Buffer[] = []
    let bytes = 0
    let stderr = ''
    let tooLarge = false
    const timer = setTimeout(() => child.kill(), 90_000)
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length
      if (bytes > 16 * 1024 * 1024) {
        tooLarge = true
        child.kill()
      } else chunks.push(chunk)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2000)
    })
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('close', (code) => {
      clearTimeout(timer)
      if (code === 0 && !tooLarge) resolve(Buffer.concat(chunks))
      else
        reject(
          new Error(
            stderr.trim() ||
              'Não foi possível decodificar o vídeo (limite de 90 segundos por etapa).',
          ),
        )
    })
  })

const sha256 = async (path: string, signal: AbortSignal): Promise<string> => {
  const hash = createHash('sha256')
  const stream = createReadStream(path, { signal })
  for await (const chunk of stream) hash.update(chunk)
  return hash.digest('hex')
}

const imageHash = async (input: Buffer): Promise<string | null> => {
  const pixels = await sharp(input)
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize(32, 32, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer()
  return hasVisualDetail(pixels) ? perceptualHash(pixels) : null
}

export const scanFolder = async (
  folder: string | string[],
  thumbnailDirectory: string,
  signal: AbortSignal,
  onProgress: (progress: ScanProgress) => void,
): Promise<ScanResult> => {
  const started = Date.now()
  const roots = await resolveFolders(Array.isArray(folder) ? folder : [folder])
  await mkdir(thumbnailDirectory, { recursive: true })
  const paths: string[] = []
  const issues: ScanResult['issues'] = []
  const progress: ScanProgress = {
    phase: 'discovering',
    total: 0,
    processed: 0,
    currentFile: '',
    skipped: 0,
  }
  let lastProgress = 0
  const report = (force = false): void => {
    if (force || Date.now() - lastProgress > 120) {
      onProgress({ ...progress })
      lastProgress = Date.now()
    }
  }
  const pending = [...roots]
  while (pending.length) {
    signal.throwIfAborted()
    const directory = pending.pop()!
    try {
      const entries = await readdir(directory, { withFileTypes: true })
      entries.forEach((entry) => {
        const path = join(directory, entry.name)
        // Do not follow symbolic links/junctions into other folders or cycles.
        if (entry.isSymbolicLink()) return
        if (entry.isDirectory()) pending.push(path)
        else if (entry.isFile() && mediaKind(path)) paths.push(path)
      })
    } catch (error) {
      issues.push({ path: directory, message: String(error) })
    }
    progress.total = paths.length
    progress.currentFile = directory
    report()
  }
  progress.phase = 'analyzing'
  report(true)
  const files: MediaFile[] = []
  for (const path of paths) {
    signal.throwIfAborted()
    progress.currentFile = path
    report()
    try {
      const before = await stat(path)
      const kind = mediaKind(path)!
      const id = randomUUID()
      const thumbnailPath = join(thumbnailDirectory, `${id}.jpg`)
      // libvips can cache file-backed inputs after a pipeline finishes. Give it bytes
      // instead, so it never owns a handle to the user's original image.
      const imageInput = kind === 'image' ? await readFile(path, { signal }) : null
      const digest = imageInput
        ? createHash('sha256').update(imageInput).digest('hex')
        : await sha256(path, signal)
      let width = 0
      let height = 0
      let duration: number | undefined
      let hashes: string[] = []
      if (kind === 'image') {
        const metadata = await sharp(imageInput!).metadata()
        width = metadata.autoOrient.width
        height = metadata.autoOrient.height
        const hash = await imageHash(imageInput!)
        hashes = hash ? [hash] : []
        await sharp(imageInput!)
          .rotate()
          .resize(640, 480, { fit: 'inside', withoutEnlargement: true })
          .flatten({ background: '#ffffff' })
          .jpeg({ quality: 80 })
          .toFile(thumbnailPath)
      } else {
        if (!ffmpegPath) throw new Error('FFmpeg indisponível nesta plataforma.')
        const metadata = JSON.parse(
          (
            await runBinary(
              probe.path,
              ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path],
              signal,
            )
          ).toString(),
        ) as {
          format: { duration?: string }
          streams: {
            codec_type: string
            width: number
            height: number
            duration?: string
            tags?: { rotate?: string }
            side_data_list?: { rotation?: number }[]
          }[]
        }
        const stream = metadata.streams.find((item) => item.codec_type === 'video')
        if (!stream) throw new Error('Nenhuma faixa de vídeo encontrada.')
        width = stream.width
        height = stream.height
        const rotation = Number(
          stream.tags?.rotate ??
            stream.side_data_list?.find((item) => item.rotation !== undefined)?.rotation ??
            0,
        )
        if (Math.abs(rotation) % 180 === 90) [width, height] = [height, width]
        duration = Number(stream.duration ?? metadata.format.duration)
        if (!Number.isFinite(duration) || duration <= 0)
          throw new Error('Duração de vídeo inválida.')
        const frames: Buffer[] = []
        for (const fraction of [0.1, 0.3, 0.5, 0.7, 0.9]) {
          signal.throwIfAborted()
          frames.push(
            await runBinary(
              ffmpegPath,
              [
                '-hide_banner',
                '-loglevel',
                'error',
                '-nostdin',
                '-ss',
                String(duration * fraction),
                '-i',
                path,
                '-frames:v',
                '1',
                '-vf',
                'scale=640:480:force_original_aspect_ratio=decrease',
                '-threads',
                '1',
                '-f',
                'image2pipe',
                '-vcodec',
                'mjpeg',
                'pipe:1',
              ],
              signal,
            ),
          )
        }
        const frameHashes = await Promise.all(frames.map(imageHash))
        hashes = frameHashes.every((hash): hash is string => hash !== null) ? frameHashes : []
        await sharp(frames[2]).jpeg({ quality: 80 }).toFile(thumbnailPath)
      }
      const after = await stat(path)
      if (after.size !== before.size || after.mtimeMs !== before.mtimeMs)
        throw new Error('Arquivo alterado durante a análise; analise novamente.')
      files.push({
        id,
        path,
        relativePath: roots.length === 1 ? relative(roots[0], path) : path,
        name: basename(path),
        kind,
        size: before.size,
        mtimeMs: before.mtimeMs,
        width,
        height,
        duration,
        sha256: digest,
        hashes,
        thumbnailPath,
      })
    } catch (error) {
      signal.throwIfAborted()
      progress.skipped++
      issues.push({ path, message: error instanceof Error ? error.message : String(error) })
    }
    progress.processed++
    report()
  }
  signal.throwIfAborted()
  progress.phase = 'grouping'
  progress.currentFile = ''
  report(true)
  const groups = groupSimilarFiles(files)
  signal.throwIfAborted()
  return {
    roots,
    groups,
    totalFiles: paths.length,
    analyzedFiles: files.length,
    issues,
    elapsedMs: Date.now() - started,
  }
}
