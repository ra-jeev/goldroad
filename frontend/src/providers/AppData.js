import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { useFirebase } from './Firebase';

const DataContext = createContext(null);

export function AppDataProvider({ children }) {
  const [currGameNo, setCurrGameNo] = useState(null);
  const [games, setGames] = useState({});
  const [pastGames, setPastGames] = useState([]);
  const [userGames, setUserGames] = useState({});

  const {
    currentUser,
    setCurrentUser,
    getCallableFunction,
    addSignOutListener,
  } = useFirebase();

  const cleanupUserData = useCallback(() => {
    setUserGames({});
  }, []);

  useEffect(() => {
    if (addSignOutListener) {
      addSignOutListener(cleanupUserData);
    }
  }, [addSignOutListener, cleanupUserData]);

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

  const getPastGames = useCallback(
    async (offset) => {
      if (currentUser && getCallableFunction) {
        if (pastGames && pastGames.length > offset) {
          return;
        }

        const getGames = getCallableFunction('games-getRange');
        if (getGames) {
          const filter = {
            limit: 15,
          };

          if (offset > 0) {
            filter.gameNo = {
              startAt: pastGames[0].gameNo - offset,
            };
          }

          const gamesDocs = await getGames(filter);

          if (gamesDocs?.data) {
            // console.log(
            //   'got games data result from the data API: ',
            //   gamesDocs.data
            // );

            if (gamesDocs.data.length) {
              setPastGames((p) => {
                if (
                  !p.length ||
                  (p.length && p[0].gameNo !== gamesDocs.data[0].gameNo)
                ) {
                  return [...p, ...gamesDocs.data];
                } else {
                  return p;
                }
              });
            }
          }
        }
      }
    },
    [currentUser, getCallableFunction, pastGames]
  );

  const getUserGamesHistory = useCallback(
    async (startingFrom, endingAt) => {
      if (currentUser && getCallableFunction) {
        const getUserGames = getCallableFunction('userGames-getRange');
        if (getUserGames) {
          const userGamesDocs = await getUserGames({
            gameNo: { startAt: startingFrom, endAt: endingAt },
          });

          if (userGamesDocs?.data) {
            // console.log(
            //   'got user games data result from the data API: ',
            //   userGamesDocs.data
            // );

            if (userGamesDocs.data.length) {
              const uGames = {};
              userGamesDocs.data.forEach((result) => {
                uGames[result.gameNo] = result;
              });

              setUserGames((u) => {
                return { ...u, ...uGames };
              });
            }
          }
        }
      }
    },
    [currentUser, getCallableFunction]
  );

  const getUserHistoryForGame = useCallback(
    async (gameNo) => {
      if (currentUser && getCallableFunction) {
        if (Object.hasOwnProperty.call(userGames, gameNo)) {
          return userGames[gameNo];
        }

        const getUserGame = getCallableFunction('userGames-get');
        if (getUserGame) {
          const userGameDoc = await getUserGame({ gameNo: parseInt(gameNo) });
          setUserGames({ ...userGames, [gameNo]: userGameDoc.data });
        }
      }
    },
    [currentUser, getCallableFunction, userGames]
  );

  const updateUserData = useCallback(
    async (changes) => {
      if (currentUser && getCallableFunction) {
        const updateUser = getCallableFunction('users-update');
        // console.log('calling updateUser: changes:', changes);
        if (updateUser) {
          const result = await updateUser(changes);
          // console.log('updateUser returned: ', result);
          if (result?.data) {
            setCurrentUser({ ...result.data });
          }
        }
      }
    },
    [currentUser, setCurrentUser, getCallableFunction]
  );

  const updateUserGameHistory = useCallback(
    async (gameNo, changes) => {
      if (currentUser && getCallableFunction) {
        const updateUserGames = getCallableFunction('userGames-update');
        // console.log(`calling updateUserGames for ${gameNo}: changes:`, changes);
        if (updateUserGames) {
          const result = await updateUserGames({ gameNo, ...changes });
          console.log('updateUserGames returned: ', result);
          if (result?.data) {
            const userGamesData = result.data.userGame;
            const userUpdate = result.data.user;
            if (userGamesData) {
              setUserGames((uGames) => {
                return { ...uGames, [gameNo]: userGamesData };
              });
            }

            if (userUpdate) {
              setCurrentUser(userUpdate);
            }
          }
        }
      }
    },
    [currentUser, setCurrentUser, getCallableFunction]
  );

  return (
    <DataContext.Provider
      value={{
        currGameNo,
        getGame,
        pastGames,
        updateUserData,
        userGames,
        getPastGames,
        getUserHistoryForGame,
        updateUserGameHistory,
        getUserGamesHistory,
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
