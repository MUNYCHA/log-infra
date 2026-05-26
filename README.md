# Logstream System Deployment

This repository owns deployment of the internal-office Logstream application:

- React dashboard, built into the nginx container from `../log-dashboard-ui`
- Spring Boot streaming API, built from `../logstream`
- Keycloak authentication with an internal PostgreSQL identity database
- nginx as the single browser-facing entry point

Kafka is currently an external dependency. It must be reachable from the
`logstream` container on the shared Docker network.

## System Flow

```text
Office browser
  |
  |  https://SERVER_IP
  v
nginx :443 (port 80 redirects to HTTPS)
  |-- /           React dashboard static files
  |-- /auth/*     Keycloak login/OIDC endpoints
  |-- /api/*      logstream REST API
  `-- /ws/*       logstream WebSocket endpoint
                         |
                         | consumes log events
                         v
                       Kafka

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
Live view:  Kafka events -> logstream -> WebSocket -> dashboard
Download:   configured host log file -> logstream REST API -> browser
```

The API does not write Kafka events into downloadable log files.

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
- A Kafka broker producing `LogEvent` JSON messages
- A host directory containing downloadable `{topic}.log` files, if download is used
- A TLS certificate trusted by employee browsers and valid for the server IP

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

Edit `.env`. At minimum, set the IP address employees use to open the
dashboard and replace the initial Keycloak password:

```env
APP_ORIGIN=https://192.168.1.50

KC_BOOTSTRAP_ADMIN_USERNAME=admin
KC_BOOTSTRAP_ADMIN_PASSWORD=replace-with-a-strong-password
KC_DB_NAME=keycloak
KC_DB_USERNAME=keycloak
KC_DB_PASSWORD=replace-with-a-strong-database-password

VITE_SSO_CLIENT_ID=logstream-ui
VITE_MAX_LOGS_PER_TOPIC=500
VITE_MAX_MESSAGE_LENGTH=50000

LOGSTREAM_TOPICS=server-topic,system-topic,app1-topic
LOGSTREAM_LOG_DIR=/data/logstream-downloads
JVM_MAX_HEAP=512m

KAFKA_BOOTSTRAP_SERVERS=kafka:9092
KAFKA_CONSUMER_GROUP_ID=log-dashboard
KAFKA_MAX_POLL_RECORDS=500
```

`APP_ORIGIN` is used in all browser-address-sensitive locations:

```text
React application origin:        https://192.168.1.50
API/WebSocket allowed origin:     https://192.168.1.50
Keycloak browser-visible URL:     https://192.168.1.50/auth
Initial Keycloak UI redirect URI: https://192.168.1.50/*
```

On the first Keycloak start, `${APP_ORIGIN}` placeholders in
`keycloak/logstream-realm.json` are resolved into the imported UI client.

If Keycloak has already initialized its database and `APP_ORIGIN` later changes,
edit the `logstream-ui` client's valid redirect URIs and web origins in Keycloak
Admin Console. Startup import skips an already existing realm.

### 3. Install TLS Certificate Files

Create the nginx certificate directory and place an office-trusted certificate
and its private key there:

```bash
mkdir -p /opt/logstream-system/log-infra/certs
# Install certificate and key as:
# certs/fullchain.pem
# certs/privkey.pem
chmod 600 /opt/logstream-system/log-infra/certs/privkey.pem
```

The certificate must contain the server IP used in `APP_ORIGIN` as an IP Subject
Alternative Name. Employee browsers must trust its issuing CA; otherwise users
receive certificate errors and authentication is not a reliable deployment.

Certificate files and `.env` are ignored by Git.

### 4. Configure The Optional Download Directory

`LOGSTREAM_LOG_DIR` is read-only inside the API container. Set it to the host
directory that already contains downloadable log files, or prepare it when
using the download feature:

```bash
sudo mkdir -p /data/logstream-downloads
sudo chown "$USER":"$USER" /data/logstream-downloads
```

For:

```env
LOGSTREAM_TOPICS=server-topic,app1-topic
LOGSTREAM_LOG_DIR=/data/logstream-downloads
```

downloadable files are:

```text
/data/logstream-downloads/server-topic.log
/data/logstream-downloads/app1-topic.log
```

This directory does not affect live Kafka/WebSocket streaming.

### 5. Connect Kafka

The application Compose stack uses an external Docker network named
`monitoring` so a separately managed Kafka service can join it.

Create the network once:

```bash
docker network create monitoring
```

Attach the running Kafka container if it is managed elsewhere:

```bash
docker network connect --alias kafka monitoring <kafka-container-name>
```

Kafka must advertise a broker address reachable from the `logstream` container.
For the example configuration:

```env
KAFKA_BOOTSTRAP_SERVERS=kafka:9092
```

Kafka needs a network alias/service hostname `kafka` and an internal advertised
listener such as `kafka:9092`. A broker that advertises `localhost:9092` will
not work for a client running inside the `logstream` container.

If Kafka is not shared with other systems, a future simplification is to add it
to this Compose stack and allow Compose to manage all application networking.

### 6. Validate And Start

Standard Docker Compose commands are the deployment interface:

```bash
cd /opt/logstream-system/log-infra
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

Open the dashboard:

```text
https://192.168.1.50
```

## Keycloak Administration And Data

Admin Console URL:

```text
https://192.168.1.50/auth/admin/
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

Only nginx is the browser entry point on HTTPS port `443` (with HTTP port `80`
redirecting to HTTPS). The
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
curl -f https://192.168.1.50/auth/realms/logstream/.well-known/openid-configuration
```

Browser verification:

1. Open `https://192.168.1.50`.
2. Confirm redirection to Keycloak login.
3. Sign in with a user in the `logstream` realm.
4. Confirm available topics appear in the sidebar.
5. Select a topic and confirm live log events appear when Kafka receives events.
6. Confirm the download action succeeds only for configured topics with files in `LOGSTREAM_LOG_DIR`.

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

### No Kafka Logs Arrive

Verify that Kafka:

- Produces events on topics listed in `LOGSTREAM_TOPICS`.
- Is attached to the `monitoring` Docker network.
- Is reachable at `KAFKA_BOOTSTRAP_SERVERS` from the API container.
- Advertises a container-reachable listener rather than `localhost`.

### Download Returns Not Found

Verify:

- Requested topic is present in `LOGSTREAM_TOPICS`.
- `${LOGSTREAM_LOG_DIR}/{topic}.log` exists on the host.
- The mounted file is readable by the container.
