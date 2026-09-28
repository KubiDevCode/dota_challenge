// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { useQueryClient } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './error-boundary'
import { QueryProvider } from './query-client'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function QueryConsumer() {
  const client = useQueryClient()
  return <span>{client ? 'QueryClient ready' : 'Missing QueryClient'}</span>
}

it('provides one QueryClient to descendants', () => {
  render(<QueryProvider><QueryConsumer /></QueryProvider>)
  expect(screen.getByText('QueryClient ready')).toBeTruthy()
})

it('shows a recovery action after an unexpected render error', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  function Broken(): null { throw new Error('render failed') }
  render(<ErrorBoundary><Broken /></ErrorBoundary>)
  expect(screen.getByRole('alert').textContent).toContain('Что-то пошло не так')
  expect(screen.getByRole('button', { name: 'Обновить страницу' })).toBeTruthy()
})
