import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi, WorkerEvent } from '../shared/types'

const api: DesktopApi = {
  chooseFolder: () => ipcRenderer.invoke('folder:choose'),
  startScan: (path) => ipcRenderer.invoke('scan:start', path),
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
