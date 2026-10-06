#!/usr/bin/env sh
set -eu
PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
docker run --rm -v "${PROJECT_DIR}:/app" -v /app/node_modules -w /app node:22-alpine sh -lc "npm ci && npm run check && npm run build"
