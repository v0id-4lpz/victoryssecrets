# vsv

Encrypted secrets manager for small teams. One `.vsv` file, AES-256-GCM + Argon2id, zero dependencies on external services.

## What it does

- **Encrypt secrets** in a single `.vsv` file you can commit to git, host on a server, or mount as a volume
- **Inject secrets** as environment variables into any process (`vsv run -- node server.js`)
- **Query secrets** from your app via a background agent daemon (Unix socket, no password needed at runtime)
- **Validate secrets** before deploy (`vsv check -e prod` as a CI gate)

## Quick start

```bash
npm install vsv

# Create a vault
vsv init -f secrets.vsv

# Add secrets
vsv set db.host localhost -e dev --create -f secrets.vsv
vsv set db.password s3cret -e dev --create -f secrets.vsv

# Read a secret
vsv get db.host -e dev -f secrets.vsv

# Inject into a process
vsv run -e dev -f secrets.vsv -- node server.js

# Or start the agent and forget about passwords
vsv agent start -f secrets.vsv -e dev -d
vsv get db.host          # no -f, no -e, no password
```

## SDK

```typescript
import { vault, createClient } from 'vsv'

// Direct mode (opens the vault in-process)
await vault.open('./secrets.vsv', password)
vault.get('db.host', 'prod')
vault.lock()

// Client mode (connects to a running agent)
const client = createClient()
await client.get('db.host')
client.disconnect()
```

## Security

- **AES-256-GCM** encryption with **Argon2id** key derivation (256 MB, 8 iterations)
- Password is never stored — only a non-extractable CryptoKey lives in memory
- Atomic file writes with serialized persist queue
- Prototype pollution protection (unsafe name rejection + Object.hasOwn guards)
- Agent socket permissions `0600` (owner only)
- Vault format versioning with forward-compatible migration pipeline

## CI/CD

```yaml
# GitHub Actions
- run: npx vsv check -e prod -f secrets.vsv
  env:
    VSV_PASSWORD: ${{ secrets.VSV_PASSWORD }}

- run: npx vsv run -e prod -f secrets.vsv -- ./deploy.sh
  env:
    VSV_PASSWORD: ${{ secrets.VSV_PASSWORD }}
```

Supports `VSV_PASSWORD`, `VSV_PASSWORD_FILE` (Docker secrets, K8s), and interactive prompt.

## Documentation

- [CLI reference](../../DOC/cli.md)
- [SDK reference](../../DOC/sdk.md)
- [Deployment guide](../../DOC/deployment.md) (Docker, Kubernetes, GitHub Actions, Nuxt)

## License

MIT
