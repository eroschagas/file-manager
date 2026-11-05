export const metadataFields = [
  { key: 'DateTimeOriginal', label: 'Capture date', date: true },
  { key: 'CreateDate', label: 'Creation date', date: true },
  { key: 'ModifyDate', label: 'Internal modification date', date: true },
  { key: 'Title', label: 'Title' },
  { key: 'Description', label: 'Description' },
  { key: 'Artist', label: 'Author' },
  { key: 'Copyright', label: 'Copyright' },
  { key: 'Make', label: 'Camera manufacturer' },
  { key: 'Model', label: 'Camera model' },
] as const
export type MetadataKey = (typeof metadataFields)[number]['key']
export type MetadataChanges = Partial<Record<MetadataKey, string | null>>

export const maskMetadataDate = (input: string): string => {
  const digits = input.replace(/\D/g, '').slice(0, 14)
  const groups = [
    digits.slice(0, 4),
    digits.slice(4, 6),
    digits.slice(6, 8),
    digits.slice(8, 10),
    digits.slice(10, 12),
    digits.slice(12, 14),
  ]
  const separators = ['', ':', ':', ' ', ':', ':']
  const date = groups.map((group, index) => (group ? separators[index] + group : '')).join('')
  const zone = /^\d{4}[:-]\d{2}[:-]\d{2}[ T]\d{2}:\d{2}:\d{2}(Z|[+-][\d:]*)$/i.exec(input)?.[1]
  if (!zone) return date
  if (zone.toUpperCase() === 'Z') return date + 'Z'
  const zoneDigits = zone.replace(/\D/g, '').slice(0, 4)
  return (
    date +
    zone[0] +
    zoneDigits.slice(0, 2) +
    (zoneDigits.length > 2 ? ':' + zoneDigits.slice(2) : '')
  )
}

export const validMetadataDate = (value: string): boolean => {
  const match =
    /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:Z|([+-])(\d{2}):(\d{2}))?$/.exec(value)
  if (!match) return false
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number)
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  return (
    year > 0 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    hour < 24 &&
    minute < 60 &&
    second < 60 &&
    (!match[7] ||
      (Number(match[8]) <= 14 &&
        Number(match[9]) < 60 &&
        (Number(match[8]) !== 14 || Number(match[9]) === 0)))
  )
}

export const metadataValueError = (key: MetadataKey, value: string): string => {
  if (!value.trim()) return ''
  if (value.length > 4096 || /[\r\n\0]/.test(value))
    return 'Enter a valid value (up to 4096 characters).'
  const field = metadataFields.find((field) => field.key === key)!
  return 'date' in field && !validMetadataDate(value.trim())
    ? 'Enter a complete, valid date: YYYY:MM:DD HH:mm:ss.'
    : ''
}
export interface MetadataPreview {
  id: string
  root: string
  count: number
  values: Record<MetadataKey, string>
  issues: { path: string; message: string }[]
}
export interface MetadataResult {
  updated: number
  issues: { path: string; message: string }[]
}
export interface MetadataApi {
  chooseMetadataFolder: () => Promise<string | null>
  previewMetadata: (folder: string) => Promise<MetadataPreview>
  applyMetadata: (id: string, changes: MetadataChanges) => Promise<MetadataResult | null>
}

export const commonMetadata = (values: string[], total: number): string => {
  const counts = new Map<string, number>()
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
  const best = [...counts].sort((a, b) => b[1] - a[1])[0]
  return best && total > 0 && best[1] / total >= 0.8 ? best[0] : ''
}
