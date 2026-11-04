import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computed } from 'vue'
import type {
  DesktopApi,
  MediaFile,
  ScanResult,
  SimilarityLevel,
  TrashResult,
  WorkerEvent,
} from '../src/shared/types'
import { FileManagerController } from '../src/renderer/src/controllers/FileManagerController'
import { FolderSelection } from '../src/renderer/src/models/FolderSelection'
import { ReviewSession } from '../src/renderer/src/models/ReviewSession'
import { ScanSession } from '../src/renderer/src/models/ScanSession'

const file = (id: string, size: number): MediaFile => ({
  id,
  size,
  path: `/photos/${id}.jpg`,
  relativePath: `${id}.jpg`,
  name: `${id}.jpg`,
  kind: 'image',
  mtimeMs: 0,
  width: 100,
  height: 100,
  sha256: id,
  hashes: [],
  thumbnailPath: '',
})
const result = (): ScanResult => ({
  roots: ['/photos'],
  groups: [
    {
      id: 'group',
      kind: 'image',
      match: 'similar',
      files: [file('large', 300), file('medium', 200), file('small', 100)],
    },
  ],
  totalFiles: 3,
  analyzedFiles: 3,
  issues: [],
  elapsedMs: 100,
})

class FakeDesktop implements Pick<
  DesktopApi,
  'chooseFolder' | 'startScan' | 'cancelScan' | 'trashFiles' | 'revealFile' | 'onScanEvent'
> {
  listener?: (event: WorkerEvent) => void
  requestedScan?: { paths: string[]; similarity: SimilarityLevel }
  trashResult: TrashResult = { deletedIds: [], errors: [] }
  failTrash = false
  chooseFolder = async (): Promise<string[]> => ['/photos', '/videos']
  startScan = async (paths: string[], similarity: SimilarityLevel): Promise<void> => {
    this.requestedScan = { paths, similarity }
  }
  cancelScan = async (): Promise<void> => {}
  revealFile = async (): Promise<void> => {}
  trashFiles = async (): Promise<TrashResult> => {
    if (this.failTrash) throw new Error('Operation failed')
    return this.trashResult
  }
  onScanEvent = (listener: (event: WorkerEvent) => void): (() => void) => {
    this.listener = listener
    return () => {
      this.listener = undefined
    }
  }
}

test('folder model preserves similarity while clearing or replacing folder inputs', () => {
  const folders = new FolderSelection()
  folders.state.similarity = 'flexible'
  folders.setPath(0, ' /photos ')
  folders.addPath()
  folders.setPath(1, '/photos')
  folders.replacePath(0, ['/photos', '/videos'])
  assert.deepEqual(folders.selectedFolders, ['/photos', '/videos'])
  folders.resetPaths()
  assert.deepEqual(folders.state.paths, [''])
  assert.equal(folders.state.similarity, 'flexible')
})

test('review model keeps counts reactive, allows selecting all, and preserves failed selections', () => {
  const scan = new ScanSession()
  const review = new ReviewSession(scan)
  const data = result()
  scan.complete(data)
  review.begin(data)
  const count = computed(() => review.selectedCounts.group)
  assert.equal(count.value, 2)
  assert.equal(review.selectedFiles[0].id, 'medium')
  review.toggleFile('large')
  assert.equal(count.value, 3)
  assert.equal(review.selectedSize, 600)
  review.applyTrashResult({
    deletedIds: ['large'],
    errors: [{ id: 'small', path: '/photos/small.jpg', message: 'In use' }],
  })
  assert.equal(count.value, 2)
  assert.deepEqual(
    review.selectedFiles.map((entry) => entry.id),
    ['medium', 'small'],
  )
  assert.equal(review.state.removedCount, 1)
  review.setFilter('video')
  assert.equal((() => review.activeGroup)(), undefined)
  review.setFilter('all')
  assert.equal(review.activeGroup?.id, 'group')
})

