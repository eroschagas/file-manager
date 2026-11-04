import { parentPort, workerData } from 'node:worker_threads'
import { scanFolder } from './scanner'
import type { SimilarityLevel, WorkerEvent } from '../shared/types'

const controller = new AbortController()
const send = (event: WorkerEvent): void => {
  parentPort?.postMessage(event)
}
parentPort?.on('message', (message) => {
  if (message === 'cancel') controller.abort()
})
const { folders, thumbnailDirectory, similarity } = workerData as {
  folders: string[]
  thumbnailDirectory: string
  similarity: SimilarityLevel
}
scanFolder(
  folders,
  thumbnailDirectory,
  controller.signal,
  (progress) => send({ type: 'progress', progress }),
  similarity,
)
  .then((result) => send({ type: 'complete', result }))
  .catch((error: unknown) => {
    if (controller.signal.aborted) send({ type: 'cancelled' })
    else send({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  })
  .finally(() => parentPort?.close())
