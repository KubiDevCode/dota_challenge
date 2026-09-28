import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unexpected rendering error', error, info)
  }

  render() {
    if (this.state.hasError) {
      return <main role="alert" className="grid min-h-screen place-content-center bg-[#08090b] px-5 text-center text-[#f3f0e9]"><h1 className="font-display text-3xl">Что-то пошло не так</h1><p className="mt-3 text-sm text-[#aaa69f]">Обновите страницу и попробуйте снова.</p><button className="secondary-button mx-auto mt-6" onClick={() => window.location.reload()}>Обновить страницу</button></main>
    }
    return this.props.children
  }
}
