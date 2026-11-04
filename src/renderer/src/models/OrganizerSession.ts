import { reactive } from 'vue'
import type {
  OrganizationPreview,
  OrganizationProgress,
  OrganizationResult,
} from '../../../shared/organizer'

export class OrganizerSession {
  readonly state = reactive({
    folder: '',
    preview: null as OrganizationPreview | null,
    result: null as OrganizationResult | null,
    progress: { phase: 'reading', processed: 0, total: 0, currentFile: '' } as OrganizationProgress,
  })

  get percent(): number {
    const { processed, total } = this.state.progress
    return total ? Math.min(100, Math.round((processed / total) * 100)) : 0
  }

  get phaseTitle(): string {
    return {
      reading: 'Reading your files',
      planning: 'Preparing your preview',
      moving: 'Organizing your files',
    }[this.state.progress.phase]
  }

  setFolder = (folder: string): void => {
    this.state.folder = folder
    this.state.preview = null
    this.state.result = null
  }
}
