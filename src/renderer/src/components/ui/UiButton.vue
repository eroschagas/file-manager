<template>
  <button :type="type" :class="classes" :disabled="disabled"><slot /></button>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'text' | 'icon'
const props = defineProps({
  variant: { type: String as PropType<ButtonVariant>, default: 'secondary' },
  type: { type: String as PropType<'button' | 'submit' | 'reset'>, default: 'button' },
  disabled: { type: Boolean, default: false },
})
const classes = computed(() =>
  props.variant === 'text'
    ? ['text-button']
    : props.variant === 'icon'
      ? ['icon-button']
      : ['button', 'button--' + props.variant],
)
</script>

<style lang="scss" scoped>
.button {
  min-height: 43px;
  padding: 11px 17px;
  border: 1px solid transparent;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  font-size: 13px;
  font-weight: 600;
  transition: background 150ms;
  flex-shrink: 0;
  &--primary {
    background: var(--primary);
    color: white;
    &:hover:not(:disabled) {
      background: var(--primary-dark);
    }
  }
  &--secondary {
    background: white;
    border-color: var(--border);
    &:hover:not(:disabled) {
      background: var(--surface);
    }
  }
  &--danger {
    background: var(--danger);
    color: white;
    &:hover:not(:disabled) {
      background: #b63d47;
    }
  }
}
.text-button {
  border: 0;
  background: none;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0;
  color: var(--muted);
  font-size: 12px;
  &:hover:not(:disabled) {
    color: var(--primary);
  }
}
.icon-button {
  border: 0;
  background: transparent;
  width: 32px;
  height: 32px;
  padding: 0;
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  color: var(--muted);
  border-radius: 5px;
  &:hover {
    background: var(--surface);
    color: var(--text);
  }
}
</style>
