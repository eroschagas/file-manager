<template>
  <div class="app-shell">
    <AppHeader @home="controller.goHome" /><AppNotice
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
import { onBeforeUnmount } from 'vue'
import { FileManagerController } from './controllers/FileManagerController'
const controller = new FileManagerController(window.desktop)
controller.initialize()
onBeforeUnmount(controller.dispose)
</script>

<style lang="scss" scoped>
.app-shell {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
