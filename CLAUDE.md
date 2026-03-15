
# Guidelines

## Sécurité

La sécurité est une priorité absolue de l'app.

- **Chiffrement** : AES-256-GCM + Argon2id (256MB, 8 itérations, parallélisme 4)
- **Mot de passe jamais stocké** : seule la `CryptoKey` non-extractable (Web Crypto API) est conservée en mémoire — le password est oublié après dérivation
- **Secrets jamais dans le DOM** : les valeurs sensibles sont stockées dans un `Map` JS, jamais dans des attributs `data-*`
- **Clipboard auto-clear** : le presse-papier est nettoyé 10s après copie d'un secret + vidé au verrouillage
- **Auto-lock** : verrouillage automatique après 10 min d'inactivité, efface `CryptoKey` + données + clipboard
- **Privacy overlay** : flou sur l'écran quand la fenêtre perd le focus
- **CSP** : Content Security Policy stricte — `script-src 'self'`, pas de CDN JS
- **IPC hardening** : validation des paths (extension `.vsv`, anti-traversal), limite taille fichier 10MB
- **Mutex persist** : les écritures sont sérialisées pour éviter les corruptions
- **JSON corrompu** : try/catch explicite avec message clair au lieu de crash

## UI

- Tailwind v4 local (`npm run css` pour build, `npm run css:watch` pour dev)
- TypeScript strict — composants `renderX()` (HTML string) + `bindX(render)` (event handlers)
- Build : `npm run build:ts` (esbuild bundle `src/app.ts` → `build/app.js`)
- Formulaires inline via `startInlineEdit(container, { rows, onSave, onCancel, onInput, onReady })`

## Architecture

```
src/                          ← sources TypeScript
  types/
    vault.ts                    VaultData, SecretEntry, Service, etc.
    electron-api.d.ts           window.electronAPI typing
  models/                     ← données pures, aucun side effect
    vault-schema.ts             structure vault + ensureStructure
    validators.ts               sanitizeId, labelToId, validate*
    template-refactor.ts        refactoring refs ${service.field} dans templates
  services/                   ← logique métier pure (data in → data out)
    service-ops.ts              CRUD services + cleanup secrets/templates
    environment-ops.ts          CRUD environnements
    secret-ops.ts               CRUD secrets + move avec refactoring
    template-ops.ts             CRUD templates + parseEnvFile + buildServiceFieldTree
    env-generator.ts            resolveSecrets + generateEnv
    search.ts                   buildSearchIndex + filterSearch
  vault.ts                    ← orchestrateur stateful (état + crypto/storage + délègue aux services)
  crypto.ts                   ← AES-256-GCM + Argon2id via IPC
  storage.ts                  ← file handles via Electron API
  autolock.ts                 ← timer inactivité
  generator.ts                ← génération mots de passe (utilitaire crypto, pas logique métier)
  ui/                         ← composants UI (render + bind)
    helpers.ts                  état partagé (currentSection, selectedEnv) + utilitaires (esc, fileName, dirName, shortenPath)
    components/                 boutons, inline-edit, toast, etc.
    services.ts, environments.ts, secrets.ts, templates.ts, generate.ts, welcome.ts
  app.ts                      ← orchestrateur principal (routing, nav, modals)
build/app.js                  ← bundle ESM unique (output esbuild, gitignored)
tests/                        ← *.test.ts (importent depuis src/)
main.js                       ← reste JS (CommonJS Electron main)
preload.js                    ← reste JS (CommonJS Electron preload)
```

### Règles d'architecture

- Les **models** et **services** sont des fonctions pures — pas d'état, pas d'IO, pas de DOM
- `vault.ts` est un wrapper mince : il appelle un service puis `persist()`
- Les UI importent depuis `vault.ts` pour les mutations async, et depuis `services/` ou `models/` pour la logique pure
- **Pas de logique métier dans les fichiers UI** — extraire dans `services/` ou `models/`
- **Pas de fonctions utilitaires dupliquées** — centraliser dans `ui/helpers.ts` (formatage, échappement) ou dans `models/` (validation, sanitization)
- **Types centraux** dans `src/types/vault.ts` — toujours importer les types depuis ce fichier
- **Constantes UI** (labels, couleurs, mappings) : déclarer en haut du module, pas inline dans les fonctions

## Tests

- Vitest : `npm test` (typecheck + run) / `npm run test:watch` (watch)
- Tests TypeScript dans `tests/models/` et `tests/services/`
- Tout nouveau service/model doit avoir ses tests
- `npm run typecheck` pour vérifier les types sans exécuter

## GIT

- Jamais de Co-Authored-By
- **Ne jamais push directement sur `master`** — toujours merge depuis `develop`
- Branche de travail : `develop`
- Merge vers `master` : `git checkout master && git merge develop && git push && git checkout develop`
