import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'
import ffmpeg from 'ffmpeg-static'
import sharp, { type Sharp } from 'sharp'
import { FileOrganizer } from '../src/main/organizer/FileOrganizer'
import {
  MediaDateReader,
  parseCaptureDate,
  videoCaptureDate,
} from '../src/main/organizer/MediaDateReader'

const fixture = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'file-manager-media-dates-'))
  try {
    await run(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}
const image = (): Sharp =>
  sharp({ create: { width: 16, height: 16, channels: 3, background: '#6650d8' } })
const signal = (): AbortSignal => new AbortController().signal
const readDate = async (path: string): Promise<Date> =>
  new Date(await new MediaDateReader().read(await lstat(path), path, signal()))

test('capture dates preserve camera calendar month, validate dates and ignore unset values', () => {
  const capture = new Date(parseCaptureDate('2021:03:01 00:15:00+14:00')!)
  assert.equal(capture.getFullYear(), 2021)
  assert.equal(capture.getMonth(), 2)
  assert.equal(capture.getDate(), 1)
  assert.equal(parseCaptureDate('2021:02:30 12:00:00'), undefined)
  assert.equal(parseCaptureDate('0000:00:00 00:00:00'), undefined)
  assert.equal(parseCaptureDate('1904-01-01T00:00:00Z'), undefined)
  assert.equal(parseCaptureDate('not a date'), undefined)
  assert.notEqual(parseCaptureDate('2020:02:29 12:00:00'), undefined)
})

test('video metadata prefers recording date and falls back from invalid container dates to video tracks', () => {
  const capture = videoCaptureDate({
    format: {
      tags: {
        'com.apple.quicktime.creationdate': '2019-01-01T00:15:00+14:00',
        creation_time: '2026-11-04T12:00:00Z',
      },
    },
  })
  assert.equal(new Date(capture!).getFullYear(), 2019)
  assert.equal(new Date(capture!).getMonth(), 0)
  const track = videoCaptureDate({
    format: { tags: { creation_time: '0000-00-00T00:00:00Z' } },
    streams: [
      { codec_type: 'audio', tags: { creation_time: '2026-11-04T12:00:00Z' } },
      { codec_type: 'video', tags: { creation_time: '2018-07-20T12:00:00Z' } },
    ],
  })
  assert.equal(new Date(track!).getFullYear(), 2018)
  assert.equal(new Date(track!).getMonth(), 6)
})

test('real JPEG/PNG/WebP EXIF dates override newer file modification times', async () =>
  fixture(async (root) => {
    for (const extension of ['jpg', 'png', 'webp']) {
      const path = join(root, `capture.${extension}`)
      await image()
        .withExif({
          IFD2: {
            DateTimeOriginal: '2021:03:01 00:15:00',
            DateTimeDigitized: '2022:08:10 12:00:00',
          },
        })
        .toFile(path)
      const modified = new Date(2025, 9, 10, 12)
      await utimes(path, modified, modified)
      const capture = await readDate(path)
      assert.equal(capture.getFullYear(), 2021, extension)
      assert.equal(capture.getMonth(), 2, extension)
    }
  }))

test('XMP capture dates are read when EXIF dates are absent', async () =>
  fixture(async (root) => {
    const path = join(root, 'xmp.jpg')
    await image()
      .withXmp(
        '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmp:CreateDate="2017-06-15T12:00:00+03:00"/></rdf:RDF></x:xmpmeta>',
      )
      .jpeg()
      .toFile(path)
    const capture = await readDate(path)
    assert.equal(capture.getFullYear(), 2017)
    assert.equal(capture.getMonth(), 5)
  }))

test('missing, invalid and unreadable media metadata falls back to modification time', async () =>
  fixture(async (root) => {
    await image().jpeg().toFile(join(root, 'no-exif.jpg'))
    await image()
      .withExif({ IFD2: { DateTimeOriginal: '0000:00:00 00:00:00' } })
      .jpeg()
      .toFile(join(root, 'invalid-exif.jpg'))
    await writeFile(join(root, 'broken.mp4'), 'invalid video')
    await writeFile(join(root, 'document.txt'), 'document')
    const modified = new Date(2016, 8, 20, 12)
    for (const name of await readdir(root)) {
      const path = join(root, name)
      await utimes(path, modified, modified)
      assert.equal((await readDate(path)).getTime(), modified.getTime(), name)
    }
  }))

test('real MP4 recording metadata overrides a newer file modification date', async () =>
  fixture(async (root) => {
    const path = join(root, 'capture.mp4')
    await promisify(execFile)(
      ffmpeg!,
      [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=c=black:s=16x16:d=0.1',
        '-c:v',
        'libx264',
        '-metadata',
        'creation_time=2018-07-20T12:00:00Z',
        path,
      ],
      { windowsHide: true },
    )
    const capture = await readDate(path)
    assert.equal(capture.getFullYear(), 2018)
    assert.equal(capture.getMonth(), 6)
  }))

test('organizer corrects an earlier date folder and remains stable on another run', async () =>
  fixture(async (root) => {
    const previous = join(root, '2026', 'Nov')
    await mkdir(previous, { recursive: true })
    const photo = join(previous, 'photo.jpg')
    await image()
      .withExif({ IFD2: { DateTimeOriginal: '2020:02:10 12:00:00' } })
      .jpeg()
      .toFile(photo)
    const original = await readFile(photo)
    const organizer = new FileOrganizer()
    const preview = await organizer.createPreview(root, signal(), () => {})
    assert.deepEqual(preview.folders, [{ path: '2020/02 - Feb', count: 1 }])
    const result = await organizer.execute(preview.id, signal(), () => {})
    assert.equal(result.movedFiles, 1)
    assert.deepEqual(await readFile(join(root, '2020', '02 - Feb', 'photo.jpg')), original)
    const again = await organizer.createPreview(root, signal(), () => {})
    assert.equal(again.pendingFiles, 0)
    assert.equal(again.alreadyOrganized, 1)
  }))

test('canceling metadata reads is propagated instead of using a fallback date', async () =>
  fixture(async (root) => {
    const path = join(root, 'photo.jpg')
    await image().jpeg().toFile(path)
    const abort = new AbortController()
    abort.abort()
    await assert.rejects(new MediaDateReader().read(await lstat(path), path, abort.signal), {
      name: 'AbortError',
    })
  }))
