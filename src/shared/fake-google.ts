// The local stand-in for Google (test/fake-google/server.ts). Only the dev Worker entry and the
// stand-in import this file, and the production bundle check fails if it ships (D5).
export const FAKE_GOOGLE_URL = 'http://127.0.0.1:8790'
export const FAKE_CLIENT_ID = 'fake-client-id.apps.example.com'
export const FAKE_CLIENT_SECRET = 'fake-client-secret'
/** Encrypts dev sessions only. Production reads SESSION_SECRET from a Worker secret. */
export const FAKE_SESSION_SECRET = 'dev-only-session-secret-not-for-production-use-0001'
