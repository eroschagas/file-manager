<template>
  <section class="organizer-progress" aria-live="polite">
    <h2>{{ props.session.phaseTitle }}</h2>
    <p>
      {{ props.session.state.progress.processed
      }}<template v-if="props.session.state.progress.total">
        / {{ props.session.state.progress.total }}</template
      >
      files
    </p>
    <div
      class="organizer-progress__track"
      role="progressbar"
      :aria-label="props.session.phaseTitle"
      :aria-valuenow="props.session.state.progress.total ? props.session.percent : undefined"
      :class="{ 'organizer-progress__track--reading': !props.session.state.progress.total }"
    >
      <span
        :style="{ width: `${props.session.state.progress.total ? props.session.percent : 35}%` }"
      />
    </div>
    <p class="organizer-progress__file" :title="props.session.state.progress.currentFile">
      {{ props.session.state.progress.currentFile || 'Preparing…' }}
    </p>
    <UiButton :disabled="props.cancelling" @click="emit('cancel')">{{
      props.cancelling ? 'Canceling…' : 'Cancel'
    }}</UiButton>
    <p v-if="props.session.state.progress.phase === 'moving'" class="organizer-progress__hint">
      Canceling stops after the current file. Files already moved stay organized.
    </p>
  </section>
</template>
<script setup lang="ts">
import { type PropType } from 'vue'
import { OrganizerSession } from '../../models/OrganizerSession'
import UiButton from '../ui/UiButton.vue'
const props = defineProps({
  session: { type: Object as PropType<OrganizerSession>, required: true },
  cancelling: { type: Boolean, default: false },
})
const emit = defineEmits<{ cancel: [] }>()
</script>
<style lang="scss" scoped>
.organizer-progress {
  padding: 38px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: white;
  text-align: center;
  min-width: 0;
  h2 {
    font-size: 21px;
    margin: 0 0 10px;
  }
  p {
    color: var(--muted);
    font-size: 13px;
  }
  &__track {
    height: 7px;
    border-radius: 10px;
    background: #efedf8;
    overflow: hidden;
    margin: 25px auto 15px;
    max-width: 550px;
    span {
      display: block;
      height: 100%;
      background: var(--primary);
      border-radius: inherit;
      transition: width 0.2s;
    }
  }
  &__track--reading span {
    animation: progress 1.5s ease-in-out infinite alternate;
  }
  &__file {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin: 0 auto 24px;
    max-width: 550px;
  }
  &__hint {
    margin-bottom: 0;
  }
}
@keyframes progress {
  to {
    transform: translateX(180%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .organizer-progress__track--reading span {
    animation: none;
  }
}
</style>
