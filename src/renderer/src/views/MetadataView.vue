<template>
  <main class="metadata">
    <div class="metadata__heading">
      <PhNotePencil :size="28" />
      <h1>Batch metadata editor</h1>
    </div>
    <p>Choose a folder to edit photo and video metadata, including subfolders.</p>
    <form class="metadata__folder" @submit.prevent="inspect">
      <label for="metadataFolder">Media folder</label>
      <div class="metadata__controls">
        <input
          id="metadataFolder"
          v-model="folder"
          :disabled="busy"
          placeholder="Full folder path"
          @input="preview = null"
        />
        <UiButton :disabled="busy" @click="browse"
          ><PhFolderOpen :size="18" />Choose folder</UiButton
        >
        <UiButton type="submit" variant="primary" :disabled="busy || !folder.trim()"
          >Read metadata</UiButton
        >
      </div>
    </form>
    <p v-if="busy" role="status">
      {{ saving ? 'Saving metadata…' : 'Reading files in the folder…' }}
    </p>
    <p v-if="message" role="status">{{ message }}</p>
    <section v-if="preview" class="metadata__editor">
      <h2>{{ preview.count }} media file(s)</h2>
      <p>
        Values found in at least 80% of files are filled in automatically. Fields with varying
        values are left blank.
      </p>
      <p>
        A blank field preserves each file's original value. “Delete” removes the metadata. Filled
        fields will be applied to all files.
      </p>
      <p>
        Dates: YYYY:MM:DD HH:mm:ss (no timezone conversion). File system dates are not changed.
        Metadata is saved directly to the existing files, without creating backup copies.
      </p>
      <form novalidate @submit.prevent="apply">
        <div v-for="field in metadataFields" :key="field.key" class="metadata__field">
          <label :for="`metadata${field.key}`"
            >{{ field.label }}<small>{{ field.key }}</small></label
          >
          <div class="metadata__input">
            <input
              :id="`metadata${field.key}`"
              :value="values[field.key]"
              :class="[
                'metadata__value',
                { 'metadata__value--invalid': !!errors[field.key] && !deleted[field.key] },
              ]"
              :aria-invalid="!!errors[field.key] && !deleted[field.key]"
              :disabled="busy || deleted[field.key]"
              :placeholder="'date' in field ? 'YYYY:MM:DD HH:mm:ss' : 'Keep original'"
              :maxlength="'date' in field ? 25 : 4096"
              @input="updateValue(field.key, $event)"
            />
          </div>
          <label class="metadata__delete"
            ><input v-model="deleted[field.key]" type="checkbox" :disabled="busy" />Delete<span
              class="metadata__sr"
            >
              {{ field.label }}</span
            ></label
          >
        </div>
        <UiButton type="submit" variant="primary" :disabled="busy || !preview.count || !hasChanges"
          >Apply to all files</UiButton
        >
      </form>
    </section>
    <details v-if="issues.length" class="metadata__issues">
      <summary>{{ issues.length }} warning(s) / skipped file(s)</summary>
      <p v-for="(issue, index) in issues" :key="index">{{ issue.path }} — {{ issue.message }}</p>
    </details>
  </main>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { PhFolderOpen, PhNotePencil } from '@phosphor-icons/vue'
import UiButton from '../components/ui/UiButton.vue'
import {
  metadataFields,
  maskMetadataDate,
  metadataValueError,
  type MetadataChanges,
  type MetadataKey,
  type MetadataPreview,
} from '../../../shared/metadata'

const emit = defineEmits<{ busy: [value: boolean]; changed: [] }>()
const folder = ref('')
const preview = ref<MetadataPreview | null>(null)
const values = reactive({} as Record<MetadataKey, string>)
const deleted = reactive({} as Record<MetadataKey, boolean>)
const errors = reactive({} as Record<MetadataKey, string>)
const updateValue = (key: MetadataKey, event: Event): void => {
  const input = event.target as HTMLInputElement
  const field = metadataFields.find((field) => field.key === key)!
  values[key] = 'date' in field ? maskMetadataDate(input.value) : input.value
  input.value = values[key]
  if (errors[key]) errors[key] = metadataValueError(key, values[key])
}
const busy = ref(false)
const saving = ref(false)
const message = ref('')
const issues = ref<MetadataPreview['issues']>([])
const hasChanges = computed(() =>
  metadataFields.some(({ key }) => deleted[key] || values[key]?.trim()),
)
const run = async (action: () => Promise<void>): Promise<void> => {
  busy.value = true
  emit('busy', true)
  message.value = ''
  try {
    await action()
  } catch (error) {
    message.value = error instanceof Error ? error.message : String(error)
  } finally {
    busy.value = false
    saving.value = false
    emit('busy', false)
  }
}
const inspect = (): Promise<void> =>
  run(async () => {
    preview.value = null
    issues.value = []
    const response = await window.desktop.previewMetadata(folder.value)
    metadataFields.forEach(({ key }) => {
      values[key] = response.values[key]
      deleted[key] = false
      errors[key] = ''
    })
    issues.value = response.issues
    preview.value = response
  })
const browse = (): Promise<void> =>
  run(async () => {
    const selected = await window.desktop.chooseMetadataFolder()
    if (selected) {
      folder.value = selected
      preview.value = null
    }
  })
const apply = async (): Promise<void> => {
  metadataFields.forEach(({ key }) => {
    errors[key] = deleted[key] ? '' : metadataValueError(key, values[key] ?? '')
  })
  const invalid = metadataFields.find(({ key }) => errors[key])
  if (invalid) {
    document.getElementById(`metadata${invalid.key}`)?.focus()
    return
  }
  await run(async () => {
    if (!preview.value) return
    saving.value = true
    const changes: MetadataChanges = {}
    metadataFields.forEach(({ key }) => {
      if (deleted[key]) changes[key] = null
      else if (values[key]?.trim()) changes[key] = values[key].trim()
    })
    const response = await window.desktop.applyMetadata(preview.value.id, changes)
    if (!response) return
    preview.value = null
    issues.value = response.issues
    message.value = `${response.updated} file(s) updated. Read the folder again to review the metadata.`
    emit('changed')
  })
}
</script>

<style lang="scss" scoped>
.metadata {
  position: relative;
  min-height: 0;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 36px 42px;
  flex: 1;
  &__heading {
    display: flex;
    align-items: center;
    gap: 12px;
    h1 {
      font-size: 26px;
    }
  }
  p {
    color: var(--muted);
    line-height: 1.6;
    margin: 12px 0;
  }
  &__folder,
  &__editor {
    background: white;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px;
    margin-top: 24px;
  }
  &__controls {
    display: flex;
    gap: 12px;
    margin-top: 10px;
    input {
      flex: 1;
      min-width: 0;
    }
  }
  input:not([type='checkbox']) {
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 12px;
    font: inherit;
    width: 100%;
    min-width: 0;
  }
  &__field {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr) 90px;
    align-items: center;
    gap: 16px;
    margin: 18px 0;
    small {
      display: block;
      color: var(--muted);
      margin-top: 5px;
    }
  }
  &__delete {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  &__input {
    min-width: 0;
  }
  input.metadata__value--invalid {
    border-color: var(--danger);
    outline-color: var(--danger);
    box-shadow: 0 0 0 1px var(--danger);
  }
  &__issues p {
    overflow-wrap: anywhere;
  }
  &__sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  @media (max-width: 1000px) {
    padding: 24px;
    &__field {
      grid-template-columns: 180px minmax(0, 1fr) 80px;
    }
  }
}
</style>