test('controller coordinates scan events, failed trash, cancellation, and listener cleanup', async () => {
  const desktop = new FakeDesktop()
  const controller = new FileManagerController(desktop)
  controller.initialize()
  await controller.chooseFolder(0)
  controller.folders.state.similarity = 'strict'
  await controller.startScan()
  assert.deepEqual(desktop.requestedScan, { paths: ['/photos', '/videos'], similarity: 'strict' })
  assert.equal(controller.state.screen, 'scanning')
  desktop.listener?.({
    type: 'progress',
    progress: { phase: 'analyzing', total: 4, processed: 1, currentFile: 'photo.jpg', skipped: 0 },
  })
  assert.equal(controller.scan.percent, 25)
  desktop.listener?.({ type: 'complete', result: result() })
  assert.equal(controller.state.screen, 'results')
  controller.openPreview(controller.review.selectedFiles[0])
  desktop.failTrash = true
  await controller.trashSelected()
  assert.equal(controller.state.previewFile, null)
  assert.equal(controller.state.deleting, false)
  assert.equal(controller.state.isError, true)
  assert.equal(controller.review.selectedFiles[0].id, 'medium')
  controller.goHome()
  assert.deepEqual(controller.folders.state.paths, [''])
  assert.equal(controller.folders.state.similarity, 'strict')
  assert.equal(controller.review.selectedFiles.length, 0)
  desktop.listener?.({ type: 'cancelled' })
  assert.equal(controller.state.message, 'Scan canceled. No files were removed.')
  controller.dispose()
  assert.equal(desktop.listener, undefined)
})

test('review preserves the highest-resolution file and group toggles leave other groups unchanged', () => {
  const scan = new ScanSession()
  const review = new ReviewSession(scan)
  const data = result()
  data.groups[0].files[2].width = 200
  data.groups.push({
    id: 'other',
    kind: 'image',
    match: 'exact',
    files: [file('other-small', 50), file('other-large', 500)],
  })
  scan.complete(data)
  review.begin(data)
  assert.equal(review.highestResolutionId, 'small')
  assert.deepEqual([...review.state.selectedIds], ['large', 'medium', 'other-small'])
  assert.equal(review.potentialSpace, 550)
  review.toggleGroupSelection()
  assert.deepEqual([...review.state.selectedIds], ['other-small'])
  review.toggleGroupSelection()
  assert.equal(review.selectedCounts.group, 3)
  assert.equal(review.selectedCounts.other, 1)
  review.toggleFile('large')
  review.toggleGroupSelection()
  assert.equal(review.selectedCounts.group, 0)
  assert.equal(review.selectedCounts.other, 1)
  review.selectGroup('other')
  assert.equal(review.highestResolutionId, 'other-large')
  review.toggleGroupSelection()
  assert.equal(review.selectedFiles.length, 0)
  review.setFilter('video')
  review.toggleGroupSelection()
  assert.equal(review.selectedFiles.length, 0)
})

test('group navigation respects filters and boundaries without changing selections', () => {
  const scan = new ScanSession()
  const review = new ReviewSession(scan)
  const data = result()
  data.groups.push(
    { id: 'video', kind: 'video', match: 'exact', files: [file('v1', 200), file('v2', 100)] },
    { id: 'last', kind: 'image', match: 'exact', files: [file('p1', 200), file('p2', 100)] },
  )
  scan.complete(data)
  review.begin(data)
  const selected = [...review.state.selectedIds]
  review.navigateGroup(-1)
  assert.equal(review.activeGroup?.id, 'group')
  review.navigateGroup(1)
  assert.equal(review.activeGroup?.id, 'video')
  review.navigateGroup(1)
  review.navigateGroup(1)
  assert.equal(review.activeGroup?.id, 'last')
  review.setFilter('image')
  assert.equal(review.activeGroupIndex, 1)
  review.navigateGroup(-1)
  assert.equal(review.activeGroup?.id, 'group')
  review.navigateGroup(1)
  assert.equal(review.activeGroup?.id, 'last')
  assert.deepEqual([...review.state.selectedIds], selected)
  review.setFilter('video')
  review.applyTrashResult({ deletedIds: ['v1'], errors: [] })
  review.navigateGroup(1)
  assert.equal(review.activeGroupIndex, -1)
})
