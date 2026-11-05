<template>
  <main class="organizer-view">
    <div class="organizer-view__content">
      <UiEyebrow>FILE ORGANIZER</UiEyebrow>
      <h1>A place for every file.</h1>
      <p class="organizer-view__intro">
        Organize photos and videos by capture date from their metadata. When unavailable, use the
        file's modification date. Includes files in subfolders.
      </p>
      <div class="organizer-view__example">
        <PhFolder :size="18" /><span
          >Selected folder <span>/</span> 2026 <span>/</span> 11 - Nov
          <span>/</span> your-file.jpg</span
        >
      </div>
      <OrganizerProgress
        v-if="props.controller.state.busy"
        :session="session"
        :cancelling="props.controller.state.cancelling"
        @cancel="props.controller.cancel"
      />
      <template v-else>
        <OrganizerFolderForm
          :folder="session.state.folder"
          @change="session.setFolder"
          @browse="props.controller.chooseFolder"
          @preview="props.controller.preview"
        />
        <label class="organizer-view__cleanup">
          <input v-model="session.state.deleteEmptyFolders" type="checkbox" />
          Delete empty folders after organizing
        </label>
        <OrganizationSummary
          v-if="session.state.preview || session.state.result"
          :preview="session.state.preview"
          :result="session.state.result"
          :delete-empty-folders="session.state.deleteEmptyFolders"
          @organize="props.controller.organize"
          @preview="props.controller.preview"
        />
      </template>
      <p class="organizer-view__note">
        Month folders use numbered English abbreviations, from 01 - Jan to 12 - Dec. Other files use
        their modification date. Files without either valid date go into
        <strong>Unknown Date</strong>. Existing names are preserved whenever possible; conflicts
        receive a numbered suffix. Empty folders are only deleted after organization when the option
        is selected.
      </p>
    </div>
  </main>
</template>
<script setup lang="ts">
import { type PropType } from 'vue'
import { PhFolder } from '@phosphor-icons/vue'
import { OrganizerController } from '../controllers/OrganizerController'
import UiEyebrow from '../components/ui/UiEyebrow.vue'
import OrganizerFolderForm from '../components/organizer/OrganizerFolderForm.vue'
import OrganizerProgress from '../components/organizer/OrganizerProgress.vue'
import OrganizationSummary from '../components/organizer/OrganizationSummary.vue'
const props = defineProps({
  controller: { type: Object as PropType<OrganizerController>, required: true },
})
const session = props.controller.session
</script>
<style lang="scss" scoped>
.organizer-view {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  width: 100%;
  padding: 46px 30px;
  &__content {
    max-width: 840px;
    width: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  h1 {
    margin: -8px 0 -10px;
    font-size: 38px;
    letter-spacing: -1.3px;
    line-height: 1.2;
  }
  &__intro {
    max-width: 650px;
    margin: 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.8;
  }
  &__example {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--primary);
    font-size: 12px;
    background: #eeebfb;
    padding: 14px 16px;
    border-radius: 8px;
    span > span {
      color: #a8a0c7;
      margin: 0 8px;
    }
  }
  &__note {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.8;
    strong {
      font-weight: 600;
    }
  }
  &__cleanup {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    input {
      accent-color: var(--primary);
    }
  }
}
@media (max-width: 1050px) {
  .organizer-view {
    padding: 32px 25px;
  }
}
</style>
