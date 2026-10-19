<template>
  <AppLayout>
    <div class="mx-auto max-w-7xl space-y-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ pageTitle }}</h1>
          <p v-if="historyRetentionDays" class="mt-2 flex gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>{{ t('imageGen.history.retention', { days: historyRetentionDays }) }}</span>
          </p>
        </div>
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <label class="input-label whitespace-nowrap text-sm">{{ t('imageGen.apiKey') }}</label>
          <Select v-model="selectedKeyID" :options="keyOptions" class="min-w-[14rem]">
            <option value="" disabled>{{ t('imageGen.selectKey') }}</option>
          </Select>
        </div>
      </div>

      <div class="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-800">
        <button
          v-for="tabItem in tabs"
          :key="tabItem.value"
          type="button"
          class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition"
          :class="
            activeTab === tabItem.value
              ? 'bg-white text-gray-900 shadow-sm dark:bg-dark-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          "
          @click="switchTab(tabItem.value)"
        >
          {{ t(tabItem.label) }}
        </button>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div class="lg:col-span-2">
          <div class="card space-y-4 p-5">
            <div>
              <label class="input-label">{{ t('imageGen.model') }}</label>
              <Select
                v-model="model"
                :options="modelOptions"
                :disabled="loadingModels || !modelOptions.length"
                :placeholder="loadingModels ? t('imageGen.modelsLoading') : t('imageGen.selectModel')"
              />
              <p v-if="modelsError" class="mt-1 text-xs text-red-600 dark:text-red-400">
                {{ modelsError }}
                <button type="button" class="ml-2 underline" @click="loadModels">{{ t('imageGen.retry') }}</button>
              </p>
              <p v-else-if="selectedKey && !loadingModels && !modelOptions.length" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ t('imageGen.noModels') }}
              </p>
              <p v-if="modelAvailable" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ t('imageGen.referenceLimit', { count: maxReferences }) }}
              </p>
            </div>

            <div>
              <label class="input-label">{{ activeTab === 'batch' ? t('imageGen.batchCount') : t('imageGen.prompt') }}</label>
              <textarea
                v-if="activeTab !== 'batch'"
                ref="promptRef"
                v-model="prompt"
                rows="5"
                class="input"
                :placeholder="t('imageGen.promptPlaceholder')"
              />
              <textarea
                v-else
                v-model="batchPromptsText"
                rows="7"
                class="input"
                :placeholder="t('imageGen.promptPlaceholder')"
              />
              <p class="input-hint mt-1">
                {{ activeTab === 'batch' ? t('imageGen.batchTextModeHint') : t('imageGen.privacyNotice') }}
              </p>
            </div>

            <div v-if="activeTab === 'batch'" class="space-y-3">
              <div class="flex items-center justify-between gap-3">
                <label class="input-label mb-0">{{ t('imageGen.batchCount') }}</label>
                <span class="text-xs text-gray-500 dark:text-gray-400">
                  {{ t('imageGen.batchCountHint', { count: batchPromptCount }) }}
                </span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <label class="input-label mb-0">{{ t('imageGen.batchStatus') }}</label>
                <span class="text-sm text-gray-500 dark:text-gray-400">
                  {{ batchProgressLabel }}
                </span>
              </div>
            </div>

            <div v-if="supportsReferences" class="space-y-3">
              <div class="flex items-center justify-between gap-3">
                <label class="input-label mb-0">{{ t('imageGen.referenceImages') }}</label>
                <span class="text-xs text-gray-500 dark:text-gray-400">
                  {{ references.length }} / {{ maxReferences }}
                </span>
              </div>
              <label
                class="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 transition hover:border-primary-400 dark:border-dark-600 dark:text-gray-400"
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  class="hidden"
                  :disabled="!canAddReference"
                  multiple
                  @change="onReferenceSelected"
                />
                <span>{{ t('imageGen.addReference') }}</span>
                <span class="mt-1 text-xs">{{ t('imageGen.referenceHint', { size: referenceMaxMB }) }}</span>
              </label>

              <div v-if="references.length" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div
                  v-for="reference in references"
                  :key="reference.id"
                  class="group relative overflow-hidden rounded-lg border border-gray-200 dark:border-dark-700"
                >
                  <img :src="reference.previewUrl" :alt="reference.name" class="h-24 w-full object-cover" />
                  <span
                    class="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white"
                  >
                    {{ reference.index }}
                  </span>
                  <button
                    type="button"
                    :title="t('imageGen.removeReference')"
                    class="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white opacity-0 transition group-hover:opacity-100"
                    @click="removeReference(reference.id)"
                  >
                    ×
                  </button>
                  <div class="flex items-center justify-between gap-1 px-2 py-1 text-xs">
                    <span class="truncate text-gray-500 dark:text-gray-400">{{ reference.name }}</span>
                    <span v-if="reference.uploadStatus !== 'ready'" class="text-gray-400">
                      {{ t(`imageGen.referenceStatus.${reference.uploadStatus}`) }}
                    </span>
                  </div>
                </div>
              </div>

              <button
                v-if="references.length"
                type="button"
                class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
                @click="clearReferences"
              >
                {{ t('imageGen.clearReferences') }}
              </button>
            </div>

            <div v-if="usesFixedSize" class="grid grid-cols-2 gap-3">
              <div>
                <label class="input-label">{{ t('imageGen.size') }}</label>
                <Select v-model="size" :options="sizeOptions" />
              </div>
              <div v-if="size === 'custom'" class="grid grid-cols-2 gap-2">
                <div>
                  <label class="input-label">{{ t('imageGen.customSize') }}</label>
                  <input v-model.number="customWidth" type="number" min="256" max="3840" class="input" />
                </div>
                <div>
                  <label class="input-label">&nbsp;</label>
                  <input v-model.number="customHeight" type="number" min="256" max="3840" class="input" />
                </div>
              </div>
            </div>

            <div v-if="supportsAspectRatio" class="grid grid-cols-2 gap-3">
              <div>
                <label class="input-label">{{ t('imageGen.aspectRatio') }}</label>
                <Select v-model="aspectRatio" :options="aspectRatioOptions" />
              </div>
              <div>
                <label class="input-label">{{ t('imageGen.imageSize') }}</label>
                <Select v-model="imageSize" :options="imageSizeOptions" />
              </div>
            </div>

            <div v-if="supportsOutputFormat" class="grid grid-cols-2 gap-3">
              <div>
                <label class="input-label">{{ t('imageGen.quality') }}</label>
                <Select v-model="quality" :options="qualityOptions" />
              </div>
              <div>
                <label class="input-label">{{ t('imageGen.format') }}</label>
                <Select v-model="outputFormat" :options="formatOptions" />
              </div>
              <div class="col-span-2">
                <label class="input-label">{{ t('imageGen.background') }}</label>
                <Select v-model="background" :options="backgroundOptions" />
              </div>
              <div v-if="outputFormat !== 'png'" class="col-span-2">
                <label class="input-label">{{ t('imageGen.compression') }}: {{ outputCompression }}</label>
                <input v-model.number="outputCompression" type="range" min="1" max="100" class="w-full" />
              </div>
            </div>

            <p v-if="sizeError" class="text-sm text-red-600 dark:text-red-400">
              {{ t(sizeError, { min: sizeLimits.minEdge, max: sizeLimits.maxEdge }) }}
            </p>
            <p v-else-if="estimateError" class="text-sm text-amber-600 dark:text-amber-400">
              {{ estimateError }}
            </p>

            <div v-if="estimate" class="rounded-lg border border-primary-200 bg-primary-50/60 px-3 py-2 text-xs dark:border-primary-900/60 dark:bg-primary-950/30">
              <div class="flex items-center justify-between">
                <span>{{ t('imageGen.estimateDetails') }}</span>
                <span class="font-medium">{{ formatCost(estimate.estimated_cost) }}</span>
              </div>
              <div class="mt-1 flex items-center justify-between text-gray-500 dark:text-gray-400">
                <span>{{ estimate.image_count }} × {{ formatCost(estimate.unit_cost) }}</span>
                <span>{{ estimate.billing_tier }} · ×{{ estimate.rate_multiplier }}</span>
              </div>
            </div>
            <p v-else-if="estimating" class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('imageGen.estimating') }}
            </p>

            <div class="flex flex-wrap gap-2">
              <button
                v-if="activeTab === 'batch'"
                type="button"
                class="btn btn-primary flex-1"
                :disabled="!canSubmit"
                @click="submitBatch"
              >
                {{ t('imageGen.batchGenerate') }}
              </button>
              <button v-else type="button" class="btn btn-primary flex-1" :disabled="!canSubmit" @click="submit">
                {{ references.length ? t('imageGen.generateEdit') : t('imageGen.generate') }}
              </button>
              <button
                v-if="status === 'generating'"
                type="button"
                class="btn btn-secondary"
                @click="cancelGeneration"
              >
                {{ t('imageGen.cancel') }}
              </button>
            </div>
          </div>
        </div>

        <div class="lg:col-span-3">
          <div v-if="activeTab === 'batch'" class="space-y-4">
            <EmptyState
              v-if="!batchItems.length"
              :title="t('imageGen.emptyState')"
              :description="t('imageGen.batchTextModeHint')"
            />
            <div
              v-for="(item, index) in batchItems"
              :key="index"
              class="card flex gap-4 p-4"
            >
              <img
                v-if="item.result"
                :src="item.result.blobUrl"
                :alt="item.prompt"
                class="h-24 w-24 rounded-lg object-cover"
              />
              <div v-else class="flex h-24 w-24 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400 dark:bg-dark-800">
                <span v-if="item.status === 'generating'">{{ t('imageGen.status.generating') }}</span>
                <span v-else-if="item.status === 'error'">{{ t('imageGen.referenceStatus.failed') }}</span>
                <span v-else>{{ t('imageGen.pending') }}</span>
              </div>
              <div class="min-w-0 flex-1 space-y-2">
                <p class="line-clamp-3 text-sm text-gray-700 dark:text-gray-300">{{ item.prompt }}</p>
                <p v-if="item.error" class="text-xs text-red-600 dark:text-red-400">{{ item.error }}</p>
                <div v-if="item.result" class="flex gap-2">
                  <button type="button" class="btn btn-secondary btn-sm" @click="download(item.result)">
                    {{ t('imageGen.download') }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="space-y-4">
            <div v-if="currentResult" class="card space-y-3 p-4">
              <img :src="currentResult.blobUrl" :alt="currentResult.prompt" class="w-full rounded-lg" />
              <div class="flex flex-wrap gap-2">
                <button type="button" class="btn btn-primary btn-sm" @click="download(currentResult)">
                  {{ t('imageGen.download') }}
                </button>
                <button type="button" class="btn btn-secondary btn-sm" @click="clearResult">
                  {{ t('imageGen.clear') }}
                </button>
                <button
                  v-if="!currentResult.serverArchived"
                  type="button"
                  class="btn btn-secondary btn-sm"
                  @click="archiveResults([currentResult])"
                >
                  {{ t('imageGen.longStorage') }}
                </button>
              </div>
            </div>
            <EmptyState v-else-if="status !== 'generating'" :title="t('imageGen.emptyState')" />
            <div v-else class="card flex items-center justify-center gap-3 p-10 text-sm text-gray-500 dark:text-gray-400">
              <LoadingSpinner />
              <span>{{ progressLabel }}</span>
            </div>
          </div>

          <div v-if="historyEnabled" class="card mt-6 space-y-4 p-5">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t('imageGen.history.title') }}
              </h2>
              <button type="button" class="btn btn-secondary btn-sm" @click="loadHistory">
                {{ t('imageGen.history.reload') }}
              </button>
            </div>
            <p v-if="historyError" class="text-sm text-red-600 dark:text-red-400">{{ historyError }}</p>
            <p v-else-if="!history.length" class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('imageGen.history.empty') }}
            </p>
            <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div
                v-for="item in history"
                :key="item.id"
                class="group relative overflow-hidden rounded-lg border border-gray-200 dark:border-dark-700"
              >
                <img
                  v-if="historyThumb(item.id)"
                  :src="historyThumb(item.id)"
                  :alt="item.prompt"
                  class="h-28 w-full object-cover"
                  @error="historyPreviewFailed(item.id)"
                />
                <div v-else class="flex h-28 w-full items-center justify-center bg-gray-100 px-2 text-center text-xs text-gray-400 dark:bg-dark-800">
                  <template v-if="!item.content_available">{{ t('imageGen.history.expired') }}</template>
                  <template v-else-if="historyPreviewErrors[item.id]">{{ t('imageGen.history.loadFailed') }}</template>
                  <template v-else>{{ t('common.loading') }}</template>
                </div>
                <div class="flex items-center justify-between gap-1 px-2 py-1 text-xs">
                  <span class="truncate text-gray-500 dark:text-gray-400">{{ item.model }}</span>
                  <div class="flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <a
                      v-if="historyThumb(item.id)"
                      :href="historyThumb(item.id)"
                      :download="`image-${item.id}`"
                      class="text-gray-500 hover:text-gray-700"
                    >
                      {{ t('imageGen.download') }}
                    </a>
                    <button type="button" class="text-gray-500 hover:text-gray-700" @click="reuse(item)">
                      {{ t('imageGen.history.reuse') }}
                    </button>
                    <button type="button" class="text-red-500 hover:text-red-600" @click="removeHistory(item.id)">
                      ×
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import Select from '@/components/common/Select.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { useAppStore } from '@/stores/app'
import { keysAPI } from '@/api/keys'
import {
  deleteHistory,
  estimate as estimateImage,
  fetchHistoryContent,
  getCapabilities,
  listHistory,
  listModels,
  type ImageGenerationEstimate,
  type ImageGenerationHistoryItem,
} from '@/api/imageGenerations'
import {
  IMAGE_BACKGROUND_OPTIONS,
  IMAGE_FORMAT_OPTIONS,
  IMAGE_GEN_DEFAULTS,
  IMAGE_MODELS,
  IMAGE_QUALITY_OPTIONS,
  IMAGE_REFERENCE_DEFAULT_LIMIT,
  IMAGE_REFERENCE_MAX_BYTES,
  IMAGE_SIZE_LIMITS,
  resolveImageModel,
  validateCustomSize,
  VERIFIED_IMAGE_SIZES,
  type ImageProvider,
} from '@/constants/imageGen'
import {
  useImageGeneration,
  type GeneratedImage,
  type ImageGenRequest,
} from '@/composables/useImageGeneration'
import type { ApiKey } from '@/types'
import { extractApiErrorCode } from '@/utils/apiError'

