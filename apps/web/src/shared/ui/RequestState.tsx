import { ApiError } from '../api'

export function LoadingState() {
  return <div role="status" className="mx-auto max-w-xl px-5 py-16 text-center text-[#aaa69f]">Загрузка…</div>
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const message = error instanceof ApiError ? error.message : 'Не удалось загрузить данные. Попробуйте ещё раз.'
  return <div role="alert" className="mx-auto max-w-xl px-5 py-16 text-center"><p className="text-[#e16d59]">{message}</p>{retry && <button className="secondary-button mt-5" onClick={retry}>Повторить</button>}</div>
}
