// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { apiRequest, ApiError } from './client'

afterEach(() => vi.unstubAllGlobals())

it('uses the public API base and sends cookie credentials with typed JSON requests', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), {
    headers: { 'Content-Type': 'application/json' },
  }))
  vi.stubGlobal('fetch', fetchMock)
  const result = await apiRequest<{ status: string }>('/health', { method: 'POST', body: { sample: true } })
  expect(result.status).toBe('ok')
  expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.objectContaining({
    credentials: 'include', method: 'POST', body: JSON.stringify({ sample: true }),
  }))
  expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toEqual(expect.any(Headers))
  expect(((fetchMock.mock.calls[0][1] as RequestInit).headers as Headers).get('Content-Type')).toBe('application/json')
})

it('uses a server error message for non-2xx responses', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: ['Bad id', 'Try again'] }), {
    status: 400, headers: { 'Content-Type': 'application/json' },
  })))
  await expect(apiRequest('/anything')).rejects.toEqual(new ApiError(400, 'Bad id, Try again'))
})

it('handles empty success responses and rejects paths outside the API base', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
  await expect(apiRequest<void>('/empty')).resolves.toBeUndefined()
  await expect(apiRequest('https://example.com')).rejects.toThrow('API path must begin with one slash')
})
