import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useImageGeneration, type ImageGenRequest } from '../useImageGeneration'
import type { ImageGenerateRequest, ImageResult } from '@/api/imageGateway'

const { generateImage, archiveHistory, createObjectURL, revokeObjectURL } = vi.hoisted(() => ({
  generateImage: vi.fn<(request: ImageGenerateRequest, signal: AbortSignal) => Promise<ImageResult>>(),
  archiveHistory: vi.fn(),
  createObjectURL: vi.fn(),
  revokeObjectURL: vi.fn(),
}))

vi.mock('@/api/imageGateway', () => ({
  generateImage,
  normalizedParamsFor: (_provider: string, request: ImageGenRequest) => ({ size: request.size }),
  describeTaskError: vi.fn(),
  restorePendingTasks: vi.fn(),
}))
vi.mock('@/api/imageGenerations', () => ({ archiveHistory }))

const pngResult: ImageResult = { data: 'iVBORw0KGgo=', mimeType: 'image/png' }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function request(overrides: Partial<ImageGenRequest> = {}): ImageGenRequest {
  return {
    apiBase: 'https://gateway.test', apiKey: 'original-test-key', apiKeyID: 11,
    model: 'gpt-image-2', prompt: 'a cup', size: '1024x1024', references: [],
    ...overrides,
  }
}

