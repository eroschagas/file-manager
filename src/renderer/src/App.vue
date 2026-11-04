<template>
  <div class="app-shell">
    <AppHeader :active-tab="activeTab" :busy="busy" @home="goHome" @navigate="navigate" />
    <template v-if="activeTab === 'duplicates'">
      <AppNotice
        v-if="controller.state.message"
        :message="controller.state.message"
        :is-error="controller.state.isError"
        @dismiss="controller.dismissMessage"
      />
      <FolderSelectionView
        v-if="controller.state.screen === 'setup'"
        :folders="controller.folders"
        :starting="controller.state.starting"
        @start="controller.startScan"
        @browse="controller.chooseFolder"
      />
      <ScanProgressView
        v-else-if="controller.state.screen === 'scanning'"
        :scan="controller.scan"
        :folders="controller.folders.selectedFolders"
        :cancelling="controller.state.cancelling"
        @cancel="controller.cancelScan"
      />
      <ReviewView
        v-else-if="controller.scan.state.result"
        :result="controller.scan.state.result"
        :review="controller.review"
        :deleting="controller.state.deleting"
        @back="controller.goHome"
        @toggle="controller.toggleSelection"
        @reveal="controller.revealFile"
        @preview="controller.openPreview"
      />
      <SelectionBar
        v-if="controller.state.screen === 'results' && controller.scan.state.result?.groups.length"
        :count="controller.review.selectedFiles.length"
        :selected-size="controller.review.selectedSize"
        :deleting="controller.state.deleting"
        @clear="controller.review.clearSelection"
        @trash="controller.trashSelected"
      />
      <ImagePreviewDialog :file="controller.state.previewFile" @close="controller.closePreview" />
    </template>
    <template v-else>
      <AppNotice
        v-if="organizer.state.message"
        :message="organizer.state.message"
        :is-error="organizer.state.isError"
        @dismiss="organizer.dismissMessage"
      />
      <OrganizerView :controller="organizer" />
    </template>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './components/layout/AppHeader.vue'
import AppNotice from './components/layout/AppNotice.vue'
import FolderSelectionView from './views/FolderSelectionView.vue'
import ScanProgressView from './views/ScanProgressView.vue'
import ReviewView from './views/ReviewView.vue'
import SelectionBar from './components/review/SelectionBar.vue'
import ImagePreviewDialog from './components/review/ImagePreviewDialog.vue'
import { computed, onBeforeUnmount, ref } from 'vue'
import { FileManagerController } from './controllers/FileManagerController'
import { OrganizerController } from './controllers/OrganizerController'
import OrganizerView from './views/OrganizerView.vue'
const controller = new FileManagerController(window.desktop)
const organizer = new OrganizerController(window.desktop, () => {
  controller.goHome()
  controller.scan.begin()
  controller.review.reset()
})
const activeTab = ref<'duplicates' | 'organizer'>('duplicates')
const busy = computed(
  () =>
    organizer.state.busy ||
    controller.state.starting ||
    controller.state.deleting ||
    controller.state.screen === 'scanning',
)
const navigate = (tab: 'duplicates' | 'organizer'): void => {
  if (busy.value) return
  controller.closePreview()
  activeTab.value = tab
}
const goHome = (): void => {
  if (!busy.value) {
    navigate('duplicates')
    controller.goHome()
  }
}
controller.initialize()
organizer.initialize()
onBeforeUnmount(() => {
  controller.dispose()
  organizer.dispose()
})
</script>

<style lang="scss" scoped>
.app-shell {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
