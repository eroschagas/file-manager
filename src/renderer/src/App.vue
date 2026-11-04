<template>
  <div class="app-shell">
    <header class="app-header">
      <a class="app-header__brand" href="#" @click.prevent="goHome"
        ><span class="app-header__logo"><PhStack :size="23" weight="bold" /></span>File Manager<span
          class="app-header__version"
          >LOCAL</span
        ></a
      >
      <div class="app-header__privacy">
        <PhShieldCheck :size="17" /> Your files stay on your computer
      </div>
    </header>

    <div v-if="message" :class="['notice', { 'notice--error': isError }]" role="status">
      <span>{{ message }}</span
      ><button class="icon-button" aria-label="Dismiss notification" @click="message = ''">
        <PhX :size="18" />
      </button>
    </div>

    <main v-if="screen === 'setup'" class="setup">
      <div class="setup__eyebrow"><span></span> MORE SPACE. FEWER COPIES.</div>
      <h1>Find what is taking<br />up space twice<span>.</span></h1>
      <p class="setup__description">
        Compare similar photos and videos, even at different quality levels.<br />You decide what
        stays and what goes to the Recycle Bin.
      </p>

      <form class="folder-form" @submit.prevent="startScan">
        <div class="folder-form__heading">
          <span class="folder-form__icon"><PhFolderSimple :size="26" /></span>
          <div>
            <h2>Where should we start?</h2>
            <p>Choose one or more folders to organize together.</p>
          </div>
        </div>
        <div v-for="(_path, index) in folderPaths" :key="index" class="folder-form__entry">
          <label :for="`folderPath${index}`">{{
            index === 0 ? 'Folder to scan' : `Folder to scan ${index + 1}`
          }}</label>
          <div class="folder-form__input-row">
            <input
              :id="`folderPath${index}`"
              v-model="folderPaths[index]"
              placeholder="e.g. C:\Users\you\Pictures"
              autocomplete="off"
              spellcheck="false"
              :disabled="starting"
            /><button
              class="button button--secondary"
              type="button"
              :disabled="starting"
              @click="chooseFolder(index)"
            >
              <PhFolderOpen :size="18" /> Browse folders
            </button>
            <button
              v-if="folderPaths.length > 1"
              class="icon-button"
              type="button"
              :aria-label="`Remove folder ${index + 1}`"
              :disabled="starting"
              @click="folderPaths.splice(index, 1)"
            >
              <PhX :size="18" />
            </button>
          </div>
        </div>
        <button
          type="button"
          class="text-button folder-form__add"
          :disabled="starting"
          @click="folderPaths.push('')"
        >
          + Add folder
        </button>
        <div class="folder-form__recursive">
          <PhTreeStructure :size="17" /><span>All subfolders will be scanned automatically.</span>
        </div>
        <div class="folder-form__similarity">
          <label for="similarityLevel">Similarity</label>
          <div class="folder-form__select">
            <select id="similarityLevel" v-model="similarityLevel" :disabled="starting">
              <option value="strict">Strict — nearly identical files</option>
              <option value="balanced">Balanced — moderate differences</option>
              <option value="flexible">Flexible — less similar files</option>
            </select>
            <PhCaretDown :size="16" aria-hidden="true" />
          </div>
          <p>{{ similarityDescriptions[similarityLevel] }}</p>
        </div>
        <div class="folder-form__footer">
          <span
            ><PhImage :size="16" /> Photos <span class="separator">/</span>
            <PhFilmStrip :size="16" /> Videos</span
          ><button
            class="button button--primary"
            type="submit"
            :disabled="!selectedFolders.length || starting"
          >
            {{ starting ? 'Preparing…' : 'Scan files' }}<PhArrowRight :size="18" />
          </button>
        </div>
      </form>

      <div class="setup__steps">
        <div>
          <span>01</span>
          <h3>Choose a folder</h3>
          <p>We search for photos and videos<br />in every subfolder.</p>
        </div>
        <div>
          <span>02</span>
          <h3>Compare similar files</h3>
          <p>View versions side by side<br />and check the details.</p>
        </div>
        <div>
          <span>03</span>
          <h3>Free up space</h3>
          <p>Select copies and confirm<br />before moving them to the Recycle Bin.</p>
        </div>
      </div>
      <p class="setup__footnote">
        <PhLockSimple :size="14" /> No files are removed during the scan.
      </p>
    </main>

    <main v-else-if="screen === 'scanning'" class="scan-view">
      <div class="scan-view__animation"><PhScan :size="45" weight="light" /></div>
      <div class="eyebrow">FINDING WHAT BELONGS TOGETHER</div>
      <h1>{{ phaseTitle }}</h1>
      <p>We are comparing the contents of your files.</p>
      <div class="scan-view__progress">
        <div
          :class="[
            'scan-view__bar',
            { 'scan-view__bar--indeterminate': progress.phase !== 'analyzing' },
          ]"
          :style="{ width: progress.phase === 'analyzing' ? `${percent}%` : '35%' }"
        ></div>
      </div>
      <div class="scan-view__counts">
        <strong>{{
          progress.phase === 'discovering'
            ? `${progress.total} files found`
            : `${progress.processed} of ${progress.total} files`
        }}</strong
        ><span v-if="progress.phase === 'analyzing'">{{ percent }}%</span>
      </div>
      <p class="scan-view__file" :title="progress.currentFile">
        {{ progress.currentFile || selectedFolders.join(' · ') }}
      </p>
      <p v-if="progress.skipped" class="scan-view__skipped">
        {{ progress.skipped }} file(s) could not be read. Details will be available when the scan
        finishes.
      </p>
      <button class="button button--secondary" :disabled="cancelling" @click="cancelScan">
        {{ cancelling ? 'Canceling…' : 'Cancel scan' }}
      </button>
    </main>

    <main v-else-if="result" class="results">
      <div class="results__heading">
        <div>
          <button class="text-button" :disabled="deleting" @click="goHome">
            <PhArrowLeft :size="16" /> Scan another folder
          </button>
          <h1>A place for every version<span>.</span></h1>
          <p v-for="root in result.roots" :key="root" :title="root">
            <PhFolderSimple :size="16" /> {{ root }}
          </p>
        </div>
        <span class="results__complete"
          ><PhCheckCircle :size="17" weight="fill" /> Scan complete</span
        >
      </div>
      <div class="summary">
        <div>
          <span>FILES SCANNED</span
          ><strong>{{ result.analyzedFiles.toLocaleString('en-US') }}</strong
          ><small>in {{ formatDuration(result.elapsedMs / 1000) }} · including subfolders</small>
        </div>
        <div>
          <span>SIMILAR GROUPS</span
          ><strong>{{ result.groups.length }}<small> groups</small></strong
          ><small>{{ groupedCount }} files to compare</small>
        </div>
        <div>
          <span>SPACE USED BY COPIES</span><strong>{{ formatBytes(potentialSpace) }}</strong
          ><small>estimate keeping one file per group</small>
        </div>
      </div>
      <details v-if="result.issues.length" class="issues">
        <summary>
          <PhWarningCircle :size="17" /> {{ result.issues.length }} item(s) could not be scanned
        </summary>
        <p v-for="issue in result.issues" :key="`${issue.path}:${issue.message}`">
          <strong>{{ issue.path }}</strong
          ><br />{{ issue.message }}
        </p>
      </details>

      <div v-if="result.groups.length" class="comparison">
        <aside class="group-list">
          <div class="group-list__heading">
            <h2>Groups found</h2>
            <span>{{ filteredGroups.length }}</span>
          </div>
          <div class="group-list__filters">
            <button
              v-for="option in filterOptions"
              :key="option.value"
              :class="[
                'group-list__filter',
                { 'group-list__filter--active': filter === option.value },
              ]"
              :disabled="deleting"
              @click="filter = option.value"
            >
              {{ option.label }}
            </button>
          </div>
          <div class="group-list__items">
            <button
              v-for="(group, index) in filteredGroups"
              :key="group.id"
              :class="[
                'group-list__item',
                { 'group-list__item--active': activeGroup?.id === group.id },
              ]"
              :disabled="deleting"
              @click="activeId = group.id"
            >
              <img :src="thumbnailUrl(group.files[0].id)" alt="" /><span
                ><strong
                  >{{ group.kind === 'image' ? 'Photos' : 'Videos' }} · Group
                  {{ index + 1 }}</strong
                ><small
                  >{{ group.files.length }} files ·
                  {{ group.match === 'exact' ? 'Identical' : 'Similar' }}</small
                ></span
              ><PhCaretRight :size="16" />
            </button>
          </div>
          <p v-if="!filteredGroups.length" class="group-list__empty">
            No groups match this filter.
          </p>
        </aside>
        <section v-if="activeGroup" :key="activeGroup.id" class="group-detail">
          <div class="group-detail__heading">
            <div>
              <div class="eyebrow">
                {{ activeGroup.match === 'exact' ? 'EXACT DUPLICATES' : 'SIMILAR VISUAL CONTENT' }}
              </div>
              <h2>Compare before choosing</h2>
              <p>
                {{ activeGroup.files.length }} versions, largest to smallest · keep at least one
                file.
              </p>
            </div>
            <span class="group-detail__type"
              ><PhImage v-if="activeGroup.kind === 'image'" :size="19" /><PhFilmStrip
                v-else
                :size="19"
            /></span>
          </div>
          <div class="group-detail__hint">
            <PhInfo :size="19" />
            <p>
              {{
                activeGroup.kind === 'video'
                  ? 'The comparison uses frames from five points in the video. Also check the audio and the full content.'
                  : 'Higher resolution is a reference, but does not guarantee better quality. Check the details before deleting.'
              }}
            </p>
          </div>
          <div class="group-detail__cards">
            <MediaCard
              v-for="file in activeGroup.files"
              :key="file.id"
              :file="file"
              :suspend-preview="deleting"
              :preferred="file.id === highestResolutionId && activeGroup.match !== 'exact'"
              :selected="selectedIds.has(file.id)"
              :disabled="
                deleting ||
                (activeGroup.files.length > 2 &&
                  !selectedIds.has(file.id) &&
                  remainingInGroup(activeGroup) <= 1)
              "
              @toggle="toggleSelection"
              @reveal="revealFile"
              @preview="previewFile = $event"
            />
          </div>
        </section>
      </div>
      <div v-else class="empty-state">
        <PhCheckCircle :size="60" weight="light" />
        <h2>
          {{ removedCount ? 'All reviewed here.' : 'No duplicates or similar versions found.' }}
        </h2>
        <p>
          {{
            removedCount
              ? 'The selected files were moved to the Recycle Bin.'
              : 'No groups matched the current comparison criteria.'
          }}
        </p>
        <button class="button button--primary" @click="goHome">
          Choose another folder <PhArrowRight :size="18" />
        </button>
      </div>
    </main>

    <footer v-if="screen === 'results' && result?.groups.length" class="selection-bar">
      <div>
        <span class="selection-bar__icon"><PhTrash :size="20" /></span>
        <div>
          <strong>{{ selectedFiles.length }} file(s) selected</strong>
          <p>{{ formatBytes(selectedSize) }} to free up · nothing has been removed yet</p>
        </div>
      </div>
      <div>
        <button
          class="text-button"
          :disabled="!selectedFiles.length || deleting"
          @click="selectedIds = new Set()"
        >
          Clear selection</button
        ><button
          class="button button--danger"
          :disabled="!selectedFiles.length || deleting"
          @click="trashSelected"
        >
          <PhTrash :size="18" />{{ deleting ? 'Moving…' : 'Move to Recycle Bin' }}
        </button>
      </div>
    </footer>

    <dialog
      ref="previewDialog"
      class="image-dialog"
      @click="closePreview"
      @cancel.prevent="closePreview"
    >
      <div class="image-dialog__content" @click.stop>
        <div>
          <span>{{ previewFile?.name }}</span
          ><button class="icon-button" aria-label="Close image" @click="closePreview">
            <PhX :size="24" />
          </button>
        </div>
        <img
          v-if="previewFile"
          :src="`media://original/${previewFile.id}`"
          :alt="previewFile.name"
          @error="previewFallback"
        />
        <p>
          {{ previewFile?.width }} × {{ previewFile?.height }} ·
          {{ previewFile ? formatBytes(previewFile.size) : '' }}
        </p>
      </div>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  PhArrowLeft,
  PhArrowRight,
  PhCaretRight,
  PhCaretDown,
  PhCheckCircle,
  PhFilmStrip,
  PhFolderOpen,
  PhFolderSimple,
  PhImage,
  PhInfo,
  PhLockSimple,
  PhScan,
  PhShieldCheck,
  PhStack,
  PhTrash,
  PhTreeStructure,
  PhWarningCircle,
  PhX,
} from '@phosphor-icons/vue'
import type {
  MediaFile,
  MediaKind,
  ScanProgress,
  ScanResult,
  SimilarGroup,
  SimilarityLevel,
} from '../../shared/types'
import MediaCard from './components/MediaCard.vue'
import { formatBytes, formatDuration, thumbnailUrl } from './format'