const props = withDefaults(
  defineProps<{
    /** 私有渠道页把可选 Key 锁在对应平台上 */
    fixedPlatform?: string
    /** 私有渠道页只暴露自己那一组模型 */
    providerFilter?: ImageProvider
  }>(),
  { fixedPlatform: '', providerFilter: undefined }
)

type TabValue = 'generate' | 'edit' | 'batch'

interface ReferenceItem {
  id: string
  index: number
  name: string
  previewUrl: string
  dataUrl?: string
  mimeType: string
  sizeBytes: number
  uploadStatus: 'reading' | 'ready' | 'failed'
}

const { t } = useI18n()
const appStore = useAppStore()
const {
  status,
  currentResult,
  batchItems,
  errorMessage,
  progress,
  generate,
  generateBatch,
  archive,
  resumePending,
  cancelGeneration,
  clearAllResults,
  readFileAsBase64: readBase64,
} = useImageGeneration()

const tabs = computed<Array<{ value: TabValue; label: string }>>(() => {
  const items: Array<{ value: TabValue; label: string }> = [
    { value: 'generate', label: 'imageGen.tabGenerate' },
    { value: 'edit', label: 'imageGen.tabEdit' },
  ]
  if (!props.providerFilter) items.push({ value: 'batch', label: 'imageGen.tabBatch' })
  return items
})

