import { execFile } from 'node:child_process'
import { link, lstat, unlink } from 'node:fs/promises'
import { promisify } from 'node:util'

const execute = promisify(execFile)

/** Moves without replacing an existing destination or changing creation metadata. */
export class SafeFileMover {
  constructor(private readonly createLink = link) {}

  move = async (
    source: string,
    destination: string,
    validate: () => Promise<void>,
  ): Promise<void> => {
    await validate()
    try {
      await this.createLink(source, destination)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (
        process.platform !== 'win32' ||
        !['EXDEV', 'EPERM', 'ENOTSUP', 'EOPNOTSUPP', 'ENOSYS', 'EINVAL'].includes(code ?? '')
      )
        throw error
      // File.Move preserves Windows metadata and refuses to overwrite. Paths are
      // environment values, never executable PowerShell source.
      await validate()
      const script =
        "$ErrorActionPreference='Stop'; try { [IO.File]::Move($env:FILE_MANAGER_SOURCE, $env:FILE_MANAGER_DESTINATION) } catch { if ([IO.File]::Exists($env:FILE_MANAGER_DESTINATION) -or [IO.Directory]::Exists($env:FILE_MANAGER_DESTINATION)) { exit 17 }; [Console]::Error.WriteLine($_.Exception.Message); exit 1 }"
      try {
        await execute(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-EncodedCommand',
            Buffer.from(script, 'utf16le').toString('base64'),
          ],
          {
            windowsHide: true,
            env: {
              ...process.env,
              FILE_MANAGER_SOURCE: source,
              FILE_MANAGER_DESTINATION: destination,
            },
          },
        )
      } catch (failure) {
        if ((failure as { code?: number }).code === 17)
          throw Object.assign(new Error('Destination already exists.'), { code: 'EEXIST' })
        throw failure
      }
      return
    }
    const identity = await lstat(destination)
    try {
      await validate()
      await unlink(source)
    } catch (error) {
      const current = await lstat(destination).catch(() => null)
      if (current?.ino === identity.ino && current?.dev === identity.dev) await unlink(destination)
      throw error
    }
  }
}
