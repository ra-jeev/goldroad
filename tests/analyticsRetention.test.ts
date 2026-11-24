import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_RETENTION_DAYS,
  analyticsRetentionCutoff,
} from '../server/utils/analyticsRetention';

describe('play stats retention', () => {
  it('keeps play stats for 2 years', () => {
    expect(ANALYTICS_RETENTION_DAYS).toBe(730);
    expect(analyticsRetentionCutoff(new Date('2026-11-24T00:00:00.000Z'))).toBe(
      '2024-11-24T00:00:00.000Z',
    );
  });
});
