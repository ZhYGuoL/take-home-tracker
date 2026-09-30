import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'test/unit/**/*.test.ts', 'eval/**/*.test.ts'],
    environment: 'node',
    // An unusual zone (+12:45, with daylight saving) catches code that leans on the machine zone.
    env: { TZ: 'Pacific/Chatham' },
    restoreMocks: true,
  },
})
