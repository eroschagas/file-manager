<template>
  <div class="folder-form__entry">
    <label :for="`folderPath${index}`">{{
      index === 0 ? 'Folder to scan' : `Folder to scan ${index + 1}`
    }}</label>
    <div class="folder-form__input-row">
      <input
        :id="`folderPath${index}`"
        :value="path"
        @input="emit('updatePath', ($event.target as HTMLInputElement).value)"
        placeholder="e.g. C:\Users\you\Pictures"
        autocomplete="off"
        spellcheck="false"
        :disabled="disabled"
      /><UiButton variant="secondary" type="button" :disabled="disabled" @click="emit('browse')">
        <PhFolderOpen :size="18" /> Browse folders
      </UiButton>
      <UiButton
        v-if="removable"
        variant="icon"
        type="button"
        :aria-label="`Remove folder ${index + 1}`"
        :disabled="disabled"
        @click="emit('remove')"
      >
        <PhX :size="18" />
      </UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PhFolderOpen, PhX } from '@phosphor-icons/vue'
import UiButton from '../ui/UiButton.vue'
const props = defineProps({
  path: { type: String, required: true },
  index: { type: Number, required: true },
  disabled: { type: Boolean, default: false },
  removable: { type: Boolean, default: false },
})
const emit = defineEmits<{ updatePath: [path: string]; browse: []; remove: [] }>()
</script>

<style lang="scss" scoped>
.folder-form {
  &__input-row {
    display: flex;
    gap: 9px;
    input {
      min-width: 0;
      flex: 1;
      width: 100%;
      padding: 12px 13px;
      background: #fafbfc;
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 12px;
      outline: none;
      &:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px #6650d812;
      }
      &::placeholder {
        color: #a0a4af;
      }
    }
  }
  &__entry + &__entry {
    margin-top: 14px;
  }
}
.folder-form__entry {
  label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 9px;
  }
}
</style>
