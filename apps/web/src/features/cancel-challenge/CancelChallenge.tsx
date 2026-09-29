import { X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { challengeKeys, enrollmentSchema } from '../../entities/challenge'
import { apiRequest, ApiError } from '../../shared/api'

export function CancelChallenge({ enrollmentId }: { enrollmentId: string }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async () => enrollmentSchema.parse(await apiRequest<unknown>(`/me/challenges/${enrollmentId}`, { method: 'DELETE' })),
    onSettled: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: challengeKeys.mine }), queryClient.invalidateQueries({ queryKey: ['my-challenges'] })]) },
  })
  return <div className="text-right"><button onClick={() => mutation.mutate()} disabled={mutation.isPending} aria-label="Отменить" title="Отменить испытание"><X size={16} /></button>{mutation.isError && <p role="alert" className="mt-2 max-w-40 text-xs text-[#e16d59]">{mutation.error instanceof ApiError ? mutation.error.message : 'Не удалось отменить испытание.'}</p>}</div>
}
