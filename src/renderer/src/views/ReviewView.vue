<template>
  <main class="results">
    <ResultsOverview
      :result="result"
      :grouped-count="review.groupedCount"
      :potential-space="review.potentialSpace"
      :deleting="deleting"
      @back="emit('back')"
    />
    <div v-if="result.groups.length" class="comparison">
      <GroupList
        :groups="review.filteredGroups"
        :active-id="review.activeGroup?.id"
        :selected-counts="review.selectedCounts"
        :filter="review.state.filter"
        :deleting="deleting"
        @filter="review.setFilter"
        @select="review.selectGroup"
      /><GroupComparison
        v-if="review.activeGroup"
        :key="review.activeGroup.id"
        :group="review.activeGroup"
        :selected-ids="review.state.selectedIds"
        :highest-resolution-id="review.highestResolutionId"
        :deleting="deleting"
        :group-index="review.activeGroupIndex"
        :group-count="review.filteredGroups.length"
        @toggle="emit('toggle', $event)"
        @prev="!deleting && review.navigateGroup(-1)"
        @next="!deleting && review.navigateGroup(1)"
        @toggle-group="!deleting && review.toggleGroupSelection()"
        @reveal="emit('reveal', $event)"
        @preview="emit('preview', $event)"
      />
    </div>
    <EmptyReviewState v-else :removed-count="review.state.removedCount" @back="emit('back')" />
  </main>
</template>

<script setup lang="ts">
import ResultsOverview from '../components/review/ResultsOverview.vue'
import GroupList from '../components/review/GroupList.vue'
import GroupComparison from '../components/review/GroupComparison.vue'
import EmptyReviewState from '../components/review/EmptyReviewState.vue'
import { type PropType } from 'vue'
import type { MediaFile, ScanResult } from '../../../shared/types'
import type { ReviewSession } from '../models/ReviewSession'
const props = defineProps({
  result: { type: Object as PropType<ScanResult>, required: true },
  review: { type: Object as PropType<ReviewSession>, required: true },
  deleting: { type: Boolean, default: false },
})
const emit = defineEmits<{
  back: []
  toggle: [id: string]
  reveal: [id: string]
  preview: [file: MediaFile]
}>()
</script>

<style lang="scss" scoped>
.results {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: min(var(--content-max-width), calc(100% - 2 * var(--page-gutter)));
  margin: 0 auto;
  overflow: hidden;
  padding: 16px 0;
}
.comparison {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 255px minmax(0, 1fr);
  gap: 25px;
  margin-top: 12px;
  grid-template-rows: minmax(0, 1fr);
  align-items: stretch;
}
@media (max-width: 1050px) {
  .comparison {
    grid-template-columns: 210px minmax(0, 1fr);
    gap: 18px;
  }
}
</style>
