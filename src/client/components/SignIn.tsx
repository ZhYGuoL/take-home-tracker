/** Why the last sign-in did not finish, from the `signin` query. */
export type SignInProblem = 'failed' | 'drive' | null

/** What a signed-out visitor sees: nothing but the way in (F8). */
export function SignIn({ problem, setUp }: { problem: SignInProblem; setUp: boolean }) {
  return (
    <div className="signin">
      <div className="panel signin-panel">
        <h1>Take-homes</h1>
        {problem === 'failed' && (
          <p className="signin-note" role="alert">
            Sign-in did not finish. Try again.
          </p>
        )}
        {problem === 'drive' && (
          <p className="signin-note" role="alert">
            The tracker needs Google Drive access to keep your list. Continue again, and tick the
            Drive box.
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
