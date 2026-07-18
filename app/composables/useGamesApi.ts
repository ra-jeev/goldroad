import type {
  CurrentGamesResponse,
  DifficultyBand,
} from '../../shared/types/game';

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

interface RandomRoadResponse {
  gameNo: number;
}

export function useGamesApi() {
  const api = useApi();

  function getCurrentGames() {
    return api.get<CurrentGamesResponse>('/api/games/current');
  }

  function getAnotherGame() {
    return api.get<RandomRoadResponse>('/api/games/another');
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
