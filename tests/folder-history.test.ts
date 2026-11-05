import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FolderHistory } from '../src/main/FolderHistory'

test('folder history persists recency and falls back through missing folders', async () => {
  const root = await mkdtemp(join(tmpdir(), 'folder-history-'))
  try {
    const folders = [join(root, 'first'), join(root, 'second'), join(root, 'third')]
    await Promise.all(folders.map((folder) => mkdir(folder)))
    const paths = await Promise.all(folders.map((folder) => realpath(folder)))
    const file = join(root, 'settings', 'history.json')
    const history = new FolderHistory(file)
    assert.equal(await history.latestExisting(), undefined)
    await history.remember(paths[0])
    await history.remember(paths[1])
    await history.remember(paths[2])
    assert.equal(await new FolderHistory(file).latestExisting(), paths[2])
    await rm(paths[2], { recursive: true })
    assert.equal(await history.latestExisting(), paths[1])
    await rm(paths[1], { recursive: true })
    assert.equal(await history.latestExisting(), paths[0])
    await history.remember(paths[0])
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), [paths[0], paths[2], paths[1]])
    await rm(paths[0], { recursive: true })
    assert.equal(await history.latestExisting(), undefined)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('invalid history and paths that became files do not prevent folder selection', async () => {
  const root = await mkdtemp(join(tmpdir(), 'folder-history-'))
  try {
    const file = join(root, 'history.json')
    await writeFile(file, 'invalid json', 'utf8')
    const history = new FolderHistory(file)
    assert.equal(await history.latestExisting(), undefined)
    const folder = join(root, 'photos')
    await mkdir(folder)
    await history.remember(folder)
    await rm(folder, { recursive: true })
    await writeFile(folder, 'file instead of folder', 'utf8')
    assert.equal(await new FolderHistory(file).latestExisting(), undefined)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
