import { createApp } from './app'

// Sign-in comes in M5. Until then no request has a user, so the model stays off in production.
export default createApp({
  fetch: (input, init) => fetch(input, init),
  currentUser: async () => null,
})
