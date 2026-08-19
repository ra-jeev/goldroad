import { describe, expect, it } from 'vitest';
import { TUTORIAL_LESSONS } from '../app/content/tutorialContent';

describe('tutorial lesson 1 start-state content (RP1-9)', () => {
  it('has an "icons" lesson as the first lesson', () => {
    expect(TUTORIAL_LESSONS[0]?.id).toBe('icons');
  });

  it('renders the real pre-run start state: current-tile occupied plus a legal neighbor move', () => {
    expect(TUTORIAL_LESSONS[0]?.visual.showStartState).toBe(true);
    expect(TUTORIAL_LESSONS[0]?.visual.isStart).toBe(true);
    expect(TUTORIAL_LESSONS[0]?.visual.isEnd).toBe(true);
  });

  it('is the only lesson that renders the start state', () => {
    const startStateLessons = TUTORIAL_LESSONS.filter(
      (lesson) => lesson.visual.showStartState,
    );
    expect(startStateLessons).toHaveLength(1);
    expect(startStateLessons[0]?.id).toBe('icons');
  });

  it('names footprints/finish and explains the target without "exact target score" wording', () => {
    const body = TUTORIAL_LESSONS[0]?.body ?? '';
    expect(body).toMatch(/footprints/i);
    expect(body).toMatch(/finish/i);
    expect(body.toLowerCase()).not.toContain('exact target score');
  });
});

describe('tutorial undo lesson', () => {
  const lesson = TUTORIAL_LESSONS.find((item) => item.id === 'undo');

  it('teaches the one-step rule and the take-back gesture', () => {
    expect(lesson?.body).toMatch(/undo your last step/i);
    expect(lesson?.body).toMatch(/only one step at a time/i);
    expect(lesson?.body).toMatch(/the tile you came from/i);
  });

  it('shows the Undo control, since the button is what needs naming', () => {
    expect(lesson?.visual.showUndoButton).toBe(true);
    expect(lesson?.visual.showRetryButton).toBeUndefined();
    expect(lesson?.visual.showHintButton).toBeUndefined();
  });

  it('comes before retry and hint, the order a player meets them', () => {
    const ids = TUTORIAL_LESSONS.map((item) => item.id);
    expect(ids.indexOf('undo')).toBeLessThan(ids.indexOf('retry-hint'));
  });

  it('leaves the retry-and-hint lesson to its own two tools', () => {
    const other = TUTORIAL_LESSONS.find((item) => item.id === 'retry-hint');
    expect(other?.body).not.toMatch(/undo/i);
  });
});

describe('tutorial lesson copy', () => {
  it('uses no em dashes', () => {
    for (const lesson of TUTORIAL_LESSONS) {
      expect(lesson.body).not.toContain('—');
      expect(lesson.title).not.toContain('—');
    }
  });
});

describe('tutorial keyboard lesson', () => {
  const lesson = TUTORIAL_LESSONS.find((item) => item.id === 'keyboard');

  it('names both movement bindings and the undo key', () => {
    expect(lesson?.body).toMatch(/arrow keys/i);
    expect(lesson?.body).toMatch(/W, A, S, D/);
    expect(lesson?.body).toMatch(/backspace/i);
  });

  it('draws its key caps rather than a mini board', () => {
    expect(lesson?.visual.showKeyboardKeys).toBe(true);
  });

  it('comes last, being a second way in rather than a rule of the road', () => {
    expect(TUTORIAL_LESSONS[TUTORIAL_LESSONS.length - 1]?.id).toBe('keyboard');
  });
});
