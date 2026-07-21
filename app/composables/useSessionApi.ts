import type { HintResult, Medal, PuzzleType } from '../../shared/types/game';

export interface SessionStartRequest {
  playerUUID: string;
  gameNo: number;
  puzzleType: PuzzleType;
  sessionId: string;
}

export interface SessionEndRequest {
  playerUUID: string;
  gameNo: number;
  puzzleType: PuzzleType;
  sessionId: string;
  score: number;
  moves: number;
  attemptNumber: number;
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

  function startSession(payload: SessionStartRequest) {
    return api.post<{ ok: boolean; gameNo: number }>(
      '/api/session/start',
      payload,
    );
  }

  function endSession(
    payload: SessionEndRequest,
    options: { keepalive?: boolean } = {},
  ) {
    return api.post<{
      ok: boolean;
      gameNo: number;
      medal: Medal | null;
      score: number;
      solved: true;
    }>('/api/session/end', payload, options);
  }

  function requestHint(payload: HintRequest) {
    return api.post<{ ok: boolean; hint: HintResult }>(
      '/api/session/hint',
      payload,
    );
  }

  return {
    startSession,
    endSession,
    requestHint,
  };
}
