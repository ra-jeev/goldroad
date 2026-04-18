import type { StatsOverview } from '../../shared/types/game'

export function useStatsApi() {
  const api = useApi()

  function getOverview() {
    return api.get<StatsOverview>('/api/stats/overview')
  }

  return {
    getOverview,
  }
}