<template>
  <div class="page-intro">
    <UiEyebrow>{{ props.eyebrow }}</UiEyebrow>
    <h1 :id="props.titleId">{{ props.title }}</h1>
    <p><slot /></p>
  </div>
</template>

<script setup lang="ts">
import UiEyebrow from './UiEyebrow.vue'

const props = defineProps({
  eyebrow: { type: String, required: true },
  title: { type: String, required: true },
  titleId: { type: String, default: undefined },
})
</script>

<style lang="scss" scoped>
.page-intro {
  display: flex;
  flex-direction: column;
  gap: 22px;
  text-align: left;
  h1 {
    margin: -8px 0 -10px;
    font-size: 38px;
    letter-spacing: -1.3px;
    line-height: 1.2;
  }
  p {
    max-width: 650px;
    margin: 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.8;
  }
}
</style>