const screen = ref<'setup' | 'scanning' | 'results'>('setup')
const folderPaths = ref([''])
const selectedFolders = computed(() => folderPaths.value.map((path) => path.trim()).filter(Boolean))
const similarityLevel = ref<SimilarityLevel>('balanced')
const similarityDescriptions: Record<SimilarityLevel, string> = {
  strict: 'Prioritizes copies with very few visual differences.',
  balanced: 'Allows moderate differences in quality and appearance.',
  flexible:
    'Finds more candidates, but may group different photos together. Review each group before deleting.',
}
const starting = ref(false)
const cancelling = ref(false)
const deleting = ref(false)
const message = ref('')
const isError = ref(false)
const result = ref<ScanResult | null>(null)
const progress = ref<ScanProgress>({
  phase: 'discovering',
  total: 0,
  processed: 0,
  currentFile: '',
  skipped: 0,
})
const filter = ref<'all' | MediaKind>('all')
const activeId = ref('')
const selectedIds = ref(new Set<string>())
const removedCount = ref(0)
const previewFile = ref<MediaFile | null>(null)
const previewDialog = ref<HTMLDialogElement | null>(null)
const filterOptions: { value: 'all' | MediaKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Photos' },
  { value: 'video', label: 'Videos' },
]
const filteredGroups = computed(
  () =>
    result.value?.groups.filter((group) => filter.value === 'all' || group.kind === filter.value) ??
    [],
)
const activeGroup = computed(
  () =>
    filteredGroups.value.find((group) => group.id === activeId.value) ?? filteredGroups.value[0],
)
const highestResolutionId = computed(
  () =>
    activeGroup.value?.files.reduce((best, file) =>
      file.width * file.height > best.width * best.height ? file : best,
    ).id,
)
const groupedCount = computed(
  () => result.value?.groups.reduce((sum, group) => sum + group.files.length, 0) ?? 0,
)
const potentialSpace = computed(
  () =>
    result.value?.groups.reduce(
      (sum, group) => sum + group.files.slice(1).reduce((total, file) => total + file.size, 0),
      0,
    ) ?? 0,
)
const selectedFiles = computed(
  () =>
    result.value?.groups
      .flatMap((group) => group.files)
      .filter((file) => selectedIds.value.has(file.id)) ?? [],
)
const selectedSize = computed(() => selectedFiles.value.reduce((sum, file) => sum + file.size, 0))
const percent = computed(() =>
  progress.value.total ? Math.round((progress.value.processed / progress.value.total) * 100) : 0,
)
const phaseTitle = computed(
  () =>
    ({
      discovering: 'Exploring your folders…',
      analyzing: 'Scanning photos and videos…',
      grouping: 'Finding similar files…',
    })[progress.value.phase],
)

