#!/bin/bash
set -e

echo "Pulling latest log-dashboard-ui..."
git -C ../log-dashboard-ui pull

echo "Pulling latest log-infra..."
git pull

echo "Loading React env..."
source ../log-dashboard-ui/.env

echo "Building and starting containers..."
VITE_WS_URL=$VITE_WS_URL \
VITE_MAX_LOGS_PER_TOPIC=$VITE_MAX_LOGS_PER_TOPIC \
VITE_MAX_MESSAGE_LENGTH=$VITE_MAX_MESSAGE_LENGTH \
docker compose up --build -d

echo "Done."
