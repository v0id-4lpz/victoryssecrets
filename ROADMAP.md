# Roadmap — victoryssecrets

## Vision

Faire de victoryssecrets la **source unique de vérités pour les secrets**, avec des ponts vers tous les endroits où ils sont consommés — du poste dev jusqu'à la prod.

**Avantage compétitif :**
- **Offline-first** — le vault est un fichier local, pas de SaaS obligatoire
- **Zero-trust** — chiffrement client-side, l'agent ne stocke jamais en clair sur disque
- **Un seul fichier `.vsv`** portable — simple à backup, versionner, partager

---

## Étape 0 — Extraction du core Node.js pur

Prérequis à tout le reste. Extraire la logique actuellement couplée à Electron IPC dans un core réutilisable.

```
core/                 ← Node.js pur, partagé par tous les consumers
  crypto.ts             AES-256-GCM + Argon2id via Node crypto.subtle + binding C natif
  storage.ts            lecture/écriture .vsv via fs (pas d'IPC Electron)
  vault.ts              orchestrateur stateful (même rôle que l'actuel src/vault.ts)
  services/*            déjà purs — réutilisables tels quels
  models/*              déjà purs — réutilisables tels quels
```

**Principe :** les `services/` et `models/` actuels sont déjà des fonctions pures sans IO — ils sont réutilisables tels quels. Le travail porte sur `crypto.ts`, `storage.ts` et `vault.ts` qui doivent être découplés d'Electron.

**Sécurité Node.js — pourquoi c'est solide :**
- `crypto.subtle` (Web Crypto API) natif depuis Node v15, backed par OpenSSL, AES hardware-accelerated
- Argon2 via binding C natif (`argon2` npm) — même implémentation que celle recommandée par OWASP
- Clés non-extractables dans le runtime, comme dans le navigateur

**Points d'attention spécifiques au CLI/agent (hors sandbox navigateur) :**
- Permissions socket Unix (700, vérification UID)
- Verrouillage mémoire (`mlock`) pour éviter que les secrets finissent en swap
- Nettoyage mémoire explicite à la fermeture

**Résultat :** une fois le core extrait, chaque brique en découle :

```
core Node.js pur
  ├── CLI (vsv)              ← étape 1
  ├── Agent (daemon)         ← le CLI + un socket Unix qui écoute
  ├── SDK Node.js            ← un client qui parle à l'agent
  ├── SDK Python/Go          ← même protocole socket
  ├── Docker wrapper         ← le CLI dans un entrypoint
  ├── GitHub Action          ← le CLI dans un container
  ├── K8s operator           ← l'agent + sync loop
  └── Electron (UI desktop)  ← rebranché sur le même core
```

---

## 1. CLI (`vsv`)

Point d'entrée universel pour la consommation des secrets.

```bash
# Injecter en env vars sans écrire sur disque
vsv run -e staging -- docker compose up

# Générer un .env éphémère (supprimé automatiquement)
vsv env -e production --ttl 1h > .env

# Récupérer un secret unique (scriptable)
DB_URL=$(vsv get api.database_url -e prod)

# Pousser vers un provider externe
vsv sync -e prod --to aws-secrets-manager
```

### Commandes envisagées

