import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import { test } from 'node:test'
import sharp from 'sharp'
import ffmpegPath from 'ffmpeg-static'
import { mediaKind, scanFolder } from '../src/main/scanner'

const run = promisify(execFile)

test('detects supported media extensions case-insensitively', () => {
  assert.equal(mediaKind('PHOTO.JPG'), 'image')
  assert.equal(mediaKind('clip.MOV'), 'video')
  assert.equal(mediaKind('notes.txt'), null)
})

test(
  'scans nested folders, groups resized/recompressed images and videos, reports corrupt media',
  { timeout: 120_000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'file-manager-test-'))
    const root = join(directory, 'input')
    const thumbnails = join(directory, 'thumbnails')
    await mkdir(join(root, 'nested', 'deeper'), { recursive: true })
    try {
      const image = Buffer.from(
        `<svg width="640" height="480"><rect width="640" height="480" fill="#e8c58a"/><circle cx="180" cy="190" r="110" fill="#386a8c"/><path d="M280 400 L420 60 L610 400Z" fill="#b34f5b"/><rect x="50" y="350" width="180" height="40" fill="#263c46"/></svg>`,
      )
      await sharp(image).jpeg({ quality: 95 }).toFile(join(root, 'original.jpg'))
      await sharp(image)
        .resize(320, 240)
        .jpeg({ quality: 45 })
        .toFile(join(root, 'nested', 'small.jpg'))
      await copyFile(join(root, 'original.jpg'), join(root, 'nested', 'deeper', 'copy.JPG'))
      await writeFile(join(root, 'broken.jpg'), 'not an image')
      await writeFile(join(root, 'notes.txt'), 'ignored')
      assert.ok(ffmpegPath)
      await run(
        ffmpegPath,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-f',
          'lavfi',
          '-i',
          'testsrc2=size=320x240:rate=10:duration=2',
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          join(root, 'video.mp4'),
        ],
        { windowsHide: true },
      )
      await run(
        ffmpegPath,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-i',
          join(root, 'video.mp4'),
          '-vf',
          'scale=160:120',
          '-c:v',
          'libx264',
          '-crf',
          '35',
          join(root, 'nested', 'deeper', 'video-small.mp4'),
        ],
        { windowsHide: true },
      )
      const phases = new Set<string>()
      const result = await scanFolder(root, thumbnails, new AbortController().signal, (event) =>
        phases.add(event.phase),
      )
      assert.equal(result.totalFiles, 6)
      assert.equal(result.analyzedFiles, 5)
      assert.equal(result.issues.length, 1)
      assert.equal(result.groups.length, 2)
      assert.equal(result.groups.find((group) => group.kind === 'image')?.files.length, 3)
      assert.equal(result.groups.find((group) => group.kind === 'video')?.files.length, 2)
      assert.equal(result.groups.find((group) => group.kind === 'image')?.match, 'similar')
      assert.ok(
        result.groups.some((group) =>
          group.files.some((file) => file.relativePath.includes('deeper')),
        ),
      )
      assert.ok(phases.has('analyzing'))
      assert.ok(phases.has('grouping'))
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  },
)

test('cancellation stops scanning before processing files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'file-manager-cancel-'))
  try {
    const controller = new AbortController()
    controller.abort()
    await assert.rejects(
      scanFolder(directory, join(directory, 'thumbs'), controller.signal, () => {}),
      { name: 'AbortError' },
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
