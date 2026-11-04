<template>
  <article :class="['media-card', { 'media-card--selected': selected }]">
    <div class="media-card__preview">
      <video
        v-if="file.kind === 'video' && videoRequested && !suspendPreview"
        ref="videoElement"
        :src="`media://original/${file.id}`"
        :poster="thumbnailUrl(file.id)"
        controls
        autoplay
        preload="metadata"
        @error="videoFailed = true"
      />
      <button
        v-else
        class="media-card__image-button"
        :aria-label="file.kind === 'video' ? 'Play video' : 'Enlarge image'"
        :disabled="suspendPreview"
        @click="openPreview"
      >
        <img :src="thumbnailUrl(file.id)" :alt="file.name" loading="lazy" />
        <span class="media-card__zoom"
          ><PhPlay v-if="file.kind === 'video'" :size="20" /><PhMagnifyingGlassPlus
            v-else
            :size="20"
        /></span>
      </button>
      <span v-if="preferred" class="media-card__badge"
        ><PhSparkle :size="13" weight="fill" /> Highest resolution in this group</span
      >
    </div>
    <div class="media-card__body">
      <div class="media-card__title">
        <h3 :title="file.name">{{ file.name }}</h3>
        <button
          class="icon-button"
          title="Show in folder"
          aria-label="Show in folder"
          @click="emit('reveal', file.id)"
        >
          <PhFolderOpen :size="19" />
        </button>
      </div>
      <p class="media-card__path" :title="file.path">{{ file.relativePath }}</p>
      <div class="media-card__metadata">
        <span>{{ file.width }} × {{ file.height }}</span
        ><span>{{ formatBytes(file.size) }}</span
        ><span v-if="file.duration">{{ formatDuration(file.duration) }}</span>
      </div>
      <p v-if="videoFailed" class="media-card__warning">
        This format cannot be played here. Open it from its folder to review it.
      </p>
      <label :class="['media-card__selection', { 'media-card__selection--disabled': disabled }]">
        <input
          type="checkbox"
          :checked="selected"
          :disabled="disabled"
          @change="emit('toggle', file.id)"
        />
        <span>{{ selected ? 'Selected for Recycle Bin' : 'Select for Recycle Bin' }}</span
        ><PhTrash :size="16" />
      </label>
    </div>
  </article>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch, type PropType } from 'vue'
import {
  PhFolderOpen,
  PhMagnifyingGlassPlus,
  PhPlay,
  PhSparkle,
  PhTrash,
} from '@phosphor-icons/vue'
import type { MediaFile } from '../../../shared/types'
import { formatBytes, formatDuration, thumbnailUrl } from '../format'

const props = defineProps({
  file: { type: Object as PropType<MediaFile>, required: true },
  selected: { type: Boolean, default: false },
  preferred: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  suspendPreview: { type: Boolean, default: false },
})
const emit = defineEmits<{
  toggle: [id: string]
  reveal: [id: string]
  preview: [file: MediaFile]
}>()
const videoFailed = ref(false)
const videoRequested = ref(false)
const videoElement = ref<HTMLVideoElement | null>(null)
const releaseVideo = (): void => {
  const video = videoElement.value
  if (video) {
    video.pause()
    video.removeAttribute('src')
    video.load()
  }
  videoRequested.value = false
}
const openPreview = (): void => {
  if (props.suspendPreview) return
  if (props.file.kind === 'video') {
    videoFailed.value = false
    videoRequested.value = true
  } else emit('preview', props.file)
}
watch(
  () => props.suspendPreview,
  (suspended) => {
    if (suspended) releaseVideo()
  },
  { flush: 'sync' },
)
onBeforeUnmount(releaseVideo)
</script>

<style lang="scss">
.media-card {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: white;
  transition:
    border-color 150ms,
    box-shadow 150ms;
  &--selected {
    border-color: var(--danger);
    box-shadow: 0 0 0 1px var(--danger);
  }
  &__preview {
    position: relative;
    height: 240px;
    background: #eef0f3;
    display: flex;
    align-items: center;
    justify-content: center;
    img,
    video {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  }
  &__image-button {
    width: 100%;
    height: 100%;
    border: 0;
    padding: 0;
    background: transparent;
    cursor: zoom-in;
  }
  &__zoom {
    position: absolute;
    bottom: 12px;
    right: 12px;
    display: grid;
    place-items: center;
    padding: 7px;
    border-radius: 8px;
    color: white;
    background: #18202cb3;
  }
  &__badge {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    gap: 5px;
    align-items: center;
    border: 1px solid #ddd9fc;
    border-radius: 6px;
    padding: 5px 8px;
    font-size: 11px;
    font-weight: 600;
    color: #5d43bb;
    background: #f4f0ff;
    pointer-events: none;
  }
  &__body {
    padding: 17px;
  }
  &__title {
    display: flex;
    align-items: center;
    gap: 8px;
    h3 {
      flex: 1;
      min-width: 0;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
  &__path {
    margin-top: 5px;
    color: var(--muted);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &__metadata {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
    span {
      padding: 4px 7px;
      background: var(--surface);
      border-radius: 5px;
      font-size: 11px;
      color: var(--muted);
    }
  }
  &__warning {
    margin-top: 10px;
    font-size: 12px;
    color: #986319;
  }
  &__selection {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 17px;
    padding-top: 15px;
    border-top: 1px solid var(--border);
    color: var(--muted);
    font-size: 12px;
    cursor: pointer;
    span {
      flex: 1;
    }
    input {
      accent-color: var(--danger);
      width: 16px;
      height: 16px;
    }
    &--disabled {
      opacity: 0.5;
      cursor: default;
    }
  }
  &--selected &__selection {
    color: var(--danger);
  }
}
</style>
