# Victory's Secrets

Encrypted secrets manager for developers and small teams. One `.vsv` file — commit it to git, host it on a server, or mount it as a volume. Zero external services required.

## Packages

| Package | Description |
|---------|-------------|
| [`vsv`](packages/vsv) | Core library, CLI, agent daemon, and client SDK |
| [`electron`](packages/electron) | Desktop app (GUI) |

## What it does

- **Encrypt secrets** in a single `.vsv` file using AES-256-GCM + Argon2id
- **Organize** by services, environments, and fields
- **Generate `.env` files** from templates with per-environment overrides
- **Inject secrets** into any process (`vsv run -- node server.js`)
- **Query at runtime** via a background agent daemon (Unix socket)
- **Validate before deploy** (`vsv check -e prod` as a CI gate)
- **Remote vaults** — host the encrypted file on HTTPS, the server only sees opaque bytes

## Quick start

### CLI

```bash
npm install vsv

vsv init -f secrets.vsv
vsv set db.host localhost -e dev --create -f secrets.vsv
vsv run -e dev -f secrets.vsv -- node server.js
```

### Agent

```bash
# start the daemon (prompts for password, then runs in background)
vsv agent start -f secrets.vsv -e prod -d

# all subsequent commands go through the agent — no password needed
vsv get db.host
vsv run -- node server.js
vsv agent stop
```

### SDK

```typescript
import { vault, createClient } from 'vsv'

// Direct: open the vault in-process
await vault.open('./secrets.vsv', password)
vault.get('db.host', 'prod')

// Client: connect to a running agent
const client = createClient()
await client.get('db.host')
```

### Desktop app

```bash
cd packages/electron
npm ci && npm start
```

## Security

- **AES-256-GCM** encryption with **Argon2id** key derivation (256 MB, 8 iterations)
- Password is never stored — only a non-extractable CryptoKey lives in memory
- Atomic file writes with serialized persist mutex
- Prototype pollution protection (unsafe name rejection + `Object.hasOwn` guards)
- Agent socket permissions `0600` (owner only)
- Desktop: secrets never in the DOM, clipboard auto-clear, privacy overlay on blur, strict CSP

## CI/CD

Works with GitHub Actions, Docker, and Kubernetes. Supports `VSV_PASSWORD`, `VSV_PASSWORD_FILE` (Docker/K8s secrets), and interactive prompt.

```yaml
- run: npx vsv check -e prod -f secrets.vsv
  env:
    VSV_PASSWORD: ${{ secrets.VSV_PASSWORD }}
```

## Documentation

- [CLI reference](DOC/cli.md)
- [SDK reference](DOC/sdk.md)
- [Deployment guide](DOC/deployment.md) (Docker, Kubernetes, GitHub Actions, Nuxt)

## Development

```bash
npm ci
npm test             # run all tests (378 tests across 26 files)
npm run typecheck    # type-check without running
```

## License

MIT