const activeTab = ref<TabValue>('generate')
const keys = ref<ApiKey[]>([])
const selectedKeyID = ref<number | ''>('')

const model = ref<string>(IMAGE_GEN_DEFAULTS.model)
const availableModelIDs = ref<string[]>([])
const loadingModels = ref(false)
const modelsError = ref('')
const prompt = ref('')
const batchPromptsText = ref('')
const size = ref<string>(IMAGE_GEN_DEFAULTS.size)
const customWidth = ref(1024)
const customHeight = ref(1024)
const quality = ref(IMAGE_GEN_DEFAULTS.quality)
const background = ref(IMAGE_GEN_DEFAULTS.background)
const outputFormat = ref<string>(IMAGE_GEN_DEFAULTS.format)
const outputCompression = ref(IMAGE_GEN_DEFAULTS.compression)
const aspectRatio = ref(IMAGE_GEN_DEFAULTS.aspectRatio)
const imageSize = ref(IMAGE_GEN_DEFAULTS.imageSize)
const references = ref<ReferenceItem[]>([])
const promptRef = ref<HTMLTextAreaElement | null>(null)

const historyEnabled = ref(false)
const historyRetentionDays = ref(0)
const history = ref<ImageGenerationHistoryItem[]>([])
const historyError = ref('')
const historyPreviewUrls = ref<Record<number, string>>({})
const historyPreviewErrors = ref<Record<number, boolean>>({})
const estimate = ref<ImageGenerationEstimate | null>(null)
const estimating = ref(false)
const estimateError = ref('')

