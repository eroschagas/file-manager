<template>
  <aside class="group-list">
    <div class="group-list__heading">
      <h2>Groups found</h2>
      <span>{{ groups.length }}</span>
    </div>
    <div class="group-list__filters">
      <button
        v-for="option in filterOptions"
        :key="option.value"
        :class="['group-list__filter', { 'group-list__filter--active': filter === option.value }]"
        :disabled="deleting"
        @click="emit('filter', option.value)"
      >
        {{ option.label }}
      </button>
    </div>
    <div class="group-list__items">
      <button
        v-for="(group, index) in groups"
        :key="group.id"
        :class="['group-list__item', { 'group-list__item--active': activeId === group.id }]"
        :disabled="deleting"
        @click="emit('select', group.id)"
      >
        <img :src="thumbnailUrl(group.files[0].id)" alt="" /><span
          ><strong
            >{{ group.kind === 'image' ? 'Photos' : 'Videos' }} · Group {{ index + 1 }}</strong
          ><small
            >{{ group.files.length }} files ·
            {{ group.match === 'exact' ? 'Identical' : 'Similar' }}</small
          ></span
        ><span
          :class="[
            'group-list__selected-count',
            { 'group-list__selected-count--active': selectedCounts[group.id] > 0 },
          ]"
          :aria-label="`${selectedCounts[group.id]} files selected in this group`"
          >{{ selectedCounts[group.id] }}</span
        ><PhCaretRight :size="16" />
      </button>
    </div>
    <p v-if="!groups.length" class="group-list__empty">No groups match this filter.</p>
  </aside>
</template>

<script setup lang="ts">
import { PhCaretRight } from '@phosphor-icons/vue'
import { type PropType } from 'vue'
import type { SimilarGroup } from '../../../../shared/types'
import type { MediaFilter } from '../../models/ReviewSession'
import { thumbnailUrl } from '../../format'
const props = defineProps({
  groups: { type: Array as PropType<SimilarGroup[]>, required: true },
  activeId: { type: String, default: '' },
  selectedCounts: { type: Object as PropType<Record<string, number>>, required: true },
  filter: { type: String as PropType<MediaFilter>, required: true },
  deleting: { type: Boolean, default: false },
})
const emit = defineEmits<{ filter: [filter: MediaFilter]; select: [id: string] }>()
const filterOptions: { value: MediaFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Photos' },
  { value: 'video', label: 'Videos' },
]
</script>

<style lang="scss" scoped>
.group-list {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: white;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  &__heading {
    flex-shrink: 0;
    padding: 19px 16px 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    h2 {
      font-size: 13px;
      font-weight: 600;
    }
    > span {
      padding: 3px 6px;
      border-radius: 5px;
      background: var(--surface);
      color: var(--muted);
      font-size: 10px;
    }
  }
  &__filters {
    flex-shrink: 0;
    display: flex;
    gap: 4px;
    padding: 0 13px 15px;
    border-bottom: 1px solid var(--border);
  }
  &__filter {
    padding: 6px 10px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--muted);
    font-size: 11px;
    &--active {
      background: #efebfc;
      color: var(--primary);
      font-weight: 600;
    }
  }
  &__items {
    flex: 1;
    min-height: 0;
    overscroll-behavior: contain;
    overflow-y: auto;
    padding: 7px;
  }
  &__item {
    > .group-list__selected-count {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 23px;
      height: 23px;
      padding: 0 6px;
      border-radius: 20px;
      background: var(--surface);
      color: var(--muted);
      font-size: 11px;
      font-weight: 600;
    }
    > .group-list__selected-count--active {
      background: var(--primary);
      color: white;
    }
    display: flex;
    align-items: center;
    width: 100%;
    text-align: left;
    gap: 10px;
    padding: 12px 8px;
    background: white;
    border: 0;
    border-radius: 7px;
    margin: 3px 0;
    img {
      width: 42px;
      height: 42px;
      object-fit: cover;
      border-radius: 6px;
    }
    > span {
      flex: 1;
      min-width: 0;
    }
    strong {
      display: block;
      font-size: 11px;
      font-weight: 600;
    }
    small {
      display: block;
      font-size: 10px;
      color: var(--muted);
      margin-top: 6px;
    }
    svg {
      color: #b0afbc;
    }
    &--active {
      background: #f1edfd;
      strong,
      svg {
        color: var(--primary);
      }
    }
    &:hover:not(:disabled) {
      background: #f5f3fc;
    }
  }
  &__empty {
    padding: 18px;
    font-size: 12px;
    color: var(--muted);
  }
}
</style>
