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

test('flexible matching finds candidates beyond balanced and strict thresholds', () => {
  const first = file('a', { hashes: ['0'] })
  const second = file('b', { hashes: ['3ff'] })
  assert.equal(areSimilar(first, second, 'strict'), false)
  assert.equal(areSimilar(first, second, 'balanced'), false)
  assert.equal(areSimilar(first, second, 'flexible'), true)
  assert.equal(groupSimilarFiles([first, second], 'balanced').length, 0)
  assert.equal(groupSimilarFiles([first, second], 'flexible').length, 1)
  const moderatelyDifferent = file('c', { hashes: ['3f'] })
  assert.equal(areSimilar(first, moderatelyDifferent, 'strict'), false)
  assert.equal(areSimilar(first, moderatelyDifferent, 'balanced'), true)
})

test('orders members by bytes even when the smaller file has higher resolution', () => {
  const groups = groupSimilarFiles([
    file('small', { size: 100, width: 1000, height: 1000 }),
    file('large', { size: 300, width: 200, height: 200 }),
    file('medium', { size: 200, width: 400, height: 400 }),
  ])
  assert.deepEqual(
    groups[0].files.map((entry) => entry.id),
    ['large', 'medium', 'small'],
  )
})

test('broad finds larger visual and framing differences through the candidate index', () => {
  const hash = Array.from({ length: 14 }, (_, index) => 1n << BigInt(Math.floor((index * 63) / 15)))
    .reduce((left, right) => left | right, 0n)
    .toString(16)
  assert.equal(hammingDistance('0', hash), 14)
  const anchor = file('anchor', { hashes: ['0'], size: 300 })
  const changed = file('changed', { hashes: [hash], size: 200 })
  assert.equal(areSimilar(anchor, changed, 'flexible'), false)
  assert.equal(areSimilar(anchor, changed, 'broad'), true)
  assert.equal(groupSimilarFiles([anchor, changed], 'flexible').length, 0)
  assert.equal(groupSimilarFiles([anchor, changed], 'broad').length, 1)
  assert.equal(areSimilar(anchor, file('framed', { hashes: ['0'], width: 110 }), 'flexible'), false)
  assert.equal(areSimilar(anchor, file('framed', { hashes: ['0'], width: 110 }), 'broad'), true)
  assert.equal(
    areSimilar(anchor, file('old-framing-match', { hashes: ['0'], width: 120 }), 'broad'),
    false,
  )
  assert.equal(
    areSimilar(anchor, file('different-shape', { hashes: ['0'], width: 200 }), 'broad'),
    false,
  )
  assert.equal(areSimilar(anchor, file('too-different', { hashes: ['7fff'] }), 'broad'), false)
  assert.equal(areSimilar(anchor, file('old-broad-match', { hashes: ['3ffff'] }), 'broad'), false)
  assert.equal(areSimilar(anchor, file('no-signature', { hashes: [] }), 'broad'), false)
})

test('broad retains video duration, matching-frame and average-distance checks', () => {
  const anchor = file('anchor', { kind: 'video', duration: 60, hashes: Array<string>(5).fill('0') })
  const changed = file('changed', {
    kind: 'video',
    duration: 60,
    hashes: ['3fff', '3fff', '3fff', '3fff', '0'],
  })
  assert.equal(areSimilar(anchor, changed, 'flexible'), false)
  assert.equal(areSimilar(anchor, changed, 'broad'), true)
  assert.equal(groupSimilarFiles([anchor, changed], 'broad').length, 1)
  assert.equal(areSimilar(anchor, { ...changed, duration: 80 }, 'broad'), false)
  assert.equal(
    areSimilar(anchor, { ...changed, hashes: ['3fff', '3fff', '3fff', '7fff', '7fff'] }, 'broad'),
    false,
  )
  assert.equal(
    areSimilar(anchor, { ...changed, hashes: ['3fff', '3fff', '3fff', '3fff', '7fff'] }, 'broad'),
    false,
  )
})
