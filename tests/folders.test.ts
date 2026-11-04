import assert from 'node:assert/strict'
import { dirname, join, parse } from 'node:path'
import { test } from 'node:test'
import { getFolderPickerDirectory } from '../src/main/folders'

const root = parse(process.cwd()).root
const photos = join(root, 'photos')

test('remembers the parent of a single selection', () => {
  assert.equal(getFolderPickerDirectory([join(photos, 'trip')]), photos)
  assert.equal(getFolderPickerDirectory([root]), root)
  assert.equal(getFolderPickerDirectory([]), undefined)
})

test('finds the deepest shared directory, comparing full path segments', () => {
  assert.equal(
    getFolderPickerDirectory([join(photos, 'trip', 'day1'), join(photos, 'trip', 'day2')]),
    join(photos, 'trip'),
  )
  assert.equal(getFolderPickerDirectory([photos, join(photos, 'trip')]), photos)
  assert.equal(getFolderPickerDirectory([join(root, 'photos-one'), join(root, 'photos-two')]), root)
})

test(
  'falls back to the last selection parent when drives have no common directory',
  { skip: process.platform !== 'win32' },
  () => {
    const last = 'D:\\videos\\trip'
    assert.equal(getFolderPickerDirectory(['C:\\photos\\trip', last]), dirname(last))
  },
)
