<template>
  <footer class="selection-bar">
    <div>
      <span class="selection-bar__icon"><PhTrash :size="20" /></span>
      <div>
        <strong>{{ count }} file(s) selected</strong>
        <p>{{ formatBytes(selectedSize) }} to free up · nothing has been removed yet</p>
      </div>
    </div>
    <div>
      <UiButton variant="text" :disabled="!count || deleting" @click="emit('clear')">
        Clear selection</UiButton
      ><UiButton variant="danger" :disabled="!count || deleting" @click="emit('trash')">
        <PhTrash :size="18" />{{ deleting ? 'Moving…' : 'Move to Recycle Bin' }}
      </UiButton>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { PhTrash } from '@phosphor-icons/vue'
import UiButton from '../ui/UiButton.vue'
import { formatBytes } from '../../format'
const props = defineProps({
  count: { type: Number, required: true },
  selectedSize: { type: Number, required: true },
  deleting: { type: Boolean, default: false },
})
const emit = defineEmits<{ clear: []; trash: [] }>()
</script>

<style lang="scss" scoped>
.selection-bar {
  position: relative;
  flex-shrink: 0;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 4;
  background: #fffffff5;
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--border);
  padding: 19px 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  > div {
    display: flex;
    align-items: center;
    gap: 18px;
  }
  strong {
    font-size: 12px;
    font-weight: 600;
  }
  p {
    color: var(--muted);
    font-size: 11px;
    margin-top: 5px;
  }
  &__icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border: 1px solid var(--border);
    border-radius: 9px;
    color: var(--muted);
  }
}
@media (max-width: 1050px) {
  .selection-bar {
    padding: 17px 25px;
  }
}
</style>
