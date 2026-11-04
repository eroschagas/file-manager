<template>
  <div class="empty-state">
    <PhCheckCircle :size="60" weight="light" />
    <h2>
      {{ removedCount ? 'All reviewed here.' : 'No duplicates or similar versions found.' }}
    </h2>
    <p>
      {{
        removedCount
          ? 'The selected files were moved to the Recycle Bin.'
          : 'No groups matched the current comparison criteria.'
      }}
    </p>
    <UiButton variant="primary" @click="emit('back')">
      Choose another folder <PhArrowRight :size="18" />
    </UiButton>
  </div>
</template>

<script setup lang="ts">
import { PhCheckCircle, PhArrowRight } from '@phosphor-icons/vue'
import UiButton from '../ui/UiButton.vue'
const props = defineProps({ removedCount: { type: Number, default: 0 } })
const emit = defineEmits<{ back: [] }>()
</script>

<style lang="scss" scoped>
.empty-state {
  min-height: 0;
  overflow-y: auto;
  padding: 80px 20px;
  text-align: center;
  > svg {
    color: #8ba995;
  }
  h2 {
    font-size: 21px;
    margin-top: 18px;
  }
  p {
    color: var(--muted);
    font-size: 13px;
    margin-top: 12px;
  }
  .button {
    margin-top: 26px;
  }
}
</style>
