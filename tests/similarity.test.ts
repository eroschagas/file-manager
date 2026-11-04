import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { MediaFile } from '../src/shared/types'
import {
  areSimilar,
  groupSimilarFiles,
  hammingDistance,
  hasVisualDetail,
  perceptualHash,
} from '../src/main/similarity'

const file = (id: string, overrides: Partial<MediaFile> = {}): MediaFile => ({
  id,
  path: `/photos/${id}.jpg`,
  relativePath: `${id}.jpg`,
  name: `${id}.jpg`,
  kind: 'image',
  size: 100,
  mtimeMs: 0,
  width: 100,
  height: 100,
  sha256: id,
  hashes: ['123456789abcdef0'],
  thumbnailPath: '',
  ...overrides,
})

test('matches different resolutions but rejects unrelated signatures and different shapes', () => {
  assert.equal(areSimilar(file('a'), file('b', { width: 800, height: 800 })), true)
  assert.equal(areSimilar(file('a'), file('b', { hashes: ['0000000000000000'] })), false)
  assert.equal(areSimilar(file('a'), file('b', { width: 300, height: 100 })), false)
})

test('groups byte-identical files even without a visual signature', () => {
  const groups = groupSimilarFiles([
    file('a', { sha256: 'same', hashes: [] }),
    file('b', { sha256: 'same', hashes: [] }),
    file('c', { hashes: [] }),
  ])
  assert.equal(groups.length, 1)
  assert.equal(groups[0].match, 'exact')
  assert.equal(groups[0].files.length, 2)
})

test('compares each group member to its anchor instead of chaining loose matches', () => {
  const groups = groupSimilarFiles([
    file('a', { hashes: ['0000000000000000'], size: 300 }),
    file('b', { hashes: ['000000000000007f'], size: 200 }),
    file('c', { hashes: ['0000000000003fff'], size: 100 }),
  ])
  assert.deepEqual(
    groups.map((group) => group.files.map((entry) => entry.id)),
    [['a', 'b']],
  )
})

test('band index finds matches whose seven differing bits are spread across seven bands', () => {
  const hash = Array.from({ length: 7 }, (_, index) => 1n << BigInt(index * 8))
    .reduce((a, b) => a | b, 0n)
    .toString(16)
  assert.equal(hammingDistance('0', hash), 7)
  assert.equal(
    groupSimilarFiles([file('a', { hashes: ['0'] }), file('b', { hashes: [hash] })]).length,
    1,
  )
})

test('video matching requires matching duration and at least four matching frames', () => {
  const hashes = Array<string>(5).fill('123456789abcdef0')
  const video = file('a', { kind: 'video', duration: 60, hashes })
  assert.equal(
    areSimilar(
      video,
      file('b', { kind: 'video', duration: 60.1, hashes, width: 200, height: 200 }),
    ),
    true,
  )
  assert.equal(areSimilar(video, file('b', { kind: 'video', duration: 80, hashes })), false)
  assert.equal(
    areSimilar(
      video,
      file('b', {
        kind: 'video',
        duration: 60,
        hashes: [hashes[0], hashes[1], hashes[2], '0', '0'],
      }),
    ),
    false,
  )
  assert.equal(areSimilar(video, file('b', { hashes })), false)
})

test('solid frames are excluded from approximate matching', () => {
  assert.equal(hasVisualDetail(new Uint8Array(1024).fill(100)), false)
  const pixels = Uint8Array.from({ length: 1024 }, (_, index) => (index * 37) % 256)
  assert.equal(hasVisualDetail(pixels), true)
  assert.equal(perceptualHash(pixels), perceptualHash(pixels))
  assert.throws(() => perceptualHash(new Uint8Array(10)))
})
