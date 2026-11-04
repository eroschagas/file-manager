<template>
  <main class="setup">
    <div class="setup__content">
      <div class="setup__eyebrow"><span></span> MORE SPACE. FEWER COPIES.</div>
      <h1>Find what is taking<br />up space twice<span>.</span></h1>
      <p class="setup__description">
        Compare similar photos and videos, even at different quality levels.<br />You decide what
        stays and what goes to the Recycle Bin.
      </p>

      <FolderSelectionForm
        :folders="folders"
        :starting="starting"
        @start="emit('start')"
        @browse="emit('browse', $event)"
      />

      <div class="setup__steps">
        <div>
          <span>01</span>
          <h3>Choose a folder</h3>
          <p>We search for photos and videos<br />in every subfolder.</p>
        </div>
        <div>
          <span>02</span>
          <h3>Compare similar files</h3>
          <p>View versions side by side<br />and check the details.</p>
        </div>
        <div>
          <span>03</span>
          <h3>Free up space</h3>
          <p>Select copies and confirm<br />before moving them to the Recycle Bin.</p>
        </div>
      </div>
      <p class="setup__footnote">
        <PhLockSimple :size="14" /> No files are removed during the scan.
      </p>
    </div>
  </main>
</template>

<script setup lang="ts">
import { PhLockSimple } from '@phosphor-icons/vue'
import FolderSelectionForm from '../components/setup/FolderSelectionForm.vue'
import { type PropType } from 'vue'
import type { FolderSelection } from '../models/FolderSelection'
const props = defineProps({
  folders: { type: Object as PropType<FolderSelection>, required: true },
  starting: { type: Boolean, default: false },
})
const emit = defineEmits<{ start: []; browse: [index: number] }>()
</script>

<style lang="scss" scoped>
.setup {
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow-y: auto;
  text-align: center;
  &__content {
    max-width: 840px;
    margin: 0 auto;
    padding: 62px 30px 25px;
  }
  &__eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 11px;
    border-radius: 20px;
    background: #eeebfc;
    color: var(--primary);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.5px;
    span {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--primary);
    }
  }
  h1 {
    margin-top: 22px;
    font-size: clamp(32px, 3.5vw, 45px);
    line-height: 1.17;
    font-weight: 650;
    letter-spacing: -1.8px;
    span {
      color: var(--primary);
    }
  }
  &__description {
    margin-top: 17px;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.8;
  }
  &__steps {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    margin: 36px 0 26px;
    text-align: left;
    gap: 28px;
    padding: 0 10px;
    span {
      display: block;
      color: #b5a9e8;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    h3 {
      font-size: 12px;
      font-weight: 600;
    }
    p {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.7;
      margin-top: 6px;
    }
  }
  &__footnote {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    color: #9699a4;
    font-size: 11px;
  }
}
</style>
