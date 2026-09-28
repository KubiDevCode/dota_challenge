// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import App from '../../App'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

it('keeps the existing challenge interactions and stores difficulty in the URL', () => {
  window.history.replaceState(null, '', '/challenges?source=preview')
  render(<App />)
  expect(screen.getAllByRole('button', { name: /Незримый защитник/ })).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Легко' }))
  expect(window.location.search).toBe('?source=preview&difficulty=easy')
  expect(screen.getByRole('button', { name: /Верный союзник/ })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Без права на ошибку/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Верный союзник/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Активировать испытание' }))
  expect(screen.getByText('2/3')).toBeTruthy()
  fireEvent.click(screen.getAllByRole('button', { name: 'Отменить' })[0])
  expect(screen.getByText('1/3')).toBeTruthy()
})

it('keeps profile routes and provides an admin route without backend auth', () => {
  window.history.replaceState(null, '', '/profile/76561198123456789')
  const view = render(<App />)
  expect(screen.getByRole('heading', { name: 'InvokerEnjoyer' })).toBeTruthy()
  view.unmount()
  window.history.replaceState(null, '', '/admin')
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Администрирование' })).toBeTruthy()
})
