import type {
  HintResult,
  Medal,
  PuzzleType,
  RunEndReason,
} from '../../shared/types/game';

export interface SessionEndRequest {
  playerUUID: string;
  gameNo: number;
  puzzleType: PuzzleType;
  sessionId: string;
  score: number;
  moves: number;
  attemptNumber: number;
  solved: boolean;
  endReason: RunEndReason;
  hintsUsed?: number;
  solveTimeMs?: number | null;
}

export interface HintRequest {
  playerUUID: string;
  gameNo: number;
  puzzleType: PuzzleType;
  sessionId: string;
  attemptNumber: number;
  pathHistory: number[];
}

export function useSessionApi() {
  const api = useApi();

  function endSession(payload: SessionEndRequest) {
    return api.post<{
      ok: boolean;
      gameNo: number;
      medal: Medal | null;
      score: number;
      solved: boolean;
    }>('/api/session/end', payload);
  }

  function requestHint(payload: HintRequest) {
    return api.post<{ ok: boolean; hint: HintResult }>(
      '/api/session/hint',
      payload,
    );
  }

  return {
    endSession,
    requestHint,
  };
}
