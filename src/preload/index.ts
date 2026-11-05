import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi, WorkerEvent } from '../shared/types'
import type { OrganizationProgress } from '../shared/organizer'

const api: DesktopApi = {
  chooseMetadataFolder: () => ipcRenderer.invoke('metadata:choose'),
  previewMetadata: (folder) => ipcRenderer.invoke('metadata:preview', folder),
  applyMetadata: (id, changes) => ipcRenderer.invoke('metadata:apply', id, changes),
  chooseOrganizerFolder: () => ipcRenderer.invoke('organizer:choose'),
  previewOrganization: (folder) => ipcRenderer.invoke('organizer:preview', folder),
  organizeFiles: (id, deleteEmptyFolders = false) =>
    ipcRenderer.invoke('organizer:run', id, deleteEmptyFolders),
  cancelOrganization: () => ipcRenderer.invoke('organizer:cancel'),
  onOrganizationProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: OrganizationProgress): void =>
      callback(progress)
    ipcRenderer.on('organizer:progress', listener)
    return () => ipcRenderer.removeListener('organizer:progress', listener)
  },
  chooseFolder: () => ipcRenderer.invoke('folder:choose'),
  startScan: (paths, similarity) => ipcRenderer.invoke('scan:start', paths, similarity),
  cancelScan: () => ipcRenderer.invoke('scan:cancel'),
  trashFiles: (ids) => ipcRenderer.invoke('files:trash', ids),
  revealFile: (id) => ipcRenderer.invoke('file:reveal', id),
  onScanEvent: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, event: WorkerEvent): void =>
      callback(event)
    ipcRenderer.on('scan:event', listener)
    return () => ipcRenderer.removeListener('scan:event', listener)
  },
}
contextBridge.exposeInMainWorld('desktop', api)
