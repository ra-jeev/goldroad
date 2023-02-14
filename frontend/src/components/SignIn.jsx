import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaGoogle, FaFacebook } from 'react-icons/fa';

import { useFirebase, AUTH_PROVIDER, AUTH_STATE } from '../providers/Firebase';
import './SignIn.css';

export const SignIn = () => {
  const [showError, setShowError] = useState(false);
  const [signingStatus, setSigningStatus] = useState(null);
  const { authenticate, authState, resetAuthState } = useFirebase();

  const navigate = useNavigate();

  useEffect(() => {
    return () => resetAuthState();
  }, [resetAuthState]);

  useEffect(() => {
    if (authState && authState.state === AUTH_STATE.SIGNED_IN) {
      navigate('/', { replace: true });
    }
  }, [authState, navigate]);

  useEffect(() => {
    if (authState) {
      switch (authState.state) {
        case AUTH_STATE.SIGNING_IN:
          setSigningStatus('Signing in...');
          break;
        case AUTH_STATE.MERGING_ACCOUNTS:
          setSigningStatus('Merging your playing history, please wait...');
          break;
        case AUTH_STATE.ACCOUNT_EXISTS:
          setSigningStatus(
            `Failed to sign in. Last time you'd used ${
              authState.provider[0].toUpperCase() + authState.provider.slice(1)
            } to sign in, please use the same method.`
          );
          setShowError(true);
          break;
        case AUTH_STATE.ERROR:
          setSigningStatus('Failed to sign in. Please try again later.');
          setShowError(true);
          break;
        case AUTH_STATE.SIGNED_IN:
          setSigningStatus('Signed in successfully.');
          break;
        default:
          setSigningStatus(null);
          setShowError(false);
          break;
      }
    }
  }, [authState]);

  return (
    <div className='sign-in-container'>
      {signingStatus && !showError ? (
        <div className='sign-in-section'>{signingStatus}</div>
      ) : (
        <div className='sign-in-section'>
          <h1>Sign in to your account</h1>
          <p>Take your playing history with you, wherever you go...</p>
          <div className='button-container'>
            <button
              type='button'
              onClick={() => {
                setShowError(false);
                authenticate(AUTH_PROVIDER.GOOGLE);
              }}
            >
              <FaGoogle /> Sign in with Google
            </button>
            <button
              type='button'
              onClick={() => {
                setShowError(false);
                authenticate(AUTH_PROVIDER.FACEBOOK);
              }}
            >
              <FaFacebook /> Sign in with Facebook
            </button>
          </div>
          {showError && signingStatus && (
            <p className='sign-in-error'>{signingStatus}</p>
          )}
        </div>
      )}
    </div>
  );
};
