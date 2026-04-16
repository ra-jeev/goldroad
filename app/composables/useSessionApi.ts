import type { HintResult, Medal, PuzzleType } from '../../shared/types/game'

export interface SessionEndRequest {
  playerUUID: string
  gameNo: number
  puzzleType: PuzzleType
  sessionId: string
  score: number
  moves: number
  attemptNumber: number
  reachedEnd: boolean
  solvedExact: boolean
  medal: Medal | null
  hintsLevel1?: number
  hintsLevel2?: number
  hintsLevel3?: number
}

export interface HintRequest {
  playerUUID: string
  gameNo: number
  puzzleType: PuzzleType
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
      medal: Medal | null
      score: number
      solvedExact: boolean
      reachedEnd: boolean
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
