import { reactive } from 'vue'
import type { SimilarityLevel } from '../../../shared/types'

export class FolderSelection {
  readonly state = reactive({ paths: [''], similarity: 'balanced' as SimilarityLevel })

  readonly descriptions: Record<SimilarityLevel, string> = {
    strict: 'Prioritizes copies with very few visual differences.',
    balanced: 'Allows moderate differences in quality and appearance.',
    flexible:
      'Finds more candidates, but may group different photos together. Review each group before deleting.',
  }

  get selectedFolders(): string[] {
    return this.state.paths.map((path) => path.trim()).filter(Boolean)
  }

  setPath = (index: number, path: string): void => {
    this.state.paths[index] = path
  }
  addPath = (): void => {
    this.state.paths.push('')
  }
  removePath = (index: number): void => {
    this.state.paths.splice(index, 1)
  }

  replacePath = (index: number, folders: string[]): void => {
    if (!folders.length) return
    this.state.paths.splice(index, 1, ...folders)
    this.state.paths = [...new Set(this.state.paths)]
  }

  resetPaths = (): void => {
    this.state.paths = ['']
  }
}
