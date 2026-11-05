import { reactive } from 'vue'
import type { OrganizerApi } from '../../../shared/organizer'
import { OrganizerSession } from '../models/OrganizerSession'

export class OrganizerController {
  readonly session = new OrganizerSession()
  readonly state = reactive({ busy: false, cancelling: false, message: '', isError: false })
  private unsubscribe?: () => void

  constructor(
    private readonly desktop: OrganizerApi | undefined,
    private readonly onMoved: () => void,
  ) {}

  initialize = (): void => {
    this.unsubscribe = this.desktop?.onOrganizationProgress((value) => {
      this.session.state.progress = value
    })
  }
  dispose = (): void => {
    this.unsubscribe?.()
  }
  dismissMessage = (): void => {
    this.state.message = ''
  }
  private get api(): OrganizerApi {
    if (!this.desktop)
      throw new Error('Open the app in Electron to access folders on your computer.')
    return this.desktop
  }
  private operation = async (action: () => Promise<void>): Promise<void> => {
    if (this.state.busy) return
    this.state.busy = true
    this.state.cancelling = false
    this.dismissMessage()
    try {
      await action()
    } catch (error) {
      this.state.isError = !this.state.cancelling
      this.state.message = this.state.cancelling
        ? 'Preview canceled. No files were moved.'
        : error instanceof Error
          ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
          : String(error)
    } finally {
      this.state.busy = false
      this.state.cancelling = false
    }
  }
  chooseFolder = async (): Promise<void> => {
    try {
      const folder = await this.api.chooseOrganizerFolder()
      if (folder) this.session.setFolder(folder)
    } catch (error) {
      this.state.message = String(error)
      this.state.isError = true
    }
  }
  preview = (): Promise<void> =>
    this.operation(async () => {
      this.session.state.preview = null
      this.session.state.result = null
      this.session.state.progress = { phase: 'reading', processed: 0, total: 0, currentFile: '' }
      this.session.state.preview = await this.api.previewOrganization(this.session.state.folder)
    })
  organize = (): Promise<void> =>
    this.operation(async () => {
      const preview = this.session.state.preview
      if (!preview || (!preview.pendingFiles && !this.session.state.deleteEmptyFolders)) return
      this.session.state.progress = {
        phase: 'moving',
        processed: 0,
        total: preview.pendingFiles,
        currentFile: '',
      }
      const result = await this.api.organizeFiles(preview.id, this.session.state.deleteEmptyFolders)
      if (!result) return
      this.session.state.result = result
      this.session.state.preview = null
      if (result.movedFiles) this.onMoved()
    })
  cancel = async (): Promise<void> => {
    this.state.cancelling = true
    try {
      await this.api.cancelOrganization()
    } catch (error) {
      this.state.cancelling = false
      this.state.message = String(error)
      this.state.isError = true
    }
  }
}
