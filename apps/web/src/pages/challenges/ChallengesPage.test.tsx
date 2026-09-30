// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { ChallengesPage } from './ChallengesPage'

const ids = [1, 2, 3, 4].map((n) => `00000000-0000-4000-8000-00000000000${n}`)
const challenges = ids.map((id, index) => ({
  id, title: `Цель ${index + 1}`, description: 'Описание испытания', category: 'Боевое',
  difficulty: index === 0 ? 'EASY' : 'HARD', mode: index === 0 ? 'PERSISTENT' : 'SINGLE_MATCH',
  xpReward: 100, seasonPointsReward: 10, allowedMatchModes: [], rules: [],
}))
type TestEnrollment = {
  id: string; challenge: typeof challenges[number]; status: string; activatedAt: string; attemptsChecked: number
  completedAt: string | null; completedByMatchId: string | null
  completedByMatch: { id: string; startedAt: string; duration: number | null; matchMode: number | null } | null
}
const enrollment = (index: number, status = 'ACTIVE'): TestEnrollment => ({
  id: `10000000-0000-4000-8000-00000000000${index + 1}`, challenge: challenges[index], status,
  activatedAt: '2026-01-01T00:00:00.000Z', attemptsChecked: 0,
  completedAt: null, completedByMatchId: null, completedByMatch: null,
})
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

