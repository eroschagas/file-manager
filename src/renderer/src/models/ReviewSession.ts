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

  private bestFile = (group: SimilarGroup): MediaFile | undefined =>
    group.files.reduce<MediaFile | undefined>((best, file) => {
      if (!best) return file
      const resolution = file.width * file.height
      const bestResolution = best.width * best.height
      return resolution > bestResolution || (resolution === bestResolution && file.size > best.size)
        ? file
        : best
    }, undefined)

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
    return this.activeGroup ? this.bestFile(this.activeGroup)?.id : undefined
  }

  get activeGroupIndex(): number {
    const id = this.activeGroup?.id
    return this.filteredGroups.findIndex((group) => group.id === id)
  }

  navigateGroup = (direction: -1 | 1): void => {
    const index = this.activeGroupIndex
    if (index < 0) return
    const group = this.filteredGroups[index + direction]
    if (group) this.selectGroup(group.id)
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
    return this.groups.reduce((sum, group) => {
      const bestId = this.bestFile(group)?.id
      return (
        sum +
        group.files
          .filter((file) => file.id !== bestId)
          .reduce((total, file) => total + file.size, 0)
      )
    }, 0)
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
      result.groups.flatMap((group) => {
        const bestId = this.bestFile(group)?.id
        return group.files.filter((file) => file.id !== bestId).map((file) => file.id)
      }),
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

  toggleGroupSelection = (): void => {
    const group = this.activeGroup
    if (!group) return
    const selected = new Set(this.state.selectedIds)
    const hasSelection = group.files.some((file) => selected.has(file.id))
    group.files.forEach((file) => {
      if (hasSelection) selected.delete(file.id)
      else selected.add(file.id)
    })
    this.state.selectedIds = selected
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
