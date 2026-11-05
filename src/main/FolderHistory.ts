import { mkdir, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute } from 'node:path'

export class FolderHistory {
  private folders: string[] = []
  private loaded?: Promise<void>
  private pending: Promise<void> = Promise.resolve()

  constructor(private readonly file: string) {}

  private load = (): Promise<void> => {
    this.loaded ??= (async () => {
      try {
        const value: unknown = JSON.parse(await readFile(this.file, 'utf8'))
        if (Array.isArray(value))
          this.folders = value.filter(
            (folder): folder is string => typeof folder === 'string' && isAbsolute(folder),
          )
      } catch {
        // Missing or invalid history starts empty; folder selection remains available.
      }
    })()
    return this.loaded
  }

  latestExisting = async (): Promise<string | undefined> => {
    await this.load()
    await this.pending
    for (const folder of this.folders) {
      try {
        if ((await stat(folder)).isDirectory()) return folder
      } catch {
        // Continue through history when a folder is missing or inaccessible.
      }
    }
    return undefined
  }

  remember = async (folder: string): Promise<void> => {
    await this.load()
    const save = this.pending.then(async () => {
      const resolved = await realpath(folder)
      if (!(await stat(resolved)).isDirectory()) return
      const key = (path: string): string =>
        process.platform === 'win32' ? path.toLowerCase() : path
      this.folders = [resolved, ...this.folders.filter((path) => key(path) !== key(resolved))]
      await mkdir(dirname(this.file), { recursive: true })
      await writeFile(`${this.file}.tmp`, JSON.stringify(this.folders), 'utf8')
      await rename(`${this.file}.tmp`, this.file)
    })
    this.pending = save.catch((error: unknown) =>
      console.warn('Could not save folder history:', error),
    )
    await this.pending
  }
}
