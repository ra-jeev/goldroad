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
  const [userData, setUserData] = useState(null);

  const { client, user } = useRealmApp();

  const getGame = useCallback(
    async (gameNo) => {
      // console.log(
      //   `*-*-*-*-*-*-*-*-*-*-* getting game #${
      //     gameNo || 'current'
      //   } in useDataProvider hook`
      // );

      if ((!gameNo && games.current) || (gameNo && games[gameNo])) {
        const gameDoc = gameNo ? games[gameNo] : games.current;
        // console.log(
        //   `*-*-*-*-*-*-*-*-*-*-* already has data for game #${
        //     gameNo || 'current'
        //   }`
        // );

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
        // console.log(
        //   `*-*-*-*-*-*-*-*-*-*-* got game #${gameDoc.gameNo} data in useDataProvider hook`
        // );

        if (gameDoc.current) {
          setGames({ ...games, current: gameDoc, [gameNo]: gameDoc });
        } else {
          setGames({ ...games, [gameNo]: gameDoc });
        }

        setCurrGameNo(gameDoc.gameNo);
        return structuredClone(gameDoc);
      }
    },
    [games]
  );

  useEffect(() => {
    const getUserData = async () => {
      if (!userData) {
        // console.log(
        //   '*-*-*-*-*-*-*-*-*-*-* calling get user data from the useDataProvider hook'
        // );
        const appDb = client.db(process.env.REACT_APP_MONGO_DB_NAME);
        const data = await appDb.collection('users').findOne({ _id: user.id });

        if (data) {
          // console.log(
          //   `*-*-*-*-*-*-*-*-*-*-* set user data in the useDataProvider hook: ${JSON.stringify(
          //     data
          //   )}`
          // );
          setUserData({ ...data });
        }
      }
    };

    if (client && user) {
      getUserData();
    }
  }, [userData, client, user]);

  const updateUserData = useCallback(
    async (changes) => {
      const result = await client
        .db(process.env.REACT_APP_MONGO_DB_NAME)
        .collection('users')
        .findOneAndUpdate({ _id: user.id }, changes, {
          returnNewDocument: true,
        });

      setUserData({ ...result });
    },
    [client, user]
  );

  return (
    <DataContext.Provider
      value={{ currGameNo, getGame, userData, updateUserData }}
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
