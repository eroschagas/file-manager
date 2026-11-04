import type { MediaFile, SimilarGroup } from '../shared/types'

const hashBits = 63
export const imageThreshold = 7

export const hammingDistance = (left: string, right: string): number => {
  let difference = BigInt(`0x${left}`) ^ BigInt(`0x${right}`)
  let count = 0
  while (difference) {
    difference &= difference - 1n
    count++
  }
  return count
}

// Ignore the DC coefficient so overall brightness does not dominate the signature.
export const perceptualHash = (pixels: Uint8Array): string => {
  const size = 32
  if (pixels.length !== size * size) throw new Error('Expected 32 × 32 grayscale pixels')
  const cosines = Array.from({ length: 8 }, (_, frequency) =>
    Array.from({ length: size }, (_, position) =>
      Math.cos(((2 * position + 1) * frequency * Math.PI) / (2 * size)),
    ),
  )
  const rows = Array.from({ length: size }, (_, y) =>
    cosines.map((cosine) =>
      cosine.reduce((sum, value, x) => sum + pixels[y * size + x] * value, 0),
    ),
  )
  const coefficients = Array.from({ length: 64 }, (_, index) => {
    const u = index % 8
    const v = Math.floor(index / 8)
    return rows.reduce((sum, row, y) => sum + row[u] * cosines[v][y], 0)
  }).slice(1)
  const median = [...coefficients].sort((a, b) => a - b)[31]
  return coefficients
    .reduce((hash, value) => (hash << 1n) | BigInt(value > median), 0n)
    .toString(16)
    .padStart(16, '0')
}

export const hasVisualDetail = (pixels: Uint8Array): boolean => {
  const average = pixels.reduce((sum, value) => sum + value, 0) / pixels.length
  const variance = pixels.reduce((sum, value) => sum + (value - average) ** 2, 0) / pixels.length
  return variance > 20
}

export const areSimilar = (left: MediaFile, right: MediaFile): boolean => {
  if (left.kind !== right.kind) return false
  if (left.sha256 === right.sha256) return true
  if (!left.hashes.length || left.hashes.length !== right.hashes.length) return false
  const ratioA = left.width / left.height
  const ratioB = right.width / right.height
  if (Math.abs(ratioA - ratioB) / Math.max(ratioA, ratioB) > 0.08) return false
  if (left.kind === 'image') {
    return hammingDistance(left.hashes[0], right.hashes[0]) <= imageThreshold
  }
  const durationA = left.duration ?? 0
  const durationB = right.duration ?? 0
  if (Math.abs(durationA - durationB) > Math.max(0.5, Math.max(durationA, durationB) * 0.02)) {
    return false
  }
  const distances = left.hashes.map((hash, index) => hammingDistance(hash, right.hashes[index]))
  return (
    distances.filter((distance) => distance <= imageThreshold).length >= 4 &&
    distances.reduce((sum, distance) => sum + distance, 0) / distances.length <= imageThreshold
  )
}

// Eight disjoint bands guarantee a shared band for hashes within seven bits.
const bandKeys = (hash: string): string[] => {
  const bits = BigInt(`0x${hash}`).toString(2).padStart(hashBits, '0')
  return Array.from({ length: 8 }, (_, index) => `${index}:${bits.slice(index * 8, index * 8 + 8)}`)
}

export const groupSimilarFiles = (files: MediaFile[]): SimilarGroup[] => {
  const groups: SimilarGroup[] = []
  const exactIndex = new Map<string, SimilarGroup>()
  const visualIndex = new Map<string, Set<SimilarGroup>>()
  const sorted = [...files].sort(
    (a, b) =>
      b.width * b.height - a.width * a.height || b.size - a.size || a.path.localeCompare(b.path),
  )
  sorted.forEach((file) => {
    const keys = file.hashes.flatMap((hash, frame) =>
      bandKeys(hash).map((band) => `${file.kind}:${frame}:${band}`),
    )
    const candidates = new Set(keys.flatMap((key) => [...(visualIndex.get(key) ?? [])]))
    let group = exactIndex.get(`${file.kind}:${file.sha256}`)
    if (!group) group = [...candidates].find((candidate) => areSimilar(candidate.files[0], file))
    if (group) {
      if (group.files[0].sha256 !== file.sha256) group.match = 'similar'
      group.files.push(file)
    } else {
      group = { id: file.id, kind: file.kind, match: 'exact', files: [file] }
      groups.push(group)
      const anchor = group
      keys.forEach((key) => {
        if (!visualIndex.has(key)) visualIndex.set(key, new Set())
        visualIndex.get(key)!.add(anchor)
      })
    }
    exactIndex.set(`${file.kind}:${file.sha256}`, group)
  })
  return groups.filter((group) => group.files.length > 1)
}
