import type { InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '../client'
import { archiveHistory, fetchHistoryContent } from '../imageGenerations'

vi.mock('@/i18n', () => ({ getLocale: () => 'zh' }))

describe('image generation history API', () => {
  const originalAdapter = apiClient.defaults.adapter

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter
    localStorage.removeItem('auth_token')
  })

  it('loads protected image bytes through the panel API with the session authorization header', async () => {
    const blob = new Blob(['png'], { type: 'image/png' })
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => ({
      data: blob, status: 200, statusText: 'OK', headers: {}, config,
    }))
    apiClient.defaults.adapter = adapter
    localStorage.setItem('auth_token', 'history-test-session')

    expect(await fetchHistoryContent(11)).toBe(blob)
    const request = adapter.mock.calls[0][0]
    expect(apiClient.getUri(request)).toContain('/api/v1/image-generations/history/11/content')
    expect(request.headers.get('Authorization')).toBe('Bearer history-test-session')
    expect(request.responseType).toBe('blob')
  })

  it('archives actual image bytes together with metadata so a remounted page can retrieve the image', async () => {
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => ({
      data: { code: 0, data: { id: 11, content_available: true } },
      status: 201, statusText: 'Created', headers: {}, config,
    }))
    apiClient.defaults.adapter = adapter
    const file = new File(['png'], 'generated.png', { type: 'image/png' })

    const saved = await archiveHistory({
      model: 'gpt-image-2', provider: 'openai', prompt: 'a cat', content_type: file.type,
      normalized_params: { size: '1024x1024' }, file,
    })

    const request = adapter.mock.calls[0][0]
    expect(request.data).toBeInstanceOf(FormData)
    const form = request.data as FormData
    expect((form.get('file') as File).size).toBe(file.size)
    expect((form.get('file') as File).type).toBe('image/png')
    expect(form.get('normalized_params')).toBe('{"size":"1024x1024"}')
    expect(saved).toEqual({ id: 11, content_available: true })
  })
})
