import { ChallengeCard, type Challenge, type Enrollment } from '../../entities/challenge'

export function ChallengeGrid({ challenges, enrollments, onSelect }: {
  challenges: Challenge[]
  enrollments: Enrollment[]
  onSelect: (challenge: Challenge) => void
}) {
  return <div className="grid gap-4 lg:grid-cols-2">{challenges.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} status={enrollments.find((item) => item.challenge.id === challenge.id)?.status} onSelect={() => onSelect(challenge)} />)}</div>
}
