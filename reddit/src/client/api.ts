import type { RoadResponse } from '../shared/api';

export async function fetchRoad(): Promise<RoadResponse> {
  const response = await fetch('/api/road', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Road request failed: ${response.status}`);
  return (await response.json()) as RoadResponse;
}
