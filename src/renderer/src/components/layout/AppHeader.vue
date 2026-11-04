<template>
  <header class="app-header">
    <a class="app-header__brand" href="#" @click.prevent="emit('home')"
      ><span class="app-header__logo"><PhStack :size="23" weight="bold" /></span>File Manager<span
        class="app-header__version"
        >LOCAL</span
      ></a
    >
    <div class="app-header__privacy">
      <PhShieldCheck :size="17" /> Your files stay on your computer
    </div>
  </header>
</template>

<script setup lang="ts">
import { PhStack, PhShieldCheck } from '@phosphor-icons/vue'
const emit = defineEmits<{ home: [] }>()
</script>

<style lang="scss" scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  flex-shrink: 0;
  height: 80px;
  padding: 0 42px;
  border-bottom: 1px solid var(--border);
  background: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  &__brand {
    display: flex;
    align-items: center;
    gap: 11px;
    color: var(--text);
    text-decoration: none;
    font-weight: 700;
    font-size: 18px;
    letter-spacing: -0.4px;
  }
  &__logo {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    color: white;
    background: var(--primary);
    border-radius: 10px;
  }
  &__version {
    margin-left: 5px;
    padding: 4px 6px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 9px;
    letter-spacing: 1px;
    color: var(--muted);
    font-weight: 600;
  }
  &__privacy {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--muted);
    svg {
      color: #799784;
    }
  }
}
@media (max-width: 1050px) {
  .app-header {
    padding: 0 25px;
  }
}
</style>