| Commande         | Description                                              |
| ---------------- | -------------------------------------------------------- |
| `vsv run`        | Lance un process avec les secrets injectés en env vars   |
| `vsv env`        | Génère un `.env` éphémère (optionnel `--ttl`)            |
| `vsv get`        | Récupère un secret unique (stdout, scriptable)           |
| `vsv sync`       | Pousse/tire les secrets vers/depuis un provider externe  |
| `vsv unlock`     | Déverrouille le vault (démarre l'agent si actif)         |
| `vsv lock`       | Verrouille le vault et coupe l'agent                     |
| `vsv status`     | Affiche l'état du vault et de l'agent                    |

---

## 2. Agent local

Daemon léger qui tourne en background après un unlock unique.

- Expose un **socket Unix** sécurisé (vérification PID/UID du process appelant)
- Les apps demandent un secret à la volée sans connaître le mot de passe
- Le dev déverrouille une fois, l'agent sert ensuite toutes les requêtes
- **Auto-lock** après inactivité (identique à l'app desktop)
- Aucun secret jamais écrit en clair sur disque

---

## 3. Intégrations natives

### Docker
- Secret driver ou entrypoint wrapper
- Injection au runtime dans les containers

### CI/CD
- **GitHub Actions** — action officielle pour injecter les secrets
- **GitLab CI** — intégration via l'agent dans le runner

### Kubernetes
- Opérateur qui synchronise le vault vers des objets `Secret` k8s
- Rotation automatique

### Terraform / Pulumi
- Provider pour lire les secrets au `plan` / `apply`

---

## 4. SDK

Librairies légères pour consommer les secrets programmatiquement.

- **Node.js** — lib qui parle à l'agent via socket Unix
- **Python** — idem
- **Go** — idem
- **Fallback** — lecture directe du vault chiffré avec le mot de passe (sans agent)

---

## 5. Sync & collaboration multi-utilisateur

Synchronisation des vaults entre machines et utilisateurs, avec le serveur relay qui reste **aveugle** (ne voit que du chiffré).

### Architecture

```
┌─────────────────────────────────────────────┐
│              Relay (aveugle)                │
│  Stocke le vault chiffré + métadonnées      │
│  Ne possède AUCUNE clé de déchiffrement     │
│                                             │
│  Options de backend :                       │
│  - Simple : fichier sur S3 + lock DynamoDB  │
│  - Self-hosted : micro-service (SQLite)     │
│  - Managé : service victoryssecrets (futur) │
└─────────────────┬───────────────────────────┘
                  │ push/pull (chiffré)
      ┌───────────┼───────────┐
      │           │           │
    Alice        Bob       Charlie
   (laptop)   (serveur)   (CI/CD)
```

### Crypto multi-utilisateur

Chaque utilisateur a sa propre paire de clés (dérivée de son mot de passe personnel). La Vault Key (VK) est chiffrée N fois, une par membre :

```
Vault Key (VK) — clé symétrique AES-256, chiffre les données
  │
  ├── chiffrée avec la clé publique de Alice   → alice.enc
  ├── chiffrée avec la clé publique de Bob     → bob.enc
  └── chiffrée avec la clé publique de Charlie → charlie.enc
```

- Personne ne connaît le mot de passe des autres
- Révoquer un membre = re-chiffrer la VK sans sa clé + re-chiffrer le vault avec une nouvelle VK

### Résolution de conflits

- Chaque secret porte un `updatedAt` + `updatedBy`
- En cas de conflit de version, merge côté client au niveau des entrées (pas du fichier entier)
- Le client déchiffre les deux versions (locale + distante), merge, re-chiffre et push

### Évolution du format `.vsv`

```jsonc
{
  "version": 2,
  "vaultId": "uuid",
  "members": {
    "alice-uuid": { "publicKey": "...", "encryptedVaultKey": "...", "role": "admin" },
    "bob-uuid":   { "publicKey": "...", "encryptedVaultKey": "...", "role": "read" }
  },
  "secrets": {
    "api.database_url": {
      "values": { "prod": "...", "staging": "..." },
      "updatedAt": "2026-03-12T...",
      "updatedBy": "alice-uuid"
    }
  }
}
```

### Implémentation incrémentale

| Étape | Quoi | Complexité |
|-------|------|------------|
| v1 | **Mot de passe partagé** + relay simple (push/pull/version). Merge côté client par `updatedAt`. | Faible |
| v2 | **Crypto multi-utilisateur** (paires de clés, VK chiffrée par membre). Rôles admin/write/read. | Moyenne |
| v3 | **Permissions granulaires** (par service, par environnement). Audit trail. | Élevée |
| v4 | **Service managé** en option pour ceux qui ne veulent pas self-host. | Élevée |

---

## Ordre d'implémentation

| Phase | Quoi                              | Dépend de |
| ----- | --------------------------------- | --------- |
| 0     | Core Node.js pur                  | —         |
| 1     | CLI (`vsv`)                       | Phase 0   |
| 2     | Rebrancher Electron sur core      | Phase 0   |
| 3     | Agent local (daemon + socket)     | Phase 1   |
| 4     | Sync v1 (relay + mot de passe partagé) | Phase 0   |
| 5     | SDK Node.js                       | Phase 3   |
| 6     | Intégrations (Docker, CI/CD)      | Phase 1   |
| 7     | Sync v2 (crypto multi-utilisateur)| Phase 4   |
| 8     | SDK Python / Go                   | Phase 3   |
| 9     | K8s operator                      | Phase 3+5 |
| 10    | Sync v3-v4 (permissions, managé)  | Phase 7   |

Les phases 1 et 2 peuvent avancer en parallèle après la phase 0.
La sync v1 (phase 4) peut démarrer dès la phase 0 terminée.

---

## Décisions prises

- **Monorepo** — core, CLI, agent, Electron dans un seul repo (`packages/`)
- **Format `.vsv`** — garder le format actuel, ajouter un champ `version` pour les migrations futures. Prévoir dès la phase 0 les champs nécessaires à la sync (`vaultId`, `updatedAt` par secret)
- **Auth agent** — socket Unix + vérification UID pour commencer. Token de session si ouverture réseau plus tard
- **Sync** — multi-utilisateur multi-machines. Relay aveugle (zero-knowledge). Commencer simple (mot de passe partagé) puis crypto multi-utilisateur. Backend relay flexible : self-hosted ou managé, au choix de l'utilisateur
