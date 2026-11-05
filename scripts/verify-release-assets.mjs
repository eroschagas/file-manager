import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { installerFiles, projectRoot } from './installer-files.mjs'

for (const name of Object.values(installerFiles)) {
  const path = join(projectRoot, 'installers', name)
  const info = await stat(path)
  if (!info.isFile() || !info.size) throw new Error(`Installer is missing or empty: ${name}`)
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  const expected = `${hash.digest('hex')}  ${name}`
  if ((await readFile(`${path}.sha256`, 'utf8')).trim() !== expected)
    throw new Error(`Installer checksum does not match: ${name}`)
  console.log(`Verified ${name}`)
}
