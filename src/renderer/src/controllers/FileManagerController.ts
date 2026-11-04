import { nextTick, reactive } from 'vue'
import type { DesktopApi, MediaFile, WorkerEvent } from '../../../shared/types'
import { FolderSelection } from '../models/FolderSelection'
import { ScanSession } from '../models/ScanSession'
import { ReviewSession } from '../models/ReviewSession'

export class FileManagerController {
  readonly folders = new FolderSelection()
  readonly scan = new ScanSession()
  readonly review = new ReviewSession(this.scan)
  readonly state = reactive({
    screen: 'setup' as 'setup' | 'scanning' | 'results',
    starting: false,
    cancelling: false,
    deleting: false,
    message: '',
    isError: false,
    previewFile: null as MediaFile | null,
  })
  private unsubscribe?: () => void

  constructor(private readonly desktop: DesktopApi | undefined) {}

  initialize = (): void => {
    this.unsubscribe = this.desktop?.onScanEvent(this.onScanEvent)
    if (!this.desktop)
      this.showMessage(
        'Open the app in Electron using npm run dev to access folders on your computer.',
        true,
      )
  }

  dispose = (): void => {
    this.unsubscribe?.()
    this.unsubscribe = undefined
  }

  private get api(): DesktopApi {
    if (!this.desktop)
      throw new Error(
        'Open the app in Electron using npm run dev to access folders on your computer.',
      )
    return this.desktop
  }

  private showMessage = (text: string, error = false): void => {
    this.state.message = text
    this.state.isError = error
  }

  private reportError = (error: unknown): void => {
    const message =
      error instanceof Error
        ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
        : String(error)
    this.showMessage(message, true)
  }

  dismissMessage = (): void => {
    this.state.message = ''
  }

  chooseFolder = async (index: number): Promise<void> => {
    try {
      this.folders.replacePath(index, await this.api.chooseFolder())
    } catch (error) {
      this.reportError(error)
    }
  }

  startScan = async (): Promise<void> => {
    if (this.state.starting || !this.folders.selectedFolders.length) return
    this.state.starting = true
    this.dismissMessage()
    this.state.screen = 'scanning'
    this.scan.begin()
    this.review.reset()
    try {
      await this.api.startScan(this.folders.selectedFolders, this.folders.state.similarity)
    } catch (error) {
      this.state.screen = 'setup'
      this.reportError(error)
    } finally {
      this.state.starting = false
    }
  }

  cancelScan = async (): Promise<void> => {
    this.state.cancelling = true
    try {
      await this.api.cancelScan()
    } catch (error) {
      this.state.cancelling = false
      this.reportError(error)
    }
  }

  toggleSelection = (id: string): void => {
    if (!this.state.deleting) this.review.toggleFile(id)
  }
  openPreview = (file: MediaFile): void => {
    this.state.previewFile = file
  }
  closePreview = (): void => {
    this.state.previewFile = null
  }

  trashSelected = async (): Promise<void> => {
    if (!this.review.selectedFiles.length || this.state.deleting) return
    this.state.deleting = true
    try {
      this.closePreview()
      await nextTick()
      const response = await this.api.trashFiles([...this.review.state.selectedIds])
      this.review.applyTrashResult(response)
      const count = new Set(response.deletedIds).size
      if (response.errors.length)
        this.showMessage(
          `${count} file(s) moved. ${response.errors.length} failure(s): ${response.errors.map((entry) => `${entry.path}: ${entry.message}`).join(' · ')}`,
          true,
        )
      else if (count)
        this.showMessage(
          `${count} file(s) moved to the Recycle Bin. You can restore them from the system Recycle Bin.`,
        )
    } catch (error) {
      this.reportError(error)
    } finally {
      this.state.deleting = false
    }
  }

  revealFile = async (id: string): Promise<void> => {
    try {
      await this.api.revealFile(id)
    } catch (error) {
      this.reportError(error)
    }
  }

  goHome = (): void => {
    if (this.state.screen === 'scanning' || this.state.deleting || this.state.starting) return
    this.state.screen = 'setup'
    this.folders.resetPaths()
    this.review.clearSelection()
    this.dismissMessage()
  }

  private onScanEvent = (event: WorkerEvent): void => {
    if (event.type === 'progress') this.scan.updateProgress(event.progress)
    else if (event.type === 'complete') {
      this.scan.complete(event.result)
      this.review.begin(event.result)
      this.state.screen = 'results'
      this.state.cancelling = false
    } else {
      this.state.screen = 'setup'
      this.state.cancelling = false
      this.showMessage(
        event.type === 'cancelled' ? 'Scan canceled. No files were removed.' : event.message,
        event.type === 'error',
      )
    }
  }
}
