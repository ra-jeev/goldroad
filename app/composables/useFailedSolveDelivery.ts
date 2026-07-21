import type { SessionEndRequest } from './useSessionApi';
import {
  FAILED_SOLVE_STORAGE_KEY,
  FailedSolveDeliveryService,
  type PendingFailedSolve,
} from '../utils/failedSolveDelivery';

let initialized = false;
let service: FailedSolveDeliveryService | null = null;

export function useFailedSolveDelivery() {
  const sessionApi = useSessionApi();

  function getService() {
    if (service) return service;
    service = new FailedSolveDeliveryService({
      send: (payload) => sessionApi.endSession(payload, { keepalive: true }),
      persist: (raw) => {
        try {
          localStorage.setItem(FAILED_SOLVE_STORAGE_KEY, raw);
        } catch (error) {
          console.warn('[analytics-delivery] failed to persist solve queue', error);
        }
      },
      log: (message: string, item: PendingFailedSolve, error?: unknown) => {
        console.warn(`[analytics-delivery] ${message}`, {
          gameNo: item.payload.gameNo,
          puzzleType: item.payload.puzzleType,
          error,
        });
      },
    });
    return service;
  }

  function queueFailedSolve(payload: SessionEndRequest, expiresAt: string) {
    getService().queue(payload, expiresAt);
  }

  function initialize() {
    if (initialized || typeof window === 'undefined') return;
    initialized = true;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(FAILED_SOLVE_STORAGE_KEY);
    } catch (error) {
      console.warn('[analytics-delivery] failed to read solve queue', error);
    }

    const delivery = getService();
    delivery.hydrate(stored);
    window.addEventListener('online', () => void delivery.trigger());
    window.addEventListener('pageshow', () => void delivery.trigger());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void delivery.trigger();
      }
    });
    void delivery.trigger();
  }

  return { initialize, queueFailedSolve };
}
