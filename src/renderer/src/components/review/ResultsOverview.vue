<template>
  <div class="results__overview">
    <div class="results__heading">
      <div>
        <UiButton variant="text" :disabled="deleting" @click="emit('back')">
          <PhArrowLeft :size="16" /> Scan another folder
        </UiButton>
        <h1>A place for every version<span>.</span></h1>
        <p v-for="root in result.roots" :key="root" :title="root">
          <PhFolderSimple :size="16" /> <span>{{ root }}</span>
        </p>
      </div>
      <span class="results__complete"
        ><PhCheckCircle :size="17" weight="fill" /> Scan complete</span
      >
    </div>
    <div class="summary">
      <div>
        <span>FILES SCANNED</span><strong>{{ result.analyzedFiles.toLocaleString('en-US') }}</strong
        ><small>in {{ formatDuration(result.elapsedMs / 1000) }} · including subfolders</small>
      </div>
      <div>
        <span>SIMILAR GROUPS</span><strong>{{ result.groups.length }}<small> groups</small></strong
        ><small>{{ groupedCount }} files to compare</small>
      </div>
      <div>
        <span>SPACE USED BY COPIES</span><strong>{{ formatBytes(potentialSpace) }}</strong
        ><small>estimate keeping one file per group</small>
      </div>
    </div>
    <details v-if="result.issues.length" class="issues">
      <summary>
        <PhWarningCircle :size="17" /> {{ result.issues.length }} item(s) could not be scanned
      </summary>
      <p v-for="issue in result.issues" :key="`${issue.path}:${issue.message}`">
        <strong>{{ issue.path }}</strong
        ><br />{{ issue.message }}
      </p>
    </details>
  </div>
</template>

<script setup lang="ts">
import { PhArrowLeft, PhFolderSimple, PhCheckCircle, PhWarningCircle } from '@phosphor-icons/vue'
import UiButton from '../ui/UiButton.vue'
import { type PropType } from 'vue'
import type { ScanResult } from '../../../../shared/types'
import { formatBytes, formatDuration } from '../../format'
const props = defineProps({
  result: { type: Object as PropType<ScanResult>, required: true },
  groupedCount: { type: Number, required: true },
  potentialSpace: { type: Number, required: true },
  deleting: { type: Boolean, default: false },
})
const emit = defineEmits<{ back: [] }>()
</script>

<style lang="scss" scoped>
.results {
  &__overview {
    flex-shrink: 0;
    min-height: 0;
    max-height: 35%;
    overflow-y: auto;
  }
  &__heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    > div {
      min-width: 0;
    }
    h1 {
      font-size: 22px;
      letter-spacing: -0.9px;
      margin: 6px 0 5px;
      font-weight: 650;
      span {
        color: var(--primary);
      }
    }
    p {
      display: flex;
      align-items: center;
      gap: 7px;
      color: var(--muted);
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      svg {
        flex-shrink: 0;
      }
      span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
  &__complete {
    display: inline-flex;
    gap: 7px;
    align-items: center;
    white-space: nowrap;
    padding: 7px 10px;
    font-size: 11px;
    background: #eaf3ec;
    color: #61876a;
    border-radius: 6px;
  }
}
.summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  background: white;
  border: 1px solid var(--border);
  border-radius: 12px;
  margin-top: 14px;
  padding: 12px 0;
  > div {
    display: flex;
    flex-direction: column;
    padding: 0 18px;
    gap: 4px;
    & + div {
      border-left: 1px solid var(--border);
    }
    > span {
      font-size: 9px;
      letter-spacing: 1.2px;
      color: var(--muted);
      font-weight: 600;
    }
    > strong {
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.8px;
      small {
        font-size: 14px;
        font-weight: 400;
        letter-spacing: 0;
        color: var(--muted);
      }
    }
    > small {
      color: var(--muted);
      font-size: 11px;
    }
  }
}
.issues {
  margin-top: 18px;
  padding: 13px 16px;
  border: 1px solid #efdfbf;
  border-radius: 8px;
  color: #8e6c33;
  background: #fffcf4;
  font-size: 12px;
  summary {
    cursor: pointer;
    svg {
      vertical-align: middle;
      margin-right: 5px;
    }
  }
  p {
    margin-top: 13px;
    overflow-wrap: anywhere;
    line-height: 1.6;
  }
  &[open] {
    max-height: 250px;
    overflow-y: auto;
  }
}
</style>
