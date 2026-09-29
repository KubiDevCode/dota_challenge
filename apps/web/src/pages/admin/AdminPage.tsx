import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFieldArray, useForm } from 'react-hook-form'
import { useState } from 'react'
import { z } from 'zod'
import { useCurrentUser } from '../../entities/user'
import { listAdminSeasons, listThresholds, replaceThresholds, saveSeason, thresholdSchema, type AdminSeason, type SeasonInput } from '../../entities/season'
import { ManageChallenge } from '../../features/manage-challenge'
import { ApiError } from '../../shared/api'
import { apiBaseUrl } from '../../shared/config'
import { ErrorState, LoadingState } from '../../shared/ui'

const seasonFormSchema = z.object({ name: z.string().trim().min(1, 'Введите название').max(128), startsAt: z.string().min(1, 'Укажите дату начала'), endsAt: z.string().min(1, 'Укажите дату окончания'), status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED']) }).refine((value) => new Date(value.startsAt) < new Date(value.endsAt), { message: 'Дата начала должна быть раньше даты окончания', path: ['endsAt'] })
type SeasonFormValues = z.infer<typeof seasonFormSchema>
const thresholdFormSchema = z.object({ thresholds: z.array(thresholdSchema).min(1, 'Добавьте хотя бы один уровень') }).superRefine(({ thresholds }, ctx) => {
  const rows = [...thresholds].sort((a, b) => a.level - b.level)
  if (rows[0]?.level !== 1 || rows[0]?.requiredTotalXp !== 0) ctx.addIssue({ code: 'custom', message: 'Первый уровень должен начинаться с 0 XP', path: ['thresholds'] })
  rows.forEach((row, index) => { if (index > 0 && (row.level !== rows[index - 1].level + 1 || row.requiredTotalXp <= rows[index - 1].requiredTotalXp)) ctx.addIssue({ code: 'custom', message: 'Уровни должны идти подряд, а XP — строго возрастать', path: ['thresholds'] }) })
})
type ThresholdValues = z.infer<typeof thresholdFormSchema>
const inputClass = 'mt-1 w-full rounded-md border border-white/10 bg-[#111317] px-3 py-2 text-sm text-[#eeeae3] outline-none focus:border-[#ca5946]'
const labelClass = 'block text-xs font-medium text-[#aaa69f]'
const statusLabels = { DRAFT: 'Черновик', ACTIVE: 'Активен', COMPLETED: 'Завершён' }
const errorMessage = (error: unknown) => error instanceof ApiError ? error.message : 'Не удалось сохранить данные. Попробуйте ещё раз.'
const localDate = (value: string) => {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function SeasonForm({ season, close }: { season?: AdminSeason; close: () => void }) {
  const client = useQueryClient()
  const form = useForm<SeasonFormValues>({ resolver: zodResolver(seasonFormSchema), defaultValues: season ? { name: season.name, startsAt: localDate(season.startsAt), endsAt: localDate(season.endsAt), status: season.status } : { name: '', startsAt: '', endsAt: '', status: 'DRAFT' } })
  const mutation = useMutation({ mutationFn: (value: SeasonInput) => saveSeason(value, season?.id), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['admin-seasons'] }); close() } })
  return <form className="profile-panel space-y-3" onSubmit={form.handleSubmit((value) => mutation.mutate({ name: value.name, startsAt: new Date(value.startsAt).toISOString(), endsAt: new Date(value.endsAt).toISOString(), status: value.status }))}>
    <h3 className="font-display text-xl">{season ? 'Изменить сезон' : 'Новый сезон'}</h3>
    <div className="grid gap-3 sm:grid-cols-2"><label className={labelClass}>Название<input className={inputClass} {...form.register('name')} />{form.formState.errors.name?.message && <ErrorText>{form.formState.errors.name.message}</ErrorText>}</label>
      <label className={labelClass}>Статус<select className={inputClass} {...form.register('status')}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className={labelClass}>Начало<input className={inputClass} type="datetime-local" {...form.register('startsAt')} />{form.formState.errors.startsAt?.message && <ErrorText>{form.formState.errors.startsAt.message}</ErrorText>}</label>
      <label className={labelClass}>Окончание<input className={inputClass} type="datetime-local" {...form.register('endsAt')} />{form.formState.errors.endsAt?.message && <ErrorText>{form.formState.errors.endsAt.message}</ErrorText>}</label>
    </div>
    {form.watch('status') === 'ACTIVE' && <p className="text-xs text-[#d8aa60]">В системе может быть только один активный сезон. Сохранение вернёт конфликт (409), если другой сезон уже активен.</p>}
    {mutation.isError && <div role="alert" className="rounded-md border border-[#d65a46]/30 bg-[#d65a46]/10 p-3 text-sm text-[#ef907e]">{mutation.error instanceof ApiError && mutation.error.status === 409 ? 'Конфликт: уже существует активный сезон. Завершите его перед активацией этого сезона.' : errorMessage(mutation.error)}</div>}
    <div className="flex gap-2"><button className="steam-button" disabled={mutation.isPending}>{mutation.isPending ? 'Сохранение…' : 'Сохранить сезон'}</button><button type="button" className="secondary-button" onClick={close}>Отмена</button></div>
  </form>
}

function ErrorText({ children }: { children: string }) { return <span role="alert" className="mt-1 block text-xs text-[#e16d59]">{children}</span> }