let estimateTimer: ReturnType<typeof setTimeout> | undefined
let estimateController: AbortController | null = null
let loadToken = 0
let modelLoadToken = 0
let modelController: AbortController | null = null
let modelLoadPromise = Promise.resolve()
let disposed = false

const provider = computed(() => resolveImageModel(model.value).provider)
const modelOptions = computed(() =>
  IMAGE_MODELS
    .filter(m => (!props.providerFilter || m.provider === props.providerFilter) && availableModelIDs.value.includes(m.value))
    .map(m => ({ value: m.value, label: m.label }))
)
const modelAvailable = computed(() => !loadingModels.value && !modelsError.value
  && modelOptions.value.some(option => option.value === model.value))
const spec = computed(() => resolveImageModel(model.value))
const supportsReferences = computed(() => spec.value.maxReferences > 0)
const maxReferences = computed(() => Math.min(IMAGE_REFERENCE_DEFAULT_LIMIT, spec.value.maxReferences || IMAGE_REFERENCE_DEFAULT_LIMIT))
const supportsAspectRatio = computed(() => spec.value.aspectRatios.length > 0)
const supportsOutputFormat = computed(() => spec.value.supportsOutputFormat)
const usesFixedSize = computed(() => !supportsAspectRatio.value)
const referenceMaxMB = Math.round(IMAGE_REFERENCE_MAX_BYTES / (1024 * 1024))
const sizeLimits = IMAGE_SIZE_LIMITS

