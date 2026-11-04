<template>
  <main class="scan-view">
    <div class="scan-view__animation"><PhScan :size="45" weight="light" /></div>
    <UiEyebrow>FINDING WHAT BELONGS TOGETHER</UiEyebrow>
    <h1>{{ scan.phaseTitle }}</h1>
    <p>We are comparing the contents of your files.</p>
    <div class="scan-view__progress">
      <div
        :class="[
          'scan-view__bar',
          { 'scan-view__bar--indeterminate': scan.state.progress.phase !== 'analyzing' },
        ]"
        :style="{ width: scan.state.progress.phase === 'analyzing' ? `${scan.percent}%` : '35%' }"
      ></div>
    </div>
    <div class="scan-view__counts">
      <strong>{{
        scan.state.progress.phase === 'discovering'
          ? `${scan.state.progress.total} files found`
          : `${scan.state.progress.processed} of ${scan.state.progress.total} files`
      }}</strong
      ><span v-if="scan.state.progress.phase === 'analyzing'">{{ scan.percent }}%</span>
    </div>
    <p class="scan-view__file" :title="scan.state.progress.currentFile">
      {{ scan.state.progress.currentFile || folders.join(' · ') }}
    </p>
    <p v-if="scan.state.progress.skipped" class="scan-view__skipped">
      {{ scan.state.progress.skipped }} file(s) could not be read. Details will be available when
      the scan finishes.
    </p>
    <UiButton variant="secondary" :disabled="cancelling" @click="emit('cancel')">
      {{ cancelling ? 'Canceling…' : 'Cancel scan' }}
    </UiButton>
  </main>
</template>

<script setup lang="ts">
import { PhScan } from '@phosphor-icons/vue'
import UiButton from '../components/ui/UiButton.vue'
import UiEyebrow from '../components/ui/UiEyebrow.vue'
import { type PropType } from 'vue'
import type { ScanSession } from '../models/ScanSession'
const props = defineProps({
  scan: { type: Object as PropType<ScanSession>, required: true },
  folders: { type: Array as PropType<string[]>, required: true },
  cancelling: { type: Boolean, default: false },
})
const emit = defineEmits<{ cancel: [] }>()
</script>

<style lang="scss" scoped>
.scan-view {
  width: 590px;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  max-width: calc(100% - 48px);
  margin: 100px auto 0;
  padding: 20px;
  text-align: center;
  &__animation {
    display: grid;
    place-items: center;
    width: 96px;
    height: 96px;
    margin: 0 auto 30px;
    border: 1px solid #e4defb;
    border-radius: 27px;
    color: var(--primary);
    background: #eeebfb;
    animation: pulse 2s ease-in-out infinite;
  }
  h1 {
    font-size: 28px;
    margin: 17px 0 12px;
    letter-spacing: -0.8px;
  }
  > p {
    color: var(--muted);
    font-size: 13px;
  }
  &__progress {
    width: 100%;
    height: 7px;
    border-radius: 8px;
    overflow: hidden;
    background: #e8e5f4;
    margin-top: 39px;
  }
  &__bar {
    height: 100%;
    border-radius: inherit;
    background: var(--primary);
    transition: width 180ms;
    &--indeterminate {
      animation: slide 1.7s ease-in-out infinite;
    }
  }
  &__counts {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    margin-top: 12px;
    strong {
      font-weight: 500;
    }
    span {
      color: var(--primary);
    }
  }
  &__file {
    width: 100%;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin: 16px 0 35px;
    font-size: 11px !important;
  }
  &__skipped {
    margin-bottom: 20px;
  }
}
@keyframes pulse {
  50% {
    box-shadow: 0 0 0 16px #eeeafb66;
  }
}
@keyframes slide {
  50% {
    transform: translateX(185%);
  }
}
</style>
