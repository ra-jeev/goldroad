import { fetchGame } from '@/app/lib/data';
import GameBoard from '@/app/ui/game/board';
import GameNotFound from '@/app/ui/game/not-found';

export default async function GameContainer() {
  const game = await fetchGame();

  return game ? <GameBoard game={game} /> : <GameNotFound />;
}
