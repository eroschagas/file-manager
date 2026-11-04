<template>
  <form class="organizer-form" @submit.prevent="emit('preview')">
    <label class="organizer-form__label" for="organizerFolder">Folder to organize</label>
    <div class="organizer-form__row">
      <div class="organizer-form__input">
        <PhFolder :size="20" /><input
          id="organizerFolder"
          :value="props.folder"
          placeholder="Enter a folder path or browse"
          :disabled="props.busy"
          @input="emit('change', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <UiButton :disabled="props.busy" @click="emit('browse')"
        ><PhFolderOpen :size="18" /> Browse</UiButton
      >
    </div>
    <p class="organizer-form__help">
      All file types and subfolders are included. Symbolic links and junctions are skipped.
    </p>
    <UiButton type="submit" variant="primary" :disabled="props.busy || !props.folder.trim()"
      ><PhMagnifyingGlass :size="18" /> Preview organization</UiButton
    >
  </form>
</template>
<script setup lang="ts">
import { PhFolder, PhFolderOpen, PhMagnifyingGlass } from '@phosphor-icons/vue'
import UiButton from '../ui/UiButton.vue'
const props = defineProps({
  folder: { type: String, required: true },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits<{ change: [folder: string]; browse: []; preview: [] }>()
</script>
<style lang="scss" scoped>
.organizer-form {
  padding: 28px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: white;
  &__label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 10px;
  }
  &__row {
    display: flex;
    gap: 12px;
  }
  &__input {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    gap: 12px;
    padding: 0 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--muted);
    &:focus-within {
      border-color: var(--primary);
    }
  }
  input {
    min-width: 0;
    width: 100%;
    border: 0;
    outline: 0;
    background: transparent;
    padding: 13px 0;
    color: var(--text);
    font: inherit;
    font-size: 13px;
  }
  &__help {
    font-size: 12px;
    color: var(--muted);
    margin: 12px 0 24px;
  }
}
</style>
