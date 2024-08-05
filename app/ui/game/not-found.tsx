'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from '@/app/ui/game/not-found.module.css';

export default function GameNotFound() {
  const pathname = usePathname();

  return (
    <div className={styles.error}>
      <h2 className={styles['error-title']}>Oops! Game not found.</h2>
      <p className={styles['error-description']}>
        We couldn&apos;t find the game you&apos;re looking for. Please try again
        later.
      </p>
      {pathname === '/' && (
        <Link className='app-btn' href='/' replace>
          Play today&apos;s game
        </Link>
      )}
    </div>
  );
}
