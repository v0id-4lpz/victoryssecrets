# Deployment

## Overview

The `.vsv` file is an AES-256-GCM encrypted blob. It can be committed to the repo, hosted on a server, or mounted as a volume. Only the password can decrypt it.

## GitHub Actions

```yaml
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4
      - run: npm ci

      # Validation: do all secrets exist for prod?
      - run: npx vsv check -e prod -f secrets.vsv
        env:
          VSV_PASSWORD: ${{ secrets.VSV_PASSWORD }}

      # Option A: inject all secrets at once
      - run: npx vsv run -e prod -f secrets.vsv -- ./deploy.sh
        env:
          VSV_PASSWORD: ${{ secrets.VSV_PASSWORD }}

      # Option B: read a specific secret
      - run: |
          DB_URL=$(npx vsv get db.url -e prod -f secrets.vsv)
          echo "::add-mask::$DB_URL"
        env:
          VSV_PASSWORD: ${{ secrets.VSV_PASSWORD }}
```

## Docker

### With `VSV_PASSWORD`

```dockerfile
FROM node:22-alpine
COPY . .
RUN npm ci
CMD ["npx", "vsv", "run", "-e", "prod", "-f", "secrets.vsv", "--", "node", "server.js"]
```

```bash
docker run -e VSV_PASSWORD=... myapp
```

### With Docker secrets (`VSV_PASSWORD_FILE`)

```yaml
# docker-compose.yml
services:
  app:
    image: myapp
    secrets:
      - vsv_password
    environment:
      VSV_PASSWORD_FILE: /run/secrets/vsv_password
      VSV_FILE: /app/secrets.vsv

secrets:
  vsv_password:
    file: ./vsv-password.txt
```

`VSV_PASSWORD_FILE` is more secure than `VSV_PASSWORD`: env vars are visible in `/proc/<pid>/environ` and in crash logs. A memory-mounted file is not.

## Kubernetes

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: vsv-password
type: Opaque
stringData:
  password: "your-vault-password"
---
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: app
          env:
            - name: VSV_PASSWORD_FILE
              value: /secrets/password
          volumeMounts:
            - name: vsv-password
              mountPath: /secrets
              readOnly: true
      volumes:
        - name: vsv-password
          secret:
            secretName: vsv-password
```

## Remote vaults (read-only)

The vault can be hosted on an HTTP server instead of being in the repo:

```bash
# CI
npx vsv run -e prod -f https://internal.company.com/vault.vsv -- ./deploy.sh

# Agent with automatic refresh
vsv agent start -f https://internal.company.com/vault.vsv -e prod -d --poll 5
```

The server only sees encrypted binary. Mutations are blocked (read-only).

If the remote vault password changes, restart the agent with the new password.

## Agent daemon in production

```bash
# Start as daemon (detaches from terminal)
vsv agent start -f ./secrets.vsv -e prod -d
# Agent started in background (pid 1234, log /tmp/vsv-agent-501.log)

# Check status
vsv agent status

# Logs
tail -f /tmp/vsv-agent-501.log
# [2026-03-13T10:12:22.342Z] Agent started (pid 1234, env prod, socket /tmp/vsv-agent-501.sock)

# Stop
vsv agent stop
```

The agent:
- Detaches from the terminal (survives shell close)
- Ignores SIGHUP
- Auto-locks after inactivity (configurable)
- Socket set to mode `0600` (owner only)
- Uses `$XDG_RUNTIME_DIR` on Linux (`/run/user/<uid>/`, mode `0700`)
- Password is passed via a temporary `0600` file (not in `ps`, not in env vars)

## Nuxt integration

### Option A: `vsv run` (injection at startup)

```bash
vsv run -e prod -f ./secrets.vsv -- npx nuxt dev
```

The vault template maps Nuxt variables:

```
NUXT_DB_HOST=${db.host}
NUXT_DB_PASSWORD=${db.password}
NUXT_PUBLIC_APP_URL=${app.url}
```

### Option B: Agent + server plugin (live querying)

```bash
vsv agent start -f ./secrets.vsv -e prod -d
```

```ts
// server/utils/vsv.ts
import { createClient } from 'vsv'

let client: ReturnType<typeof createClient> | null = null

export async function getVsv() {
  if (!client) {
    client = createClient()
  }
  return client
}
```

```ts
// server/api/example.get.ts
export default defineEventHandler(async () => {
  const vsv = await getVsv()
  const apiKey = await vsv.get('stripe.secret-key')
  // ...
})
```

Advantage: secrets are always up to date (rotation without restart).

## Security

- **Encryption**: AES-256-GCM + Argon2id (256 MB, 8 iterations, parallelism 4)
- **Password never stored**: only the non-extractable CryptoKey is in memory
- **Auto-lock**: automatic lock after inactivity
- **Socket permissions**: `0600` (owner only), in `$XDG_RUNTIME_DIR` when available
- **Daemon password**: passed via temporary `0600` file, never in args or process env vars
- **Remote vault**: the HTTP server only sees encrypted binary
- **`vsv check`**: missing secret validation as a CI gate
