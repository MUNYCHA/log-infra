# Logstream System Deployment

This repository owns deployment of the internal-office Logstream application:

- React dashboard, built into the nginx container from `../log-dashboard-ui`
- Spring Boot streaming API, built from `../logstream`
- Keycloak authentication with an internal PostgreSQL identity database
- nginx as the single browser-facing entry point

Redis is currently an external dependency. It must be reachable from the
`logstream` container on the shared Docker network.

## System Flow

```text
Office browser
  |
  |  https://<SERVER_IP>
  v
nginx HTTPS (HTTPS_PORT, default 443; port 80 redirects to HTTPS)
  |-- /           React dashboard static files
  |-- /auth/*     Keycloak login/OIDC endpoints
  |-- /api/*      logstream REST API
  `-- /ws/*       logstream WebSocket endpoint
                         |
                         | consumes log events
                         v
                       Redis

Keycloak -> keycloak-db (PostgreSQL, internal Docker network only)
```

Authentication flow:

```text
Browser -> nginx /auth -> Keycloak -> JWT token
Browser -> nginx /api with Authorization: Bearer <jwt> -> logstream
Browser -> nginx /ws with bearer.<jwt> WebSocket subprotocol -> logstream
logstream -> Keycloak internal JWKS endpoint to verify JWT signatures
```

Live log streaming and log file download are separate:

```text
Live view:  Redis events -> logstream -> WebSocket -> dashboard
Download:   configured host log file -> logstream REST API -> browser
```

The API does not write Redis events into downloadable log files.

## Repository Layout

The three repositories must be sibling directories because this Compose file
builds the application images from relative paths.

```text
/opt/logstream-system/
|-- log-infra/
|-- logstream/
`-- log-dashboard-ui/
```

`log-infra/.env` is the deployment configuration source of truth. The `.env`
examples in the UI and API repositories are for running those applications
independently during development.

## Requirements

- Linux server reachable by office browsers through a stable IP address
- Docker Engine with Docker Compose v2 (`docker compose`)
- Git
- A Redis instance publishing `LogEvent` JSON messages on pub/sub channels
- A host directory containing downloadable `{channel}.log` files, if download is used
- A TLS certificate valid for the server IP — self-signed is supported (one-time
  browser warning per machine), or CA-signed to avoid the warning
- At least 4 GB RAM and 2 CPU cores free for this stack. Worst-case committed
  memory across the container limits is ~2.75 GB (Keycloak 1g, logstream 1g,
  PostgreSQL 512m, nginx 256m); the rest is OS and Docker overhead headroom.

The authenticated React client uses OIDC Authorization Code with PKCE, whose
browser cryptography requires a secure HTTPS context. HTTP access by server IP
is not a supported deployment mode.

## First Deployment

### 1. Clone The Repositories

```bash
sudo mkdir -p /opt/logstream-system
sudo chown "$USER":"$USER" /opt/logstream-system
cd /opt/logstream-system

git clone <log-infra-repository-url> log-infra
git clone <logstream-repository-url> logstream
git clone <log-dashboard-ui-repository-url> log-dashboard-ui
```

### 2. Create Deployment Configuration

```bash
cd /opt/logstream-system/log-infra
cp .env.example .env
```

Edit `.env` and replace every `<PLACEHOLDER>` with a real value. The fields
left at fixed values below (client id, tuning numbers) are deployment-independent
and normally need no change:

```env
APP_ORIGIN=https://<SERVER_IP>
HTTPS_PORT=443

KC_BOOTSTRAP_ADMIN_USERNAME=<admin-username>
KC_BOOTSTRAP_ADMIN_PASSWORD=<admin-password>
KC_DB_NAME=<db-name>
KC_DB_USERNAME=<db-username>
KC_DB_PASSWORD=<db-password>

VITE_SSO_CLIENT_ID=logstream-ui
VITE_MAX_LOGS_PER_CHANNEL=500
VITE_MAX_MESSAGE_LENGTH=50000

LOGSTREAM_CHANNELS=<channel-a>,<channel-b>
LOGSTREAM_LOG_DIR=<host-log-dir>
JVM_MAX_HEAP=512m

REDIS_HOST=<redis-host>
REDIS_PORT=6379
REDIS_PASSWORD=<password-if-any>
```

`APP_ORIGIN` is used in all browser-address-sensitive locations:

```text
React application origin:        https://<SERVER_IP>
API/WebSocket allowed origin:     https://<SERVER_IP>
Keycloak browser-visible URL:     https://<SERVER_IP>/auth
Initial Keycloak UI redirect URI: https://<SERVER_IP>/*
```

`HTTPS_PORT` defaults to 443 and normally needs no change. Set it only if 443 is
unavailable on the server. A browser origin includes its port, so a non-443 port
has two consequences:

1. Add the same port to `APP_ORIGIN` (e.g. `https://<SERVER_IP>:8080`), or
   Keycloak rejects login with an origin/redirect mismatch.
2. The port-80 → HTTPS redirect only lands on 443. With a custom port, leave
   port 80 closed and have users open `https://<SERVER_IP>:<port>` directly.

On the first Keycloak start, `${APP_ORIGIN}` placeholders in
`keycloak/logstream-realm.json` are resolved into the imported UI client.

If Keycloak has already initialized its database and `APP_ORIGIN` later changes,
edit the `logstream-ui` client's valid redirect URIs and web origins in Keycloak
Admin Console. Startup import skips an already existing realm.

### 3. Install TLS Certificate Files

nginx terminates HTTPS and requires `certs/fullchain.pem` and `certs/privkey.pem`
to exist before it starts. HTTPS is mandatory — the OIDC/PKCE login uses browser
crypto that only works in a secure context, so HTTP-by-IP is not supported.

For a no-domain / internal IP deploy, generate a self-signed cert bound to the
server IP (replace `<SERVER_IP>` with the IP from `APP_ORIGIN`, both places):

```bash
cd /opt/logstream-system/log-infra
openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout certs/privkey.pem \
  -out certs/fullchain.pem \
  -days 825 \
  -subj "/CN=<SERVER_IP>" \
  -addext "subjectAltName=IP:<SERVER_IP>"
chmod 600 certs/privkey.pem
```

Self-signed certs trigger a one-time browser warning per machine. To avoid it,
or if you have a domain, install a CA-signed certificate as the same two files.
Full details and the internal-CA option are in `certs/README.md`. The certificate
SAN must match the host in `APP_ORIGIN`.

Certificate files and `.env` are ignored by Git.

### 4. Configure The Optional Download Directory

`LOGSTREAM_LOG_DIR` is read-only inside the API container. Set it to the host
directory that already contains downloadable log files, or prepare it when
using the download feature:

```bash
sudo mkdir -p <host-log-dir>
sudo chown "$USER":"$USER" <host-log-dir>
```

For:

```env
LOGSTREAM_CHANNELS=<channel-a>,<channel-b>
LOGSTREAM_LOG_DIR=<host-log-dir>
```

downloadable files are:

```text
<host-log-dir>/<channel-a>.log
<host-log-dir>/<channel-b>.log
```

This directory does not affect live Redis/WebSocket streaming.

### 5. Connect Redis

The application Compose stack uses an external Docker network named
`monitoring` so a separately managed Redis service can join it.

Create the network once — this step is always required, because both Compose
files declare the network `external` and neither will create it:

```bash
docker network create monitoring
```

In every case, Redis must be resolvable as hostname `redis` on that network
and must be reachable from the `logstream` container — an instance bound only
to `localhost` will not work for a client running inside a container. This
stack's side is then just:

```env
REDIS_HOST=redis
REDIS_PORT=6379
```

How Redis meets that contract depends on how it is managed:

**Option A — Redis has its own Compose file (preferred).** No manual network
commands and no alias are needed: a service named `redis` is automatically
resolvable by that name, and the network membership is declared in the file,
so it survives container recreation. Redis needs far less configuration than
Kafka did — a minimal example:

```yaml
services:
  redis:                          # service name "redis" = DNS name clients dial
    image: redis:7-alpine
    networks:
      - monitoring                # join the shared network

networks:
  monitoring:
    external: true                # join, don't own — same rule as this stack
```

**Option B — Redis runs as a container managed outside Compose.** Attach it
manually, using an alias to provide the `redis` hostname:

```bash
docker network connect --alias redis monitoring <redis-container-name>
```

This manual attachment belongs to the container instance, not the image or
name: recreating the Redis container (image update, a re-run on its side)
silently drops it, and the command must be run again. Prefer Option A whenever
the Redis container's configuration can be edited.

If Redis is not shared with other systems, a future simplification is to add it
to this Compose stack and allow Compose to manage all application networking.

### 6. Validate And Start

Standard Docker Compose commands are the deployment interface. Run these only
after `.env` has real values — `docker compose config` fails on the unedited
`<placeholder>` values (e.g. `LOGSTREAM_LOG_DIR` is read as an undefined volume):

```bash
cd /opt/logstream-system/log-infra
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

Open the dashboard:

```text
https://<SERVER_IP>
```

## Keycloak Administration And Data

Admin Console URL:

```text
https://<SERVER_IP>/auth/admin/
```

Create application users in the `logstream` realm. Users authenticate through
the dashboard login flow and receive JWT tokens accepted by the API and
WebSocket handshake.

Keycloak runs in standard mode backed by an internal PostgreSQL service. User
accounts, realm settings, credentials, and client settings are persisted in:

```text
log-infra_keycloak_db_data -> /var/lib/postgresql/data in the keycloak-db container
```

The database service is attached only to the private application network and
does not publish a host port. Normal container restart or recreation retains users:

```bash
docker compose restart
docker compose down
docker compose up -d
```

Do not use this during normal operation:

```bash
docker compose down -v
```

It deletes the PostgreSQL volume and therefore the stored realm and users.
Maintain regular database backups.

## Service Operations

Run commands from `log-infra`:

```bash
docker compose ps
docker compose logs -f
docker compose logs -f nginx
docker compose logs -f logstream
docker compose logs -f keycloak keycloak-db
docker compose restart
docker compose down
docker compose up -d
```

Only nginx is the browser entry point on the configured HTTPS port (`443` by
default, set via `HTTPS_PORT`), with HTTP port `80` redirecting to HTTPS. The
`logstream` API is reached by users through nginx at `/api` and `/ws`.

## Update Procedure

Review and pull source updates in each repository, then rebuild through the
deployment Compose project:

```bash
cd /opt/logstream-system/log-infra
git status --short
git pull

cd ../logstream
git status --short
git pull

cd ../log-dashboard-ui
git status --short
git pull

cd ../log-infra
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

Do not pull over uncommitted server-side modifications without reviewing them.

Changes to `APP_ORIGIN` after Keycloak is already running require updating the
existing Keycloak client redirect/web-origin settings through Admin Console.

## Testing And Verification

### Before Deployment

Backend tests:

```bash
cd /opt/logstream-system/logstream
./mvnw test
```

Frontend checks:

```bash
cd /opt/logstream-system/log-dashboard-ui
npm ci
npm run lint
npm run build
```

Deployment configuration checks:

```bash
cd /opt/logstream-system/log-infra
docker compose config --quiet
python3 -m json.tool keycloak/logstream-realm.json >/dev/null
```

### After Deployment

Check running services:

```bash
cd /opt/logstream-system/log-infra
docker compose ps
docker compose exec logstream wget -qO- http://localhost:8080/actuator/health
```

Check that Keycloak discovery is reachable through nginx:

```bash
curl -f https://<SERVER_IP>/auth/realms/logstream/.well-known/openid-configuration
```

Browser verification:

1. Open `https://<SERVER_IP>`.
2. Confirm redirection to Keycloak login.
3. Sign in with a user in the `logstream` realm.
4. Confirm available channels appear in the sidebar.
5. Select a channel and confirm live log events appear when Redis receives events.
6. Confirm the download action succeeds only for configured channels with files in `LOGSTREAM_LOG_DIR`.

## Keycloak Backup

Keycloak state is stored in PostgreSQL. Create a logical backup using
`pg_dump`; this can be run while the application is online:

```bash
cd /opt/logstream-system/log-infra
mkdir -p backups
set -a
. ./.env
set +a
docker compose exec -T keycloak-db \
  pg_dump -U "$KC_DB_USERNAME" -d "$KC_DB_NAME" -Fc \
  > backups/keycloak.dump
```

Also back up:

```text
log-infra/.env
log-infra/keycloak/logstream-realm.json
any directory configured as LOGSTREAM_LOG_DIR
```

## Troubleshooting

### Login Redirect Rejected

Symptoms:

```text
Invalid redirect_uri
Login returns an error after the browser reaches Keycloak
```

Check that these represent the same browser-facing IP origin:

```text
APP_ORIGIN in log-infra/.env
Keycloak logstream-ui valid redirect URIs
Keycloak logstream-ui web origins
```

For an existing Keycloak database, change client settings in Admin Console rather
than editing only the realm import file.

### Dashboard Loads But Live Logs Do Not Connect

Check:

```bash
docker compose logs -f nginx logstream
```

Verify:

- The user has logged in and received a valid Keycloak JWT.
- The browser URL origin exactly matches `APP_ORIGIN`.
- nginx forwards the WebSocket `Sec-WebSocket-Protocol` header.
- `logstream` can retrieve signing keys from the Keycloak container.

### nginx Returns `502 Bad Gateway`

Check that backend and Keycloak containers are running:

```bash
docker compose ps
docker compose logs logstream keycloak nginx
```

### No Redis Logs Arrive

Verify that Redis:

- Publishes events on channels listed in `LOGSTREAM_CHANNELS`.
- Is attached to the `monitoring` Docker network.
- Is reachable at `REDIS_HOST`/`REDIS_PORT` from the API container.

### Download Returns Not Found

Verify:

- Requested channel is present in `LOGSTREAM_CHANNELS`.
- `${LOGSTREAM_LOG_DIR}/{channel}.log` exists on the host.
- The mounted file is readable by the container.
