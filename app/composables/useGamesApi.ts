import type {
  Board,
  DifficultyBand,
  PuzzleType,
} from '../../shared/types/game';

interface GamePayload {
  gameNo: number;
  puzzleType: PuzzleType;
  board: Board;
  maxScore: number;
  totalCoins: number;
  difficultyBand: DifficultyBand;
  playableAt: string;
  nextGameAt: string | null;
}

interface CurrentGamesResponse {
  classic: GamePayload | null;
  expedition: GamePayload | null;
}

interface PastRoadModeSummary {
  maxScore: number;
  totalCoins: number;
  difficultyBand: DifficultyBand;
}

interface PastGamesResponse {
  count: number;
  games: Array<{
    gameNo: number;
    playableAt: string;
    classic: PastRoadModeSummary | null;
    expedition: PastRoadModeSummary | null;
  }>;
}

export function useGamesApi() {
  const api = useApi();

  function getCurrentGames() {
    return api.get<CurrentGamesResponse>('/api/games/current');
  }

  function getAnotherGame(playerId?: string) {
    return api.get<GamePayload>('/api/games/another', {
      playerId,
    });
  }

  function getPastGames(limit = 30) {
    return api.get<PastGamesResponse>('/api/games/past', { limit });
  }

  function getGameBoard(gameNo: number) {
    return api.get<CurrentGamesResponse>(`/api/games/${gameNo}/board`);
  }

  return {
    getCurrentGames,
    getAnotherGame,
    getPastGames,
    getGameBoard,
  };
}
