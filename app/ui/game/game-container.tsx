import { fetchGame } from '@/app/lib/data';
import Board from '@/app/ui/game/game-board';

export default async function GameContainer() {
  const game = await fetchGame();

  return <Board game={game} />;
}
