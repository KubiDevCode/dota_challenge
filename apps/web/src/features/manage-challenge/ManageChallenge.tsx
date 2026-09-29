import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import type { UseFormReturn } from 'react-hook-form'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'
import { challengeDifficulties, challengeMetrics, challengeModes, createAdminChallenge, listAdminChallenges, matchModes, metricLabel, publicationStatuses, ruleSchema, updateAdminChallenge, type AdminChallenge, type ChallengeInput } from '../../entities/challenge'
import { ApiError } from '../../shared/api'

const ruleFields = z.object({ rules: z.array(ruleSchema).min(1, 'Добавьте хотя бы одно правило') })
const formSchema = z.object({
  title: z.string().trim().min(1, 'Введите название').max(200), description: z.string(), category: z.string().trim().min(1, 'Введите категорию').max(64),
  difficulty: z.enum(challengeDifficulties), mode: z.enum(challengeModes), xpReward: z.number().int().min(0).max(2147483647),
  seasonPointsReward: z.number().int().min(0).max(2147483647), allowedMatchModes: z.array(z.number()), publicationStatus: z.enum(publicationStatuses),
  availableFrom: z.string(), rules: ruleFields.shape.rules,
})
type FormValues = z.infer<typeof formSchema>
const defaults: FormValues = { title: '', description: '', category: '', difficulty: 'EASY', mode: 'SINGLE_MATCH', xpReward: 0, seasonPointsReward: 0, allowedMatchModes: [], publicationStatus: 'DRAFT', availableFrom: '', rules: [{ metric: 'kills', operator: 'GTE', value: 1 }] }
const labels: Record<string, string> = { EASY: 'Легко', MEDIUM: 'Средне', HARD: 'Сложно', PERSISTENT: 'Постоянное', SINGLE_MATCH: 'За один матч', DRAFT: 'Черновик', PUBLISHED: 'Опубликовано' }
const inputClass = 'mt-1 w-full rounded-md border border-white/10 bg-[#111317] px-3 py-2 text-sm text-[#eeeae3] outline-none focus:border-[#ca5946]'
const fieldLabel = 'block text-xs font-medium text-[#aaa69f]'
const localDateTime = (value: string) => {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function serverError(error: unknown) {
  if (error instanceof ApiError) return error.message
  return 'Не удалось сохранить. Проверьте соединение и попробуйте ещё раз.'
}

function RuleEditor({ control, register, setValue, formState: { errors } }: UseFormReturn<FormValues>) {
  const { fields, append, remove } = useFieldArray({ control, name: 'rules' })
  const watched = useWatch({ control, name: 'rules' })
  return <fieldset className="space-y-3 rounded-lg border border-white/8 p-4"><legend className="px-2 text-sm font-semibold">Правила матча</legend>
    {fields.map((row, index) => {
      const metric = watched?.[index]?.metric ?? 'kills'
      const isWin = metric === 'win'
      const isHero = metric === 'heroId'
      return <div key={row.id} className="grid gap-2 sm:grid-cols-[1.2fr_.8fr_1fr_auto] sm:items-end">
        <label className={fieldLabel}>Метрика<select className={inputClass} aria-label={`Метрика правила ${index + 1}`} {...register(`rules.${index}.metric`, { onChange: (event) => {
          const next = event.target.value
          setValue(`rules.${index}.operator`, next === 'win' || next === 'heroId' ? 'EQ' : 'GTE')
          setValue(`rules.${index}.value`, next === 'win' ? true : next === 'heroId' ? 1 : 0)
        } })}>{challengeMetrics.map((item) => <option key={item} value={item}>{metricLabel[item]}</option>)}</select></label>
        <label className={fieldLabel}>Оператор<select className={inputClass} aria-label={`Оператор правила ${index + 1}`} {...register(`rules.${index}.operator`)}><option value="EQ">Равно</option>{!isWin && !isHero && <><option value="GTE">Не меньше</option><option value="LTE">Не больше</option></>}</select></label>
        <label className={fieldLabel}>Значение{isWin ? <select className={inputClass} aria-label={`Значение правила ${index + 1}`} {...register(`rules.${index}.value`, { setValueAs: (value) => value === 'true' })}><option value="true">Да</option><option value="false">Нет</option></select> : <input className={inputClass} aria-label={`Значение правила ${index + 1}`} type="number" min={metric === 'heroId' ? 1 : 0} step={['kills', 'deaths', 'assists', 'lastHits', 'wardsPlaced', 'heroId'].includes(metric) ? 1 : 'any'} {...register(`rules.${index}.value`, { valueAsNumber: true })} />}</label>
        <button type="button" className="secondary-button min-h-10" onClick={() => remove(index)} disabled={fields.length === 1} aria-label={`Удалить правило ${index + 1}`}>Удалить</button>
        {errors.rules?.[index]?.value?.message && <p role="alert" className="text-xs text-[#e16d59] sm:col-span-4">{errors.rules[index]?.value?.message}</p>}
      </div>
    })}
    <button type="button" className="secondary-button" onClick={() => append({ metric: 'kills', operator: 'GTE', value: 1 })}>Добавить правило</button>
  </fieldset>
}

function ChallengeForm({ challenge, close }: { challenge?: AdminChallenge; close: () => void }) {
  const client = useQueryClient()
  const [saveError, setSaveError] = useState('')
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: challenge ? {
    ...challenge, availableFrom: challenge.availableFrom ? localDateTime(challenge.availableFrom) : '',
  } : defaults })
  const mutation = useMutation({ mutationFn: (values: ChallengeInput) => challenge ? updateAdminChallenge(challenge.id, values) : createAdminChallenge(values), onSuccess: async () => {
    await client.invalidateQueries({ queryKey: ['admin-challenges'] }); close()
  }, onError: (error) => setSaveError(serverError(error)) })
  const submit = form.handleSubmit((values) => {
    setSaveError('')
    const body: ChallengeInput = { ...values, availableFrom: values.availableFrom ? new Date(values.availableFrom).toISOString() : null }
    mutation.mutate(body)
  })
  return <form className="profile-panel space-y-4" onSubmit={submit}>
    <div className="flex items-center justify-between"><h3 className="font-display text-xl">{challenge ? 'Редактировать испытание' : 'Новое испытание'}</h3><button type="button" className="text-sm text-[#aaa69f]" onClick={close}>Закрыть</button></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Название" error={form.formState.errors.title?.message}><input className={inputClass} {...form.register('title')} /></Field>
      <Field label="Категория" error={form.formState.errors.category?.message}><input className={inputClass} {...form.register('category')} /></Field>
      <Field label="Сложность"><select className={inputClass} {...form.register('difficulty')}>{challengeDifficulties.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></Field>
      <Field label="Тип"><select className={inputClass} {...form.register('mode')}>{challengeModes.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></Field>
      <Field label="Награда XP" error={form.formState.errors.xpReward?.message}><input className={inputClass} type="number" min="0" step="1" {...form.register('xpReward', { valueAsNumber: true })} /></Field>
      <Field label="Очки сезона" error={form.formState.errors.seasonPointsReward?.message}><input className={inputClass} type="number" min="0" step="1" {...form.register('seasonPointsReward', { valueAsNumber: true })} /></Field>
      <Field label="Статус"><select className={inputClass} {...form.register('publicationStatus')}>{publicationStatuses.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></Field>
      <Field label="Доступно с"><input className={inputClass} type="datetime-local" {...form.register('availableFrom')} /></Field>
      <label className={`${fieldLabel} sm:col-span-2`}>Описание<textarea className={inputClass} rows={3} {...form.register('description')} /></label>
    </div>
    <fieldset className="rounded-lg border border-white/8 p-4"><legend className="px-2 text-sm font-semibold">Режимы матча</legend><div className="flex flex-wrap gap-5">{matchModes.map(({ id, label }) => <label key={id} className="flex items-center gap-2 text-sm text-[#c7c2b9]"><Controller control={form.control} name="allowedMatchModes" render={({ field }) => <input type="checkbox" value={id} checked={field.value.includes(id)} onChange={(event) => field.onChange(event.target.checked ? [...field.value, id] : field.value.filter((value) => value !== id))} />}/>{label}</label>)}</div></fieldset>
    <RuleEditor {...form} />
    {form.formState.errors.rules?.root?.message && <p role="alert" className="text-sm text-[#e16d59]">{form.formState.errors.rules.root.message}</p>}
    {saveError && <p role="alert" className="rounded-md border border-[#d65a46]/30 bg-[#d65a46]/10 p-3 text-sm text-[#ef907e]">Ошибка сервера: {saveError}</p>}
    <button className="steam-button" disabled={mutation.isPending}>{mutation.isPending ? 'Сохранение…' : 'Сохранить испытание'}</button>
  </form>
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) { return <label className={fieldLabel}>{label}{children}{error && <span role="alert" className="mt-1 block text-xs text-[#e16d59]">{error}</span>}</label> }

export function ManageChallenge() {
  const client = useQueryClient()
  const challenges = useQuery({ queryKey: ['admin-challenges'], queryFn: ({ signal }) => listAdminChallenges(signal), retry: false })
  const [editing, setEditing] = useState<AdminChallenge | null | 'new'>(null)
  const mutation = useMutation({ mutationFn: ({ id, publicationStatus }: { id: string; publicationStatus: 'DRAFT' | 'PUBLISHED' }) => updateAdminChallenge(id, { publicationStatus }), onSuccess: () => client.invalidateQueries({ queryKey: ['admin-challenges'] }) })
  if (challenges.isPending) return <p role="status" className="text-sm text-[#aaa69f]">Загрузка испытаний…</p>
  if (challenges.isError) return <div role="alert" className="profile-panel text-sm text-[#e16d59]">{serverError(challenges.error)} <button className="ml-3 underline" onClick={() => void challenges.refetch()}>Повторить</button></div>
  return <div className="space-y-4">
    <div className="flex items-center justify-between"><h2 className="font-display text-2xl">Испытания</h2>{!editing && <button className="steam-button" onClick={() => setEditing('new')}>Создать испытание</button>}</div>
    {editing && <ChallengeForm key={editing === 'new' ? 'new' : editing.id} challenge={editing === 'new' ? undefined : editing} close={() => setEditing(null)} />}
    <div className="space-y-2">{challenges.data.map((challenge) => <article key={challenge.id} className="profile-panel flex flex-wrap items-center justify-between gap-4 py-4"><div><h3 className="font-semibold">{challenge.title}</h3><p className="mt-1 text-xs text-[#817d76]">{labels[challenge.publicationStatus]} · {labels[challenge.mode]} · {challenge.xpReward} XP</p></div><div className="flex gap-2"><button className="secondary-button" onClick={() => setEditing(challenge)}>Изменить</button><button className="secondary-button" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: challenge.id, publicationStatus: challenge.publicationStatus === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' })}>{challenge.publicationStatus === 'PUBLISHED' ? 'Снять с публикации' : 'Опубликовать'}</button></div></article>)}</div>
    {!challenges.data.length && <p className="profile-panel text-sm text-[#aaa69f]">Испытаний пока нет.</p>}
    {mutation.isError && <p role="alert" className="text-sm text-[#e16d59]">{serverError(mutation.error)}</p>}
  </div>
}

export { formSchema as challengeFormSchema }
