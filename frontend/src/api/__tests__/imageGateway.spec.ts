import { afterEach, describe, expect, it, vi } from 'vitest'

import { generateImage, type ImageGenerateRequest } from '../imageGateway'

vi.mock('../client', () => ({ buildGatewayUrl: (path: string) => path }))

const apiBase = 'https://gateway.example'
const taskID = 'imgtask_0123456789abcdef0123456789abcdef'
const request: ImageGenerateRequest = {
  apiBase,
  apiKey: 'image-test-key',
  model: 'gpt-image-2',
  prompt: 'a cat',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function asyncUnavailable(): Response {
  return json({ error: { message: 'async image tasks are not enabled' } }, 404)
}

function acceptedTask() {
  return { id: taskID, task_id: taskID, object: 'image.generation.task', status: 'processing' }
}

function completedTask() {
  return { ...acceptedTask(), status: 'completed', result: { data: [{ b64_json: 'generated-image' }] } }
}

describe('image gateway response handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it.each(['task_id', 'id'])('uses completed image data before interpreting upstream %s as a task', async identifier => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(asyncUnavailable())
      .mockResolvedValueOnce(json({ [identifier]: 'req_upstream', data: [{ b64_json: 'generated-image' }] }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await generateImage(request, new AbortController().signal)).toEqual({ data: 'generated-image' })
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${apiBase}/v1/images/generations/async`,
      `${apiBase}/v1/images/generations`,
    ])
  })

  it('downloads a completed image URL without looking up its upstream task_id', async () => {
    const imageResponse = new Response(null, { headers: { 'Content-Type': 'image/png' } })
    // jsdom 的 FileReader 需要同环境 Blob，不能使用 Node Response 生成的 Blob。
    imageResponse.blob = async () => new Blob(['image-bytes'], { type: 'image/png' })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(asyncUnavailable())
      .mockResolvedValueOnce(json({ task_id: 'req_upstream', data: [{ url: '/generated.png' }] }))
      .mockResolvedValueOnce(imageResponse)
    vi.stubGlobal('fetch', fetchMock)

    expect(await generateImage(request, new AbortController().signal)).toEqual({
      data: btoa('image-bytes'), mimeType: 'image/png',
    })
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${apiBase}/v1/images/generations/async`,
      `${apiBase}/v1/images/generations`,
      `${window.location.origin}/generated.png`,
    ])
  })

  it.each(['gpt-image-2', 'dreamina-seedream-5.0-pro'])('polls an accepted local async task for %s', async model => {
    const onAccepted = vi.fn()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ ...acceptedTask(), poll_url: `/v1/images/tasks/${taskID}` }, 202))
      .mockResolvedValueOnce(json(completedTask()))
    vi.stubGlobal('fetch', fetchMock)

    expect(await generateImage({ ...request, model, onAccepted }, new AbortController().signal)).toEqual({
      data: 'generated-image',
    })
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${apiBase}/v1/images/generations/async`,
      `${apiBase}/v1/images/tasks/${taskID}`,
    ])
    expect(fetchMock.mock.calls[1][1].headers).toEqual({ Authorization: 'Bearer image-test-key' })
    if (model === 'gpt-image-2') expect(onAccepted).toHaveBeenCalledOnce()
  })

  it('polls a real local task returned by the synchronous endpoint', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(asyncUnavailable())
      .mockResolvedValueOnce(json(acceptedTask(), 202))
      .mockResolvedValueOnce(json(completedTask()))
    vi.stubGlobal('fetch', fetchMock)

    expect(await generateImage(request, new AbortController().signal)).toEqual({ data: 'generated-image' })
    expect(fetchMock.mock.calls[2][0]).toBe(`${apiBase}/v1/images/tasks/${taskID}`)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('uses an explicit poll_url for a task returned by the synchronous endpoint', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(asyncUnavailable())
      .mockResolvedValueOnce(json({ task_id: 'provider-task', poll_url: '/provider/tasks/provider-task' }, 202))
      .mockResolvedValueOnce(json(completedTask()))
    vi.stubGlobal('fetch', fetchMock)

    expect(await generateImage(request, new AbortController().signal)).toEqual({ data: 'generated-image' })
    expect(fetchMock.mock.calls[2][0]).toBe(`${apiBase}/provider/tasks/provider-task`)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it.each([{}, { task_id: 'req_upstream' }, { id: 'req_upstream' }, null])(
    'rejects a response with no image or valid task without polling: %j', async body => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(asyncUnavailable())
        .mockResolvedValueOnce(json(body))
      vi.stubGlobal('fetch', fetchMock)

      await expect(generateImage(request, new AbortController().signal)).rejects.toThrow('channel 2 returned no image')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    },
  )

  it('continues parsing Gemini inline image results', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({
      candidates: [{ content: { parts: [{ inlineData: { data: 'gemini-image', mimeType: 'image/png' } }] } }],
    }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await generateImage({ ...request, model: 'gemini-3-pro-image' }, new AbortController().signal)).toEqual({
      data: 'gemini-image', mimeType: 'image/png',
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe(`${apiBase}/v1beta/models/gemini-3-pro-image:generateContent`)
  })
})
