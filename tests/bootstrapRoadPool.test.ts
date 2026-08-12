import { describe, expect, it } from 'vitest';
import { buildRoadSchedule } from '../scripts/bootstrap-road-pool';

describe('production launch road schedule', () => {
  it('keeps Road 1 for two days and shifts every future road with it', () => {
    expect(buildRoadSchedule('2026-08-12T00:00:00.000Z', 2, 3)).toEqual([
      {
        gameNo: 1,
        playableAt: '2026-08-12T00:00:00.000Z',
        nextGameAt: '2026-08-14T00:00:00.000Z',
      },
      {
        gameNo: 2,
        playableAt: '2026-08-14T00:00:00.000Z',
        nextGameAt: null,
      },
      {
        gameNo: 3,
        playableAt: '2026-08-15T00:00:00.000Z',
        nextGameAt: null,
      },
      {
        gameNo: 4,
        playableAt: '2026-08-16T00:00:00.000Z',
        nextGameAt: null,
      },
    ]);
  });

  it('rejects an invalid first-road duration', () => {
    expect(() => buildRoadSchedule('2026-08-12T00:00:00.000Z', 0)).toThrow(
      'firstRoadDays must be a positive integer.',
    );
  });
});
