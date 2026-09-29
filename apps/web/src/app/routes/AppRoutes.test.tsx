// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../../App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

it('keeps profile routing and provides an admin route', async () => {
  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url.endsWith('/me') ? {
    id: '76561198123456789', steamId64: '76561198123456789', displayName: 'InvokerEnjoyer', avatarUrl: null, totalXp: 0, role: 'ADMIN',
  } : url.includes('/admin/') ? [] : {
    id: '76561198123456789', displayName: 'InvokerEnjoyer', avatarUrl: null, totalXp: 0,
    level: null, seasonalScore: 0, seasonId: null, completedChallenges: 0,
  }), { headers: { 'Content-Type': 'application/json' } }))))
  window.history.replaceState(null, '', '/profile/76561198123456789')
  const view = render(<App />)
  expect(await screen.findByRole('heading', { name: 'InvokerEnjoyer' })).toBeTruthy()
  view.unmount()
  window.history.replaceState(null, '', '/admin')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Администрирование' })).toBeTruthy()
})