function Seasons() {
  const seasons = useQuery({ queryKey: ['admin-seasons'], queryFn: ({ signal }) => listAdminSeasons(signal), retry: false })
  const [editing, setEditing] = useState<AdminSeason | 'new' | null>(null)
  if (seasons.isPending) return <p role="status" className="text-sm text-[#aaa69f]">Загрузка сезонов…</p>
  if (seasons.isError) return <div role="alert" className="text-sm text-[#e16d59]">{errorMessage(seasons.error)} <button className="underline" onClick={() => void seasons.refetch()}>Повторить</button></div>
  return <div className="space-y-4"><div className="flex items-center justify-between"><h2 className="font-display text-2xl">Сезоны</h2>{!editing && <button className="steam-button" onClick={() => setEditing('new')}>Создать сезон</button>}</div>
    {editing && <SeasonForm key={editing === 'new' ? 'new' : editing.id} season={editing === 'new' ? undefined : editing} close={() => setEditing(null)} />}
    <div className="space-y-2">{seasons.data.map((season) => <article key={season.id} className="profile-panel flex items-center justify-between gap-3 py-4"><div><h3 className="font-semibold">{season.name}</h3><p className="mt-1 text-xs text-[#817d76]">{statusLabels[season.status]} · {new Date(season.startsAt).toLocaleDateString()} — {new Date(season.endsAt).toLocaleDateString()}</p></div><button className="secondary-button" onClick={() => setEditing(season)}>Изменить</button></article>)}</div>
    {!seasons.data.length && <p className="profile-panel text-sm text-[#aaa69f]">Сезонов пока нет.</p>}
  </div>
}

function ThresholdEditor() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['admin-thresholds'], queryFn: ({ signal }) => listThresholds(signal), retry: false })
  const form = useForm<ThresholdValues>({ resolver: zodResolver(thresholdFormSchema), values: { thresholds: query.data ?? [] } })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'thresholds' })
  const mutation = useMutation({ mutationFn: replaceThresholds, onSuccess: async () => { await client.invalidateQueries({ queryKey: ['admin-thresholds'] }) } })
  if (query.isPending) return <p role="status" className="text-sm text-[#aaa69f]">Загрузка уровней…</p>
  if (query.isError) return <div role="alert" className="text-sm text-[#e16d59]">{errorMessage(query.error)} <button className="underline" onClick={() => void query.refetch()}>Повторить</button></div>
  return <form className="space-y-4" onSubmit={form.handleSubmit(({ thresholds }) => mutation.mutate(thresholds))}><h2 className="font-display text-2xl">Пороги уровней</h2><p className="text-sm text-[#88857f]">Уровни должны идти подряд, а необходимый суммарный XP — возрастать. Первый уровень начинается с 0 XP.</p>
    <div className="space-y-2">{fields.map((field, index) => <div key={field.id} className="grid grid-cols-[.6fr_1fr_1fr_auto] items-end gap-2"><label className={labelClass}>Уровень<input className={inputClass} type="number" min="1" step="1" {...form.register(`thresholds.${index}.level`, { valueAsNumber: true })} /></label><label className={labelClass}>Всего XP<input className={inputClass} type="number" min="0" step="1" {...form.register(`thresholds.${index}.requiredTotalXp`, { valueAsNumber: true })} /></label><label className={labelClass}>Звание<input className={inputClass} {...form.register(`thresholds.${index}.rankName`)} /></label><button type="button" className="secondary-button min-h-10" aria-label={`Удалить уровень ${index + 1}`} onClick={() => remove(index)}>Удалить</button></div>)}</div>
    {form.formState.errors.thresholds?.message && <ErrorText>{form.formState.errors.thresholds.message}</ErrorText>}{form.formState.errors.thresholds?.root?.message && <ErrorText>{form.formState.errors.thresholds.root.message}</ErrorText>}
    {mutation.isError && <div role="alert" className="text-sm text-[#e16d59]">Ошибка сервера: {errorMessage(mutation.error)}</div>}
    <div className="flex gap-2"><button type="button" className="secondary-button" onClick={() => append({ level: fields.length + 1, requiredTotalXp: (form.getValues(`thresholds.${fields.length - 1}.requiredTotalXp`) ?? 0) + 100, rankName: '' })}>Добавить уровень</button><button className="steam-button" disabled={mutation.isPending}>{mutation.isPending ? 'Сохранение…' : 'Сохранить пороги'}</button></div>
  </form>
}

export function AdminPage() {
  const me = useCurrentUser()
  if (me.isPending) return <LoadingState />
  if (me.error instanceof ApiError && me.error.status === 401) return <section className="mx-auto max-w-[1180px] px-5 py-16 lg:px-10"><h1 className="font-display text-4xl">Войдите в Steam</h1><p className="mt-4 text-[#98958e]">Панель администратора доступна только после входа.</p><a className="steam-button mt-6 inline-flex" href={`${apiBaseUrl}/auth/steam`}>Войти через Steam</a></section>
  if (me.error instanceof ApiError && me.error.status === 403) return <section className="mx-auto max-w-[1180px] px-5 py-16 lg:px-10"><h1 className="font-display text-4xl">Доступ запрещён</h1><p className="mt-4 text-[#98958e]">Для просмотра панели нужна роль администратора.</p></section>
  if (me.isError) return <ErrorState error={me.error} retry={() => void me.refetch()} />
  if (me.data.role !== 'ADMIN') return <section className="mx-auto max-w-[1180px] px-5 py-16 lg:px-10"><h1 className="font-display text-4xl">Доступ запрещён</h1><p className="mt-4 text-[#98958e]">Для просмотра панели нужна роль администратора.</p></section>
  return <main className="mx-auto max-w-[1180px] space-y-12 px-5 py-12 lg:px-10"><header><p className="section-label">УПРАВЛЕНИЕ ИГРОЙ</p><h1 className="mt-3 font-display text-4xl">Администрирование</h1></header><ManageChallenge /><Seasons /><ThresholdEditor /></main>
}

export { seasonFormSchema, thresholdFormSchema }
