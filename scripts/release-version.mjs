import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { projectRoot } from './installer-files.mjs'

const packageJson = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'))
const lock = JSON.parse(await readFile(join(projectRoot, 'package-lock.json'), 'utf8'))
if (packageJson.version !== lock.version || packageJson.version !== lock.packages[''].version)
  throw new Error('package.json and package-lock.json must have the same version.')
console.log(packageJson.version)
