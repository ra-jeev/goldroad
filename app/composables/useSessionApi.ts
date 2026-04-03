import type { HintResult, OutcomeTier } from '../../shared/types/game'

export interface SessionEndRequest {
  playerUUID: string
  gameNo: number
  sessionId: string
  score: number
  moves: number
  attempts: number
  tier: OutcomeTier
  hintsLevel1?: number
  hintsLevel2?: number
  hintsLevel3?: number
}

export interface HintRequest {
  playerUUID: string
  gameNo: number
  sessionId: string
  level: 1 | 2 | 3
  currentTileIndex: number
}

export function useSessionApi() {
  const api = useApi()

  function endSession(payload: SessionEndRequest) {
    return api.post<{
      ok: boolean
      gameNo: number
      tier: OutcomeTier
      score: number
      completed: boolean
    }>('/api/session/end', payload)
  }

  function requestHint(payload: HintRequest) {
    return api.post<{ ok: boolean; hint: HintResult }>('/api/session/hint', payload)
  }

  return {
    endSession,
    requestHint,
  }
}
