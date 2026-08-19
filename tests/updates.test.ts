import { describe, expect, it } from 'vitest';
import { UPDATES } from '../app/content/updates';

describe('updates feed', () => {
  it('is ordered newest first, which the nav dot depends on', () => {
    const times = UPDATES.map((entry) => Date.parse(entry.date));
    for (const time of times) expect(Number.isNaN(time)).toBe(false);
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('announces the undo release', () => {
    const entry = UPDATES[0];
    expect(entry?.date).toBe('19 Aug 2026');
    const body = entry?.body.join(' ') ?? '';
    expect(body).toMatch(/undo/i);
    expect(body).toMatch(/tile you came from/i);
    expect(body).toMatch(/backspace/i);
  });

  it('gives every entry a title and a body', () => {
    for (const entry of UPDATES) {
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.body.length).toBeGreaterThan(0);
    }
  });
});
