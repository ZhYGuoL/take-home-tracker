#!/bin/sh
# Starts the fake Google and the dev server for QA, and fills Avery's demo data.
cd "$(dirname "$0")/../../.."
SP=${TMPDIR:-/tmp}
lsof -ti :8790,5173 | xargs kill 2>/dev/null
sleep 1
(npx tsx test/fake-google/server.ts > $SP/qa-fg.log 2>&1 &)
(npx vite --port 5173 --strictPort > $SP/qa-vite.log 2>&1 &)
for i in $(seq 1 80); do curl -sf localhost:5173/api/health >/dev/null && curl -sf 127.0.0.1:8790/__health >/dev/null && break; sleep 0.5; done
pnpm -s demo
