import { randomUUID } from 'node:crypto'
import type { Stats } from 'node:fs'
import { lstat, mkdir, readdir, realpath, rmdir } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, sep } from 'node:path'
import type {
  OrganizationPreview,
  OrganizationProgress,
  OrganizationResult,
} from '../../shared/organizer'
import { SafeFileMover } from './SafeFileMover'
import { MediaDateReader } from './MediaDateReader'
import { isInsideFolder } from '../folders'

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
interface Entry {
  source: string
  target: string
  folder: string
  info: Stats
}
interface Plan {
  preview: OrganizationPreview
  entries: Entry[]
}
type Progress = (progress: OrganizationProgress) => void
const message = (error: unknown): string => (error instanceof Error ? error.message : String(error))
const key = (path: string): string => (process.platform === 'win32' ? path.toLowerCase() : path)
const exists = async (path: string): Promise<boolean> => {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

export class FileOrganizer {
  private plan: Plan | null = null
  constructor(
    private readonly captureTime: (
      info: Stats,
      path: string,
      signal: AbortSignal,
    ) => number | Promise<number> = new MediaDateReader().read,
    private readonly mover: Pick<SafeFileMover, 'move'> = new SafeFileMover(),
  ) {}

  getPreview = (id: string): OrganizationPreview => {
    if (!this.plan || this.plan.preview.id !== id)
      throw new Error('Preview expired. Preview the folder again.')
    return this.plan.preview
  }

  private dateFolder = async (info: Stats, path: string, signal: AbortSignal): Promise<string> => {
    const timestamp = await this.captureTime(info, path, signal)
    const date = new Date(timestamp)
    const year = date.getFullYear()
    return Number.isFinite(timestamp) && timestamp !== 0 && year >= 1 && year <= 9999
      ? `${String(year).padStart(4, '0')}/${String(date.getMonth() + 1).padStart(2, '0')} - ${months[date.getMonth()]}`
      : 'Unknown Date'
  }

  private directory = async (root: string, folder: string, created?: string[]): Promise<void> => {
    let current = root
    for (const part of folder.split('/')) {
      current = join(current, part)
      try {
        const info = await lstat(current)
        if (!info.isDirectory() || info.isSymbolicLink())
          throw new Error(`Destination is not a regular folder: ${current}`)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        if (!created) return
        try {
          await mkdir(current)
          created.push(current)
        } catch (failure) {
          if ((failure as NodeJS.ErrnoException).code !== 'EEXIST') throw failure
          const info = await lstat(current)
          if (!info.isDirectory() || info.isSymbolicLink())
            throw new Error(`Invalid destination: ${current}`)
        }
      }
    }
  }

  private availableTarget = async (
    directory: string,
    name: string,
    reserved: Set<string>,
  ): Promise<string> => {
    const extension = extname(name)
    const stem = basename(name, extension)
    let index = 1
    let target = join(directory, name)
    while (reserved.has(key(target)) || (await exists(target))) {
      index += 1
      target = join(directory, `${stem} (${index})${extension}`)
    }
    reserved.add(key(target))
    return target
  }

  createPreview = async (
    folder: string,
    signal: AbortSignal,
    progress: Progress,
  ): Promise<OrganizationPreview> => {
    this.plan = null
    if (!isAbsolute(folder)) throw new Error('Enter an absolute folder path.')
    const root = await realpath(folder)
    if (!(await lstat(root)).isDirectory()) throw new Error('Choose a folder.')
    const preview: OrganizationPreview = {
      id: randomUUID(),
      root,
      totalFiles: 0,
      pendingFiles: 0,
      alreadyOrganized: 0,
      renamedFiles: 0,
      folders: [],
      issues: [],
    }
    const files: { source: string; info: Stats }[] = []
    let lastUpdate = 0
    const notify = (
      phase: OrganizationProgress['phase'],
      processed: number,
      total: number,
      currentFile: string,
      force = false,
    ): void => {
      if (force || Date.now() - lastUpdate > 100) {
        progress({ phase, processed, total, currentFile })
        lastUpdate = Date.now()
      }
    }
    notify('reading', 0, 0, root, true)
    const pending = [root]
    while (pending.length) {
      signal.throwIfAborted()
      const directory = pending.pop()!
      try {
        const info = await lstat(directory)
        if (!info.isDirectory() || info.isSymbolicLink()) continue
        const names = await readdir(directory)
        for (const name of names.sort()) {
          signal.throwIfAborted()
          const source = join(directory, name)
          try {
            const info = await lstat(source)
            if (info.isSymbolicLink()) {
              preview.issues.push({
                path: source,
                message: 'Symbolic links and junctions are skipped.',
              })
              continue
            }
            if (info.isDirectory()) pending.push(source)
            else if (info.isFile()) files.push({ source, info })
            notify('reading', files.length, 0, source)
          } catch (error) {
            preview.issues.push({ path: source, message: message(error) })
          }
        }
      } catch (error) {
        if (signal.aborted) throw error
        preview.issues.push({ path: directory, message: message(error) })
      }
    }
    preview.totalFiles = files.length
    const reserved = new Set<string>()
    const entries: Entry[] = []
    const counts = new Map<string, number>()
    notify('planning', 0, files.length, '', true)
    for (const [index, file] of files.entries()) {
      signal.throwIfAborted()
      notify('planning', index, files.length, file.source)
      const bucket = await this.dateFolder(file.info, file.source, signal)
      signal.throwIfAborted()
      const destination = join(root, ...bucket.split('/'))
      try {
        if (key(dirname(file.source)) === key(destination)) preview.alreadyOrganized += 1
        else {
          await this.directory(root, bucket)
          const target = await this.availableTarget(destination, basename(file.source), reserved)
          entries.push({ ...file, target, folder: bucket })
          if (basename(target) !== basename(file.source)) preview.renamedFiles += 1
        }
        counts.set(bucket, (counts.get(bucket) ?? 0) + 1)
      } catch (error) {
        preview.issues.push({ path: file.source, message: message(error) })
      }
      notify('planning', index + 1, files.length, file.source, index + 1 === files.length)
    }
    preview.pendingFiles = entries.length
    preview.folders = [...counts]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, count]) => ({ path, count }))
    this.plan = { preview, entries }
    return preview
  }

  execute = async (
    id: string,
    signal: AbortSignal,
    progress: Progress,
    deleteEmptyFolders = false,
  ): Promise<OrganizationResult> => {
    const preview = this.getPreview(id)
    const entries = this.plan!.entries
    this.plan = null
    const result: OrganizationResult = {
      root: preview.root,
      movedFiles: 0,
      alreadyOrganized: preview.alreadyOrganized,
      renamedFiles: 0,
      cancelled: false,
      folders: [],
      issues: [...preview.issues],
    }
    const counts = new Map<string, number>()
    const created: string[] = []
    try {
      for (const [index, entry] of entries.entries()) {
        if (signal.aborted) {
          result.cancelled = true
          break
        }
        try {
          const validate = async (): Promise<void> => {
            if ((await realpath(preview.root)) !== preview.root)
              throw new Error('The selected folder has changed.')
            const info = await lstat(entry.source)
            const resolved = await realpath(entry.source)
            const local = relative(preview.root, resolved)
            if (
              !local ||
              local === '..' ||
              local.startsWith(`..${sep}`) ||
              isAbsolute(local) ||
              !info.isFile() ||
              info.isSymbolicLink() ||
              info.size !== entry.info.size ||
              info.mtimeMs !== entry.info.mtimeMs ||
              info.ino !== entry.info.ino ||
              info.dev !== entry.info.dev ||
              info.birthtimeMs !== entry.info.birthtimeMs
            )
              throw new Error('The file has changed since the preview. Preview again.')
          }
          await validate()
          await this.directory(preview.root, entry.folder, created)
          let target = entry.target
          while (true) {
            try {
              await this.mover.move(entry.source, target, validate)
              break
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
              target = await this.availableTarget(
                dirname(target),
                basename(entry.source),
                new Set(),
              )
            }
          }
          result.movedFiles += 1
          if (basename(target) !== basename(entry.source)) result.renamedFiles += 1
          counts.set(entry.folder, (counts.get(entry.folder) ?? 0) + 1)
        } catch (error) {
          result.issues.push({ path: entry.source, message: message(error) })
        }
        progress({
          phase: 'moving',
          processed: index + 1,
          total: entries.length,
          currentFile: entry.source,
        })
      }
    } finally {
      // Only remove empty directories created by this operation.
      for (const directory of created.reverse()) await rmdir(directory).catch(() => undefined)
    }
    if (deleteEmptyFolders && !result.cancelled && !signal.aborted)
      await this.deleteEmptySubfolders(preview.root, signal, result)
    result.folders = [...counts].map(([path, count]) => ({ path, count }))
    return result
  }

  private deleteEmptySubfolders = async (
    root: string,
    signal: AbortSignal,
    result: OrganizationResult,
  ): Promise<void> => {
    const validate = async (path: string): Promise<void> => {
      if ((await realpath(root)) !== root || !isInsideFolder(root, path))
        throw new Error('The selected folder has changed.')
      const info = await lstat(path)
      if (!info.isDirectory() || info.isSymbolicLink() || (await realpath(path)) !== path)
        throw new Error('Symbolic links and junctions are skipped.')
    }
    const visit = async (directory: string): Promise<void> => {
      if (signal.aborted) return
      try {
        if (directory === root) {
          if ((await realpath(root)) !== root) throw new Error('The selected folder has changed.')
        } else await validate(directory)
        const entries = await readdir(directory, { withFileTypes: true })
        for (const entry of entries) {
          if (signal.aborted) return
          if (entry.isDirectory() && !entry.isSymbolicLink())
            await visit(join(directory, entry.name))
        }
        if (directory === root || signal.aborted) return
        await validate(directory)
        // rmdir is nonrecursive: a folder containing any file is never removed.
        await rmdir(directory)
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (!['ENOTEMPTY', 'EEXIST', 'ENOENT'].includes(code ?? ''))
          result.issues.push({ path: directory, message: message(error) })
      }
    }
    await visit(root)
    if (signal.aborted) result.cancelled = true
  }
}