const pageTitle = computed(() => {
  if (props.fixedPlatform === 'aggregate_w') return t('imageGen.title') + ' · W'
  return t('imageGen.title')
})

const keyOptions = computed(() =>
  keys.value.map(key => ({
    value: key.id,
    label: key.group?.name ? `${key.name} · ${key.group.name}` : key.name,
  }))
)

const selectedKey = computed(() => keys.value.find(key => key.id === selectedKeyID.value) || null)

watch(selectedKey, () => { modelLoadPromise = loadModels() }, { immediate: true, flush: 'sync' })

watch(modelOptions, options => {
  if (!options.some(option => option.value === model.value)) model.value = options[0]?.value ?? ''
}, { immediate: true, flush: 'sync' })

const sizeOptions = computed(() => [
  ...VERIFIED_IMAGE_SIZES.map(preset => ({ value: preset.value, label: preset.label })),
  { value: 'custom', label: t('imageGen.sizeCustom') },
])

const aspectRatioOptions = computed(() =>
  spec.value.aspectRatios.map(value => ({ value, label: value }))
)
const imageSizeOptions = computed(() => spec.value.imageSizes.map(value => ({ value, label: value })))
const qualityOptions = IMAGE_QUALITY_OPTIONS
const backgroundOptions = IMAGE_BACKGROUND_OPTIONS
const formatOptions = IMAGE_FORMAT_OPTIONS

const batchPromptList = computed(() =>
  batchPromptsText.value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
)
const batchPromptCount = computed(() => batchPromptList.value.length)
const batchProgressLabel = computed(() => {
  const done = batchItems.value.filter(item => item.status === 'success' || item.status === 'error').length
  return `${done} / ${batchItems.value.length || batchPromptCount.value}`
})

const effectiveSize = computed(() => {
  if (supportsAspectRatio.value) return imageSize.value
  return size.value === 'custom' ? `${customWidth.value}x${customHeight.value}` : size.value
})

const sizeError = computed(() =>
  supportsAspectRatio.value || size.value !== 'custom' ? null : validateCustomSize(customWidth.value, customHeight.value)
)

const canAddReference = computed(() => references.value.length < maxReferences.value)

function formatCost(value: number): string {
  return Number(value || 0).toFixed(6).replace(/\.?0+$/, '') || '0'
}

function historyThumb(id: number): string {
  return historyPreviewUrls.value[id] || ''
}

function releaseHistoryPreview(id: number): void {
  const url = historyPreviewUrls.value[id]
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
  delete historyPreviewUrls.value[id]
  delete historyPreviewErrors.value[id]
}

function historyPreviewFailed(id: number): void {
  releaseHistoryPreview(id)
  historyPreviewErrors.value[id] = true
}

function safeHistoryExternalUrl(contentUrl?: string): string {
  if (!contentUrl) return ''
  try {
    const url = new URL(contentUrl)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : ''
  } catch {
    return ''
  }
}

function historyContentMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = extractApiErrorCode(error)
  const response = error as { status?: number; response?: { status?: number } }
  // Blob error responses may retain only the HTTP status in the API interceptor.
  return code === 'IMAGE_GENERATION_HISTORY_NO_CONTENT'
    || ((response.status ?? response.response?.status) === 404 && (!code || code === '404'))
}

/* ---------------------------------- 数据加载 -------------------------------- */

