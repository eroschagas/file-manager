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
        <PhShieldCheck :size="17" /> Seus arquivos ficam no seu computador
      </div>
    </header>

    <div v-if="message" :class="['notice', { 'notice--error': isError }]" role="status">
      <span>{{ message }}</span
      ><button class="icon-button" aria-label="Fechar aviso" @click="message = ''">
        <PhX :size="18" />
      </button>
    </div>

    <main v-if="screen === 'setup'" class="setup">
      <div class="setup__eyebrow"><span></span> MAIS ESPAÇO. MENOS CÓPIAS.</div>
      <h1>Encontre o que está<br />ocupando espaço em dobro<span>.</span></h1>
      <p class="setup__description">
        Compare fotos e vídeos parecidos, mesmo em qualidades diferentes.<br />Você escolhe o que
        fica e o que vai para a lixeira.
      </p>

      <form class="folder-form" @submit.prevent="startScan">
        <div class="folder-form__heading">
          <span class="folder-form__icon"><PhFolderSimple :size="26" /></span>
          <div>
            <h2>Por onde vamos começar?</h2>
            <p>Escolha uma ou mais pastas para organizar juntas.</p>
          </div>
        </div>
        <div v-for="(_path, index) in folderPaths" :key="index" class="folder-form__entry">
          <label :for="`folderPath${index}`">{{
            index === 0 ? 'Pasta para análise' : `Pasta para análise ${index + 1}`
          }}</label>
          <div class="folder-form__input-row">
            <input
              :id="`folderPath${index}`"
              v-model="folderPaths[index]"
              placeholder="Ex.: C:\Users\voce\Pictures"
              autocomplete="off"
              spellcheck="false"
              :disabled="starting"
            /><button
              class="button button--secondary"
              type="button"
              :disabled="starting"
              @click="chooseFolder(index)"
            >
              <PhFolderOpen :size="18" /> Procurar pasta
            </button>
            <button
              v-if="folderPaths.length > 1"
              class="icon-button"
              type="button"
              :aria-label="`Remover pasta ${index + 1}`"
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
          + Adicionar pasta
        </button>
        <div class="folder-form__recursive">
          <PhTreeStructure :size="17" /><span
            >As subpastas também serão analisadas automaticamente.</span
          >
        </div>
        <div class="folder-form__similarity">
          <label for="similarityLevel">Similaridade</label>
          <select id="similarityLevel" v-model="similarityLevel" :disabled="starting">
            <option value="strict">Rigoroso — arquivos quase idênticos</option>
            <option value="balanced">Equilibrado — diferenças moderadas</option>
            <option value="flexible">Flexível — arquivos menos parecidos</option>
          </select>
          <p>{{ similarityDescriptions[similarityLevel] }}</p>
        </div>
        <div class="folder-form__footer">
          <span
            ><PhImage :size="16" /> Fotos <span class="separator">/</span>
            <PhFilmStrip :size="16" /> Vídeos</span
          ><button
            class="button button--primary"
            type="submit"
            :disabled="!selectedFolders.length || starting"
          >
            {{ starting ? 'Preparando…' : 'Analisar arquivos' }}<PhArrowRight :size="18" />
          </button>
        </div>
      </form>

      <div class="setup__steps">
        <div>
          <span>01</span>
          <h3>Escolha uma pasta</h3>
          <p>Buscamos fotos e vídeos<br />em todas as subpastas.</p>
        </div>
        <div>
          <span>02</span>
          <h3>Compare os semelhantes</h3>
          <p>Veja versões lado a lado<br />e confira os detalhes.</p>
        </div>
        <div>
          <span>03</span>
          <h3>Libere espaço</h3>
          <p>Selecione as cópias e envie<br />para a lixeira com confirmação.</p>
        </div>
      </div>
      <p class="setup__footnote">
        <PhLockSimple :size="14" /> Nenhum arquivo é removido durante a análise.
      </p>
    </main>

    <main v-else-if="screen === 'scanning'" class="scan-view">
      <div class="scan-view__animation"><PhScan :size="45" weight="light" /></div>
      <div class="eyebrow">ORGANIZANDO AS POSSIBILIDADES</div>
      <h1>{{ phaseTitle }}</h1>
      <p>Estamos comparando o conteúdo dos seus arquivos.</p>
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
            ? `${progress.total} arquivos encontrados`
            : `${progress.processed} de ${progress.total} arquivos`
        }}</strong
        ><span v-if="progress.phase === 'analyzing'">{{ percent }}%</span>
      </div>
      <p class="scan-view__file" :title="progress.currentFile">
        {{ progress.currentFile || selectedFolders.join(' · ') }}
      </p>
      <p v-if="progress.skipped" class="scan-view__skipped">
        {{ progress.skipped }} arquivo(s) não puderam ser lidos. Você verá os detalhes ao final.
      </p>
      <button class="button button--secondary" :disabled="cancelling" @click="cancelScan">
        {{ cancelling ? 'Cancelando…' : 'Cancelar análise' }}
      </button>
    </main>

    <main v-else-if="result" class="results">
      <div class="results__heading">
        <div>
          <button class="text-button" :disabled="deleting" @click="goHome">
            <PhArrowLeft :size="16" /> Analisar outra pasta
          </button>
          <h1>Um lugar para cada versão<span>.</span></h1>
          <p v-for="root in result.roots" :key="root" :title="root">
            <PhFolderSimple :size="16" /> {{ root }}
          </p>
        </div>
        <span class="results__complete"
          ><PhCheckCircle :size="17" weight="fill" /> Análise concluída</span
        >
      </div>
      <div class="summary">
        <div>
          <span>ARQUIVOS ANALISADOS</span
          ><strong>{{ result.analyzedFiles.toLocaleString('pt-BR') }}</strong
          ><small>em {{ formatDuration(result.elapsedMs / 1000) }} · incluindo subpastas</small>
        </div>
        <div>
          <span>GRUPOS SEMELHANTES</span
          ><strong>{{ result.groups.length }}<small> grupos</small></strong
          ><small>{{ groupedCount }} arquivos para comparar</small>
        </div>
        <div>
          <span>ESPAÇO EM CÓPIAS</span><strong>{{ formatBytes(potentialSpace) }}</strong
          ><small>estimativa mantendo um arquivo por grupo</small>
        </div>
      </div>
      <details v-if="result.issues.length" class="issues">
        <summary>
          <PhWarningCircle :size="17" /> {{ result.issues.length }} item(ns) não puderam ser
          analisados
        </summary>
        <p v-for="issue in result.issues" :key="`${issue.path}:${issue.message}`">
          <strong>{{ issue.path }}</strong
          ><br />{{ issue.message }}
        </p>
      </details>

      <div v-if="result.groups.length" class="comparison">
        <aside class="group-list">
          <div class="group-list__heading">
            <h2>Grupos encontrados</h2>
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
                  >{{ group.kind === 'image' ? 'Fotos' : 'Vídeos' }} · Grupo {{ index + 1 }}</strong
                ><small
                  >{{ group.files.length }} arquivos ·
                  {{ group.match === 'exact' ? 'Idênticos' : 'Semelhantes' }}</small
                ></span
              ><PhCaretRight :size="16" />
            </button>
          </div>
          <p v-if="!filteredGroups.length" class="group-list__empty">Nenhum grupo neste filtro.</p>
        </aside>
        <section v-if="activeGroup" :key="activeGroup.id" class="group-detail">
          <div class="group-detail__heading">
            <div>
              <div class="eyebrow">
                {{
                  activeGroup.match === 'exact' ? 'DUPLICATAS EXATAS' : 'CONTEÚDO VISUAL SEMELHANTE'
                }}
              </div>
              <h2>Compare antes de escolher</h2>
              <p>
                {{ activeGroup.files.length }} versões, do maior para o menor · mantenha pelo menos
                um arquivo.
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
                  ? 'A comparação considera imagens de cinco momentos do vídeo. Confira também o áudio e o conteúdo completo.'
                  : 'A maior resolução é uma referência, mas não garante a melhor qualidade. Confira os detalhes antes de excluir.'
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
          {{
            removedCount
              ? 'Tudo revisado por aqui.'
              : 'Nenhuma duplicata ou versão semelhante encontrada.'
          }}
        </h2>
        <p>
          {{
            removedCount
              ? 'Os arquivos selecionados foram enviados à lixeira.'
              : 'Não encontramos grupos dentro dos critérios atuais de comparação.'
          }}
        </p>
        <button class="button button--primary" @click="goHome">
          Escolher outra pasta <PhArrowRight :size="18" />
        </button>
      </div>
    </main>

    <footer v-if="screen === 'results' && result?.groups.length" class="selection-bar">
      <div>
        <span class="selection-bar__icon"><PhTrash :size="20" /></span>
        <div>
          <strong>{{ selectedFiles.length }} arquivo(s) selecionado(s)</strong>
          <p>{{ formatBytes(selectedSize) }} para liberar · nada foi removido ainda</p>
        </div>
      </div>
      <div>
        <button
          class="text-button"
          :disabled="!selectedFiles.length || deleting"
          @click="selectedIds = new Set()"
        >
          Limpar seleção</button
        ><button
          class="button button--danger"
          :disabled="!selectedFiles.length || deleting"
          @click="trashSelected"
        >
          <PhTrash :size="18" />{{ deleting ? 'Enviando…' : 'Enviar à lixeira' }}
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
          ><button class="icon-button" aria-label="Fechar imagem" @click="closePreview">
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
  strict: 'Prioriza cópias com poucas diferenças visuais.',
  balanced: 'Aceita diferenças moderadas de qualidade e aparência.',
  flexible:
    'Encontra mais candidatos, mas pode agrupar fotos diferentes. Revise cada grupo antes de excluir.',
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
  { value: 'all', label: 'Todos' },
  { value: 'image', label: 'Fotos' },
  { value: 'video', label: 'Vídeos' },
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
      discovering: 'Explorando suas pastas…',
      analyzing: 'Analisando fotos e vídeos…',
      grouping: 'Encontrando os semelhantes…',
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
        `${deleted.size} arquivo(s) enviado(s). ${response.errors.length} falha(s): ${response.errors.map((entry) => `${entry.path}: ${entry.message}`).join(' · ')}`,
        true,
      )
    else if (deleted.size)
      showMessage(
        `${deleted.size} arquivo(s) enviado(s) à lixeira. Você pode restaurá-los pela lixeira do sistema.`,
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
      event.type === 'cancelled'
        ? 'Análise cancelada. Nenhum arquivo foi removido.'
        : event.message,
      event.type === 'error',
    )
  }
})
if (!window.desktop)
  showMessage('Abra pelo Electron usando npm run dev para acessar as pastas do computador.', true)
onBeforeUnmount(() => unsubscribe?.())
</script>
