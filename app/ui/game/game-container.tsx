import { fetchGame } from '@/app/lib/data';
import GameBoard from '@/app/ui/game/game-board';

export default async function GameContainer() {
  const game = await fetchGame();

  return <GameBoard game={game} />;
}
