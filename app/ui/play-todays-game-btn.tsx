import Link from 'next/link';
import clsx from 'clsx';
import FootprintIcon from '@/app/ui/icons/Footprint';

export default function PlayTodaysGameBtn({
  className,
}: {
  className?: string;
}) {
  return (
    <Link className={clsx('app-btn', className)} href='/' replace>
      Walk down today&apos;s road
      <FootprintIcon />
    </Link>
  );
}
