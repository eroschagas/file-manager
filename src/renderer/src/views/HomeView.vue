<template>
  <main class="home">
    <div class="home__page">
      <div class="home__content">
        <section class="home__hero" aria-labelledby="homeTitle">
          <div class="home__intro">
            <span class="home__eyebrow">A CLEARER SPACE FOR YOUR MEMORIES</span>
            <h1 id="homeTitle">Less clutter.<br />More clarity.</h1>
            <p class="home__description">
              Meet Lumora. Find similar photos and videos, bring order to your folders, and give
              your media the right details. All in one place, right on your computer.
            </p>
            <div class="home__privacy">
              <PhShieldCheck :size="20" /> Local processing. No uploads.
            </div>
          </div>
          <div class="home__identity">
            <img class="home__logo" :src="logo" alt="Lumora logo" width="144" height="144" />
            <strong class="home__name">Lumora</strong>
            <span>Your media, beautifully in order.</span>
          </div>
        </section>
        <section class="home__tools" aria-labelledby="toolsTitle">
          <div class="home__section-heading">
            <h2 id="toolsTitle">Make room for what matters.</h2>
            <p>Choose a tool to get started.</p>
          </div>
          <div class="home__grid">
            <button
              v-for="tool in tools"
              :key="tool.tab"
              class="home__tool"
              @click="emit('navigate', tool.tab)"
            >
              <component :is="tool.icon" class="home__tool-icon" :size="28" />
              <h3>{{ tool.title }}</h3>
              <p>{{ tool.description }}</p>
              <span class="home__tool-action">{{ tool.action }} <PhArrowUpRight :size="18" /></span>
            </button>
          </div>
        </section>
      </div>
      <footer class="home__footer">
        <div class="home__footer-content">
          <p>
            <strong>Lumora</strong> <span>Version {{ version }}</span>
          </p>
          <p>Built with Vue, TypeScript &amp; Electron. Designed for local media collections.</p>
        </div>
      </footer>
    </div>
  </main>
</template>

<script setup lang="ts">
import {
  PhArrowUpRight,
  PhImages,
  PhFolders,
  PhSlidersHorizontal,
  PhShieldCheck,
} from '@phosphor-icons/vue'
import type { Component } from 'vue'
import type { ToolTab } from '../../../shared/navigation'
import { version } from '../../../../package.json'
import logo from '../../../../resources/lumora.svg'

interface HomeTool {
  tab: ToolTab
  icon: Component
  title: string
  description: string
  action: string
}

const emit = defineEmits<{ navigate: [tab: ToolTab] }>()
const tools: HomeTool[] = [
  {
    tab: 'duplicates',
    icon: PhImages,
    title: 'Find the keepers',
    description:
      'Compare duplicate and visually similar photos and videos. Review your selection before moving files to the Recycle Bin.',
    action: 'Find duplicates',
  },
  {
    tab: 'organizer',
    icon: PhFolders,
    title: 'A place for every file',
    description:
      'Turn scattered files into folders organized by year and month. Preview their destinations before making a move.',
    action: 'Organize files',
  },
  {
    tab: 'metadata',
    icon: PhSlidersHorizontal,
    title: 'Get the details right',
    description:
      'Edit dates, titles, authors, and camera details across your photos and videos. Review and confirm each batch.',
    action: 'Edit metadata',
  },
]
</script>

<style lang="scss" scoped>
.home {
  flex: 1;
  min-height: 0;
  overflow: auto;
  &__page {
    min-height: 100%;
    display: flex;
    flex-direction: column;
  }
  &__content {
    flex: 1;
    width: min(var(--content-max-width), calc(100% - 2 * var(--page-gutter)));
    margin: 0 auto;
    padding: 56px 0 32px;
  }
  &__hero {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    align-items: center;
    gap: 56px;
    padding-bottom: 48px;
  }
  &__eyebrow {
    color: var(--primary);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.8px;
  }
  h1 {
    margin: 18px 0;
    font-size: clamp(36px, 4.5vw, 60px);
    line-height: 1.08;
    letter-spacing: -2px;
  }
  &__description {
    max-width: 510px;
    color: var(--muted);
    font-size: 15px;
    line-height: 1.8;
  }
  &__privacy {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 24px;
    color: var(--primary-dark);
    font-size: 12px;
    font-weight: 600;
  }
  &__identity {
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: 14px;
    padding: 38px 20px;
    border: 1px solid #e7e1fa;
    border-radius: 28px;
    background: radial-gradient(ellipse at top, #e8e1ff, #f8f6ff 70%);
    color: var(--muted);
    font-size: 13px;
  }
  &__logo {
    filter: drop-shadow(0 16px 20px #5140b326);
  }
  &__name {
    color: var(--text);
    font-size: 34px;
    letter-spacing: -1.4px;
  }
  &__section-heading {
    margin-bottom: 24px;
    h2 {
      margin: 0 0 8px;
      font-size: 22px;
      letter-spacing: -0.6px;
    }
    p {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
    }
  }
  &__grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
  }
  &__tool {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 26px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: white;
    color: var(--text);
    text-align: left;
    font: inherit;
    cursor: pointer;
    transition:
      border-color 150ms,
      box-shadow 150ms;
    h3 {
      margin: 22px 0 10px;
      font-size: 17px;
    }
    p {
      margin: 0 0 24px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.75;
    }
    &:hover {
      border-color: var(--primary);
      box-shadow: 0 8px 24px #6650d810;
    }
    &:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 4px;
    }
  }
  &__tool-icon {
    color: var(--primary);
  }
  &__tool-action {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    margin-top: auto;
    color: var(--primary);
    font-size: 12px;
    font-weight: 600;
  }
  &__footer {
    flex-shrink: 0;
    border-top: 1px solid var(--border);
    padding: 20px var(--page-gutter) 24px;
    font-size: 11px;
    color: var(--muted);
  }
  &__footer-content {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    max-width: var(--content-max-width);
    margin: 0 auto;
    p {
      margin: 0;
    }
    strong {
      color: var(--text);
      margin-right: 10px;
    }
  }
}
@media (max-width: 1050px) {
  .home {
    &__content {
      padding-top: 32px;
    }
    &__hero {
      gap: 28px;
    }
    &__tool {
      padding: 20px;
    }
  }
}
@media (max-width: 767px) {
  .home {
    &__content {
      padding-top: 28px;
    }
    &__hero {
      grid-template-columns: 1fr;
      gap: 28px;
    }
    &__identity {
      padding: 24px;
    }
    &__grid {
      grid-template-columns: 1fr;
    }
    &__footer-content {
      flex-direction: column;
    }
  }
}
</style>
