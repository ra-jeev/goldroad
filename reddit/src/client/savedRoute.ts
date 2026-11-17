// The route of the try in progress, kept for this browser tab only, so a
// reload continues the same try. The server never relies on it: it replays
// every route it is sent.
import type { RoadMode } from '../shared/api';

type SavedRoute = { path: number[]; started: boolean };

const key = (day: string, mode: RoadMode) => `goldroad:${day}:${mode}`;

export function loadRoute(day: string, mode: RoadMode): SavedRoute | null {
  try {
    const raw = sessionStorage.getItem(key(day, mode));
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedRoute;
    return Array.isArray(saved.path) ? saved : null;
  } catch {
    return null;
  }
}

export function saveRoute(day: string, mode: RoadMode, route: SavedRoute): void {
  try {
    sessionStorage.setItem(key(day, mode), JSON.stringify(route));
  } catch {
    // Storage can be blocked. The game still works; a reload starts over.
  }
}

export function clearRoute(day: string, mode: RoadMode): void {
  try {
    sessionStorage.removeItem(key(day, mode));
  } catch {
    // See saveRoute.
  }
}
