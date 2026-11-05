import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { promisify } from 'node:util'

const require = createRequire(import.meta.url)
const execute = promisify(execFile)
const platform = process.argv[2]
const nativePlatforms = { win: 'win32', mac: 'darwin', linux: 'linux' }
if (
  platform &&
  (!Object.hasOwn(nativePlatforms, platform) ||
    nativePlatforms[platform] !== process.platform ||
    process.arch !== 'x64')
)
  throw new Error('Build each x64 installer on its matching x64 operating system.')
const binaries = { FFmpeg: require('ffmpeg-static'), FFprobe: require('ffprobe-static').path }
for (const [name, path] of Object.entries(binaries)) {
  if (!path) throw new Error(`${name} is unavailable for this operating system.`)
  const { stdout } = await execute(path, ['-version'], { windowsHide: true, timeout: 15_000 })
  console.log(`${name} (${process.platform}/${process.arch}): ${stdout.split(/\r?\n/)[0]}`)
}
