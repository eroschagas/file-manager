<template>
  <dialog
    ref="previewDialog"
    class="image-dialog"
    @click="emit('close')"
    @cancel.prevent="emit('close')"
  >
    <div class="image-dialog__content" @click.stop>
      <div>
        <span>{{ file?.name }}</span
        ><UiButton variant="icon" aria-label="Close image" @click="emit('close')">
          <PhX :size="24" />
        </UiButton>
      </div>
      <img
        v-if="file"
        :src="`media://original/${file.id}`"
        :alt="file.name"
        @error="previewFallback"
      />
      <p>
        {{ file?.width }} × {{ file?.height }} ·
        {{ file ? formatBytes(file.size) : '' }}
      </p>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { PhX } from '@phosphor-icons/vue'
import UiButton from '../ui/UiButton.vue'
import { nextTick, onBeforeUnmount, ref, watch, type PropType } from 'vue'
import type { MediaFile } from '../../../../shared/types'
import { formatBytes, thumbnailUrl } from '../../format'
const props = defineProps({ file: { type: Object as PropType<MediaFile | null>, default: null } })
const emit = defineEmits<{ close: [] }>()
const previewDialog = ref<HTMLDialogElement | null>(null)
const previewFallback = (event: Event): void => {
  const image = event.target as HTMLImageElement
  if (props.file && image.src !== thumbnailUrl(props.file.id))
    image.src = thumbnailUrl(props.file.id)
}
watch(
  () => props.file,
  async (file) => {
    if (file) {
      await nextTick()
      if (props.file) previewDialog.value?.showModal()
    } else previewDialog.value?.close()
  },
)
onBeforeUnmount(() => previewDialog.value?.close())
</script>

<style lang="scss" scoped>
.image-dialog {
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 14px;
  width: min(1100px, 92vw);
  max-height: 92vh;
  color: var(--text);
  background: white;
  &::backdrop {
    background: #151622bb;
    backdrop-filter: blur(5px);
  }
  &__content {
    padding: 17px;
    > div {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      font-size: 13px;
      margin-bottom: 15px;
    }
    img {
      width: 100%;
      height: 68vh;
      object-fit: contain;
      background: var(--surface);
      border-radius: 7px;
    }
    p {
      margin-top: 12px;
      font-size: 12px;
      color: var(--muted);
    }
  }
}
</style>
