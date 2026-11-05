import { dialog, type BrowserWindow } from 'electron'
import { dirname } from 'node:path'
import { FileOrganizer } from './FileOrganizer'

export class OrganizerIpc {
  busy = false
  private abort?: AbortController
  private pickerDirectory?: string
  private readonly organizer = new FileOrganizer()

  cancel = (): void => {
    this.abort?.abort()
  }

  register = (
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => void,
    getWindow: () => BrowserWindow | null,
    otherBusy: () => boolean,
    onMoved: () => Promise<void>,
    prepareMove: () => Promise<() => void>,
  ): void => {
    handle('organizer:choose', async () => {
      const selection = await dialog.showOpenDialog(getWindow()!, {
        title: 'Choose a folder to organize',
        properties: ['openDirectory'],
        defaultPath: this.pickerDirectory,
      })
      if (selection.canceled || !selection.filePaths.length) return null
      this.pickerDirectory = dirname(selection.filePaths[0])
      return selection.filePaths[0]
    })
    const operation = async <T>(action: (signal: AbortSignal) => Promise<T>): Promise<T> => {
      if (this.busy || otherBusy()) throw new Error('Wait for the current operation to finish.')
      this.busy = true
      this.abort = new AbortController()
      try {
        return await action(this.abort.signal)
      } finally {
        this.busy = false
        this.abort = undefined
      }
    }
    const progress: Parameters<FileOrganizer['createPreview']>[2] = (value) => {
      const window = getWindow()
      if (window && !window.isDestroyed()) window.webContents.send('organizer:progress', value)
    }
    handle('organizer:preview', (folder) =>
      operation(async (signal) => {
        if (typeof folder !== 'string' || !folder.trim()) throw new Error('Choose a folder first.')
        return this.organizer.createPreview(folder.trim(), signal, progress)
      }),
    )
    handle('organizer:run', (id, deleteEmptyFolders = false) =>
      operation(async (signal) => {
        if (typeof id !== 'string') throw new Error('Invalid preview.')
        if (typeof deleteEmptyFolders !== 'boolean') throw new Error('Invalid cleanup option.')
        const preview = this.organizer.getPreview(id)
        const confirmation = await dialog.showMessageBox(getWindow()!, {
          type: 'question',
          title: 'Organize files',
          message: `Move ${preview.pendingFiles} file(s) into date folders?`,
          detail: `Folder: ${preview.root}\n\nIncludes files in subfolders. Files move into Year/MM - Mon folders (for example, 2026/11 - Nov). Photos and videos use the capture date in their metadata, falling back to the file modification date. Other files use their modification date. Files without either valid date go into Unknown Date. Existing files will never be overwritten.${deleteEmptyFolders ? '\n\nEmpty subfolders will be deleted only after file organization finishes. The selected root folder is preserved. Cleanup is skipped if organization is canceled.' : ''}`,
          buttons: ['Cancel', 'Organize files'],
          defaultId: 0,
          cancelId: 0,
          noLink: true,
        })
        if (confirmation.response !== 1 || signal.aborted) return null
        const release = await prepareMove()
        try {
          const result = await this.organizer.execute(id, signal, progress, deleteEmptyFolders)
          if (result.movedFiles) await onMoved()
          return result
        } finally {
          release()
        }
      }),
    )
    handle('organizer:cancel', this.cancel)
  }
}
