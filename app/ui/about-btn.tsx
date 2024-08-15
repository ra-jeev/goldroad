'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { QuestionMarkCircleIcon } from '@heroicons/react/16/solid';
import styles from '@/app/ui/about-btn.module.css';

const LAST_UPDATE = 'game-update-300323';
export default function AboutBtn() {
  const [showDot, setShowDot] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const updateShown = localStorage.getItem(LAST_UPDATE) || 'no';
    if (updateShown === 'no') {
      setShowDot(true);
    }
  }, []);

  useEffect(() => {
    if (pathname === '/about') {
      console.log('the pathname is about....hiding the dot');
      setShowDot(false);
      localStorage.setItem(LAST_UPDATE, 'yes');
    }
  }, [pathname]);

  return (
    <Link href='/about' className='icon-btn icon-wrapper'>
      <QuestionMarkCircleIcon />
      {showDot && <span className={styles['notification-dot']} />}
    </Link>
  );
}
