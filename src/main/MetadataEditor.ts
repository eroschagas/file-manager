import { ExifTool, type WriteTags } from 'exiftool-vendored'
import { randomUUID } from 'node:crypto'
import { lstat, readdir, realpath } from 'node:fs/promises'
import { extname, join } from 'node:path'
import {
  commonMetadata,
  metadataFields,
  metadataValueError,
  type MetadataChanges,
  type MetadataPreview,
  type MetadataResult,
} from '../shared/metadata'
import { resolveFolders, isInsideFolder } from './folders'

const extensions = new Set(
  '.jpg .jpeg .png .webp .avif .gif .tif .tiff .heic .heif .dng .nef .cr2 .cr3 .arw .mp4 .mov .mkv .avi .webm .m4v .mts .m2ts .3gp .3g2'.split(
    ' ',
  ),
)
interface FileSnapshot {
  path: string
  size: number
  mtimeMs: number
}
export class MetadataEditor {
  private readonly tool = new ExifTool({ maxProcs: 1 })
  private preview?: MetadataPreview
  private files: FileSnapshot[] = []
  close = (): void => {
    void this.tool.end()
  }

  inspect = async (folder: unknown): Promise<MetadataPreview> => {
    this.preview = undefined
    this.files = []
    const [root] = await resolveFolders([folder])
    const issues: MetadataPreview['issues'] = []
    const rows: Record<string, string>[] = []
    const walk = async (directory: string): Promise<void> => {
      const entries = await readdir(directory, { withFileTypes: true })
      for (const entry of entries) {
        const path = join(directory, entry.name)
        try {
          const info = await lstat(path)
          if (info.isSymbolicLink()) continue
          if (info.isDirectory()) {
            await walk(path)
            continue
          }
          if (!info.isFile() || !extensions.has(extname(path).toLowerCase())) continue
          const tags = await this.tool.read(path)
          const row: Record<string, string> = {}
          metadataFields.forEach(({ key }) => {
            const value = tags[key]
            row[key] =
              value == null
                ? ''
                : typeof value === 'object' && 'toExifString' in value
                  ? (value as { toExifString: () => string }).toExifString()
                  : String(value)
          })
          rows.push(row)
          this.files.push({ path, size: info.size, mtimeMs: info.mtimeMs })
        } catch (error) {
          issues.push({ path, message: String(error) })
        }
      }
    }
    await walk(root)
    this.preview = {
      id: randomUUID(),
      root,
      count: this.files.length,
      issues,
      values: Object.fromEntries(
        metadataFields.map(({ key }) => [
          key,
          commonMetadata(
            rows.map((row) => row[key]),
            rows.length,
          ),
        ]),
      ) as MetadataPreview['values'],
    }
    return this.preview
  }

  getPreview = (id: unknown): MetadataPreview => {
    if (!this.preview || id !== this.preview.id)
      throw new Error('Read the folder again before applying changes.')
    return this.preview
  }

  validate = (input: unknown): MetadataChanges => {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new Error('Invalid metadata.')
    const changes: MetadataChanges = {}
    Object.entries(input).forEach(([key, value]) => {
      const field = metadataFields.find((field) => field.key === key)
      if (!field || (value !== null && typeof value !== 'string'))
        throw new Error('Invalid metadata.')
      if (typeof value === 'string') {
        if (!value.trim()) return
        const error = metadataValueError(field.key, value)
        if (error) throw new Error(`${field.label}: ${error}`)
      }
      changes[field.key] = value === null ? null : value.trim()
    })
    if (!Object.keys(changes).length)
      throw new Error('Fill in a field or select a field to delete.')
    return changes
  }

  apply = async (id: unknown, input: unknown): Promise<MetadataResult> => {
    const preview = this.getPreview(id)
    const changes = this.validate(input)
    const files = this.files
    this.preview = undefined
    const result: MetadataResult = { updated: 0, issues: [] }
    for (const file of files) {
      try {
        const info = await lstat(file.path)
        if (
          !info.isFile() ||
          info.isSymbolicLink() ||
          info.size !== file.size ||
          info.mtimeMs !== file.mtimeMs ||
          !isInsideFolder(preview.root, await realpath(file.path))
        )
          throw new Error('The file has changed since it was read. Read the folder again.')
        const written = await this.tool.write(file.path, changes as WriteTags, {
          writeArgs: ['-P', '-overwrite_original'],
        })
        const tags = await this.tool.read(file.path)
        Object.entries(changes).forEach(([key, expected]) => {
          const value = tags[key as keyof typeof tags]
          const actual =
            value == null
              ? ''
              : typeof value === 'object' && 'toExifString' in value
                ? (value as { toExifString: () => string }).toExifString()
                : String(value)
          const field = metadataFields.find((field) => field.key === key)!
          const matches =
            expected !== null && 'date' in field
              ? actual.slice(0, 19) === expected.slice(0, 19) &&
                (!expected.slice(19) ||
                  actual.slice(19).replace(/Z$/, '+00:00') ===
                    expected.slice(19).replace(/Z$/, '+00:00'))
              : actual === (expected ?? '')
          if (!matches)
            throw new Error(
              `Could not verify ${key} after writing. This format may not support the requested field.`,
            )
        })
        result.updated += written.updated
        written.warnings?.forEach((message) => result.issues.push({ path: file.path, message }))
      } catch (error) {
        result.issues.push({ path: file.path, message: String(error) })
      }
    }
    return result
  }
}
