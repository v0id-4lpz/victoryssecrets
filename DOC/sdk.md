# vsv SDK

Deux modes d'utilisation programmatique : **library directe** (le process ouvre le vault) ou **client SDK** (connexion à un agent).

## Library directe

Le process ouvre le vault et le garde en mémoire. Le password est nécessaire au démarrage.

```ts
import { vault } from 'vsv'

await vault.open('./secrets.vsv', process.env.VSV_PASSWORD!)

// Lire un secret (shorthand)
const dbHost = vault.get('db.host', 'prod')

// Lire un secret (détaillé)
const entry = vault.getSecret('db', 'host')
// { secret: false, values: { dev: "localhost", prod: "db.prod.internal" } }

// Générer un .env résolu
import { envGenerator } from 'vsv'
const { output, entries, warnings } = envGenerator.generateEnv(vault.getData(), 'prod')

// Fermer (efface la CryptoKey et les données de la mémoire)
vault.lock()
```

### API vault

| Méthode | Description |
|---------|-------------|
| `open(path, password)` | Ouvre un vault (local ou URL distante) |
| `create(path, password)` | Crée un nouveau vault |
| `lock()` | Efface tout de la mémoire |
| `getData()` | Données complètes du vault |
| `get(ref, envId)` | Raccourci `service.field` → valeur |
| `getSecret(serviceId, field)` | SecretEntry complète |
| `isUnlocked()` | État du vault |
| `isRemote()` | `true` si ouvert depuis une URL |
| `refresh()` | Re-fetch un vault distant |
| `addService(id, label)` | Crée un service |
| `deleteService(id)` | Supprime un service |
| `setSecret(serviceId, field, opts?)` | Crée/modifie un secret |
| `setSecretValue(serviceId, field, envId, value)` | Set une valeur |
| `deleteSecret(serviceId, field)` | Supprime un secret |
| `addEnvironment(envId)` | Crée un environnement |
| `deleteEnvironment(envId)` | Supprime un environnement |

Les mutations appellent `persist()` automatiquement. `persist()` est bloqué sur les vaults distants (read-only).

---

## Client SDK

Se connecte à un agent daemon via Unix socket. Pas besoin de password dans l'app.

```bash
# Démarrer l'agent d'abord
vsv agent start -f ./secrets.vsv -e prod -d
```

```ts
import { createClient } from 'vsv'

const client = createClient()
// ou: createClient({ env: 'dev' })          — default env client
// ou: createClient({ connectTimeout: 3000 }) — timeout connexion (défaut 5s)

// Lire un secret
const dbHost = await client.get('db.host')         // utilise l'env par défaut
const dbHostDev = await client.get('db.host', 'dev') // env explicite

// Générer le .env complet
const { output, entries, warnings } = await client.env('prod')

// Vérifier l'existence
await client.hasService('db')        // true
await client.hasEnvironment('prod')  // true

// Mutations (persistées sur disque via l'agent)
await client.addService('redis', 'Redis')
await client.setSecret('redis', 'url', { secret: true, values: { prod: 'redis://prod:6379' } })
await client.setSecretValue('redis', 'url', 'staging', 'redis://staging:6379')

// Refresh (vaults distants)
await client.refresh()

// Déconnexion
client.disconnect()

// Verrouillage + arrêt agent
await client.lock()
```

### Résolution d'environnement

Chaîne de résolution pour `client.get('db.host')` :

1. Paramètre `envId` explicite
2. Default env du client (`createClient({ env: 'dev' })`)
3. Default env de l'agent (`vsv agent start -e prod`)
4. Erreur si aucun env

### Options du client

```ts
interface ClientOptions {
  socketPath?: string    // Chemin socket (défaut : auto-détecté)
  env?: string           // Environnement par défaut
  connectTimeout?: number // Timeout connexion en ms (défaut : 5000)
  requestTimeout?: number // Timeout requête en ms (défaut : 30000)
}
```

### API client

| Méthode | Description |
|---------|-------------|
| `get(ref, envId?)` | Raccourci `service.field` → valeur |
| `getSecret(serviceId, field)` | SecretEntry complète |
| `getData()` | VaultData complet |
| `getInfo()` | Info agent (`{ env }`) |
| `env(envId?)` | Génère le .env résolu |
| `hasService(id)` | Vérifie l'existence |
| `hasEnvironment(envId)` | Vérifie l'existence |
| `isRemote()` | `true` si vault distant |
| `refresh()` | Re-fetch vault distant |
| `addService(id, label, comment?)` | Crée un service |
| `deleteService(id)` | Supprime un service |
| `setSecret(serviceId, field, opts?)` | Crée/modifie un secret |
| `setSecretValue(serviceId, field, envId, value)` | Set une valeur |
| `deleteSecret(serviceId, field)` | Supprime un secret |
| `lock()` | Verrouille le vault + arrête l'agent |
| `disconnect()` | Ferme la connexion |

---

## Exports du package

```ts
import { vault } from 'vsv'             // Orchestrateur stateful
import { createClient } from 'vsv'      // Client SDK

// Services purs (logique métier sans side effects)
import { envGenerator } from 'vsv'      // Résolution secrets + génération .env
import { serviceOps } from 'vsv'        // CRUD services
import { environmentOps } from 'vsv'    // CRUD environnements
import { secretOps } from 'vsv'         // CRUD secrets
import { templateOps } from 'vsv'       // CRUD templates
import { settingsOps } from 'vsv'       // CRUD settings
import { search } from 'vsv'            // Index de recherche
```