async function loadKeys(): Promise<void> {
  try {
    const response = await keysAPI.list(1, 100, { status: 'active' })
    keys.value = (response.items || []).filter(key => {
      if (key.status !== 'active') return false
      if (!key.group?.allow_image_generation) return false
      if (props.fixedPlatform && key.group?.platform !== props.fixedPlatform) return false
      return true
    })
    if (!keys.value.some(key => key.id === selectedKeyID.value)) {
      selectedKeyID.value = keys.value[0]?.id ?? ''
    }
  } catch {
    keys.value = []
  }
}

async function loadModels(): Promise<void> {
  const token = ++modelLoadToken
  modelController?.abort()
  const previousModel = model.value
  availableModelIDs.value = []
  model.value = ''
  modelsError.value = ''
  const key = selectedKey.value
  loadingModels.value = !!key
  if (!key || disposed) return

  const controller = new AbortController()
  modelController = controller
  try {
    const models = await listModels(key.key, controller.signal)
    if (disposed || token !== modelLoadToken) return
    availableModelIDs.value = models
    if (modelOptions.value.some(option => option.value === previousModel)) model.value = previousModel
  } catch {
    if (disposed || token !== modelLoadToken) return
    modelsError.value = t('imageGen.modelsLoadFailed')
  } finally {
    if (!disposed && token === modelLoadToken) loadingModels.value = false
  }
}

async function loadHistory(): Promise<void> {
  if (!historyEnabled.value || disposed) return
  historyError.value = ''
  const token = ++loadToken
  try {
    const response = await listHistory(1, 24)
    if (token !== loadToken) return
    history.value = response.items || []
    const availableIDs = new Set(history.value.filter(item => item.content_available).map(item => item.id))
    for (const id of Object.keys(historyPreviewUrls.value).map(Number)) {
      if (!availableIDs.has(id)) releaseHistoryPreview(id)
    }
    historyPreviewErrors.value = {}
    await Promise.all(history.value.filter(item => item.content_available && !historyThumb(item.id)).map(async item => {
      try {
        // 面板图片接口需要 JWT，必须通过 apiClient 取回后再交给 img 展示。
        const blob = await fetchHistoryContent(item.id)
        if (token !== loadToken || !history.value.some(record => record.id === item.id)) return
        historyPreviewUrls.value[item.id] = URL.createObjectURL(blob)
      } catch (error) {
        if (token !== loadToken || !history.value.some(record => record.id === item.id)) return
        const externalUrl = historyContentMissing(error) ? safeHistoryExternalUrl(item.content_url) : ''
        if (externalUrl) {
          // External images load directly; the panel JWT must never be sent to their host.
          historyPreviewUrls.value[item.id] = externalUrl
        } else {
          historyPreviewErrors.value[item.id] = true
        }
      }
    }))
  } catch {
    if (token !== loadToken) return
    historyError.value = t('imageGen.history.loadFailed')
  }
}

async function bootstrap(): Promise<void> {
  try {
    const capabilities = await getCapabilities()
    historyEnabled.value = capabilities.history_enabled
    historyRetentionDays.value = capabilities.retention_days || 0
  } catch {
    historyEnabled.value = false
  }
  await loadKeys()
  await loadHistory()
  await modelLoadPromise
  if (selectedKey.value && provider.value === 'dreamina-canvas') {
    await resumePending(window.location.origin, selectedKey.value.key)
  }
}

/* ---------------------------------- 参考图 ---------------------------------- */

async function onReferenceSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  for (const file of files) {
    if (!canAddReference.value) {
      appStore.showWarning(t('imageGen.referenceLimitReached', { count: maxReferences.value }))
      break
    }
    if (file.size > IMAGE_REFERENCE_MAX_BYTES) {
      appStore.showError(t('imageGen.error.fileTooLarge', { size: referenceMaxMB }))
      continue
    }
    const id = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const previewUrl = URL.createObjectURL(file)
    references.value.push({
      id,
      index: references.value.length + 1,
      name: file.name,
      previewUrl,
      mimeType: file.type || 'image/png',
      sizeBytes: file.size,
      uploadStatus: 'reading',
    })
    try {
      const base64 = await readBase64(file)
      const target = references.value.find(item => item.id === id)
      if (target) {
        target.dataUrl = `data:${target.mimeType};base64,${base64}`
        target.uploadStatus = 'ready'
      }
    } catch {
      const target = references.value.find(item => item.id === id)
      if (target) target.uploadStatus = 'failed'
      appStore.showError(t('imageGen.uploadError'))
    }
  }
  reindexReferences()
  if (references.value.length && activeTab.value === 'generate') activeTab.value = 'edit'
}

function reindexReferences(): void {
  references.value.forEach((item, index) => {
    item.index = index + 1
  })
}

