import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import exifr from 'exifr'
import ffmpegPath from 'ffmpeg-static'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { ExifTool } from 'exiftool-vendored'
import { MetadataEditor } from '../src/main/MetadataEditor'
import { commonMetadata, maskMetadataDate, metadataValueError } from '../src/shared/metadata'

test('date masks require a full valid calendar date or an empty value', () => {
  assert.equal(maskMetadataDate('20261105123045'), '2026:11:05 12:30:45')
  assert.equal(maskMetadataDate('20261'), '2026:1')
  assert.equal(maskMetadataDate(''), '')
  assert.equal(metadataValueError('CreateDate', ''), '')
  assert.equal(metadataValueError('CreateDate', '2024:02:29 12:30:45'), '')
  const invalidDates = [
    '2026:11:05',
    '2026:11:05 12:30',
    '2026:02:29 12:00:00',
    '2026:11:05 24:00:00',
    '2026:11:05 12:00:00+03:',
  ]
  invalidDates.forEach((value) => assert.notEqual(metadataValueError('CreateDate', value), ''))
})

test('common metadata requires 80% of all files, including missing values', () => {
  assert.equal(commonMetadata(['a', 'a', 'a', 'a', 'b'], 5), 'a')
  assert.equal(commonMetadata(['a', 'a', 'b'], 3), '')
  assert.equal(commonMetadata(['a', 'a', '', ''], 4), '')
  assert.equal(commonMetadata([], 0), '')
})

test('metadata validates field allowlist and complete dates; blank fields are omitted', () => {
  const editor = new MetadataEditor()
  try {
    assert.deepEqual(editor.validate({ Artist: ' ', Title: ' Test ', Description: null }), {
      Title: 'Test',
      Description: null,
    })
    assert.throws(() => editor.validate({ All: null }))
    assert.throws(() => editor.validate({ DateTimeOriginal: '2026:11:05' }))
    assert.throws(() => editor.validate({ DateTimeOriginal: '2026:02:30 12:00:00' }))
    assert.throws(() => editor.validate({ Title: '' }))
    assert.throws(() => editor.validate({ Title: 'a\n-execute' }))
  } finally {
    editor.close()
  }
})

test('batch metadata edits existing files without backups, preserves omitted fields, deletes tags and rejects stale previews', async () => {
  const root = await mkdtemp(join(tmpdir(), 'metadata-test-'))
  const tool = new ExifTool({ maxProcs: 1 })
  const editor = new MetadataEditor()
  try {
    await mkdir(join(root, 'nested'))
    const path = join(root, 'nested', 'photo.jpg')
    await sharp({ create: { width: 8, height: 8, channels: 3, background: '#abc' } })
      .jpeg()
      .toFile(path)
    await tool.write(
      path,
      { Artist: 'Original author', Title: 'Remove me', DateTimeOriginal: '2020:01:02 03:04:05' },
      { writeArgs: ['-overwrite_original'] },
    )
    const original = await readFile(path)
    const originalPixels = await sharp(path).raw().toBuffer()
    const preview = await editor.inspect(root)
    assert.equal(preview.count, 1)
    assert.equal(preview.values.Artist, 'Original author')
    const response = await editor.apply(preview.id, {
      Artist: '',
      Title: null,
      DateTimeOriginal: '2026:11:05 12:30:00',
    })
    assert.equal(response.updated, 1)
    assert.deepEqual(response.issues, [])
    const tags = await tool.read(path)
    assert.equal(tags.Artist, 'Original author')
    assert.equal(tags.Title, undefined)
    assert.match(String(tags.DateTimeOriginal), /2026.*11.*05/)
    const exif = await exifr.parse(path, { reviveValues: false })
    assert.equal(exif.DateTimeOriginal, '2026:11:05 12:30:00')
    assert.deepEqual(await sharp(path).raw().toBuffer(), originalPixels)
    assert.notDeepEqual(await readFile(path), original)
    assert.deepEqual(await readdir(join(root, 'nested')), ['photo.jpg'])
    await assert.rejects(editor.apply(preview.id, { Artist: 'Again' }))
    const repeatPreview = await editor.inspect(root)
    const repeat = await editor.apply(repeatPreview.id, { Artist: 'Updated author' })
    assert.equal(repeat.updated, 1)
    assert.deepEqual(repeat.issues, [])
    assert.deepEqual(await readdir(join(root, 'nested')), ['photo.jpg'])
    const next = await editor.inspect(root)
    assert.equal(next.count, 1, 'backup files must not be included')
    await sharp({ create: { width: 12, height: 12, channels: 3, background: '#fff' } })
      .jpeg()
      .toFile(path)
    const stale = await editor.apply(next.id, { Artist: 'Changed' })
    assert.equal(stale.updated, 0)
    assert.equal(stale.issues.length, 1)
  } finally {
    editor.close()
    await tool.end()
    await rm(root, { recursive: true, force: true })
  }
})

test('video dates are changed in the existing MP4 without creating companion files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'metadata-video-test-'))
  const path = join(root, 'video.mp4')
  const editor = new MetadataEditor()
  const tool = new ExifTool({ maxProcs: 1 })
  try {
    await promisify(execFile)(
      ffmpegPath!,
      ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=32x32:d=1', '-c:v', 'libx264', path],
      { windowsHide: true },
    )
    const preview = await editor.inspect(root)
    const result = await editor.apply(preview.id, {
      CreateDate: '2026:11:05 12:30:00',
      DateTimeOriginal: '2026:11:05 12:30:00',
    })
    assert.equal(result.updated, 1)
    assert.deepEqual(result.issues, [])
    const tags = await tool.read(path)
    assert.match(String(tags.CreateDate), /2026.*11.*05/)
    assert.deepEqual(await readdir(root), ['video.mp4'])
  } finally {
    editor.close()
    await tool.end()
    await rm(root, { recursive: true, force: true })
  }
})
