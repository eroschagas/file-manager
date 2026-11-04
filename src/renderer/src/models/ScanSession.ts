import { reactive } from 'vue'
import type { ScanProgress, ScanResult } from '../../../shared/types'

export class ScanSession {
  readonly state = reactive<{ result: ScanResult | null; progress: ScanProgress }>({
    result: null,
    progress: { phase: 'discovering', total: 0, processed: 0, currentFile: '', skipped: 0 },
  })

  get percent(): number {
    const { total, processed } = this.state.progress
    return total ? Math.round((processed / total) * 100) : 0
  }

  get phaseTitle(): string {
    return {
      discovering: 'Exploring your folders…',
      analyzing: 'Scanning photos and videos…',
      grouping: 'Finding similar files…',
    }[this.state.progress.phase]
  }

  begin = (): void => {
    this.state.result = null
    this.state.progress = {
      phase: 'discovering',
      total: 0,
      processed: 0,
      currentFile: '',
      skipped: 0,
    }
  }

  updateProgress = (progress: ScanProgress): void => {
    this.state.progress = progress
  }
  complete = (result: ScanResult): void => {
    this.state.result = result
  }
}
