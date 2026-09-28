import { ChallengeCard, type Challenge } from '../../entities/challenge'

export function ChallengeGrid({ challenges, activeIds, onSelect }: {
  challenges: Challenge[]
  activeIds: number[]
  onSelect: (challenge: Challenge) => void
}) {
  return <div className="grid gap-4 lg:grid-cols-2">{challenges.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} active={activeIds.includes(challenge.id)} onSelect={() => onSelect(challenge)} />)}</div>
}
