# TLS Certificates

nginx terminates HTTPS and expects these two files here on the deployed server:

```text
fullchain.pem   # certificate
privkey.pem     # private key
```

They are mounted read-only into nginx at `/etc/nginx/certs/`. **nginx will not
start if they are missing.** Certificate and key files are excluded from Git.

The certificate must include the exact value used in `APP_ORIGIN` (the server IP
or hostname) as a Subject Alternative Name, or browsers reject it with a
name-mismatch error.

## Why HTTPS is required (even for a private IP)

The dashboard logs in with OIDC Authorization Code + PKCE, which uses the
browser Web Crypto API (`crypto.subtle`). Browsers only expose that API in a
**secure context** — HTTPS, or `http://localhost`. Plain `http://<ip>` is not a
secure context, so login breaks before it ever reaches Keycloak. HTTP-by-IP is
therefore not a supported deployment mode.

## Option A — Self-signed for an IP (no domain)

For an internal IP deploy with no domain, generate a self-signed cert bound to
the server IP. Run this from the `log-infra` directory and replace `<SERVER_IP>`
(it appears twice) with the real server IP from `APP_ORIGIN`:

```bash
openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout certs/privkey.pem \
  -out certs/fullchain.pem \
  -days 825 \
  -subj "/CN=<SERVER_IP>" \
  -addext "subjectAltName=IP:<SERVER_IP>"
chmod 600 certs/privkey.pem
```

Notes:

- `subjectAltName=IP:...` is what makes it valid for an IP URL. For a hostname
  instead, use `subjectAltName=DNS:logstream.internal`. Both can be listed,
  comma-separated.
- Requires OpenSSL 1.1.1+ (`-addext`). Check with `openssl version`.
- Keep `-days` at or under 825; some browsers reject longer-lived self-signed certs.

Self-signed certs are not trusted by browsers, so each employee sees a
one-time "your connection is not private" warning and clicks through. To remove
the warning, distribute an internal CA and install it on employee machines, then
sign `fullchain.pem` with that CA.

## Option B — CA-signed (domain, or internal CA)

If you have a domain or an internal CA, install the issued certificate as
`fullchain.pem` and its key as `privkey.pem`. The SAN must match `APP_ORIGIN`.
No browser warning if the issuing CA is trusted by employee machines.
