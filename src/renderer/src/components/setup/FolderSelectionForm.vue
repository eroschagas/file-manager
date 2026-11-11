<template>
  <form class="folder-form" @submit.prevent="emit('start')">
    <div class="folder-form__heading">
      <span class="folder-form__icon"><PhFolderSimple :size="26" /></span>
      <div>
        <h2>Where should we start?</h2>
        <p>Choose one or more folders to organize together.</p>
      </div>
    </div>
    <FolderPathInput
      v-for="(path, index) in folders.state.paths"
      :key="index"
      :path="path"
      :index="index"
      :disabled="starting"
      :removable="folders.state.paths.length > 1"
      @update-path="folders.setPath(index, $event)"
      @browse="emit('browse', index)"
      @remove="folders.removePath(index)"
    />
    <UiButton
      type="button"
      variant="text"
      class="folder-form__add"
      :disabled="starting"
      @click="folders.addPath()"
    >
      + Add folder
    </UiButton>
    <div class="folder-form__recursive">
      <PhTreeStructure :size="17" /><span>All subfolders will be scanned automatically.</span>
    </div>
    <div class="folder-form__similarity">
      <label for="similarityLevel">Similarity</label>
      <div class="folder-form__select">
        <select id="similarityLevel" v-model="folders.state.similarity" :disabled="starting">
          <option value="strict">Strict — nearly identical files</option>
          <option value="balanced">Balanced — moderate differences</option>
          <option value="flexible">Flexible — less similar files</option>
          <option value="broad">Broad — slightly larger differences</option>
        </select>
        <PhCaretDown :size="16" aria-hidden="true" />
      </div>
      <p>{{ folders.descriptions[folders.state.similarity] }}</p>
    </div>
    <div class="folder-form__footer">
      <span
        ><PhImage :size="16" /> Photos <span class="separator">/</span>
        <PhFilmStrip :size="16" /> Videos</span
      ><UiButton
        variant="primary"
        type="submit"
        :disabled="!folders.selectedFolders.length || starting"
      >
        {{ starting ? 'Preparing…' : 'Scan files' }}<PhArrowRight :size="18" />
      </UiButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import {
  PhFolderSimple,
  PhTreeStructure,
  PhCaretDown,
  PhImage,
  PhFilmStrip,
  PhArrowRight,
} from '@phosphor-icons/vue'
import FolderPathInput from './FolderPathInput.vue'
import UiButton from '../ui/UiButton.vue'
import { type PropType } from 'vue'
import type { FolderSelection } from '../../models/FolderSelection'
const props = defineProps({
  folders: { type: Object as PropType<FolderSelection>, required: true },
  starting: { type: Boolean, default: false },
})
const emit = defineEmits<{ start: []; browse: [index: number] }>()
</script>

<style lang="scss" scoped>
.folder-form {
  &__select {
    position: relative;
    > svg {
      position: absolute;
      right: 14px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      color: var(--muted);
    }
  }
  &__similarity {
    margin-top: 20px;
    select {
      width: 100%;
      padding: 11px 42px 11px 12px;
      appearance: none;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: white;
      color: var(--text);
      font: inherit;
      font-size: 12px;
    }
    select:focus-visible {
      outline: 3px solid #b7a9ff;
      outline-offset: 2px;
    }
    p {
      margin-top: 8px;
      font-size: 11px;
      line-height: 1.6;
      color: var(--muted);
    }
  }

  &__add {
    margin-top: 14px;
    color: var(--primary);
  }
  padding: 27px;
  margin: 33px auto 0;
  width: 100%;
  background: white;
  border: 1px solid var(--border);
  border-radius: 15px;
  text-align: left;
  box-shadow: 0 8px 30px #29325405;
  &__heading {
    display: flex;
    gap: 13px;
    align-items: center;
    margin-bottom: 25px;
    h2 {
      font-size: 16px;
      font-weight: 600;
      letter-spacing: -0.3px;
    }
    p {
      margin-top: 5px;
      font-size: 12px;
      color: var(--muted);
    }
  }
  &__icon {
    display: grid;
    place-items: center;
    width: 47px;
    height: 47px;
    background: #f0edfc;
    color: var(--primary);
    border-radius: 12px;
  }
  label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 9px;
  }

  &__recursive {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--muted);
    font-size: 11px;
    margin-top: 13px;
    svg {
      color: var(--primary);
    }
  }
  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 23px;
    padding-top: 20px;
    border-top: 1px solid #f0f1f5;
    > span {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
      font-size: 11px;
    }
    .separator {
      margin: 0 6px;
      color: #d6d8e0;
    }
  }
}
</style>
