import { parentPort, workerData } from 'node:worker_threads'
import { scanFolder } from './scanner'
import type { WorkerEvent } from '../shared/types'

const controller = new AbortController()
const send = (event: WorkerEvent): void => {
  parentPort?.postMessage(event)
}
parentPort?.on('message', (message) => {
  if (message === 'cancel') controller.abort()
})
const { folder, thumbnailDirectory } = workerData as { folder: string; thumbnailDirectory: string }
scanFolder(folder, thumbnailDirectory, controller.signal, (progress) =>
  send({ type: 'progress', progress }),
)
  .then((result) => send({ type: 'complete', result }))
  .catch((error: unknown) => {
    if (controller.signal.aborted) send({ type: 'cancelled' })
    else send({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  })
  .finally(() => parentPort?.close())
