import { createApp } from './app'
import { GOOGLE } from './auth'

// The production Worker. Google's real endpoints are the only ones it can use (D5).
export default createApp({
  fetch: (input, init) => fetch(input, init),
  auth: (env) =>
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && (env.SESSION_SECRET?.length ?? 0) >= 32
      ? {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          sessionSecret: env.SESSION_SECRET as string,
          endpoints: GOOGLE,
        }
      : null,
})