function removeReference(id: string): void {
  const target = references.value.find(item => item.id === id)
  if (target) URL.revokeObjectURL(target.previewUrl)
  references.value = references.value.filter(item => item.id !== id)
  reindexReferences()
  if (!references.value.length && activeTab.value === 'edit') activeTab.value = 'generate'
}

function clearReferences(): void {
  for (const item of references.value) URL.revokeObjectURL(item.previewUrl)
  references.value = []
  if (activeTab.value === 'edit') activeTab.value = 'generate'
}

function toGatewayReferences() {
  return references.value
    .filter(item => item.uploadStatus === 'ready' && item.dataUrl)
    .map(item => ({ id: item.id, name: item.name, dataUrl: item.dataUrl, mimeType: item.mimeType }))
}

/* ---------------------------------- 估价 ----------------------------------- */

/** 参数一变就重新估价，但要防抖：拖压缩率滑块会连发几十次请求。 */
watch(
  [selectedKeyID, model, modelAvailable, effectiveSize, aspectRatio, batchPromptCount, provider],
  () => {
    if (estimateTimer) clearTimeout(estimateTimer)
    estimateController?.abort()
    estimate.value = null
    estimateError.value = ''

    const key = selectedKey.value
    if (!key || !modelAvailable.value || sizeError.value) {
      estimating.value = false
      return
    }

    estimating.value = true
    estimateTimer = setTimeout(() => void runEstimate(), props.fixedPlatform ? 1000 : 250)
  },
  { immediate: true, flush: 'sync' }
)

async function runEstimate(): Promise<void> {
  const key = selectedKey.value
  if (!key || !modelAvailable.value) return
  estimateController?.abort()
  const controller = new AbortController()
  estimateController = controller
  try {
    const result = await estimateImage(
      {
        api_key_id: key.id,
        model: model.value,
        image_size: effectiveSize.value,
        image_count: activeTab.value === 'batch' ? Math.max(1, batchPromptCount.value) : 1,
      },
      controller.signal
    )
    if (controller.signal.aborted) return
    estimate.value = result
  } catch (error) {
    if (controller.signal.aborted) return
    const statusCode = (error as { status?: number; response?: { status?: number } }).status
      ?? (error as { response?: { status?: number } }).response?.status
    if (statusCode === 403) {
      estimateError.value = t('imageGen.estimateFailed')
    } else if (props.fixedPlatform) {
      estimateError.value = t('imageGen.estimateFailed')
    } else {
      estimateError.value = t('imageGen.estimateFailed')
    }
  } finally {
    if (!controller.signal.aborted) estimating.value = false
  }
}

/* ---------------------------------- 提交 ----------------------------------- */

function buildRequest(): ImageGenRequest | null {
  const key = selectedKey.value
  if (!key || !modelAvailable.value) return null
  const isGeminiLike = provider.value === 'gemini-native' || provider.value === 'dreamina-canvas'
  return {
    apiBase: window.location.origin,
    apiKey: key.key,
    apiKeyID: key.id,
    model: model.value,
    prompt: prompt.value.trim(),
    size: isGeminiLike ? undefined : effectiveSize.value,
    imageSize: isGeminiLike ? imageSize.value : undefined,
    aspectRatio: isGeminiLike ? aspectRatio.value : undefined,
    quality: supportsOutputFormat.value ? quality.value : undefined,
    background: supportsOutputFormat.value ? background.value : undefined,
    outputFormat: supportsOutputFormat.value ? outputFormat.value : undefined,
    outputCompression: supportsOutputFormat.value ? outputCompression.value : undefined,
    references: activeTab.value === 'edit' ? toGatewayReferences() : [],
    referenceSnapshot: references.value.map((item, index) => ({
      index: index + 1,
      name: item.name,
      content_type: item.mimeType,
      size_bytes: item.sizeBytes,
    })),
  }
}

const canSubmit = computed(() => {
  if (!selectedKey.value || !modelAvailable.value || status.value === 'generating') return false
  if (sizeError.value) return false
  if (activeTab.value === 'batch') return batchPromptCount.value > 0
  if (!prompt.value.trim()) return false
  if (activeTab.value === 'edit' && !references.value.length) return false
  if (references.value.some(item => item.uploadStatus !== 'ready')) return false
  return true
})

const progressLabel = computed(() => {
  const key = progress.value || 'imageGen.status.generating'
  return t(key, { current: 0, total: 0 })
})