function setup({ initial = [], items = challenges, activateStatus = 201, cancelStatus = 200, listStatus = 200 }: {
  initial?: TestEnrollment[]; items?: typeof challenges; activateStatus?: number; cancelStatus?: number; listStatus?: number
} = {}) {
  let mine = [...initial]
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.startsWith('/api/challenges?')) {
      if (listStatus !== 200) return json({ message: 'Каталог недоступен' }, listStatus)
      const params = new URLSearchParams(url.split('?')[1])
      const filtered = items.filter((item) => !params.has('difficulty') || item.difficulty === params.get('difficulty'))
      return json({ items: filtered, page: Number(params.get('page')), limit: 20 })
    }
    if (url === '/api/me/challenges' && (!options?.method || options.method === 'GET')) return json(mine)
    if (url.includes('/activate') && options?.method === 'POST') {
      if (activateStatus !== 201) return json({ message: 'Maximum of three active challenges' }, activateStatus)
      const index = challenges.findIndex((item) => url.includes(item.id))
      const created = enrollment(index)
      mine = [created, ...mine]
      return json(created, 201)
    }
    if (url.startsWith('/api/me/challenges/') && options?.method === 'DELETE') {
      if (cancelStatus !== 200) return json({ message: 'Only active challenges can be cancelled' }, cancelStatus)
      const existing = mine.find((item) => url.endsWith(item.id))!
      mine = mine.map((item) => item.id === existing.id ? { ...item, status: 'CANCELLED' } : item)
      return json({ ...existing, status: 'CANCELLED' })
    }
    throw new Error(`Unexpected request: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
  render(<QueryClientProvider client={client}><BrowserRouter><ChallengesPage /></BrowserRouter></QueryClientProvider>)
  return fetchMock
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

it('shows loading, server challenges, rewards and active status', async () => {
  window.history.replaceState(null, '', '/challenges')
  setup({ initial: [enrollment(1)] })
  expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
  expect(await screen.findByRole('button', { name: /Цель 1/ })).toBeTruthy()
  expect(screen.getByText('1/3')).toBeTruthy()
  expect(screen.getAllByText('За один матч').length).toBeGreaterThan(0)
  expect(screen.getAllByText('100 XP').length).toBeGreaterThan(0)
})

it('loads completed challenges with numeric OpenDota match IDs', async () => {
  window.history.replaceState(null, '', '/challenges')
  const completed = {
    ...enrollment(0, 'SUCCEEDED'),
    completedAt: '2026-09-30T15:30:00.000Z',
    completedByMatchId: '9023211143',
    completedByMatch: {
      id: '9023211143', startedAt: '2026-09-30T15:27:32.000Z', duration: 2042, matchMode: 22,
    },
  }
  setup({ initial: [completed] })
  expect(await screen.findByText('История испытаний')).toBeTruthy()
  expect(screen.getAllByText('Выполнено').length).toBeGreaterThan(0)
  expect(screen.queryByRole('alert')).toBeNull()
})

it('activates and cancels through API, then refreshes the active cache', async () => {
  window.history.replaceState(null, '', '/challenges')
  const fetchMock = setup()
  fireEvent.click(await screen.findByRole('button', { name: /Цель 1/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Активировать испытание' }))
  await waitFor(() => expect(screen.getByText('1/3')).toBeTruthy())
  expect(fetchMock).toHaveBeenCalledWith(`/api/challenges/${ids[0]}/activate`, expect.objectContaining({ method: 'POST' }))
  fireEvent.click(screen.getByRole('button', { name: 'Отменить' }))
  await waitFor(() => expect(screen.getByText('0/3')).toBeTruthy())
  expect(fetchMock).toHaveBeenCalledWith(`/api/me/challenges/${enrollment(0).id}`, expect.objectContaining({ method: 'DELETE' }))
  expect(screen.getByText('История испытаний')).toBeTruthy()
})

it('blocks a fourth activation when three slots are active', async () => {
  window.history.replaceState(null, '', '/challenges')
  const fetchMock = setup({ initial: [enrollment(0), enrollment(1), enrollment(2)] })
  fireEvent.click(await screen.findByRole('button', { name: /Цель 4/ }))
  expect(screen.getByRole('button', { name: 'Все слоты заняты' }).hasAttribute('disabled')).toBe(true)
  expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/activate'))).toBe(false)
})

it('shows backend activation conflict without changing active count', async () => {
  window.history.replaceState(null, '', '/challenges')
  setup({ activateStatus: 409 })
  fireEvent.click(await screen.findByRole('button', { name: /Цель 1/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Активировать испытание' }))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Maximum of three active challenges')
  expect(screen.getByText('0/3')).toBeTruthy()
})

it('shows backend cancellation error and retains the active challenge', async () => {
  window.history.replaceState(null, '', '/challenges')
  setup({ initial: [enrollment(0)], cancelStatus: 409 })
  await screen.findByText('1/3')
  fireEvent.click(screen.getByRole('button', { name: 'Отменить' }))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Only active challenges can be cancelled')
  expect(screen.getByText('1/3')).toBeTruthy()
})

it('shows API errors, retry, and an empty catalog', async () => {
  window.history.replaceState(null, '', '/challenges')
  setup({ listStatus: 500 })
  expect(await screen.findByText('Каталог недоступен')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Повторить' })).toBeTruthy()
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/challenges')
  setup({ items: [] })
  expect(await screen.findByText('По выбранным фильтрам испытаний нет.')).toBeTruthy()
  expect(within(screen.getByRole('complementary')).getByText(/Активных испытаний пока нет/)).toBeTruthy()
})

it('keeps difficulty, mode, category and page filters in the URL', async () => {
  window.history.replaceState(null, '', '/challenges?source=preview&page=2')
  const fetchMock = setup()
  await screen.findByRole('button', { name: /Цель 1/ })
  fireEvent.click(screen.getByRole('button', { name: 'Легко' }))
  expect(window.location.search).toContain('difficulty=easy')
  expect(window.location.search).not.toContain('page=2')
  fireEvent.change(screen.getByRole('combobox', { name: 'Тип испытания' }), { target: { value: 'PERSISTENT' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Категория' }), { target: { value: 'Боевое' } })
  fireEvent.click(screen.getByRole('button', { name: 'Применить категорию' }))
  await waitFor(() => expect(window.location.search).toContain('category='))
  expect(window.location.search).toContain('mode=PERSISTENT')
  expect(window.location.search).toContain('source=preview')
  expect(fetchMock).toHaveBeenCalled()
})
