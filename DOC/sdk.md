# vsv SDK

Two modes of programmatic usage: **direct library** (the process opens the vault) or **client SDK** (connects to an agent).

## Direct library

The process opens the vault and keeps it in memory. The password is required at startup.

```ts
import { vault } from 'vsv'

await vault.open('./secrets.vsv', process.env.VSV_PASSWORD!)

// Read a secret (shorthand)
const dbHost = vault.get('db.host', 'prod')

// Read a secret (detailed)
const entry = vault.getSecret('db', 'host')
// { secret: false, values: { dev: "localhost", prod: "db.prod.internal" } }

// Generate a resolved .env
import { envGenerator } from 'vsv'
const { output, entries, warnings } = envGenerator.generateEnv(vault.getData(), 'prod')

// Close (clears the CryptoKey and data from memory)
vault.lock()
```

### Vault API

| Method | Description |
|--------|-------------|
| `open(path, password)` | Open a vault (local path or remote URL) |
| `create(path, password)` | Create a new vault |
| `lock()` | Clear everything from memory |
| `getData()` | Full vault data |
| `get(ref, envId)` | Shorthand `service.field` → value |
| `getSecret(serviceId, field)` | Full SecretEntry |
| `getAllSecrets()` | All secrets by service |
| `isUnlocked()` | Vault state |
| `isReadOnly()` | `true` if remote or read-only flag is set |
| `isRemote()` | `true` if opened from a URL |
| `refresh()` | Re-fetch a remote vault |
| `persist()` | Write to disk (serialized via internal mutex) |
| `changePassword(current, new)` | Re-encrypt vault with a new password |
| `addService(id, label)` | Create a service |
| `deleteService(id)` | Delete a service |
| `renameServiceId(oldId, newId)` | Rename a service key |
| `setSecret(serviceId, field, opts?)` | Create/update a secret |
| `setSecretValue(serviceId, field, envId, value)` | Set a value for a specific env |
| `deleteSecret(serviceId, field)` | Delete a secret |
| `moveSecret(oldSvc, oldField, newSvc, newField)` | Move a secret (updates template refs) |
| `addEnvironment(envId)` | Create an environment |
| `deleteEnvironment(envId)` | Delete an environment |
| `renameEnvironment(oldId, newId)` | Rename an environment |
| `setReadOnly(bool)` | Toggle read-only mode |

Mutations call `persist()` automatically. `persist()` is blocked on remote vaults and when read-only mode is enabled. Concurrent calls to `persist()` are serialized via an internal mutex.

---

## Client SDK

Connects to an agent daemon via Unix socket. No password needed in the app.

```bash
# Start the agent first
vsv agent start -f ./secrets.vsv -e prod -d
```

```ts
import { createClient } from 'vsv'

const client = createClient()
// or: createClient({ env: 'dev' })          — client default env
// or: createClient({ connectTimeout: 3000 }) — connection timeout (default 5s)

// Read a secret
const dbHost = await client.get('db.host')           // uses the default env
const dbHostDev = await client.get('db.host', 'dev') // explicit env

// Generate the full .env
const { output, entries, warnings } = await client.env('prod')

// Check existence
await client.hasService('db')        // true
await client.hasEnvironment('prod')  // true

// Mutations (persisted to disk via the agent)
await client.addService('redis', 'Redis')
await client.setSecret('redis', 'url', { secret: true, values: { prod: 'redis://prod:6379' } })
await client.setSecretValue('redis', 'url', 'staging', 'redis://staging:6379')

// Refresh (remote vaults)
await client.refresh()

// Disconnect
client.disconnect()

// Lock vault + stop agent
await client.lock()
```

### Environment resolution

Resolution chain for `client.get('db.host')`:

1. Explicit `envId` parameter
2. Client default env (`createClient({ env: 'dev' })`)
3. Agent default env (`vsv agent start -e prod`)
4. Error if no env is available

### Client options

```ts
interface ClientOptions {
  socketPath?: string    // Socket path (default: auto-detected)
  env?: string           // Default environment
  connectTimeout?: number // Connection timeout in ms (default: 5000)
  requestTimeout?: number // Request timeout in ms (default: 30000)
}
```

### Client API

| Method | Description |
|--------|-------------|
| `get(ref, envId?)` | Shorthand `service.field` → value |
| `getSecret(serviceId, field)` | Full SecretEntry |
| `getData()` | Full VaultData |
| `getInfo()` | Agent info (`{ env }`) |
| `env(envId?)` | Generate the resolved .env |
| `hasService(id)` | Check existence |
| `hasEnvironment(envId)` | Check existence |
| `isRemote()` | `true` if remote vault |
| `refresh()` | Re-fetch remote vault |
| `addService(id, label, comment?)` | Create a service |
| `deleteService(id)` | Delete a service |
| `setSecret(serviceId, field, opts?)` | Create/update a secret |
| `setSecretValue(serviceId, field, envId, value)` | Set a value |
| `deleteSecret(serviceId, field)` | Delete a secret |
| `lock()` | Lock the vault + stop the agent |
| `disconnect()` | Close the connection |

---

## Package exports

```ts
import { vault } from 'vsv'             // Stateful orchestrator
import { createClient } from 'vsv'      // Client SDK

// Pure services (business logic, no side effects)
import { envGenerator } from 'vsv'      // Secret resolution + .env generation
import { serviceOps } from 'vsv'        // Service CRUD
import { environmentOps } from 'vsv'    // Environment CRUD
import { secretOps } from 'vsv'         // Secret CRUD
import { templateOps } from 'vsv'       // Template CRUD
import { settingsOps } from 'vsv'       // Settings CRUD
import { search } from 'vsv'            // Search index
```
