import { gameData } from '@/app/lib/dummy-data';
import { Game } from '@/app/lib/types';

export async function fetchGame() {
  const game = await new Promise<Game>((resolve) => {
    setTimeout(() => {
      resolve(gameData);
    }, 2500);
  });

  return game;
}
