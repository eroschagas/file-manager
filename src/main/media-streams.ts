import type { ReadStream } from 'node:fs'

// Explicitly wait for file descriptors to close before asking Windows to move files.
export class MediaStreams {
  private streams = new Map<string, Set<ReadStream>>()
  private blockedIds = new Set<string>()

  isBlocked = (id: string): boolean => this.blockedIds.has(id)

  track = (id: string, stream: ReadStream): void => {
    if (!this.streams.has(id)) this.streams.set(id, new Set())
    this.streams.get(id)!.add(stream)
    stream.once('close', () => {
      const entries = this.streams.get(id)
      entries?.delete(stream)
      if (!entries?.size) this.streams.delete(id)
    })
  }

  blockAndClose = async (ids: string[]): Promise<void> => {
    ids.forEach((id) => this.blockedIds.add(id))
    await Promise.all(
      ids
        .flatMap((id) => [...(this.streams.get(id) ?? [])])
        .map(
          (stream) =>
            new Promise<void>((resolve) => {
              if (stream.closed) {
                resolve()
                return
              }
              stream.once('close', resolve)
              stream.destroy()
            }),
        ),
    )
  }

  unblock = (ids: string[]): void => {
    ids.forEach((id) => this.blockedIds.delete(id))
  }
}

export const trashErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error)
  if (/operation was aborted/i.test(message)) {
    return (
      'Windows interrupted the move to the Recycle Bin. A file may be in use, permissions may be restricted, or the drive Recycle Bin may be unavailable. Close other viewers and try again. Details: ' +
      message
    )
  }
  return message
}
