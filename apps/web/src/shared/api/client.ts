import { apiBaseUrl } from '../config'

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | object | null
}

function buildUrl(path: string) {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error('API path must begin with one slash')
  }
  return `${apiBaseUrl}${path}`
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, headers: inputHeaders, ...rest } = options
  const headers = new Headers(inputHeaders)
  const isJsonBody = body !== null && body !== undefined && typeof body === 'object'
    && (Array.isArray(body) || Object.getPrototypeOf(body) === Object.prototype)
  if (isJsonBody && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')

  const response = await fetch(buildUrl(path), {
    ...rest,
    credentials: 'include',
    headers,
    body: isJsonBody ? JSON.stringify(body) : body as BodyInit | null | undefined,
  })

  if (!response.ok) {
    let message = `Ошибка запроса (${response.status})`
    const contentType = response.headers.get('Content-Type') || ''
    if (contentType.includes('application/json')) {
      try {
        const payload: unknown = await response.json()
        if (payload && typeof payload === 'object' && 'message' in payload) {
          const value = payload.message
          if (typeof value === 'string') message = value
          if (Array.isArray(value)) message = value.filter((item): item is string => typeof item === 'string').join(', ') || message
        }
      } catch { /* Keep the HTTP status when the error payload is malformed. */ }
    }
    throw new ApiError(response.status, message)
  }

  if (response.status === 204 || response.status === 205) return undefined as T
  const contentType = response.headers.get('Content-Type') || ''
  if (!contentType.includes('application/json')) {
    throw new ApiError(response.status, 'Сервер вернул неожиданный формат ответа')
  }
  try {
    return await response.json() as T
  } catch {
    throw new ApiError(response.status, 'Не удалось прочитать ответ сервера')
  }
}
