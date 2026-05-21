#!/bin/bash
set -euo pipefail

# Brings up the full stack on one Docker network:
#   logstream API (../logstream)  +  keycloak & nginx (this repo)
# nginx reverse-proxies /api and /ws to the `logstream` service by name, so the
# API MUST be running and attached to the shared `monitoring` network or nginx
# returns 502. This script guarantees both.

INFRA_DIR="$(cd "$(dirname "$0")" && pwd)"
UI_DIR="$INFRA_DIR/../log-dashboard-ui"
API_DIR="$INFRA_DIR/../logstream"

echo "==> Pulling latest..."
git -C "$UI_DIR" pull
git -C "$API_DIR" pull
git -C "$INFRA_DIR" pull

echo "==> Ensuring shared 'monitoring' network exists..."
docker network inspect monitoring >/dev/null 2>&1 || docker network create monitoring

echo "==> Starting logstream API..."
# compose auto-loads $API_DIR/.env for the variable substitutions in its compose file
docker compose --project-directory "$API_DIR" -f "$API_DIR/docker-compose.yml" up --build -d

echo "==> Loading infra + UI env..."
set -a
# shellcheck disable=SC1091
source "$UI_DIR/.env"
# shellcheck disable=SC1091
source "$INFRA_DIR/.env"
set +a

echo "==> Building UI + starting Keycloak and nginx..."
docker compose --project-directory "$INFRA_DIR" -f "$INFRA_DIR/docker-compose.yml" up --build -d

echo "==> Done. Services:"
docker compose --project-directory "$INFRA_DIR" -f "$INFRA_DIR/docker-compose.yml" ps
