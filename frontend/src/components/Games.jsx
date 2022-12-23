import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlayCircle } from 'react-icons/fa';

import { useRealmApp } from './RealmApp';
import './Games.css';

export function Games() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const realmApp = useRealmApp();
  const navigate = useNavigate();

  useEffect(() => {
    const getPastGames = async () => {
      setLoading(true);
      const result = await realmApp.client
        ?.db(process.env.REACT_APP_MONGO_DB_NAME)
        .collection('games')
        .find(
          {
            active: true,
            current: false,
          },
          {
            sort: {
              gameNo: -1,
            },
            projection: {
              gameNo: 1,
              maxScore: 1,
            },
          }
        );

      console.log('result of find operationL ', result);
      setGames([...result]);
      setLoading(false);
    };

    if (realmApp.client) {
      getPastGames();
    }
  }, [realmApp.client]);

  return (
    <div className='games-container'>
      <div className='title'>Roads of past</div>
      {loading ? (
        <div>Loading...</div>
      ) : (
        games.map((game) => {
          return (
            <div className='game-card' key={game._id}>
              <FaPlayCircle
                className='game-card__button'
                onClick={() => navigate(`/games/${game.gameNo}`)}
              />
              <div>
                <div
                  className='game-card__title'
                  onClick={() => navigate(`/games/${game.gameNo}`)}
                >
                  GoldRoad #{game.gameNo}
                </div>
                <div className='game-card__description'>
                  Collect <strong>{game.maxScore} coins</strong> in your path
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
