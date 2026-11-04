import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from 'electron'
import { createReadStream } from 'node:fs'
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, stat } from 'node:fs/promises'
import { extname, isAbsolute, join, relative } from 'node:path'
import { Readable } from 'node:stream'
import { pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import type { MediaFile, ScanResult, TrashResult, WorkerEvent } from '../shared/types'
import { MediaStreams, trashErrorMessage } from './media-streams'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
])

let window: BrowserWindow | null = null
let worker: Worker | null = null
let result: ScanResult | null = null
let trashBusy = false
let sessionDirectory = ''
const mediaFiles = new Map<string, MediaFile>()
const mediaStreams = new MediaStreams()

const emit = (event: WorkerEvent): void => {
  if (window && !window.isDestroyed()) window.webContents.send('scan:event', event)
}

const createWindow = (): void => {
  window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 900,
    minHeight: 650,
    title: 'File Manager',
    backgroundColor: '#f7f8fa',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.on('will-attach-webview', (event) => event.preventDefault())
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  )
  window.webContents.on('before-input-event', (event, input) => {
    if (!app.isPackaged && input.control && input.shift && input.key.toLowerCase() === 'i') {
      event.preventDefault()
      window?.webContents.toggleDevTools()
    }
  })
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else void window.loadFile(join(__dirname, '../renderer/index.html'))
  window.on('closed', () => {
    window = null
    worker?.postMessage('cancel')
  })
}

const inside = (root: string, target: string): boolean => {
  const path = relative(root, target)
  return (
    path !== '' &&
    path !== '..' &&
    !path.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) &&
    !isAbsolute(path)
  )
}

const unchangedFile = async (file: MediaFile): Promise<void> => {
  const info = await lstat(file.path)
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.size !== file.size ||
    info.mtimeMs !== file.mtimeMs
  ) {
    throw new Error('Arquivo alterado desde a análise. Analise a pasta novamente.')
  }
  const resolved = await realpath(file.path)
  if (!result || !inside(result.root, resolved)) throw new Error('Arquivo fora da pasta analisada.')
}

const setupIpc = (): void => {
  // Restrict every operation to this application's own top-level renderer.
  const handle = (channel: string, handler: (...args: unknown[]) => unknown): void => {
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      if (
        !window ||
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      ) {
        throw new Error('Origem inválida.')
      }
      return handler(...args)
    })
  }
  handle('folder:choose', async () => {
    const selection = await dialog.showOpenDialog(window!, {
      properties: ['openDirectory'],
      title: 'Escolha a pasta para analisar',
    })
    return selection.canceled ? null : selection.filePaths[0]
  })
  handle('scan:start', async (folder: unknown) => {
    if (worker || trashBusy) throw new Error('Aguarde a operação atual terminar.')
    if (typeof folder !== 'string' || !folder.trim() || !isAbsolute(folder.trim()))
      throw new Error('Informe o caminho completo de uma pasta.')
    const root = await realpath(folder.trim())
    if (!(await stat(root)).isDirectory()) throw new Error('O caminho informado não é uma pasta.')
    mediaFiles.clear()
    result = null
    await rm(sessionDirectory, { recursive: true, force: true })
    await mkdir(sessionDirectory, { recursive: true })
    const current = new Worker(join(__dirname, 'analysis-worker.js'), {
      workerData: { folder: root, thumbnailDirectory: sessionDirectory },
    })
    worker = current
    let finished = false
    current.on('message', (event: WorkerEvent) => {
      if (worker !== current) return
      if (event.type === 'complete') {
        result = event.result
        result.groups.forEach((group) =>
          group.files.forEach((file) => mediaFiles.set(file.id, file)),
        )
      }
      if (event.type !== 'progress') finished = true
      emit(event)
    })
    current.on('error', (error) => {
      finished = true
      emit({ type: 'error', message: error.message })
    })
    current.on('exit', (code) => {
      if (!finished)
        emit({ type: 'error', message: `A análise foi interrompida (código ${code}).` })
      if (worker === current) worker = null
    })
  })
  handle('scan:cancel', () => {
    worker?.postMessage('cancel')
  })
  handle('file:reveal', (id: unknown) => {
    const file = typeof id === 'string' ? mediaFiles.get(id) : undefined
    if (!file) throw new Error('Arquivo não encontrado nesta análise.')
    shell.showItemInFolder(file.path)
  })
  handle('files:trash', async (ids: unknown): Promise<TrashResult> => {
    if (worker || trashBusy || !result) throw new Error('Aguarde a operação atual terminar.')
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      !ids.every((id) => typeof id === 'string' && mediaFiles.has(id))
    ) {
      throw new Error('Seleção de arquivos inválida.')
    }
    trashBusy = true
    try {
      const selected = new Set(ids as string[])
      const selectedFiles = [...selected].map((id) => mediaFiles.get(id)!)
      const affected = result.groups.filter((group) =>
        group.files.some((file) => selected.has(file.id)),
      )
      // Check a real, unchanged copy will remain in every affected group.
      for (const group of affected) {
        const retained = group.files.filter((file) => !selected.has(file.id))
        const available = await Promise.allSettled(retained.map(unchangedFile))
        if (!available.some((entry) => entry.status === 'fulfilled')) {
          throw new Error(
            'Mantenha pelo menos um arquivo disponível em cada grupo. Se a pasta mudou, analise novamente.',
          )
        }
      }
      await Promise.all(selectedFiles.map(unchangedFile))
      const confirmation = await dialog.showMessageBox(window!, {
        type: 'warning',
        title: 'Enviar arquivos à lixeira',
        message: `Enviar ${selectedFiles.length} arquivo(s) à lixeira?`,
        detail:
          'Confira as imagens e os vídeos antes de confirmar. Você poderá restaurar os arquivos pela lixeira do sistema.',
        buttons: ['Cancelar', 'Enviar à lixeira'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      })
      if (confirmation.response !== 1) return { deletedIds: [], errors: [] }
      await mediaStreams.blockAndClose([...selected])
      const response: TrashResult = { deletedIds: [], errors: [] }
      for (const file of selectedFiles) {
        try {
          const group = affected.find((entry) =>
            entry.files.some((entryFile) => entryFile.id === file.id),
          )!
          const retained = await Promise.allSettled(
            group.files.filter((entry) => !selected.has(entry.id)).map(unchangedFile),
          )
          if (!retained.some((entry) => entry.status === 'fulfilled'))
            throw new Error('A cópia que seria mantida não está mais disponível.')
          await unchangedFile(file)
          await shell.trashItem(file.path)
          response.deletedIds.push(file.id)
          mediaFiles.delete(file.id)
        } catch (error) {
          response.errors.push({
            id: file.id,
            path: file.path,
            message: trashErrorMessage(error),
          })
        }
      }
      const deleted = new Set(response.deletedIds)
      result.groups = result.groups
        .map((group) => ({ ...group, files: group.files.filter((file) => !deleted.has(file.id)) }))
        .filter((group) => group.files.length > 1)
      return response
    } finally {
      mediaStreams.unblock(ids as string[])
      trashBusy = false
    }
  })
}