describe('image generation request lifetime and archive snapshots', () => {
  beforeEach(() => {
    generateImage.mockReset()
    archiveHistory.mockReset().mockResolvedValue({ id: 1 })
    createObjectURL.mockReset().mockImplementation(() => `blob:image-${createObjectURL.mock.calls.length}`)
    revokeObjectURL.mockReset()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps an active request alive until explicitly canceled and discards its late result', async () => {
    const pending = deferred<ImageResult>()
    generateImage.mockReturnValue(pending.promise)
    const generation = useImageGeneration()
    const run = generation.generate(request())
    const signal = generateImage.mock.calls[0][1]

    expect(signal.aborted).toBe(false)
    expect(generation.status.value).toBe('generating')
    generation.cancelGeneration()
    expect(signal.aborted).toBe(true)
    expect(generation.status.value).toBe('idle')
    pending.resolve(pngResult)

    expect(await run).toBeNull()
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(generation.currentResult.value).toBeNull()
    expect(generation.errorMessage.value).toBe('')
  })

  it('does not show a failure returned after cancellation', async () => {
    const pending = deferred<ImageResult>()
    generateImage.mockReturnValue(pending.promise)
    const generation = useImageGeneration()
    const run = generation.generate(request())

    generation.cancelGeneration()
    pending.reject(new Error('the canceled upstream request failed'))

    expect(await run).toBeNull()
    expect(generation.status.value).toBe('idle')
    expect(generation.errorMessage.value).toBe('')
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('keeps the newer generation when an older replaced request returns late', async () => {
    const first = deferred<ImageResult>()
    const second = deferred<ImageResult>()
    generateImage.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const generation = useImageGeneration()
    const oldRun = generation.generate(request({ prompt: 'old prompt' }))
    const oldSignal = generateImage.mock.calls[0][1]
    const newRun = generation.generate(request({ prompt: 'new prompt' }))

    expect(oldSignal.aborted).toBe(true)
    second.resolve(pngResult)
    const newImage = await newRun
    expect(newImage?.prompt).toBe('new prompt')
    expect(createObjectURL).toHaveBeenCalledOnce()
    first.resolve(pngResult)

    expect(await oldRun).toBeNull()
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(generation.currentResult.value).toBe(newImage)
    expect(generation.status.value).toBe('success')
  })

  it('does not start queued batch items or create images after manual cancellation', async () => {
    const pending = deferred<ImageResult>()
    generateImage.mockReturnValue(pending.promise)
    const generation = useImageGeneration()
    const run = generation.generateBatch({ ...request(), prompts: ['first', 'queued'], concurrency: 1 })
    await flushPromises()
    expect(generateImage).toHaveBeenCalledOnce()
    const signal = generateImage.mock.calls[0][1]

    generation.cancelGeneration()
    pending.resolve(pngResult)
    await run

    expect(signal.aborted).toBe(true)
    expect(generateImage).toHaveBeenCalledOnce()
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(generation.status.value).toBe('idle')
    expect(generation.progress.value).toBe('')
  })

  it('archives a completed single image using its original Key and reference snapshot', async () => {
    const referenceSnapshot = [{ index: 1, name: 'original.png', content_type: 'image/png', size_bytes: 42 }]
    generateImage.mockResolvedValue(pngResult)
    const generation = useImageGeneration()
    const image = await generation.generate(request({ apiKeyID: 11, referenceSnapshot }))
    expect(image).not.toBeNull()

    await generation.archive([image!], {
      apiKeyID: 22, references: [],
      referenceSnapshot: [{ index: 1, name: 'replacement.png' }],
    })

    expect(archiveHistory).toHaveBeenCalledOnce()
    expect(archiveHistory.mock.calls[0][0]).toMatchObject({
      api_key_id: 11, reference_snapshot: referenceSnapshot, prompt: 'a cup',
      model: 'gpt-image-2', content_type: 'image/png',
    })
    expect(archiveHistory.mock.calls[0][0].file).toBeInstanceOf(File)
    expect(image!.serverArchived).toBe(true)
  })

  it('snapshots original reference metadata when no explicit snapshot was supplied', async () => {
    generateImage.mockResolvedValue(pngResult)
    const generation = useImageGeneration()
    const image = await generation.generate(request({ references: [
      { id: 'ref-original', name: 'original.webp', mimeType: 'image/webp', dataUrl: 'data:image/webp;base64,AA==' },
    ] }))

    await generation.archive([image!], { apiKeyID: 22, references: [
      { id: 'ref-new', name: 'replacement.png', mimeType: 'image/png' },
    ] })

    expect(archiveHistory.mock.calls[0][0]).toMatchObject({
      api_key_id: 11,
      reference_snapshot: [{ index: 1, name: 'original.webp', content_type: 'image/webp' }],
    })
  })

  it('retains each batch image prompt and the original archive metadata', async () => {
    const referenceSnapshot = [{ index: 1, name: 'batch-original.png', content_type: 'image/png' }]
    generateImage.mockResolvedValue(pngResult)
    const generation = useImageGeneration()
    await generation.generateBatch({
      ...request({ apiKeyID: 31, referenceSnapshot }), prompts: ['first image', 'second image'], concurrency: 2,
    })
    const images = generation.batchItems.value.flatMap(item => item.result ? [item.result] : [])

    await generation.archive(images, { apiKeyID: 99, references: [], referenceSnapshot: [] })

    expect(images).toHaveLength(2)
    expect(archiveHistory).toHaveBeenCalledTimes(2)
    expect(archiveHistory.mock.calls.map(([payload]) => payload.prompt)).toEqual(['first image', 'second image'])
    for (const [payload] of archiveHistory.mock.calls) {
      expect(payload.api_key_id).toBe(31)
      expect(payload.reference_snapshot).toEqual(referenceSnapshot)
    }
    expect(images.every(image => image.serverArchived)).toBe(true)
  })

  it('supports manually archiving an image without stored request metadata', async () => {
    generateImage.mockResolvedValue(pngResult)
    const generation = useImageGeneration()
    const image = await generation.generate(request())
    Reflect.deleteProperty(image!, 'apiKeyID')
    Reflect.deleteProperty(image!, 'referenceSnapshot')

    await generation.archive([image!], {
      apiKeyID: 77, references: [{ id: 'ref-fallback', name: 'fallback.png', mimeType: 'image/png' }],
    })

    expect(archiveHistory.mock.calls[0][0]).toMatchObject({
      api_key_id: 77,
      reference_snapshot: [{ index: 1, name: 'fallback.png', content_type: 'image/png' }],
    })
  })

  it('archives a successful batch item even when another prompt fails', async () => {
    generateImage.mockResolvedValueOnce(pngResult).mockRejectedValueOnce(new Error('second prompt failed'))
    const generation = useImageGeneration()
    await generation.generateBatch({ ...request(), prompts: ['first', 'second'], concurrency: 2 })
    const items = generation.batchItems.value
    expect(items.map(item => item.status)).toEqual(['success', 'error'])
    expect(items[1].error).toBe('second prompt failed')
    expect(generation.status.value).toBe('success')

    await generation.archive(items.flatMap(item => item.result ? [item.result] : []), { references: [] })

    expect(archiveHistory).toHaveBeenCalledOnce()
    expect(archiveHistory.mock.calls[0][0].prompt).toBe('first')
  })

  it('skips successfully archived images and allows retrying an archive failure', async () => {
    generateImage.mockResolvedValue(pngResult)
    const error = { status: 400, reason: 'IMAGE_GENERATION_HISTORY_UPLOAD_INCOMPLETE', code: 400, message: 'internal detail' }
    archiveHistory.mockRejectedValueOnce(error).mockResolvedValue({ id: 1 })
    const onError = vi.fn()
    const generation = useImageGeneration()
    const image = await generation.generate(request())

    await generation.archive([image!], { references: [], onError })
    expect(image!.serverArchived).toBe(false)
    expect(onError).toHaveBeenCalledWith(error)
    expect(onError.mock.calls[0][0]).toBe(error)
    await generation.archive([image!], { references: [], onError })
    await generation.archive([image!], { references: [], onError })

    expect(archiveHistory).toHaveBeenCalledTimes(2)
    expect(image!.serverArchived).toBe(true)
  })

  it('shares an archive in flight and permits one retry after its failure', async () => {
    const firstSave = deferred<{ id: number }>()
    const retrySave = deferred<{ id: number }>()
    generateImage.mockResolvedValue(pngResult)
    archiveHistory.mockReturnValueOnce(firstSave.promise).mockReturnValueOnce(retrySave.promise)
    const generation = useImageGeneration()
    const image = await generation.generate(request())
    const onError = vi.fn()
    const options = { references: [], onError }

    const automaticSave = generation.archive([image!], options)
    const manualSave = generation.archive([image!], options)
    expect(archiveHistory).toHaveBeenCalledOnce()
    expect(image!.serverArchived).toBe(false)
    expect(generation.isArchiving(image!)).toBe(true)
    firstSave.reject(new Error('temporary history failure'))
    await Promise.all([automaticSave, manualSave])
    expect(onError).toHaveBeenCalledOnce()
    expect(image!.serverArchived).toBe(false)
    expect(generation.isArchiving(image!)).toBe(false)

    const retry = generation.archive([image!], options)
    const repeatedRetry = generation.archive([image!], options)
    expect(archiveHistory).toHaveBeenCalledTimes(2)
    expect(generation.isArchiving(image!)).toBe(true)
    retrySave.resolve({ id: 1 })
    await Promise.all([retry, repeatedRetry])
    await generation.archive([image!], options)

    expect(archiveHistory).toHaveBeenCalledTimes(2)
    expect(image!.serverArchived).toBe(true)
    expect(generation.isArchiving(image!)).toBe(false)
  })

  it('releases completed result URLs only when results are cleared', async () => {
    generateImage.mockResolvedValue(pngResult)
    const generation = useImageGeneration()
    const image = await generation.generate(request())
    expect(revokeObjectURL).not.toHaveBeenCalled()

    generation.clearAllResults()
    generation.clearAllResults()

    expect(revokeObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith(image!.blobUrl)
    expect(generation.currentResult.value).toBeNull()
    expect(generation.batchItems.value).toEqual([])
  })
})
