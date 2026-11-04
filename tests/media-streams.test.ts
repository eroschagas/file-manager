import assert from 'node:assert/strict'
import { createReadStream } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { MediaStreams, trashErrorMessage } from '../src/main/media-streams'

test('closes active and opening preview handles before allowing the trash operation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'media-streams-'))
  try {
    const path = join(directory, 'preview.bin')
    await writeFile(path, Buffer.alloc(1024 * 1024))
    const registry = new MediaStreams()
    const openStream = createReadStream(path)
    await new Promise<void>((resolve) => openStream.once('open', () => resolve()))
    const openingStream = createReadStream(path)
    registry.track('file', openStream)
    registry.track('file', openingStream)
    await registry.blockAndClose(['file'])
    assert.equal(openStream.closed, true)
    assert.equal(openingStream.closed, true)
    assert.equal(registry.isBlocked('file'), true)
    registry.unblock(['file'])
    assert.equal(registry.isBlocked('file'), false)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('explains native abort errors without claiming a specific cause', () => {
  assert.match(trashErrorMessage(new Error('Operation was aborted')), /O Windows interrompeu/)
  assert.match(trashErrorMessage(new Error('Operation was aborted')), /Operation was aborted/)
  assert.equal(trashErrorMessage(new Error('Access denied')), 'Access denied')
})