const serveMedia = (): void => {
  protocol.handle('media', async (request) => {
    try {
      const url = new URL(request.url)
      if (!['thumbnail', 'original'].includes(url.hostname))
        return new Response(null, { status: 404 })
      const file = mediaFiles.get(url.pathname.slice(1))
      if (!file) return new Response(null, { status: 404 })
      if (url.hostname === 'thumbnail')
        return net.fetch(pathToFileURL(file.thumbnailPath).toString())
      if (mediaStreams.isBlocked(file.id)) return new Response(null, { status: 409 })
      await unchangedFile(file)
      // A full-size image is requested only by the explicit zoom action. Finish
      // the disk read before sending bytes to Chromium; no persistent file stream.
      if (file.kind === 'image') {
        const bytes = await readFile(file.path, { signal: request.signal })
        if (mediaStreams.isBlocked(file.id)) return new Response(null, { status: 409 })
        const imageTypes: Record<string, string> = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp',
          '.gif': 'image/gif',
          '.avif': 'image/avif',
        }
        return new Response(new Uint8Array(bytes), {
          headers: {
            'Content-Type':
              imageTypes[extname(file.path).toLowerCase()] ?? 'application/octet-stream',
          },
        })
      }
      const size = (await stat(file.path)).size
      const types: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.m4v': 'video/mp4',
        '.mov': 'video/quicktime',
        '.webm': 'video/webm',
        '.mkv': 'video/x-matroska',
        '.avi': 'video/x-msvideo',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.avif': 'image/avif',
      }
      const headers: Record<string, string> = {
        'Content-Type': types[extname(file.path).toLowerCase()] ?? 'application/octet-stream',
        'Accept-Ranges': 'bytes',
      }
      const range = request.headers.get('range')
      let start = 0
      let end = size - 1
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range)
        if (!match || (!match[1] && !match[2]))
          return new Response(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${size}` },
          })
        start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
        end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
        if (start > end || start >= size)
          return new Response(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${size}` },
          })
        headers['Content-Range'] = `bytes ${start}-${end}/${size}`
      }
      headers['Content-Length'] = String(end - start + 1)
      // Recheck after asynchronous metadata reads in case a trash operation started meanwhile.
      if (mediaStreams.isBlocked(file.id)) return new Response(null, { status: 409 })
      const stream = createReadStream(file.path, { start, end })
      mediaStreams.track(file.id, stream)
      const abort = (): void => {
        stream.destroy()
      }
      request.signal.addEventListener('abort', abort, { once: true })
      stream.once('close', () => request.signal.removeEventListener('abort', abort))
      if (request.signal.aborted) abort()
      return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
        status: range ? 206 : 200,
        headers,
      })
    } catch {
      return new Response(null, { status: 404 })
    }
  })
}

void app.whenReady().then(async () => {
  const cacheRoot = join(app.getPath('temp'), 'file-manager')
  await mkdir(cacheRoot, { recursive: true })
  sessionDirectory = await mkdtemp(join(cacheRoot, 'session-'))
  serveMedia()
  setupIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('before-quit', () => {
  worker?.postMessage('cancel')
})
app.on('will-quit', () => {
  if (sessionDirectory) void rm(sessionDirectory, { recursive: true, force: true })
})
