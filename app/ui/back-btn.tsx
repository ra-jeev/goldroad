'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/16/solid';

export default function BackBtn() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      {pathname !== '/' && (
        <ArrowLeftIcon className='icon-btn' onClick={() => router.back()} />
      )}
    </>
  );
}
