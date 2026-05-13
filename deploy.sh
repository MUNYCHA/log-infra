#!/bin/bash
set -e

echo "Pulling latest log-dashboard-ui..."
git -C ../log-dashboard-ui pull

echo "Pulling latest log-infra..."
git pull

echo "Loading env..."
source ../log-dashboard-ui/.env
source .env

echo "Building and starting containers..."
VITE_WS_URL=$VITE_WS_URL \
VITE_MAX_LOGS_PER_TOPIC=$VITE_MAX_LOGS_PER_TOPIC \
VITE_MAX_MESSAGE_LENGTH=$VITE_MAX_MESSAGE_LENGTH \
VITE_SSO_LOGIN_URL=$VITE_SSO_LOGIN_URL \
VITE_SSO_LOGOUT_URL=$VITE_SSO_LOGOUT_URL \
VITE_SSO_TOKEN_URL=$VITE_SSO_TOKEN_URL \
VITE_SSO_CLIENT_ID=$VITE_SSO_CLIENT_ID \
KC_ADMIN=$KC_ADMIN \
KC_ADMIN_PASSWORD=$KC_ADMIN_PASSWORD \
KC_HOSTNAME_URL=$KC_HOSTNAME_URL \
docker compose up --build -d

echo "Done."
