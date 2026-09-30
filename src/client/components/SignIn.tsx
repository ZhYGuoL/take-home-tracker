/** What a signed-out visitor sees: nothing but the way in (F8). */
export function SignIn({ failed, setUp }: { failed: boolean; setUp: boolean }) {
  return (
    <div className="signin">
      <div className="panel signin-panel">
        <h1>Take-homes</h1>
        {failed && (
          <p className="signin-note" role="alert">
            Sign-in did not finish. Try again.
          </p>
        )}
        {setUp ? (
          <a className="control primary signin-button" href="/auth/google/start">
            Continue with Google
          </a>
        ) : (
          <p className="signin-note">Sign-in is not set up on this server.</p>
        )}
      </div>
    </div>
  )
}
