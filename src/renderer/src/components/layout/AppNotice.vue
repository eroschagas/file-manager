<template>
  <div :class="['notice', { 'notice--error': isError }]" role="status">
    <span>{{ message }}</span
    ><UiButton variant="icon" aria-label="Dismiss notification" @click="emit('dismiss')">
      <PhX :size="18" />
    </UiButton>
  </div>
</template>

<script setup lang="ts">
import { PhX } from '@phosphor-icons/vue'
import UiButton from '../ui/UiButton.vue'
const props = defineProps({
  message: { type: String, required: true },
  isError: { type: Boolean, default: false },
})
const emit = defineEmits<{ dismiss: [] }>()
</script>

<style lang="scss" scoped>
.notice {
  flex-shrink: 0;
  max-height: 140px;
  overflow-y: auto;
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 28px;
  background: #eaf4ee;
  color: #3c7052;
  font-size: 13px;
  &--error {
    background: #fff0ed;
    color: #a34139;
  }
}
</style>
