// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../../App'

const season = { id: 'season-1', name: 'Сезон I', startsAt: '2026-01-01T00:00:00.000Z', endsAt: '2026-12-31T00:00:00.000Z' }
const first = { userId: '11111111-1111-4111-8111-111111111111', displayName: 'Первый', avatarUrl: 'https://example.com/avatar.png', totalXp: 200, level: { level: 5, rankName: 'Страж' }, seasonalScore: 90, position: 1 }
const second = { userId: '22222222-2222-4222-8222-222222222222', displayName: 'Второй', avatarUrl: null, totalXp: 100, level: null, seasonalScore: 60, position: 2 }

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

function leaderboard(items = [first, second], hasMore = false) {
  return { season, items, page: 1, limit: 20, hasMore }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

it('renders server entries in returned order with season, rank, avatar, score and profile link', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(leaderboard())))
  window.history.replaceState(null, '', '/leaderboard')
  render(<App />)
  expect(await screen.findByText('Первый')).toBeTruthy()
  expect(screen.getByText('Второй')).toBeTruthy()
  expect(screen.getByText('Сезон I')).toBeTruthy()
  expect(screen.getByText('Страж · уровень 5')).toBeTruthy()
  expect(screen.getByText('90')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Открыть профиль Первый' }).getAttribute('href')).toBe(`/profile/${first.userId}`)
  expect(screen.getByRole('presentation').getAttribute('src')).toBe('https://example.com/avatar.png')
})

it('uses URL pagination and requests only the selected backend page', async () => {
  const fetchMock = vi.fn().mockImplementation((url: string) => url.includes('page=2')
    ? response({ ...leaderboard([{ ...second, position: 21 }]), page: 2, hasMore: false })
    : response(leaderboard([first], true)))
  vi.stubGlobal('fetch', fetchMock)
  window.history.replaceState(null, '', '/leaderboard?page=1')
  render(<App />)
  expect(await screen.findByText('Первый')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Дальше' }))
  expect(await screen.findByText('Второй')).toBeTruthy()
  await waitFor(() => expect(window.location.search).toBe('?page=2'))
  expect(fetchMock).toHaveBeenCalledWith('/api/leaderboard?page=2&limit=20', expect.anything())
})

it('opens the public profile using the profile API', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => url.includes('/profile')
    ? response({ id: first.userId, displayName: first.displayName, avatarUrl: null, totalXp: 200, level: { ...first.level, requiredTotalXp: 100 }, seasonalScore: 90, seasonId: season.id, completedChallenges: 4 })
    : response(leaderboard([first]))))
  window.history.replaceState(null, '', '/leaderboard')
  render(<App />)
  fireEvent.click(await screen.findByRole('link', { name: 'Открыть профиль Первый' }))
  expect(await screen.findByRole('heading', { name: 'Первый' })).toBeTruthy()
  expect(screen.getByText('Выполнено')).toBeTruthy()
})

it('shows an empty leaderboard', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(leaderboard([]))))
  window.history.replaceState(null, '', '/leaderboard')
  render(<App />)
  expect(await screen.findByText('В этом сезоне пока нет участников рейтинга.')).toBeTruthy()
})

it('shows API errors with retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ message: 'Сервис недоступен' }, 500)))
  window.history.replaceState(null, '', '/leaderboard')
  render(<App />)
  expect(await screen.findByText('Сервис недоступен')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Повторить' })).toBeTruthy()
})

it('shows the dedicated no-active-season state for the backend 404', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ message: 'No active season' }, 404)))
  window.history.replaceState(null, '', '/leaderboard')
  render(<App />)
  expect(await screen.findByText('Активного сезона пока нет')).toBeTruthy()
})
