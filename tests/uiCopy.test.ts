import { describe, expect, it } from 'vitest';
import { UI_COPY } from '../app/content/uiCopy';

describe('player-facing try terminology', () => {
  it('pluralizes try counts', () => {
    expect(UI_COPY.celebration.attemptLabel(1)).toBe('1 try');
    expect(UI_COPY.celebration.attemptLabel(2)).toBe('2 tries');
  });

  it('formats retry resting states as ordinals', () => {
    expect(UI_COPY.boardFooter.attemptResting(2)).toBe('2nd Try');
    expect(UI_COPY.boardFooter.attemptResting(3)).toBe('3rd Try');
    expect(UI_COPY.boardFooter.attemptResting(4)).toBe('4th Try');
    expect(UI_COPY.boardFooter.attemptResting(11)).toBe('11th Try');
    expect(UI_COPY.boardFooter.attemptResting(22)).toBe('22nd Try');
  });
});

describe('road countdown and day-complete copy', () => {
  it('shows only the countdown without repeating the UTC rotation time', () => {
    expect(UI_COPY.boardFooter.nextRoadCountdown('04:03:02')).toBe(
      'Next road in 04:03:02',
    );
    expect(UI_COPY.celebration.dayComplete.nextRoad('04:03:02')).toBe(
      'Next road in 04:03:02',
    );
  });

  it('keeps the day-complete message concise', () => {
    expect(UI_COPY.celebration.dayComplete.title).toBe(
      'Both roads conquered.',
    );
    expect(UI_COPY.celebration.dayComplete.body).toBe('See you tomorrow.');
  });
});
