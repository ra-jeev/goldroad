import type { Board, DifficultyBand } from '../../shared/types/game'

interface GamePayload {
  gameNo: number
  board: Board
  maxScore: number
  totalCoins: number
  difficultyBand: DifficultyBand
  playableAt: string
  nextGameAt: string | null
}

interface PastGamesResponse {
  count: number
  games: Array<{
    gameNo: number
    maxScore: number
    totalCoins: number
    playableAt: string
    difficultyBand: DifficultyBand
  }>
}

export function useGamesApi() {
  const api = useApi()

  function getCurrentGame() {
    return api.get<GamePayload>('/api/games/current')
  }

  function getAnotherGame(playerId?: string) {
    return api.get<GamePayload>('/api/games/another', {
      playerId,
    })
  }

  function getPastGames(limit = 30) {
    return api.get<PastGamesResponse>('/api/games/past', { limit })
  }

  function getGameBoard(gameNo: number) {
    return api.get<GamePayload>(`/api/games/${gameNo}/board`)
  }

  return {
    getCurrentGame,
    getAnotherGame,
    getPastGames,
    getGameBoard,
  }
}
