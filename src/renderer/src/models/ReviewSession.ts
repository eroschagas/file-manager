import { reactive } from 'vue'
import type {
  MediaFile,
  MediaKind,
  ScanResult,
  SimilarGroup,
  TrashResult,
} from '../../../shared/types'
import type { ScanSession } from './ScanSession'

export type MediaFilter = 'all' | MediaKind

export class ReviewSession {
  readonly state = reactive({
    filter: 'all' as MediaFilter,
    activeId: '',
    selectedIds: new Set<string>(),
    removedCount: 0,
  })

  constructor(private readonly scan: ScanSession) {}

  get groups(): SimilarGroup[] {
    return this.scan.state.result?.groups ?? []
  }

  get filteredGroups(): SimilarGroup[] {
    return this.groups.filter(
      (group) => this.state.filter === 'all' || group.kind === this.state.filter,
    )
  }

  get activeGroup(): SimilarGroup | undefined {
    return (
      this.filteredGroups.find((group) => group.id === this.state.activeId) ??
      this.filteredGroups[0]
    )
  }

  get highestResolutionId(): string | undefined {
    return this.activeGroup?.files.reduce((best, file) =>
      file.width * file.height > best.width * best.height ? file : best,
    ).id
  }

  get selectedCounts(): Record<string, number> {
    return Object.fromEntries(
      this.groups.map((group) => [
        group.id,
        group.files.filter((file) => this.state.selectedIds.has(file.id)).length,
      ]),
    )
  }

  get groupedCount(): number {
    return this.groups.reduce((sum, group) => sum + group.files.length, 0)
  }

  get potentialSpace(): number {
    return this.groups.reduce(
      (sum, group) => sum + group.files.slice(1).reduce((total, file) => total + file.size, 0),
      0,
    )
  }

  get selectedFiles(): MediaFile[] {
    return this.groups
      .flatMap((group) => group.files)
      .filter((file) => this.state.selectedIds.has(file.id))
  }

  get selectedSize(): number {
    return this.selectedFiles.reduce((sum, file) => sum + file.size, 0)
  }

  reset = (): void => {
    this.clearSelection()
    this.state.removedCount = 0
    this.state.filter = 'all'
  }

  begin = (result: ScanResult): void => {
    this.state.selectedIds = new Set(
      result.groups.map((group) => group.files[group.files.length - 1].id),
    )
    this.state.activeId = result.groups[0]?.id ?? ''
  }

  setFilter = (filter: MediaFilter): void => {
    this.state.filter = filter
  }
  selectGroup = (id: string): void => {
    this.state.activeId = id
  }
  clearSelection = (): void => {
    this.state.selectedIds = new Set()
  }

  toggleFile = (id: string): void => {
    const selected = new Set(this.state.selectedIds)
    if (selected.has(id)) selected.delete(id)
    else {
      if (!this.groups.some((group) => group.files.some((file) => file.id === id))) return
      selected.add(id)
    }
    this.state.selectedIds = selected
  }

  applyTrashResult = (response: TrashResult): void => {
    const deleted = new Set(response.deletedIds)
    const result = this.scan.state.result
    if (!result || !deleted.size) return
    result.groups = result.groups
      .map((group) => ({
        ...group,
        files: group.files.filter((file) => !deleted.has(file.id)),
      }))
      .filter((group) => group.files.length > 1)
    const visible = new Set(result.groups.flatMap((group) => group.files.map((file) => file.id)))
    this.state.selectedIds = new Set([...this.state.selectedIds].filter((id) => visible.has(id)))
    this.state.removedCount += deleted.size
  }
}
