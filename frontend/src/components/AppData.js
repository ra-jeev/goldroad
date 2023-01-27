import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { useRealmApp } from './RealmApp';

const DataContext = createContext(null);

export function AppDataProvider({ children }) {
  const [currGameNo, setCurrGameNo] = useState(null);
  const [games, setGames] = useState({});
  const [pastGames, setPastGames] = useState([]);
  const [userData, setUserData] = useState(null);
  const [userGames, setUserGames] = useState({});

  const { client, user } = useRealmApp();

  const getGame = useCallback(
    async (gameNo) => {
      if ((!gameNo && games.current) || (gameNo && games[gameNo])) {
        const gameDoc = gameNo ? games[gameNo] : games.current;
        setCurrGameNo(gameDoc.gameNo);
        return structuredClone(gameDoc);
      }

      let url = process.env.REACT_APP_GAME_API_URL;
      if (gameNo) {
        url += `?num=${gameNo}`;
      }

      const resp = await fetch(url);
      if (resp.ok) {
        const gameDoc = await resp.json();

        if (gameDoc.current) {
          setGames({ ...games, current: gameDoc, [gameDoc.gameNo]: gameDoc });
        } else {
          setGames({ ...games, [gameNo]: gameDoc });
        }

        setCurrGameNo(gameDoc.gameNo);
      }
    },
    [games]
  );

  useEffect(() => {
    const getUserData = async () => {
      if (!userData) {
        const appDb = client.db(process.env.REACT_APP_MONGO_DB_NAME);
        const data = await appDb.collection('users').findOne({ _id: user.id });

        if (data) {
          setUserData({ ...data });
        }
      }
    };

    if (client && user) {
      getUserData();
    }
  }, [userData, client, user]);

  const getPastGames = useCallback(
    async (offset) => {
      if (client) {
        if (pastGames && pastGames.length > offset) {
          return;
        }

        const filter = {
          active: true,
          current: false,
        };

        if (offset > 0) {
          filter.gameNo = {
            $lte: pastGames[0].gameNo - offset,
          };
        }

        const result = await client
          .db(process.env.REACT_APP_MONGO_DB_NAME)
          .collection('games')
          .find(filter, {
            sort: {
              gameNo: -1,
            },
            projection: {
              gameNo: 1,
              maxScore: 1,
            },
            limit: 20,
          });

        if (result?.length) {
          setPastGames((p) => {
            if (!p.length || (p.length && p[0].gameNo !== result[0].gameNo)) {
              return [...p, ...result];
            } else {
              return p;
            }
          });
        }
      }
    },
    [client, pastGames]
  );

  const getUserGamesHistory = useCallback(
    async (startingFrom, endingAt) => {
      if (client && user) {
        const historyResult = await client
          .db(process.env.REACT_APP_MONGO_DB_NAME)
          .collection('userGames')
          .find(
            {
              gameNo: {
                $lte: startingFrom,
                $gte: endingAt,
              },
            },
            {
              sort: {
                gameNo: -1,
              },
            }
          );

        if (historyResult && historyResult.length) {
          const uGames = {};
          historyResult.forEach((result) => {
            uGames[result.gameNo] = result;
          });

          setUserGames((u) => {
            return { ...u, ...uGames };
          });
        }
      }
    },
    [client, user]
  );

  const getUserHistoryForGame = useCallback(
    async (gameNo) => {
      if (client && user) {
        if (userGames[gameNo]) {
          return userGames[gameNo];
        }

        const gameNoInt = parseInt(gameNo);
        const result = await client
          .db(process.env.REACT_APP_MONGO_DB_NAME)
          .collection('userGames')
          .findOne({ gameNo: gameNoInt });

        if (result) {
          setUserGames({ ...userGames, [gameNo]: result });
        }
      }
    },
    [client, user, userGames]
  );

  const updateUserData = useCallback(
    async (changes) => {
      if (client && user) {
        const result = await client
          .db(process.env.REACT_APP_MONGO_DB_NAME)
          .collection('users')
          .findOneAndUpdate({ _id: user.id }, changes, {
            returnNewDocument: true,
          });

        setUserData({ ...result });
      }
    },
    [client, user]
  );

  const updateUserGameHistory = useCallback(
    async (gameNo, changes) => {
      if (client && user) {
        const result = await client
          .db(process.env.REACT_APP_MONGO_DB_NAME)
          .collection('userGames')
          .findOneAndUpdate({ gameNo }, changes, {
            returnNewDocument: true,
            upsert: true,
          });

        if (result) {
          setUserGames((uGames) => {
            return { ...uGames, [gameNo]: result };
          });
        }
      }
    },
    [client, user]
  );

  return (
    <DataContext.Provider
      value={{
        currGameNo,
        getGame,
        getPastGames,
        getUserGamesHistory,
        pastGames,
        userData,
        userGames,
        updateUserData,
        getUserHistoryForGame,
        updateUserGameHistory,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useAppData() {
  // console.log('*-*-*-*-*-*-*-*-*-*-* useAppData called');
  const appData = useContext(DataContext);
  if (!appData) {
    throw new Error(
      `No App Data context found. Did you call useAppData() inside of a <AppDataProvider />?`
    );
  }

  return appData;
}
