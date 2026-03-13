# vsv CLI

## Installation

```bash
npm install vsv
```

## Variables d'environnement

| Variable | Description |
|----------|-------------|
| `VSV_FILE` | Chemin du vault (alternative à `-f`) |
| `VSV_PASSWORD` | Password du vault (alternative au prompt interactif) |
| `VSV_PASSWORD_FILE` | Chemin vers un fichier contenant le password (Docker secrets, K8s) |

Priorité pour le password : `VSV_PASSWORD` > `VSV_PASSWORD_FILE` > prompt interactif.

## Commandes

### `vsv init -f <path>`

Crée un nouveau vault. Interactif uniquement (requiert un terminal).

```bash
vsv init -f ./secrets.vsv
# Password: ********
# Confirm: ********
# Vault created: ./secrets.vsv
```

Le password doit faire au moins 12 caractères. `VSV_PASSWORD` est ignoré (la création d'un vault doit être intentionnelle).

### `vsv get <service.field> [-e <env>]`

Lit la valeur d'un secret.

```bash
# Mode direct
vsv get db.host -e prod -f ./secrets.vsv

# Avec agent (pas besoin de -f, -e, ni password)
vsv get db.host

# Dans un script (pas de newline en sortie)
DB_HOST=$(vsv get db.host -e prod -f ./secrets.vsv)
```

### `vsv set <service.field> <value> [-e <env>] [--create]`

Écrit une valeur. `--create` crée automatiquement le service, l'environnement et le secret s'ils n'existent pas.

```bash
vsv set db.host localhost -e dev -f ./secrets.vsv
vsv set db.port 5432 -e prod --create -f ./secrets.vsv
```

Bloqué sur les vaults distants (read-only).

### `vsv list [services|envs|secrets] [-e <env>] [--json]`

Liste le contenu du vault.

```bash
vsv list                        # Tout
vsv list services               # Services uniquement
vsv list secrets -e prod        # Secrets avec valeurs pour prod
vsv list --json                 # Sortie JSON (scripting)
```

### `vsv env [-e <env>] [--json]`

Génère un output `.env` à partir du template du vault.

```bash
vsv env -e prod -f ./secrets.vsv > .env
vsv env -e prod --json          # Sortie JSON { "KEY": "value" }
```

### `vsv run [-e <env>] -- <command...>`

Exécute une commande avec les secrets injectés en variables d'environnement.

```bash
vsv run -e prod -f ./secrets.vsv -- node server.js
vsv run -e prod -- docker compose up
```

Les signaux (SIGTERM, SIGINT, SIGHUP) sont relayés au process enfant.

### `vsv check [-e <env>] [--json]`

Valide que tous les secrets ont une valeur pour un environnement. Exit 0 si OK, exit 1 si des valeurs manquent.

```bash
# Gate CI avant déploiement
vsv check -e prod -f ./secrets.vsv

# Sortie JSON
vsv check -e prod --json
# { "env": "prod", "ok": false, "missing": ["api.key"], "empty": [] }
```

### `vsv agent start|stop|status|refresh`

Gère le daemon agent.

```bash
# Foreground
vsv agent start -f ./secrets.vsv -e prod

# Background (daemon)
vsv agent start -f ./secrets.vsv -e prod -d

# Remote vault avec refresh automatique toutes les 5 minutes
vsv agent start -f https://internal.company.com/vault.vsv -e prod -d --poll 5

# Statut
vsv agent status

# Refresh manuel (vaults distants)
vsv agent refresh

# Arrêt
vsv agent stop
```

L'agent écoute sur un Unix socket (`$XDG_RUNTIME_DIR/vsv-agent-<uid>.sock` ou `/tmp/vsv-agent-<uid>.sock`). Socket et pid file sont en mode `0600` (owner only).

## Options globales

| Option | Description |
|--------|-------------|
| `-q, --quiet` | Supprime les warnings et messages d'info |
| `-V, --version` | Affiche la version |
| `-h, --help` | Aide |

## Vaults distants

Le vault peut être hébergé sur un serveur HTTP. Le fichier est chiffré — le serveur ne voit que du binaire opaque.

```bash
vsv get db.host -e prod -f https://mysite.com/vault.vsv
```

Les vaults distants sont **read-only** : `vsv set` et les mutations sont bloquées. L'agent peut poll périodiquement pour détecter les mises à jour (`--poll`).
