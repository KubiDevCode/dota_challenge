// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { AdminPage } from './AdminPage'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const user = (role = 'ADMIN') => ({ id: 'user-1', steamId64: '76561198000000000', accountId32: 1, displayName: 'Admin', avatarUrl: null, totalXp: 0, role })
const challenge = (overrides: Record<string, unknown> = {}) => ({ id: 'challenge-1', title: 'Win a match', description: 'Play well', category: 'combat', difficulty: 'EASY', mode: 'SINGLE_MATCH', xpReward: 100, seasonPointsReward: 10, allowedMatchModes: [1], publicationStatus: 'DRAFT', availableFrom: null, rules: [{ metric: 'win', operator: 'EQ', value: true }], createdAt: '', updatedAt: '', ...overrides })
const season = { id: 'season-1', name: 'Autumn', startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-11-01T00:00:00.000Z', status: 'DRAFT' }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
function openAdmin(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><AdminPage /></QueryClientProvider>)
}
function successFetch(userRole = 'ADMIN', rows: { challenges: unknown[]; seasons: unknown[]; thresholds: unknown[] } = { challenges: [], seasons: [], thresholds: [] }) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('/me')) return Promise.resolve(json(user(userRole)))
    if (url.endsWith('/admin/challenges')) return Promise.resolve(json(rows.challenges))
    if (url.endsWith('/admin/seasons')) return Promise.resolve(json(rows.seasons))
    if (url.endsWith('/admin/level-thresholds')) return Promise.resolve(json(rows.thresholds))
    return Promise.resolve(json({}))
  })
}

it('shows sign-in UX to anonymous visitors without requesting admin data', async () => {
  const fetchMock = vi.fn().mockResolvedValue(json({ message: 'Unauthorized' }, 401))
  openAdmin(fetchMock)
  expect(await screen.findByRole('heading', { name: 'Войдите в Steam' })).toBeTruthy()
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
})

it('denies a non-admin user before loading admin endpoints', async () => {
  const fetchMock = successFetch('USER')
  openAdmin(fetchMock)
  expect(await screen.findByRole('heading', { name: 'Доступ запрещён' })).toBeTruthy()
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
})

it('creates a challenge using the structured rule builder and edits its reward', async () => {
  const created = challenge({ rules: [{ metric: 'kills', operator: 'GTE', value: 3 }] })
  const fetchMock = successFetch('ADMIN', { challenges: [], seasons: [], thresholds: [] })
  fetchMock.mockImplementation((url: string, options?: RequestInit) => {
    if (url.endsWith('/me')) return Promise.resolve(json(user()))
    if (url.endsWith('/admin/challenges') && options?.method === 'POST') return Promise.resolve(json(created, 201))
    if (url.endsWith('/admin/challenges')) return Promise.resolve(json([created]))
    if (url.endsWith('/admin/seasons')) return Promise.resolve(json([]))
    if (url.endsWith('/admin/level-thresholds')) return Promise.resolve(json([]))
    if (url.includes('/admin/challenges/challenge-1')) return Promise.resolve(json(challenge({ xpReward: 250 })))
    return Promise.resolve(json({}))
  })
  openAdmin(fetchMock)
  fireEvent.click(await screen.findByRole('button', { name: 'Создать испытание' }))
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Win a match' } })
  fireEvent.change(screen.getByLabelText('Категория'), { target: { value: 'combat' } })
  fireEvent.change(screen.getByLabelText('Награда XP'), { target: { value: '100' } })
  fireEvent.click(screen.getByLabelText('All Pick'))
  fireEvent.change(screen.getByLabelText('Метрика правила 1'), { target: { value: 'kills' } })
  fireEvent.change(screen.getByLabelText('Значение правила 1'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить испытание' }))
  await waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => url === '/api/admin/challenges' && options.method === 'POST')).toBe(true))
  const sent = JSON.parse(fetchMock.mock.calls.find(([url, options]) => url === '/api/admin/challenges' && options.method === 'POST')![1].body)
  expect(sent.rules).toEqual([{ metric: 'kills', operator: 'GTE', value: 3 }])
  expect(sent.allowedMatchModes).toEqual([1])
  expect(sent.mode).toBe('SINGLE_MATCH')
  fireEvent.click(await screen.findByRole('button', { name: 'Изменить' }))
  fireEvent.change(screen.getByLabelText('Награда XP'), { target: { value: '250' } })
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить испытание' }))
  await waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => url === '/api/admin/challenges/challenge-1' && options.method === 'PATCH')).toBe(true))
})

