# vsv CLI

## Installation

```bash
npm install vsv
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `VSV_FILE` | Vault file path (alternative to `-f`) |
| `VSV_PASSWORD` | Vault password (alternative to the interactive prompt) |
| `VSV_PASSWORD_FILE` | Path to a file containing the password (Docker secrets, K8s) |

Password priority: `VSV_PASSWORD` > `VSV_PASSWORD_FILE` > interactive prompt.

## Commands

### `vsv init -f <path>`

Create a new vault. Interactive only (requires a terminal).

```bash
vsv init -f ./secrets.vsv
# Password: ********
# Confirm: ********
# Vault created: ./secrets.vsv
```

Password must be at least 12 characters. `VSV_PASSWORD` is ignored (vault creation must be intentional).

### `vsv get <service.field> [-e <env>]`

Read a secret value.

```bash
# Direct mode
vsv get db.host -e prod -f ./secrets.vsv

# With agent (no -f, -e, or password needed)
vsv get db.host

# In a script (no trailing newline)
DB_HOST=$(vsv get db.host -e prod -f ./secrets.vsv)
```

### `vsv set <service.field> <value> [-e <env>] [--create]`

Write a value. `--create` automatically creates the service, environment, and secret if they don't exist.

```bash
vsv set db.host localhost -e dev -f ./secrets.vsv
vsv set db.port 5432 -e prod --create -f ./secrets.vsv
```

Blocked on remote vaults (read-only).

### `vsv list [services|envs|secrets] [-e <env>] [--json]`

List vault contents.

```bash
vsv list                        # Everything
vsv list services               # Services only
vsv list secrets -e prod        # Secrets with values for prod
vsv list --json                 # JSON output (scripting)
```

### `vsv env [-e <env>] [--json]`

Generate `.env` output from the vault template.

```bash
vsv env -e prod -f ./secrets.vsv > .env
vsv env -e prod --json          # JSON output { "KEY": "value" }
```

### `vsv run [-e <env>] -- <command...>`

Run a command with secrets injected as environment variables.

```bash
vsv run -e prod -f ./secrets.vsv -- node server.js
vsv run -e prod -- docker compose up
```

Signals (SIGTERM, SIGINT, SIGHUP) are forwarded to the child process.

### `vsv check [-e <env>] [--json]`

Validate that all secrets have a value for an environment. Exits 0 if OK, exits 1 if values are missing.

```bash
# CI gate before deployment
vsv check -e prod -f ./secrets.vsv

# JSON output
vsv check -e prod --json
# { "env": "prod", "ok": false, "missing": ["api.key"], "empty": [] }
```

### `vsv agent start|stop|status|refresh`

Manage the agent daemon.

```bash
# Foreground
vsv agent start -f ./secrets.vsv -e prod

# Background (daemon)
vsv agent start -f ./secrets.vsv -e prod -d

# Remote vault with automatic refresh every 5 minutes
vsv agent start -f https://internal.company.com/vault.vsv -e prod -d --poll 5

# Status
vsv agent status

# Manual refresh (remote vaults)
vsv agent refresh

# Stop
vsv agent stop
```

The agent listens on a Unix socket (`$XDG_RUNTIME_DIR/vsv-agent-<uid>.sock` or `/tmp/vsv-agent-<uid>.sock`). Socket and pid file are set to mode `0600` (owner only).

## Global options

| Option | Description |
|--------|-------------|
| `-q, --quiet` | Suppress warnings and info messages |
| `-V, --version` | Show version |
| `-h, --help` | Help |

## Remote vaults

The vault can be hosted on an HTTP server. The file is encrypted — the server only sees opaque binary data.

```bash
vsv get db.host -e prod -f https://mysite.com/vault.vsv
```

Remote vaults are **read-only**: `vsv set` and mutations are blocked. The agent can poll periodically to detect updates (`--poll`).
