# Logstream Keycloak login theme

Keycloakify (React) theme that matches the log-dashboard-ui look. Built from
`src/login/` — palette mirrors `log-dashboard-ui/src/constants/theme.js`.

## What's customized
- `src/login/Template.tsx` — page shell: app background, centered brand + card, dark-mode aware.
- `src/login/pages/Login.tsx` — username/password login with our inputs/button.
- `src/login/main.css` — palette (`ls-*` classes), Roboto fonts (self-hosted, offline).
- `src/login/KcPage.tsx` — routes `login.ftl` to our page; all other pages use our Template.

> Passkey/WebAuthn conditional UI was dropped from the login page for clarity.
> If the realm enables passkeys, re-add that block from keycloakify's default `Login.tsx`.

## Develop / preview
```bash
npm run dev          # preview pages locally (uncomment the mock block in src/main.tsx)
npm run storybook    # browse every page/state
```

## Build the theme jar
```bash
npm run build-keycloak-theme
# -> dist_keycloak/keycloak-theme-for-kc-all-other-versions.jar  (used for KC 26)
```

## How it's wired (../docker-compose.yml + ../keycloak/realm-export.json)
- The jar is mounted into `/opt/keycloak/providers/`.
- The realm sets `"loginTheme": "logstream"`.

**After rebuilding the jar, restart Keycloak** (`docker compose ... up -d --force-recreate keycloak`).
Theme name (`logstream`) is set via `themeName` in `vite.config.ts`.
