// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { ProfilePage } from './ProfilePage'
import { RefreshMatches } from '../../features/refresh-matches'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const profile = { id: 'owner', displayName: 'Real Player', avatarUrl: null, totalXp: 1250, level: { level: 3, rankName: 'Следопыт', requiredTotalXp: 1000 }, seasonalScore: 80, seasonId: null, completedChallenges: 2 }
const match = { matchId: '98765', win: true, kills: 10, deaths: 2, assists: 9, killParticipation: 0.5, lastHits: 120, heroDamage: 12000, towerDamage: 500, wardsPlaced: 2, heroId: 74, startedAt: '2026-09-28T12:00:00.000Z', duration: 2400, matchMode: 22 }

function open(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route path="/profile" element={<ProfilePage />} /><Route path="/profile/:id" element={<ProfilePage />} /></Routes></MemoryRouter></QueryClientProvider>)
}

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('uses only the public endpoint for another player', async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(profile))
  vi.stubGlobal('fetch', fetchMock)
  open('/profile/owner')
  expect(await screen.findByRole('heading', { name: 'Real Player' })).toBeTruthy()
  expect(screen.getByText('Следопыт')).toBeTruthy()
  expect(screen.queryByText('Недавние матчи')).toBeNull()
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/users/owner/profile'])
})

it('shows sign in for an unauthenticated own profile', async () => {
  const fetchMock = vi.fn().mockResolvedValue(json({ message: 'Unauthorized' }, 401))
  vi.stubGlobal('fetch', fetchMock)
  open('/profile')
  expect(await screen.findByRole('heading', { name: 'Войдите в Steam' })).toBeTruthy()
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
})

it('shows private matches and changes the URL page', async () => {
  const fetchMock = vi.fn((url: string) => {
    if (url === '/api/me') return Promise.resolve(json({ id: 'owner', steamId64: '76561198123456789', displayName: 'Real Player', avatarUrl: null, totalXp: 1250, role: 'USER' }))
    if (url === '/api/users/owner/profile') return Promise.resolve(json(profile))
    if (url === '/api/me/challenges') return Promise.resolve(json([{ status: 'ACTIVE' }, { status: 'SUCCEEDED', completedByMatchId: '98765', challenge: { title: 'Победить с героем' } }]))
    if (url === '/api/me/match-sync-status') return Promise.resolve(json({ status: 'idle', retryable: false, lastSuccessfulSync: null }))
    if (url === '/api/me/matches?page=1&limit=20') return Promise.resolve(json({ items: [match], page: 1, limit: 20, hasMore: true }))
    if (url === '/api/me/matches?page=2&limit=20') return Promise.resolve(json({ items: [], page: 2, limit: 20, hasMore: false }))
    throw new Error(`Unexpected request: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  open('/profile')
  expect(await screen.findByText(/Матч #98765/)).toBeTruthy()
  expect(screen.getByText('Победа')).toBeTruthy()
  expect(screen.getByText('Испытание выполнено: Победить с героем')).toBeTruthy()
  expect(screen.getByText('Активных испытаний')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Далее' }))
  expect(await screen.findByText('Матчей пока нет.')).toBeTruthy()
  expect(screen.getByText('Страница 2')).toBeTruthy()
  expect(fetchMock.mock.calls.some(([url]) => url === '/api/me/matches?page=2&limit=20')).toBe(true)
})

it('starts refresh and shows the server cooldown', async () => {
  let statusCalls = 0
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url === '/api/me') return Promise.resolve(json({ id: 'owner', steamId64: '76561198123456789', displayName: 'Real Player', avatarUrl: null, totalXp: 1250, role: 'USER' }))
    if (url === '/api/users/owner/profile') return Promise.resolve(json(profile))
    if (url === '/api/me/challenges') return Promise.resolve(json([]))
    if (url === '/api/me/match-sync-status') return Promise.resolve(json({ status: statusCalls++ === 0 ? 'idle' : 'queued', retryable: false, lastSuccessfulSync: null }))
    if (url === '/api/me/matches?page=1&limit=20') return Promise.resolve(json({ items: [], page: 1, limit: 20, hasMore: false }))
    if (url === '/api/me/matches/refresh' && options?.method === 'POST') return Promise.resolve(json({ status: 'queued', jobId: 'job-1' }))
    throw new Error(`Unexpected request: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  open('/profile')
  expect(await screen.findByText('Можно обновить историю матчей.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Обновить матчи' }))
  expect(await screen.findByText('Обновление в очереди…')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Обновить матчи' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByText(/Повторное обновление через/)).toBeTruthy()
  expect(fetchMock.mock.calls.some(([url]) => url === '/api/me/matches/refresh')).toBe(true)
})

it('shows provider failure and a backend rejected cooldown', async () => {
  let failed = true
  const fetchMock = vi.fn((url: string) => {
    if (url === '/api/me/match-sync-status') return Promise.resolve(json({ status: failed ? 'failed' : 'idle', retryable: true, lastSuccessfulSync: null }))
    if (url === '/api/me/matches/refresh') return Promise.resolve(json({ message: 'Match refresh cooldown' }, 429))
    throw new Error(`Unexpected request: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><RefreshMatches /></QueryClientProvider>)
  expect(await screen.findByText('Ошибка провайдера матчей.')).toBeTruthy()
  failed = false
  fireEvent.click(screen.getByRole('button', { name: 'Обновить матчи' }))
  expect(await screen.findByText('Пауза между обновлениями.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Обновить матчи' }).hasAttribute('disabled')).toBe(true)
})

it('shows processing and confirms a completed refresh from the status timestamp', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ status: 'processing', retryable: false, lastSuccessfulSync: null })))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(<QueryClientProvider client={client}><RefreshMatches /></QueryClientProvider>)
  expect(await screen.findByText('Обработка матчей…')).toBeTruthy()
  view.unmount()

  let statusCalls = 0
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url === '/api/me/match-sync-status') return Promise.resolve(json({ status: 'idle', retryable: false, lastSuccessfulSync: statusCalls++ === 0 ? null : '2026-09-29T10:00:00.000Z' }))
    if (url === '/api/me/matches/refresh') return Promise.resolve(json({ status: 'queued', jobId: 'job-2' }))
    throw new Error(`Unexpected request: ${url}`)
  }))
  const secondClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={secondClient}><RefreshMatches /></QueryClientProvider>)
  expect(await screen.findByText('Можно обновить историю матчей.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Обновить матчи' }))
  expect(await screen.findByText('Матчи успешно обновлены.')).toBeTruthy()
})
