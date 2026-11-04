export type MediaKind = 'image' | 'video'

export interface MediaFile {
  id: string
  path: string
  relativePath: string
  name: string
  kind: MediaKind
  size: number
  mtimeMs: number
  width: number
  height: number
  duration?: number
  sha256: string
  hashes: string[]
  thumbnailPath: string
}

export interface SimilarGroup {
  id: string
  kind: MediaKind
  match: 'exact' | 'similar'
  files: MediaFile[]
}

export interface ScanProgress {
  phase: 'discovering' | 'analyzing' | 'grouping'
  total: number
  processed: number
  currentFile: string
  skipped: number
}

export interface ScanResult {
  root: string
  groups: SimilarGroup[]
  totalFiles: number
  analyzedFiles: number
  issues: { path: string; message: string }[]
  elapsedMs: number
}

export interface TrashResult {
  deletedIds: string[]
  errors: { id: string; path: string; message: string }[]
}

export type WorkerEvent =
  | { type: 'progress'; progress: ScanProgress }
  | { type: 'complete'; result: ScanResult }
  | { type: 'cancelled' }
  | { type: 'error'; message: string }

export interface DesktopApi {
  chooseFolder: () => Promise<string | null>
  startScan: (path: string) => Promise<void>
  cancelScan: () => Promise<void>
  trashFiles: (ids: string[]) => Promise<TrashResult>
  revealFile: (id: string) => Promise<void>
  onScanEvent: (callback: (event: WorkerEvent) => void) => () => void
}