const showMessage = (text: string, error = false): void => {
  message.value = text
  isError.value = error
}
const errorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
    : String(error)
const chooseFolder = async (index: number): Promise<void> => {
  try {
    const folders = await window.desktop.chooseFolder()
    if (folders.length) {
      folderPaths.value.splice(index, 1, ...folders)
      folderPaths.value = [...new Set(folderPaths.value)]
    }
  } catch (error) {
    showMessage(errorMessage(error), true)
  }
}
const startScan = async (): Promise<void> => {
  if (starting.value || !selectedFolders.value.length) return
  starting.value = true
  message.value = ''
  progress.value = { phase: 'discovering', total: 0, processed: 0, currentFile: '', skipped: 0 }
  screen.value = 'scanning'
  result.value = null
  selectedIds.value = new Set()
  removedCount.value = 0
  filter.value = 'all'
  try {
    await window.desktop.startScan(selectedFolders.value, similarityLevel.value)
  } catch (error) {
    screen.value = 'setup'
    showMessage(errorMessage(error), true)
  } finally {
    starting.value = false
  }
}
const cancelScan = async (): Promise<void> => {
  cancelling.value = true
  try {
    await window.desktop.cancelScan()
  } catch (error) {
    cancelling.value = false
    showMessage(errorMessage(error), true)
  }
}
const remainingInGroup = (group: SimilarGroup): number =>
  group.files.filter((file) => !selectedIds.value.has(file.id)).length
