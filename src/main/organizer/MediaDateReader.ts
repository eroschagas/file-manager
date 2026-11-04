import { execFile } from 'node:child_process'
import type { Stats } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { promisify } from 'node:util'
import exifr from 'exifr'
import sharp from 'sharp'

const execute = promisify(execFile)
const probe = require('ffprobe-static') as { path: string }
const photoExtensions = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.tif',
  '.tiff',
  '.heic',
  '.heif',
  '.dng',
  '.nef',
  '.cr2',
])
const videoExtensions = new Set([
  '.mp4',
  '.mov',
  '.mkv',
  '.avi',
  '.webm',
  '.m4v',
  '.mts',
  '.m2ts',
  '.3gp',
  '.3g2',
])
const photoTags = ['DateTimeOriginal', 'CreateDate', 'DateCreated', 'CreationDate']

/** Retain the calendar date recorded by the camera, without shifting its month. */
export const parseCaptureDate = (value: unknown): number | undefined => {
  if (typeof value !== 'string') return undefined
  const match =
    /^(\d{4})[:-](\d{2})[:-](\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(
      value.trim(),
    )
  if (!match) return undefined
  const [year, month, day, hour, minute, second] = match.slice(1).map((part) => Number(part ?? 0))
  if (
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    return undefined
  // Common unset container dates are not recording dates.
  if (
    [1904, 1970].includes(year) &&
    month === 1 &&
    day === 1 &&
    hour === 0 &&
    minute === 0 &&
    second === 0
  )
    return undefined
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(hour, minute, second, 0)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
    return undefined
  return date.getTime()
}

const firstDate = (values: unknown[]): number | undefined =>
  values.map(parseCaptureDate).find((value) => value !== undefined)

interface VideoMetadata {
  format?: { tags?: Record<string, unknown> }
  streams?: { codec_type?: string; tags?: Record<string, unknown> }[]
}

export const videoCaptureDate = (metadata: VideoMetadata): number | undefined => {
  const groups = [
    metadata.format?.tags,
    ...(metadata.streams ?? [])
      .filter((stream) => stream.codec_type === 'video')
      .map((stream) => stream.tags),
  ]
  const tags = groups.map((group) =>
    Object.fromEntries(
      Object.entries(group ?? {}).map(([name, value]) => [name.toLowerCase(), value]),
    ),
  )
  // Camera-specific recording dates take precedence over generic container dates.
  return firstDate(
    [
      'com.apple.quicktime.creationdate',
      'datetimeoriginal',
      'date_time_original',
      'creation_time',
      'date',
    ].flatMap((name) => tags.map((group) => group[name])),
  )
}

export class MediaDateReader {
  private imageDate = async (path: string, signal: AbortSignal): Promise<number | undefined> => {
    // Finite reads release the original before any native metadata processing.
    const input = await readFile(path, { signal })
    signal.throwIfAborted()
    let tags: Record<string, unknown> | undefined
    const options = { reviveValues: false, xmp: true, gps: false, exif: { pick: photoTags } }
    try {
      tags = await exifr.parse(input, options)
    } catch {
      /* Try the embedded EXIF block for formats such as WebP. */
    }
    let date = firstDate(photoTags.map((name) => tags?.[name]))
    if (date !== undefined) return date
    try {
      const metadata = await sharp(input).metadata()
      if (metadata.exif) {
        const exif = metadata.exif.subarray(0, 6).equals(Buffer.from('Exif\0\0'))
          ? metadata.exif.subarray(6)
          : metadata.exif
        tags = await exifr.parse(exif, options)
        date = firstDate(photoTags.map((name) => tags?.[name]))
      }
    } catch {
      /* Missing or unsupported metadata falls back to file modification time. */
    }
    return date
  }

  private videoDate = async (path: string, signal: AbortSignal): Promise<number | undefined> => {
    const binary = probe.path.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')
    const { stdout } = await execute(
      binary,
      [
        '-v',
        'error',
        '-show_entries',
        'format_tags:stream=codec_type:stream_tags',
        '-of',
        'json',
        path,
      ],
      {
        windowsHide: true,
        signal,
        timeout: 30_000,
        maxBuffer: 2 * 1024 * 1024,
      },
    )
    return videoCaptureDate(JSON.parse(stdout) as VideoMetadata)
  }

  read = async (info: Stats, path: string, signal: AbortSignal): Promise<number> => {
    signal.throwIfAborted()
    try {
      const extension = extname(path).toLowerCase()
      const capture = photoExtensions.has(extension)
        ? await this.imageDate(path, signal)
        : videoExtensions.has(extension)
          ? await this.videoDate(path, signal)
          : undefined
      signal.throwIfAborted()
      if (capture !== undefined) return capture
    } catch {
      signal.throwIfAborted()
    }
    return info.mtimeMs
  }
}
