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

describe('last-step undo copy', () => {
  it('names the take-back and the spent state', () => {
    expect(UI_COPY.boardFooter.undoLastStep).toBe('Undo last step');
    expect(UI_COPY.boardFooter.undoSpent).toBe('Move again to undo');
  });

  it('teaches undo as a one-step take-back in the help tools', () => {
    const tools = UI_COPY.helpSheet.sections.tools.items.join(' ');
    expect(tools).toMatch(/Undo takes back only your last step/i);
    expect(tools).toMatch(/Take another step to undo again/i);
    expect(tools).toMatch(/tap the tile you came from/i);
  });

  it('gives the keyboard its own section, since nothing on screen shows it', () => {
    const keys = UI_COPY.helpSheet.sections.keyboard.items.join(' ');
    expect(keys).toMatch(/arrow keys/i);
    expect(keys).toMatch(/W, A, S, D/);
    expect(keys).toMatch(/backspace/i);
  });
});

describe('contact and navigation copy', () => {
  it('keeps one address for both the footer and the drawer', () => {
    for (const link of [
      UI_COPY.contact.generalMailto,
      UI_COPY.contact.feedbackMailto,
    ]) {
      expect(link.startsWith(`mailto:${UI_COPY.contact.email}?`)).toBe(true);
      // Spaces and brackets have to be encoded or the client truncates the
      // subject at the first space.
      expect(link).not.toMatch(/[ [\]]/);
    }
  });

  it('pre-fills a feedback subject so mail arrives sorted', () => {
    expect(UI_COPY.contact.feedbackMailto).toContain('Feedback');
    expect(UI_COPY.contact.generalMailto).not.toContain('Feedback');
  });

  it('names every drawer destination', () => {
    const { stats, howToPlay, pastRoads, about, feedback } = UI_COPY.navDrawer;
    for (const label of [stats, howToPlay, pastRoads, about, feedback]) {
      expect(label.length).toBeGreaterThan(0);
    }
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
