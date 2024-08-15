import type { PlayStatus } from '@/app/lib/types';

export default function BoardStatus({
  maxScore,
  currScore,
  status,
  boardScore,
}: {
  maxScore: number;
  currScore: number;
  status: PlayStatus;
  boardScore: number;
}) {
  const playStatus = () => {
    switch (status) {
      case 'initial':
        return `Total ${boardScore} coins on the board`;
      case 'playing':
        return `${boardScore - currScore} coins remain on the board`;
      case 'no-moves':
        return 'Uh Oh! No further moves...';
      case 'wrong-path':
        return 'This road feels unfamiliar...';
      case 'lost':
        if (maxScore - currScore! <= 3) {
          return `👏 That was close. Try again!`;
        } else {
          return '👻 Get some more coins. Try again!';
        }
      case 'win':
        return "🏆 You've got the gold :-)";
    }
  };

  return (
    <div className='info-container'>
      <div className='info-title'>
        Collect {maxScore - currScore} coins
        {currScore > 0 ? ' more' : ' in your path'}
      </div>
      <div className='font-medium'>{playStatus()}</div>
    </div>
  );
}
