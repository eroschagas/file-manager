<template>
  <section class="group-detail">
    <nav class="group-detail__navigation" aria-label="Group navigation">
      <span>Group {{ groupIndex + 1 }} of {{ groupCount }}</span>
      <UiButton
        :disabled="deleting || groupIndex <= 0"
        aria-label="Previous group"
        @click="emit('prev')"
        ><PhCaretLeft :size="16" /> Prev</UiButton
      >
      <UiButton
        :disabled="deleting || groupIndex < 0 || groupIndex >= groupCount - 1"
        aria-label="Next group"
        @click="emit('next')"
        >Next <PhCaretRight :size="16"
      /></UiButton>
    </nav>
    <div class="group-detail__heading">
      <div>
        <UiEyebrow>
          {{ group.match === 'exact' ? 'EXACT DUPLICATES' : 'SIMILAR VISUAL CONTENT' }}
        </UiEyebrow>
        <h2>Compare before choosing</h2>
        <p>
          {{ group.files.length }} versions, largest to smallest · select the files to move to the
          Recycle Bin.
        </p>
      </div>
      <div class="group-detail__actions">
        <UiButton :disabled="deleting" @click="emit('toggleGroup')">{{
          hasSelection ? 'Deselect all' : 'Select all'
        }}</UiButton>
        <!-- <span class="group-detail__type"
          ><PhImage v-if="group.kind === 'image'" :size="19" /><PhFilmStrip v-else :size="19"
        /></span> -->
      </div>
    </div>
    <!-- <div class="group-detail__hint">
      <PhInfo :size="19" />
      <p>
        All except the highest-resolution file are selected initially; file size breaks ties.
        {{
          group.kind === 'video'
            ? 'The comparison uses frames from five points in the video. Also check the audio and the full content.'
            : 'Higher resolution is a reference, but does not guarantee better quality. Check the details before deleting.'
        }}
      </p>
    </div> -->
    <div class="group-detail__cards">
      <MediaCard
        v-for="file in group.files"
        :key="file.id"
        :file="file"
        :suspend-preview="deleting"
        :preferred="file.id === highestResolutionId && group.match !== 'exact'"
        :selected="selectedIds.has(file.id)"
        :disabled="deleting"
        @toggle="emit('toggle', $event)"
        @reveal="emit('reveal', $event)"
        @preview="emit('preview', $event)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { PhImage, PhFilmStrip, PhInfo, PhCaretLeft, PhCaretRight } from '@phosphor-icons/vue'
import MediaCard from '../MediaCard.vue'
import UiEyebrow from '../ui/UiEyebrow.vue'
import UiButton from '../ui/UiButton.vue'
import { computed, type PropType } from 'vue'
import type { MediaFile, SimilarGroup } from '../../../../shared/types'
const props = defineProps({
  group: { type: Object as PropType<SimilarGroup>, required: true },
  selectedIds: { type: Object as PropType<Set<string>>, required: true },
  highestResolutionId: { type: String, default: undefined },
  deleting: { type: Boolean, default: false },
  groupIndex: { type: Number, default: 0 },
  groupCount: { type: Number, default: 1 },
})
const emit = defineEmits<{
  toggle: [id: string]
  toggleGroup: []
  prev: []
  next: []
  reveal: [id: string]
  preview: [file: MediaFile]
}>()
const hasSelection = computed(() =>
  props.group.files.some((file) => props.selectedIds.has(file.id)),
)
</script>

<style lang="scss" scoped>
.group-detail {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding-right: 6px;
  min-width: 0;
  &__navigation {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 0 0 8px;
    background: #f7f8fa;
    > span {
      margin-right: auto;
      color: var(--muted);
      font-size: 12px;
    }
    > button {
      min-height: 36px;
      padding: 8px 12px;
    }
  }
  &__heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 4px 0 12px;
    h2 {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.4px;
      margin-top: 8px;
    }
    p {
      font-size: 12px;
      color: var(--muted);
      margin-top: 7px;
    }
  }
  &__type {
    width: 37px;
    height: 37px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    border: 1px solid var(--border);
    color: var(--muted);
    background: white;
  }
  &__actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  &__hint {
    display: flex;
    gap: 9px;
    align-items: center;
    padding: 11px 13px;
    border: 1px solid #e4e0f4;
    border-radius: 7px;
    color: #8275a7;
    background: #f3f0fc;
    margin-bottom: 18px;
    svg {
      flex-shrink: 0;
    }
    p {
      font-size: 11px;
      line-height: 1.6;
    }
  }
  &__cards {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 17px;
  }
}
@media (min-width: 1700px) {
  .group-detail__cards {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
