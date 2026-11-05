import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { installerFiles, projectRoot } from './installer-files.mjs'

const platform = process.argv[2]
const nativePlatforms = { win: 'win32', mac: 'darwin', linux: 'linux' }
if (!Object.hasOwn(installerFiles, platform)) throw new Error('Choose win, mac, or linux.')
if (nativePlatforms[platform] !== process.platform || process.arch !== 'x64')
  throw new Error('Build each x64 installer on its matching x64 operating system.')

const name = installerFiles[platform]
const source = join(projectRoot, 'release', name)
const info = await stat(source)
if (!info.isFile() || !info.size) throw new Error(`Installer is missing or empty: ${source}`)
const directory = join(projectRoot, 'installers')
await mkdir(directory, { recursive: true })
const destination = join(directory, name)
await copyFile(source, destination)
const hash = createHash('sha256')
for await (const chunk of createReadStream(destination)) hash.update(chunk)
await writeFile(`${destination}.sha256`, `${hash.digest('hex')}  ${name}\n`, 'utf8')
console.log(`Installer: ${destination} (${info.size} bytes)`)
console.log(`Checksum: ${destination}.sha256`)
