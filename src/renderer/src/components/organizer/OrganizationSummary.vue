<template>
  <section class="organization-summary">
    <div class="organization-summary__heading">
      <div>
        <UiEyebrow>{{ props.result ? 'ORGANIZATION RESULTS' : 'ORGANIZATION PREVIEW' }}</UiEyebrow>
        <h2>
          {{
            props.result
              ? props.result.cancelled
                ? 'Organization stopped'
                : 'Organization complete'
              : 'Your files, organized by date'
          }}
        </h2>
      </div>
      <PhFolders :size="30" />
    </div>
    <div class="organization-summary__stats">
      <div>
        <strong>{{ props.result ? props.result.movedFiles : props.preview?.pendingFiles }}</strong
        ><span>{{ props.result ? 'Files moved' : 'Files to move' }}</span>
      </div>
      <div>
        <strong>{{ data?.alreadyOrganized }}</strong
        ><span>Already organized</span>
      </div>
      <div>
        <strong>{{ data?.renamedFiles }}</strong
        ><span>{{ props.result ? 'Files renamed' : 'Name conflicts' }}</span>
      </div>
    </div>
    <p class="organization-summary__path" :title="data?.root">{{ data?.root }}</p>
    <div v-if="data?.folders.length" class="organization-summary__folders">
      <div v-for="folder in data.folders" :key="folder.path" class="organization-summary__folder">
        <span><PhFolder :size="18" />{{ folder.path }}</span
        ><span>{{ folder.count }} file(s)</span>
      </div>
    </div>
    <p v-else class="organization-summary__hint">No files to organize.</p>
    <p class="organization-summary__hint">
      {{
        props.result
          ? 'Folder counts show files moved in this operation.'
          : 'Preview only. No files have been moved. Conflicting names receive a numbered suffix.'
      }}
      Only folders needed for files are created.
    </p>
    <details v-if="data?.issues.length" class="organization-summary__issues">
      <summary>{{ data.issues.length }} skipped item(s) or issue(s)</summary>
      <p v-for="(issue, index) in data.issues" :key="index">
        <strong>{{ issue.path }}</strong
        ><br />{{ issue.message }}
      </p>
    </details>
    <div class="organization-summary__actions">
      <UiButton v-if="props.preview?.pendingFiles" variant="primary" @click="emit('organize')"
        ><PhArrowsDownUp :size="18" /> Organize files</UiButton
      ><UiButton @click="emit('preview')">Preview again</UiButton>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { PhFolder, PhFolders, PhArrowsDownUp } from '@phosphor-icons/vue'
import type { OrganizationPreview, OrganizationResult } from '../../../../shared/organizer'
import UiButton from '../ui/UiButton.vue'
import UiEyebrow from '../ui/UiEyebrow.vue'
const props = defineProps({
  preview: { type: Object as PropType<OrganizationPreview | null>, default: null },
  result: { type: Object as PropType<OrganizationResult | null>, default: null },
})
const emit = defineEmits<{ organize: []; preview: [] }>()
const data = computed(() => props.result ?? props.preview)
</script>
<style lang="scss" scoped>
.organization-summary {
  padding: 28px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: white;
  min-width: 0;
  &__heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    > svg {
      color: var(--primary);
      flex-shrink: 0;
    }
    h2 {
      margin: 10px 0 0;
      font-size: 22px;
      letter-spacing: -0.5px;
    }
  }
  &__stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 18px;
    margin: 26px 0;
    > div {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    strong {
      font-size: 26px;
    }
    span {
      font-size: 12px;
      color: var(--muted);
    }
  }
  &__path {
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }
  &__folders {
    border: 1px solid var(--border);
    border-radius: 8px;
    max-height: 320px;
    overflow-y: auto;
  }
  &__folder {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 13px 16px;
    gap: 15px;
    font-size: 13px;
    & + & {
      border-top: 1px solid var(--border);
    }
    > span:first-child {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    > span:last-child {
      color: var(--muted);
    }
    svg {
      color: var(--primary);
    }
  }
  &__hint {
    font-size: 12px;
    color: var(--muted);
    line-height: 1.7;
  }
  &__issues {
    font-size: 12px;
    line-height: 1.6;
    color: #a15a39;
    margin: 18px 0;
    summary {
      cursor: pointer;
    }
    p {
      overflow-wrap: anywhere;
    }
  }
  &__actions {
    display: flex;
    gap: 12px;
    margin-top: 22px;
  }
}
</style>
