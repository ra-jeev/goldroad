import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';

import { getApp } from 'realm-web';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  OAuthProvider,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInAnonymously,
  signInWithRedirect,
  signInWithPopup,
  signInWithCredential,
  getRedirectResult,
  linkWithRedirect,
  linkWithPopup,
  onAuthStateChanged,
  fetchSignInMethodsForEmail,
  signOut,
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore, doc, onSnapshot, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGE_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

export const AUTH_PROVIDER = {
  GOOGLE: 'google',
  FACEBOOK: 'facebook',
};

export const AUTH_STATE = {
  SIGNING_IN: 'signing_in',
  MERGING_ACCOUNTS: 'merging_accounts',
  ACCOUNT_EXISTS: 'account_exists',
  SIGNED_IN: 'signed_in',
  ERROR: 'error',
};

const FirebaseContext = createContext(null);

export function FirebaseProvider({ children }) {
  const creatingUser = useRef();
  const [auth, setAuth] = useState(null);
  const [functions, setFunctions] = useState(null);
  const [fireDb, setFireDb] = useState(null);
  const [currentUserAuthInfo, setCurrentUserAuthInfo] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authState, setAuthState] = useState(null);
  const [documentListener, setDocumentListener] = useState(null);
  const [signOutListener, setSignOutListener] = useState(null);

  useEffect(() => {
    const firebaseApp = initializeApp(firebaseConfig);
    setAuth(getAuth(firebaseApp));
    setFunctions(getFunctions(firebaseApp, 'asia-south1'));
    setFireDb(getFirestore(firebaseApp));
  }, []);

  const migrateCurrentUser = useCallback(
    async (data) => {
      const migrateUser = httpsCallable(functions, 'users-migrate');
      // console.log(`migrateCurrentUser called with data:`, data);
      if (migrateUser) {
        try {
          const resp = await migrateUser(data);
          // console.log(`got resp from migrateUser:`, resp);
          if (resp?.data?.user) {
            setCurrentUser(resp.data.user);
            return true;
          }
        } catch (error) {
          console.log('failed to migrate user:', error);
        }
      }
    },
    [functions]
  );

  const handleAccountExistsWithCredential = useCallback(
    async (credentialError) => {
      const emailFromError = credentialError.customData?.email;
      // console.log('handleCredentialInUseError: ', emailFromError);

      // const userCreds = OAuthProvider.credentialFromError(credentialError);
      // console.log('userCreds: ', userCreds);

      if (emailFromError) {
        try {
          const methods = await fetchSignInMethodsForEmail(
            auth,
            emailFromError
          );

          if (methods.length) {
            setAuthState({
              state: AUTH_STATE.ACCOUNT_EXISTS,
              provider: methods[0].split('.')[0],
            });
          }
          // console.log('found the sign in methods: ', methods);
          return;
        } catch (error) {
          // console.log(
          //   'failed to fetch the sign in methods for the email',
          //   error
          // );
        }
      } else {
        console.log('no email found in the credentialError:');
      }

      setAuthState({ state: AUTH_STATE.ERROR });
    },
    [auth]
  );

  const handleCredentialInUseError = useCallback(
    async (credentialError) => {
      setAuthState({ state: AUTH_STATE.MERGING_ACCOUNTS });
      const currentUserId = auth.currentUser.uid;
      // console.log(`currentUserId: ${currentUserId}`);
      try {
        const credentials = await signInWithCredential(
          auth,
          OAuthProvider.credentialFromError(credentialError)
        );

        console.log(
          `After signInWithCredential: ${Date.now()}, credentials.user`,
          credentials.user
        );
        await migrateCurrentUser({
          firebaseUserId: currentUserId,
        });

        // console.log(`After migrateCurrentUser: ${Date.now()}`);

        setDocumentListener(credentials);
        setAuthState({ state: AUTH_STATE.SIGNED_IN });
      } catch (error) {
        // console.log('signInWithCredential failed with ', error);
        if (error.code === 'auth/account-exists-with-different-credential') {
          await handleAccountExistsWithCredential(error);
        } else {
          setAuthState({ state: AUTH_STATE.ERROR });
        }
      }
    },
    [auth, migrateCurrentUser, handleAccountExistsWithCredential]
  );

  useEffect(() => {
    const getCurrentUserData = async () => {
      const getUser = httpsCallable(functions, 'users-get');
      if (getUser) {
        const userDoc = await getUser();
        if (userDoc?.data) {
          // console.log(
          //   '^^^^^^^^^^^^^^^^^^^ got the result from the data API: ',
          //   userDoc.data
          // );

          setCurrentUser(userDoc.data);
        } else {
          console.log('No user doc found;');
        }
      }
    };

    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        // console.log('got the user in onAuthStateChanged: ', user);
        if (!user) {
          if (!creatingUser.current) {
            // console.log('will be creating a new anonymous user');
            creatingUser.current = true;
            await signInAnonymously(auth);
            const realmApp = getApp(process.env.REACT_APP_REALM_APP_ID);
            if (realmApp.currentUser) {
              // console.log('Have a realm user with me: ', realmApp.currentUser);
              const success = await migrateCurrentUser({
                realmUserId: realmApp.currentUser.id,
              });

              if (success) {
                realmApp.deleteUser(realmApp.currentUser);
              }
            } else {
              const createUser = httpsCallable(functions, 'users-create');
              if (createUser) {
                const userDoc = await createUser();
                if (userDoc?.data) {
                  // console.log(
                  //   '^^^^^^^^^^^^^^^^^^^ created a new user with the data API: ',
                  //   userDoc.data
                  // );

                  setCurrentUser(userDoc.data);
                } else {
                  console.log('No user doc found;');
                }
              }
            }

            // console.log('setting creatingUser.current to false: ');
            creatingUser.current = false;
          }
        } else {
          console.log('currentUserAuthInfo', user);
          setCurrentUserAuthInfo(user);
          if (!creatingUser.current) {
            await getCurrentUserData();
          }
        }
      });

      return () => unsubscribe();
    }
  }, [auth, functions, migrateCurrentUser]);

  useEffect(() => {
    const checkSignInResult = async () => {
      // console.log(`Inside checkSignInResult: ${Date.now()}`);
      try {
        const result = await getRedirectResult(auth);
        console.log(
          '+++++++++++++++ got some result from getRedirectResult',
          result
        );

        if (result && result.user) {
          setAuthState({ state: AUTH_STATE.SIGNED_IN });
        } else {
          setAuthState({ state: AUTH_STATE.ERROR });
        }
      } catch (error) {
        console.log(
          `checkSignInResult: account link failed: ${Date.now()} with error: `,
          error
        );
        if (error.code === 'auth/credential-already-in-use') {
          await handleCredentialInUseError(error);
        } else if (
          error.code === 'auth/account-exists-with-different-credential' ||
          error.code === 'auth/email-already-in-use'
        ) {
          await handleAccountExistsWithCredential(error);
        }
      }

      localStorage.removeItem('isRedirecting');
    };

    if (auth && localStorage.getItem('isRedirecting') === 'true') {
      setAuthState({ state: AUTH_STATE.SIGNING_IN });
      checkSignInResult();
    }
  }, [auth, handleCredentialInUseError, handleAccountExistsWithCredential]);

  useEffect(() => {
    if (documentListener) {
      const unsubscribe = onSnapshot(
        doc(fireDb, 'migratedUsers', documentListener.user.uid),
        async (userDoc) => {
          const userDocData = userDoc.data();
          // console.log('Current data: ', userDocData);
          if (userDocData) {
            unsubscribe();
            // console.log('deleting the migrated user');
            await deleteDoc(
              doc(fireDb, 'migratedUsers', documentListener.user.uid)
            );

            setDocumentListener(null);
            if (userDocData.status && userDocData.status === 'Unmodified') {
              return;
            }

            setCurrentUser(userDocData);
          }
        }
      );

      return () => unsubscribe();
    }
  }, [documentListener, fireDb]);

  const handleSignInWithPopup = useCallback(
    async (provider) => {
      try {
        let userCredential;
        if (auth.currentUser) {
          userCredential = await linkWithPopup(auth.currentUser, provider);
        } else {
          userCredential = await signInWithPopup(auth, provider);
        }

        if (userCredential) {
          console.log('got some user credentials', userCredential);
          setAuthState({ state: AUTH_STATE.SIGNED_IN });
        }
      } catch (error) {
        console.log(
          `handleSignInWithPopup: account link failed: ${Date.now()} with error: `,
          error
        );

        if (error.code === 'auth/credential-already-in-use') {
          // console.log('trying to handle CredentialInUse');
          await handleCredentialInUseError(error);
        } else if (
          error.code === 'auth/account-exists-with-different-credential' ||
          error.code === 'auth/email-already-in-use'
        ) {
          await handleAccountExistsWithCredential(error);
        } else {
          setAuthState({ state: AUTH_STATE.ERROR });
        }
      }
    },
    [auth, handleCredentialInUseError, handleAccountExistsWithCredential]
  );

  const authenticate = useCallback(
    async (authProvider) => {
      let provider;
      switch (authProvider) {
        case AUTH_PROVIDER.GOOGLE:
          provider = new GoogleAuthProvider();
          break;
        case AUTH_PROVIDER.FACEBOOK:
          provider = new FacebookAuthProvider();
          provider.addScope('email');
          provider.addScope('public_profile');
          break;
        default:
          console.log('invalid auth provider: ', authProvider);
          return;
      }

      // console.log('google authenticate: has existing user:', auth.currentUser);
      setAuthState({ state: AUTH_STATE.SIGNING_IN });
      if (window.location.hostname.includes('playgoldroad')) {
        localStorage.setItem('isRedirecting', 'true');
        if (auth.currentUser) {
          await linkWithRedirect(auth.currentUser, provider);
        } else {
          await signInWithRedirect(auth, provider);
        }
      } else {
        await handleSignInWithPopup(provider);
      }
    },
    [auth, handleSignInWithPopup]
  );

  const getCallableFunction = useCallback(
    (funcName) => {
      if (functions) {
        return httpsCallable(functions, funcName);
      }

      return null;
    },
    [functions]
  );

  const signOutUser = useCallback(() => {
    signOut(auth);
    setCurrentUser(null);
    setAuthState(null);
    setCurrentUserAuthInfo(null);

    if (signOutListener) {
      signOutListener();
    }
  }, [auth, signOutListener]);

  const addSignOutListener = useCallback((listener) => {
    if (listener) {
      setSignOutListener(() => listener);
    }
  }, []);

  return (
    <FirebaseContext.Provider
      value={{
        currentUserAuthInfo,
        currentUser,
        authState,
        setCurrentUser,
        authenticate,
        signOutUser,
        getCallableFunction,
        addSignOutListener,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirebase = () => {
  const firebase = useContext(FirebaseContext);
  if (!firebase) {
    throw new Error(
      `No firebase context found. Did you call useFirebase() inside of a <FirebaseProvider />?`
    );
  }

  return firebase;
};
