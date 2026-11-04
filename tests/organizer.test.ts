import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { FileOrganizer } from '../src/main/organizer/FileOrganizer'
import { SafeFileMover } from '../src/main/organizer/SafeFileMover'

const noProgress = (): void => {}
const signal = (): AbortSignal => new AbortController().signal
const date = new Date(2024, 10, 12, 12).getTime()
const fixture = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'file-manager-organizer-'))
  try {
    await run(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test('organizer uses resolved dates across years and handles invalid dates', async () =>
  fixture(async (root) => {
    const dates: Record<string, number> = {
      'jan.txt': new Date(2023, 0, 1, 0, 1).getTime(),
      'dec.txt': new Date(2024, 11, 31, 23, 59).getTime(),
      'invalid.txt': Number.NaN,
    }
    await Promise.all(Object.keys(dates).map((name) => writeFile(join(root, name), name)))
    const organizer = new FileOrganizer((_info, path) => dates[basename(path)])
    const preview = await organizer.createPreview(root, signal(), noProgress)
    assert.deepEqual(
      preview.folders.map((folder) => folder.path),
      ['2023/01 - Jan', '2024/12 - Dec', 'Unknown Date'],
    )
    const result = await organizer.execute(preview.id, signal(), noProgress)
    assert.equal(result.movedFiles, 3)
    assert.deepEqual(await readdir(join(root, '2023')), ['01 - Jan'])
    assert.deepEqual(await readdir(join(root, '2024')), ['12 - Dec'])
  }))

test(
  'Windows fallback moves without overwriting and preserves creation time',
  { skip: process.platform !== 'win32' },
  async () =>
    fixture(async (root) => {
      const source = join(root, 'source.txt')
      const target = join(root, 'target.txt')
      await writeFile(source, 'source')
      await writeFile(target, 'existing')
      const birthtime = (await lstat(source)).birthtimeMs
      const mover = new SafeFileMover(async () => {
        throw Object.assign(new Error('Unsupported links'), { code: 'ENOTSUP' })
      })
      await assert.rejects(
        mover.move(source, target, async () => {}),
        { code: 'EEXIST' },
      )
      assert.equal(await readFile(source, 'utf8'), 'source')
      assert.equal(await readFile(target, 'utf8'), 'existing')
      const destination = join(root, 'new.txt')
      await mover.move(source, destination, async () => {})
      assert.equal(await readFile(destination, 'utf8'), 'source')
      assert.equal((await lstat(destination)).birthtimeMs, birthtime)
      await assert.rejects(lstat(source), { code: 'ENOENT' })
    }),
)

test('organizer previews recursively without writing, handles dates, collisions, and repeated runs', async () =>
  fixture(async (root) => {
    await mkdir(join(root, 'nested'))
    await writeFile(join(root, 'photo.jpg'), 'first')
    await writeFile(join(root, 'nested', 'photo.jpg'), 'second')
    await writeFile(join(root, 'unknown.txt'), 'unknown')
    const organizer = new FileOrganizer((_info, path) =>
      basename(path) === 'unknown.txt' ? 0 : date,
    )
    const preview = await organizer.createPreview(root, signal(), noProgress)
    assert.equal(preview.pendingFiles, 3)
    assert.equal(preview.renamedFiles, 1)
    assert.deepEqual((await readdir(root)).sort(), ['nested', 'photo.jpg', 'unknown.txt'])
    assert.deepEqual(preview.folders, [
      { path: '2024/11 - Nov', count: 2 },
      { path: 'Unknown Date', count: 1 },
    ])
    const original = await lstat(join(root, 'photo.jpg'))
    const result = await organizer.execute(preview.id, signal(), noProgress)
    assert.equal(result.movedFiles, 3)
    assert.equal(result.issues.length, 0)
    assert.equal(await readFile(join(root, '2024', '11 - Nov', 'photo.jpg'), 'utf8'), 'first')
    assert.equal(await readFile(join(root, '2024', '11 - Nov', 'photo (2).jpg'), 'utf8'), 'second')
    assert.equal(await readFile(join(root, 'Unknown Date', 'unknown.txt'), 'utf8'), 'unknown')
    assert.equal(
      (await lstat(join(root, '2024', '11 - Nov', 'photo.jpg'))).birthtimeMs,
      original.birthtimeMs,
    )
    assert.deepEqual(await readdir(join(root, '2024')), ['11 - Nov'])
    const again = await organizer.createPreview(root, signal(), noProgress)
    assert.equal(again.pendingFiles, 0)
    assert.equal(again.alreadyOrganized, 3)
    await assert.rejects(organizer.execute(preview.id, signal(), noProgress), /expired/)
  }))

test('organizer protects existing files, including collisions introduced after preview', async () =>
  fixture(async (root) => {
    await writeFile(join(root, 'file.txt'), 'source')
    const organizer = new FileOrganizer(() => date)
    const preview = await organizer.createPreview(root, signal(), noProgress)
    await mkdir(join(root, '2024', '11 - Nov'), { recursive: true })
    await writeFile(join(root, '2024', '11 - Nov', 'file.txt'), 'existing')
    const result = await organizer.execute(preview.id, signal(), noProgress)
    assert.equal(result.movedFiles, 1)
    assert.equal(result.renamedFiles, 1)
    assert.equal(await readFile(join(root, '2024', '11 - Nov', 'file.txt'), 'utf8'), 'existing')
    assert.equal(await readFile(join(root, '2024', '11 - Nov', 'file (2).txt'), 'utf8'), 'source')
  }))

test('organizer leaves changed files and creates no empty output folders on failure', async () =>
  fixture(async (root) => {
    await writeFile(join(root, 'file.txt'), 'source')
    const organizer = new FileOrganizer(() => date)
    const preview = await organizer.createPreview(root, signal(), noProgress)
    await writeFile(join(root, 'file.txt'), 'changed source')
    const result = await organizer.execute(preview.id, signal(), noProgress)
    assert.equal(result.movedFiles, 0)
    assert.match(result.issues[0].message, /changed/)
    assert.deepEqual(await readdir(root), ['file.txt'])
  }))

test('organizer cancels between files without losing completed moves', async () =>
  fixture(async (root) => {
    await writeFile(join(root, 'a.txt'), 'a')
    await writeFile(join(root, 'b.txt'), 'b')
    const organizer = new FileOrganizer(() => date)
    const preview = await organizer.createPreview(root, signal(), noProgress)
    const abort = new AbortController()
    const result = await organizer.execute(preview.id, abort.signal, () => abort.abort())
    assert.equal(result.cancelled, true)
    assert.equal(result.movedFiles, 1)
    assert.equal(await readFile(join(root, 'b.txt'), 'utf8'), 'b')
    assert.equal(await readFile(join(root, '2024', '11 - Nov', 'a.txt'), 'utf8'), 'a')
  }))

test('organizer skips junctions and refuses redirected destination folders', async () =>
  fixture(async (root) => {
    const outside = await mkdtemp(join(tmpdir(), 'file-manager-outside-'))
    try {
      await writeFile(join(root, 'file.txt'), 'source')
      await writeFile(join(outside, 'external.txt'), 'outside')
      await symlink(outside, join(root, '2024'), process.platform === 'win32' ? 'junction' : 'dir')
      const organizer = new FileOrganizer(() => date)
      const preview = await organizer.createPreview(root, signal(), noProgress)
      assert.equal(preview.totalFiles, 1)
      assert.equal(preview.pendingFiles, 0)
      assert.equal(preview.issues.length, 2)
      assert.deepEqual(await readdir(outside), ['external.txt'])
      assert.equal(await readFile(join(root, 'file.txt'), 'utf8'), 'source')
    } finally {
      await rm(outside, { recursive: true, force: true })
    }
  }))

test('organizer removes newly created empty folders when a move fails', async () =>
  fixture(async (root) => {
    await writeFile(join(root, 'file.txt'), 'source')
    const organizer = new FileOrganizer(() => date, {
      move: async () => {
        throw new Error('File is locked')
      },
    })
    const preview = await organizer.createPreview(root, signal(), noProgress)
    const result = await organizer.execute(preview.id, signal(), noProgress)
    assert.equal(result.movedFiles, 0)
    assert.match(result.issues[0].message, /locked/)
    assert.deepEqual(await readdir(root), ['file.txt'])
  }))
