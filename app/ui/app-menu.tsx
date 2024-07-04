'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRightEndOnRectangleIcon,
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
} from '@heroicons/react/16/solid';
import clsx from 'clsx';
import styles from '@/app/ui/app-menu.module.css';

const CoinsIcon = () => {
  return (
    <svg
      stroke='currentColor'
      fill='currentColor'
      strokeWidth='0'
      viewBox='0 0 512 512'
      height='1.5rem'
      width='1.5rem'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path d='M0 405.3V448c0 35.3 86 64 192 64s192-28.7 192-64v-42.7C342.7 434.4 267.2 448 192 448S41.3 434.4 0 405.3zM320 128c106 0 192-28.7 192-64S426 0 320 0 128 28.7 128 64s86 64 192 64zM0 300.4V352c0 35.3 86 64 192 64s192-28.7 192-64v-51.6c-41.3 34-116.9 51.6-192 51.6S41.3 334.4 0 300.4zm416 11c57.3-11.1 96-31.7 96-55.4v-42.7c-23.2 16.4-57.3 27.6-96 34.5v63.6zM192 160C86 160 0 195.8 0 240s86 80 192 80 192-35.8 192-80-86-80-192-80zm219.3 56.3c60-10.8 100.7-32 100.7-56.3v-42.7c-35.5 25.1-96.5 38.6-160.7 41.8 29.5 14.3 51.2 33.5 60 57.2z'></path>
    </svg>
  );
};

export default function AppMenu() {
  const menuListRef = useRef<HTMLUListElement>(null);
  const menuBtnRef = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  const signOutUser = () => {
    console.log('signed out the user');
    setIsLoggedIn(false);
  };

  const onLinkClick = () => {
    setShowMenu(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menuListRef.current?.contains(target)) {
        if (menuBtnRef.current?.contains(target)) {
          setShowMenu((prevShowMenu) => !prevShowMenu);
          return;
        }

        setShowMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div
      ref={menuBtnRef}
      className={clsx(styles.menu, { [styles['menu-active']]: showMenu })}
    >
      <Bars3Icon className='icon-btn' />
      <ul ref={menuListRef}>
        <li>
          <Link
            href='/games'
            className={styles['menu-item']}
            onClick={onLinkClick}
          >
            <CoinsIcon />
            Past roads
          </Link>
        </li>
        <li>
          {!isLoggedIn ? (
            <Link
              href='/sign-in'
              className={styles['menu-item']}
              onClick={onLinkClick}
            >
              <ArrowRightStartOnRectangleIcon /> Sign in
            </Link>
          ) : (
            <button
              type='button'
              className={styles['menu-item']}
              onClick={signOutUser}
            >
              <ArrowRightEndOnRectangleIcon /> <span>Sign out</span>
            </button>
          )}
        </li>
      </ul>
    </div>
  );
}
