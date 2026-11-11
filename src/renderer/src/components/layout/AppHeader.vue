<template>
  <header class="app-header">
    <a class="app-header__brand" href="#" @click.prevent="emit('home')"
      ><img class="app-header__logo" :src="logo" alt="" width="36" height="36" />Lumora<span
        class="app-header__version"
        >LOCAL</span
      ></a
    >
    <nav class="app-header__tabs" aria-label="Tools">
      <button
        :class="['app-header__tab', { 'app-header__tab--active': props.activeTab === 'home' }]"
        :aria-current="props.activeTab === 'home' ? 'page' : undefined"
        :disabled="props.busy"
        @click="emit('navigate', 'home')"
      >
        Home
      </button>
      <button
        :class="[
          'app-header__tab',
          { 'app-header__tab--active': props.activeTab === 'duplicates' },
        ]"
        :aria-current="props.activeTab === 'duplicates' ? 'page' : undefined"
        :disabled="props.busy"
        @click="emit('navigate', 'duplicates')"
      >
        Duplicates
      </button>
      <button
        :class="['app-header__tab', { 'app-header__tab--active': props.activeTab === 'organizer' }]"
        :aria-current="props.activeTab === 'organizer' ? 'page' : undefined"
        :disabled="props.busy"
        @click="emit('navigate', 'organizer')"
      >
        File organizer
      </button>
      <button
        :class="['app-header__tab', { 'app-header__tab--active': props.activeTab === 'metadata' }]"
        :aria-current="props.activeTab === 'metadata' ? 'page' : undefined"
        :disabled="props.busy"
        @click="emit('navigate', 'metadata')"
      >
        Metadata
      </button>
    </nav>
    <div class="app-header__privacy">
      <PhShieldCheck :size="17" /> Your files stay on your computer
    </div>
  </header>
</template>

<script setup lang="ts">
import { PhShieldCheck } from '@phosphor-icons/vue'
import logo from '../../../../../resources/lumora.svg'
import type { AppTab } from '../../../../shared/navigation'
const props = defineProps({
  activeTab: { type: String, default: 'home' },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits<{ home: []; navigate: [tab: AppTab] }>()
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
  gap: 24px;
  &__tabs {
    display: flex;
    height: 100%;
    gap: 24px;
  }
  &__tab {
    border: 0;
    border-bottom: 2px solid transparent;
    padding: 0 2px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    &:disabled {
      cursor: default;
      opacity: 0.6;
    }
    &:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 3px;
    }
  }
  &__tab--active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }
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
    &__privacy {
      font-size: 0;
      gap: 0;
    }
  }
}
@media (max-width: 767px) {
  .app-header {
    height: auto;
    padding: 16px 20px 0;
    flex-wrap: wrap;
    gap: 12px;
    &__tabs {
      order: 3;
      width: 100%;
      height: 44px;
      justify-content: space-between;
      gap: 12px;
    }
    &__brand {
      font-size: 17px;
    }
  }
}
</style>
