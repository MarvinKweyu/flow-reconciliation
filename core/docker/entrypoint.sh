#!/usr/bin/env sh
set -eu

echo "[entrypoint] Applying database schema via drizzle-kit push..."
yarn drizzle:push

echo "[entrypoint] Starting app: $@"
exec "$@"