async function submit(): Promise<void> {
  if (!canSubmit.value) return
  if (activeTab.value === 'edit' && !references.value.length) {
    appStore.showError(t('imageGen.error.referenceRequired'))
    return
  }
  const request = buildRequest()
  if (!request) return
  const image = await generate(request)
  if (!image) {
    if (errorMessage.value && !errorMessage.value.startsWith('imageGen.')) {
      appStore.showError(errorMessage.value)
    }
    return
  }
  appStore.showSuccess(t('imageGen.success'))
  await archiveResults([image])
  await loadHistory()
}

async function submitBatch(): Promise<void> {
  if (!canSubmit.value) return
  const request = buildRequest()
  if (!request) return
  await generateBatch({
    ...request,
    prompts: batchPromptList.value,
    concurrency: IMAGE_GEN_DEFAULTS.batchConcurrency,
  })
  if (errorMessage.value === 'imageGen.error.allFailed') {
    appStore.showError(t('imageGen.error.allFailed'))
    return
  }
  appStore.showSuccess(t('imageGen.success'))
  const results = batchItems.value.map(item => item.result).filter((item): item is GeneratedImage => !!item)
  await archiveResults(results)
  await loadHistory()
}

async function archiveResults(images: GeneratedImage[]): Promise<void> {
  const key = selectedKey.value
  if (!key || !images.length) return
  await archive(images, {
    apiKeyID: key.id,
    references: toGatewayReferences(),
    onError: () => appStore.showWarning(t('imageGen.history.archiveFailed')),
  })
}

/* ---------------------------------- 结果操作 -------------------------------- */

function download(image: GeneratedImage): void {
  const link = document.createElement('a')
  link.href = image.blobUrl
  link.download = `image-${image.id}.${image.extension}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function clearResult(): void {
  clearAllResults()
}

async function reuse(item: ImageGenerationHistoryItem): Promise<void> {
  if (!modelOptions.value.some(option => option.value === item.model)) {
    appStore.showWarning(t('imageGen.modelUnavailable'))
    return
  }
  const params = (item.normalized_params || {}) as Record<string, unknown>
  model.value = item.model
  if (typeof params.size === 'string') size.value = params.size
  if (typeof params.quality === 'string') quality.value = params.quality
  if (typeof params.background === 'string') background.value = params.background === 'transparent' ? 'auto' : params.background
  if (typeof params.output_format === 'string') outputFormat.value = params.output_format
  if (typeof params.output_compression === 'number') outputCompression.value = params.output_compression
  if (typeof params.aspect_ratio === 'string') aspectRatio.value = params.aspect_ratio
  if (typeof params.image_size === 'string') imageSize.value = params.image_size
  prompt.value = item.prompt

  clearReferences()
  const snapshot = Array.isArray(item.reference_snapshot) ? item.reference_snapshot : []
  let expired = 0
  for (const entry of snapshot as Array<Record<string, unknown>>) {
    try {
      const blob = await fetchHistoryContent(Number(entry.history_id || item.id))
      const previewUrl = URL.createObjectURL(blob)
      references.value.push({
        id: `history-${item.id}-${references.value.length + 1}`,
        index: references.value.length + 1,
        name: String(entry.name || t('imageGen.referenceImage')),
        previewUrl,
        mimeType: String(entry.content_type || blob.type || 'image/png'),
        sizeBytes: Number(entry.size_bytes || blob.size || 0),
        uploadStatus: 'ready',
      })
    } catch {
      expired += 1
    }
  }
  if (expired) appStore.showWarning(t('imageGen.history.referencesExpired', { count: expired }))
  activeTab.value = references.value.length ? 'edit' : 'generate'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function removeHistory(id: number): Promise<void> {
  if (!window.confirm(t('imageGen.history.deleteConfirm'))) return
  try {
    await deleteHistory(id)
    history.value = history.value.filter(item => item.id !== id)
    releaseHistoryPreview(id)
  } catch {
    appStore.showError(t('imageGen.history.deleteFailed'))
  }
}

function switchTab(value: TabValue): void {
  cancelGeneration()
  clearAllResults()
  activeTab.value = value
  if (value !== 'edit') clearReferences()
}

onMounted(() => {
  void bootstrap()
})

onUnmounted(() => {
  disposed = true
  loadToken += 1
  modelLoadToken += 1
  modelController?.abort()
  for (const id of Object.keys(historyPreviewUrls.value).map(Number)) releaseHistoryPreview(id)
  if (estimateTimer) clearTimeout(estimateTimer)
  estimateController?.abort()
  cancelGeneration()
  clearAllResults()
  for (const item of references.value) URL.revokeObjectURL(item.previewUrl)
})
</script>
