// Keep the selected STRATZ fields in this adapter. No caller sees GraphQL response types.
const MATCH_FIELDS = `
  id
  startDateTime
  durationSeconds
  gameMode
  lobbyType
  numHumanPlayers
  didRadiantWin
  radiantKills
  direKills
`

const PLAYER_FIELDS = `
  steamAccountId
  isRadiant
  isVictory
  heroId
  kills
  deaths
  assists
  numLastHits
  heroDamage
  towerDamage
  stats { wards { type } }
`

export const PLAYER_MATCHES_QUERY = `
  query PlayerMatches($accountId: Long!, $request: PlayerMatchesRequestType!) {
    player(steamAccountId: $accountId) {
      matches(request: $request) {
        ${MATCH_FIELDS}
        players(steamAccountId: $accountId) { ${PLAYER_FIELDS} }
      }
    }
  }
`

export const MATCH_QUERY = `
  query Match($matchId: Long!) {
    match(id: $matchId) {
      ${MATCH_FIELDS}
      players { ${PLAYER_FIELDS} }
    }
  }
`
