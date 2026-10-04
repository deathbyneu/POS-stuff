#!/bin/sh
set -eu
attempt=0
until npx prisma db push --skip-generate; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 20 ]; then
    echo "Database initialization failed after 20 attempts."
    exit 1
  fi
  echo "Waiting for MongoDB replica set (attempt $attempt/20)..."
  sleep 3
done
if [ "${SEED_DEMO:-true}" = "true" ]; then
  npm run db:seed
fi
exec node dist/server.js
