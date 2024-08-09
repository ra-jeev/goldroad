import GoogleSignInBtn from '@/app/ui/google-sign-in-btn';

export default function Page() {
  return (
    <div className='info-container'>
      <h1 className='info-title'>Sign in to your account</h1>
      <p className='font-medium mt-2'>
        Take your playing history with you, wherever you go...
      </p>

      <GoogleSignInBtn className='mt-12' />

      {/* {showError && signingStatus && (
        <p className='sign-in-error'>{signingStatus}</p>
      )} */}
    </div>
  );
}