it('validates incompatible rules before sending them to the API', async () => {
  const fetchMock = successFetch()
  openAdmin(fetchMock)
  fireEvent.click(await screen.findByRole('button', { name: 'Создать испытание' }))
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Win a match' } })
  fireEvent.change(screen.getByLabelText('Категория'), { target: { value: 'combat' } })
  fireEvent.change(screen.getByLabelText('Метрика правила 1'), { target: { value: 'killParticipation' } })
  fireEvent.change(screen.getByLabelText('Значение правила 1'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить испытание' }))
  expect(await screen.findByText('Укажите долю от 0 до 1')).toBeTruthy()
  expect(fetchMock.mock.calls.some(([url, options]) => url === '/api/admin/challenges' && options?.method === 'POST')).toBe(false)
})

it('clears the kill-participation error after correcting the value to zero', async () => {
  const created = challenge({ rules: [{ metric: 'killParticipation', operator: 'GTE', value: 0 }] })
  const fetchMock = successFetch()
  fetchMock.mockImplementation((url: string, options?: RequestInit) => {
    if (url.endsWith('/me')) return Promise.resolve(json(user()))
    if (url.endsWith('/admin/challenges') && options?.method === 'POST') return Promise.resolve(json(created, 201))
    if (url.endsWith('/admin/challenges')) return Promise.resolve(json([]))
    if (url.endsWith('/admin/seasons')) return Promise.resolve(json([]))
    if (url.endsWith('/admin/level-thresholds')) return Promise.resolve(json([]))
    return Promise.resolve(json({}))
  })
  openAdmin(fetchMock)
  fireEvent.click(await screen.findByRole('button', { name: 'Создать испытание' }))
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Win a match' } })
  fireEvent.change(screen.getByLabelText('Категория'), { target: { value: 'combat' } })
  fireEvent.change(screen.getByLabelText('Метрика правила 1'), { target: { value: 'killParticipation' } })
  fireEvent.change(screen.getByLabelText('Значение правила 1'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить испытание' }))
  expect(await screen.findByText('Укажите долю от 0 до 1')).toBeTruthy()

  fireEvent.change(screen.getByLabelText('Метрика правила 1'), { target: { value: 'heroDamage' } })
  await waitFor(() => expect(screen.queryByText('Укажите долю от 0 до 1')).toBeNull())
  fireEvent.change(screen.getByLabelText('Метрика правила 1'), { target: { value: 'killParticipation' } })
  expect((screen.getByLabelText('Значение правила 1') as HTMLInputElement).value).toBe('0')
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить испытание' }))
  await waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => url === '/api/admin/challenges' && options?.method === 'POST')).toBe(true))
  const sent = JSON.parse(fetchMock.mock.calls.find(([url, options]) => url === '/api/admin/challenges' && options?.method === 'POST')![1].body)
  expect(sent.rules).toEqual([{ metric: 'killParticipation', operator: 'GTE', value: 0 }])
})

it('shows backend validation errors on challenge save', async () => {
  const fetchMock = successFetch()
  fetchMock.mockImplementation((url: string, options?: RequestInit) => url.endsWith('/admin/challenges') && options?.method === 'POST'
    ? Promise.resolve(json({ message: ['Invalid rule metric, operator or value'] }, 400))
    : url.endsWith('/me') ? Promise.resolve(json(user())) : Promise.resolve(json([])))
  openAdmin(fetchMock)
  fireEvent.click(await screen.findByRole('button', { name: 'Создать испытание' }))
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Win a match' } })
  fireEvent.change(screen.getByLabelText('Категория'), { target: { value: 'combat' } })
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить испытание' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Ошибка сервера: Invalid rule metric')
})

it('creates seasons and explains an ACTIVE season conflict', async () => {
  const fetchMock = successFetch()
  fetchMock.mockImplementation((url: string, options?: RequestInit) => {
    if (url.endsWith('/me')) return Promise.resolve(json(user()))
    if (url.endsWith('/admin/seasons') && options?.method === 'POST') return Promise.resolve(json({ message: 'An ACTIVE season already exists' }, 409))
    if (url.endsWith('/admin/seasons')) return Promise.resolve(json([]))
    if (url.endsWith('/admin/challenges')) return Promise.resolve(json([]))
    if (url.endsWith('/admin/level-thresholds')) return Promise.resolve(json([]))
    return Promise.resolve(json({}))
  })
  openAdmin(fetchMock)
  fireEvent.click(await screen.findByRole('button', { name: 'Создать сезон' }))
  fireEvent.change(screen.getByLabelText('Название', { selector: 'input' }), { target: { value: 'Autumn' } })
  fireEvent.change(screen.getByLabelText('Начало'), { target: { value: '2026-10-01T00:00' } })
  fireEvent.change(screen.getByLabelText('Окончание'), { target: { value: '2026-11-01T00:00' } })
  fireEvent.change(screen.getByLabelText('Статус'), { target: { value: 'ACTIVE' } })
  expect(screen.getByText(/только один активный сезон/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить сезон' }))
  expect(await screen.findByText(/уже существует активный сезон/)).toBeTruthy()
})

it('validates and replaces level thresholds', async () => {
  const fetchMock = successFetch('ADMIN', { challenges: [], seasons: [season], thresholds: [{ level: 1, requiredTotalXp: 0, rankName: 'Recruit' }] })
  openAdmin(fetchMock)
  fireEvent.change(await screen.findByLabelText('Звание'), { target: { value: 'Recruit' } })
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить пороги' }))
  await waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => url === '/api/admin/level-thresholds' && options.method === 'PATCH')).toBe(true))
  const sent = JSON.parse(fetchMock.mock.calls.find(([url, options]) => url === '/api/admin/level-thresholds' && options.method === 'PATCH')![1].body)
  expect(sent.thresholds).toEqual([{ level: 1, requiredTotalXp: 0, rankName: 'Recruit' }])
  expect(screen.getByText('Autumn')).toBeTruthy()
})

it('rejects invalid level progression locally', async () => {
  const fetchMock = successFetch('ADMIN', { challenges: [], seasons: [], thresholds: [{ level: 1, requiredTotalXp: 0, rankName: 'Recruit' }] })
  openAdmin(fetchMock)
  fireEvent.change(await screen.findByLabelText('Уровень'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить пороги' }))
  expect(await screen.findByText('Первый уровень должен начинаться с 0 XP')).toBeTruthy()
  expect(fetchMock.mock.calls.some(([url, options]) => url === '/api/admin/level-thresholds' && options?.method === 'PATCH')).toBe(false)
})
