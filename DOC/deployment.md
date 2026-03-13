# Déploiement

## Principe

Le fichier `.vsv` est un blob chiffré AES-256-GCM. Il peut être commité dans le repo, hébergé sur un serveur, ou monté comme volume. Seul le password permet de le déchiffrer.

## GitHub Actions

```yaml
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4
      - run: npm ci

      # Validation : tous les secrets existent pour prod ?
      - run: npx vsv check -e prod -f secrets.vsv
        env:
          VSV_PASSWORD: ${{ secrets.VSV_PASSWORD }}

      # Option A : injecter tous les secrets d'un coup
      - run: npx vsv run -e prod -f secrets.vsv -- ./deploy.sh
        env:
          VSV_PASSWORD: ${{ secrets.VSV_PASSWORD }}

      # Option B : lire un secret spécifique
      - run: |
          DB_URL=$(npx vsv get db.url -e prod -f secrets.vsv)
          echo "::add-mask::$DB_URL"
        env:
          VSV_PASSWORD: ${{ secrets.VSV_PASSWORD }}
```

## Docker

### Avec `VSV_PASSWORD`

```dockerfile
FROM node:22-alpine
COPY . .
RUN npm ci
CMD ["npx", "vsv", "run", "-e", "prod", "-f", "secrets.vsv", "--", "node", "server.js"]
```

```bash
docker run -e VSV_PASSWORD=... myapp
```

### Avec Docker secrets (`VSV_PASSWORD_FILE`)

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

`VSV_PASSWORD_FILE` est plus sécurisé que `VSV_PASSWORD` : les env vars sont visibles dans `/proc/<pid>/environ` et dans les logs de crash. Un fichier monté en mémoire ne l'est pas.

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

## Vault distant (read-only)

Le vault peut être hébergé sur un serveur HTTP au lieu d'être dans le repo :

```bash
# CI
npx vsv run -e prod -f https://internal.company.com/vault.vsv -- ./deploy.sh

# Agent avec refresh automatique
vsv agent start -f https://internal.company.com/vault.vsv -e prod -d --poll 5
```

Le serveur ne voit que du binaire chiffré. Les mutations sont bloquées (read-only).

Si le password du vault distant change, il faut redémarrer l'agent avec le nouveau password.

## Agent daemon en production

```bash
# Démarrer en daemon (se détache du terminal)
vsv agent start -f ./secrets.vsv -e prod -d
# Agent started in background (pid 1234, log /tmp/vsv-agent-501.log)

# Vérifier le statut
vsv agent status

# Logs
tail -f /tmp/vsv-agent-501.log
# [2026-03-13T10:12:22.342Z] Agent started (pid 1234, env prod, socket /tmp/vsv-agent-501.sock)

# Arrêt
vsv agent stop
```

L'agent :
- Se détache du terminal (survit à la fermeture du shell)
- Ignore SIGHUP
- Auto-lock après inactivité (configurable)
- Socket en mode `0600` (owner only)
- Utilise `$XDG_RUNTIME_DIR` sur Linux (`/run/user/<uid>/`, mode `0700`)
- Le password est passé via un fichier temporaire `0600` (pas dans `ps`, pas dans les env vars)

## Intégration Nuxt

### Option A : `vsv run` (injection au démarrage)

```bash
vsv run -e prod -f ./secrets.vsv -- npx nuxt dev
```

Le template du vault mappe les variables Nuxt :

```
NUXT_DB_HOST=${db.host}
NUXT_DB_PASSWORD=${db.password}
NUXT_PUBLIC_APP_URL=${app.url}
```

### Option B : Agent + plugin serveur (live querying)

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

Avantage : les secrets sont toujours à jour (rotation sans restart).

## Sécurité

- **Chiffrement** : AES-256-GCM + Argon2id (256MB, 3 itérations, parallélisme 4)
- **Password jamais stocké** : seule la CryptoKey non-extractable est en mémoire
- **Auto-lock** : verrouillage automatique après inactivité
- **Socket permissions** : `0600` (owner only), dans `$XDG_RUNTIME_DIR` quand disponible
- **Daemon password** : passé via fichier temporaire `0600`, jamais dans les args ou env vars du process
- **Vault distant** : le serveur HTTP ne voit que du binaire chiffré
- **`vsv check`** : validation des secrets manquants comme gate CI
