import { gameData } from '@/app/lib/dummy-data';

export async function fetchGame() {
  const game = await new Promise((resolve) => {
    setTimeout(() => {
      resolve(gameData);
    }, 2500);
  });

  return game;
}
