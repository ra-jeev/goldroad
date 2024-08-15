import { fetchGame } from '@/app/lib/data';
import Board from '@/app/ui/board';
import GameNotFound from '@/app/ui/game/not-found';

export default async function GameContainer() {
  const game = await fetchGame();

  return game ? <Board game={game} /> : <GameNotFound />;
}
