#!/bin/sh
set -e

if [ "$1" = "web" ] || [ "$SERVICE_ROLE" = "web" ]; then
  echo "🚀 [CapRover] Starting IAM Web BFF on port ${PORT:-3000}..."
  cd apps/web && exec npm run start -- -H 0.0.0.0 -p "${PORT:-3000}"
elif [ "$1" = "mail" ] || [ "$SERVICE_ROLE" = "mail" ]; then
  echo "🚀 [CapRover] Starting IAM Mail Worker..."
  exec npx tsx apps/iam/src/mail-worker.ts
elif [ "$1" = "migrate" ] || [ "$SERVICE_ROLE" = "migrate" ]; then
  echo "🚀 [CapRover] Running IAM Database Migrations..."
  exec npm run db:migrate
fi

if [ -n "$1" ]; then
  exec "$@"
fi

PORT_NUM="${PORT:-4000}"
echo "🚀 [CapRover] Starting IAM REST API on port ${PORT_NUM}..."
exec npx tsx apps/iam/src/server.ts

