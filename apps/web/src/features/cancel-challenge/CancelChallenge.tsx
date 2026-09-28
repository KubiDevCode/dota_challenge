import { X } from 'lucide-react'

export function CancelChallenge({ onCancel }: { onCancel: () => void }) {
  return <button onClick={onCancel} aria-label="Отменить"><X size={13} /></button>
}
