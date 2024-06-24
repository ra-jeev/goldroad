import styles from './page.module.css';
import GameContainer from '@/app/ui/game/game-container';

export default function Home() {
  return (
    <main className={styles.main}>
      <GameContainer />
    </main>
  );
}
