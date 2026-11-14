import { expect, it } from 'vitest';
import { getHintMessage } from '../app/utils/hintMessage';

it('uses tile or path wording according to the visible guide', () => {
  expect(getHintMessage('next-step', 1)).toBe('The highlighted tile is your next move.');
  expect(getHintMessage('next-step', 2)).toBe('Follow the highlighted path.');
  expect(getHintMessage('next-step', 0)).toBeNull();
});

it('keeps the recovery message for a player off the route', () => {
  expect(getHintMessage('diverged', 1)).toBe(
    'Paths diverged. Try again and follow the highlighted path.',
  );
});