const toggleSelection = (id: string): void => {
  if (deleting.value) return
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else {
    const group = result.value?.groups.find((entry) => entry.files.some((file) => file.id === id))
    if (!group) return
    if (group.files.length === 2) group.files.forEach((file) => next.delete(file.id))
    else if (remainingInGroup(group) <= 1) return
    next.add(id)
  }
  selectedIds.value = next
}
const trashSelected = async (): Promise<void> => {
  if (!selectedFiles.value.length || deleting.value) return
  deleting.value = true
  try {
    closePreview()
    await nextTick()
    const response = await window.desktop.trashFiles([...selectedIds.value])
    const deleted = new Set(response.deletedIds)
    if (result.value && deleted.size) {
      result.value.groups = result.value.groups
        .map((group) => ({ ...group, files: group.files.filter((file) => !deleted.has(file.id)) }))
        .filter((group) => group.files.length > 1)
      const visibleIds = new Set(
        result.value.groups.flatMap((group) => group.files.map((file) => file.id)),
      )
      selectedIds.value = new Set([...selectedIds.value].filter((id) => visibleIds.has(id)))
      removedCount.value += deleted.size
    }
    if (response.errors.length)
      showMessage(
        `${deleted.size} file(s) moved. ${response.errors.length} failure(s): ${response.errors.map((entry) => `${entry.path}: ${entry.message}`).join(' · ')}`,
        true,
      )
    else if (deleted.size)
      showMessage(
        `${deleted.size} file(s) moved to the Recycle Bin. You can restore them from the system Recycle Bin.`,
      )
  } catch (error) {
    showMessage(errorMessage(error), true)
  } finally {
    deleting.value = false
  }
}
const revealFile = async (id: string): Promise<void> => {
  try {
    await window.desktop.revealFile(id)
  } catch (error) {
    showMessage(errorMessage(error), true)
  }
}
const goHome = (): void => {
  if (screen.value === 'scanning' || deleting.value || starting.value) return
  screen.value = 'setup'
  folderPaths.value = ['']
  selectedIds.value = new Set()
  message.value = ''
}
const closePreview = (): void => {
  previewDialog.value?.close()
  previewFile.value = null
}
const previewFallback = (event: Event): void => {
  const image = event.target as HTMLImageElement
  if (previewFile.value && image.src !== thumbnailUrl(previewFile.value.id))
    image.src = thumbnailUrl(previewFile.value.id)
}
watch(previewFile, async (file) => {
  if (file) {
    await nextTick()
    previewDialog.value?.showModal()
  }
})

const unsubscribe = window.desktop?.onScanEvent((event) => {
  if (event.type === 'progress') progress.value = event.progress
  else if (event.type === 'complete') {
    result.value = event.result
    selectedIds.value = new Set(
      event.result.groups.map((group) => group.files[group.files.length - 1].id),
    )
    activeId.value = event.result.groups[0]?.id ?? ''
    screen.value = 'results'
    cancelling.value = false
  } else {
    screen.value = 'setup'
    cancelling.value = false
    showMessage(
      event.type === 'cancelled' ? 'Scan canceled. No files were removed.' : event.message,
      event.type === 'error',
    )
  }
})
if (!window.desktop)
  showMessage(
    'Open the app in Electron using npm run dev to access folders on your computer.',
    true,
  )
onBeforeUnmount(() => unsubscribe?.())
</script>
