import { createContext, useContext, useEffect, useState } from 'react';
import * as Realm from 'realm-web';

const RealmContext = createContext(null);

export function RealmAppProvider({ children }) {
  const [app, setApp] = useState(
    new Realm.App({ id: process.env.REACT_APP_REALM_APP_ID })
  );
  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);

  useEffect(() => {
    const init = async () => {
      if (!user) {
        setUser(
          app.currentUser
            ? app.currentUser
            : await app.logIn(Realm.Credentials.anonymous())
        );
      }

      if (!client) {
        setClient(app.currentUser.mongoClient('gcp-goldroad'));
      }
    };

    init();
  }, [app, client, user]);

  return (
    <RealmContext.Provider value={{ ...app, user, client }}>
      {children}
    </RealmContext.Provider>
  );
}

export function useRealmApp() {
  const realmApp = useContext(RealmContext);
  if (!realmApp) {
    throw new Error(
      `No Realm App found. Did you call useRealmApp() inside of a <RealmAppProvider />.`
    );
  }

  return realmApp;
}
