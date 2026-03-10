
# Guidelines

## Sécurité

La sécurité est une priorité absolue de l'app.

- **Chiffrement** : AES-256-GCM + Argon2id (256MB, 3 itérations, parallélisme 4)
- **Mot de passe jamais stocké** : seule la `CryptoKey` non-extractable (Web Crypto API) est conservée en mémoire — le password est oublié après dérivation
- **Secrets jamais dans le DOM** : les valeurs sensibles sont stockées dans un `Map` JS, jamais dans des attributs `data-*`
- **Clipboard auto-clear** : le presse-papier est nettoyé 10s après copie d'un secret
- **Auto-lock** : verrouillage automatique après 10 min d'inactivité, efface `CryptoKey` + données

## UI

- Utiliser Tailwind
- Vanilla JS — composants `renderX()` (HTML string) + `bindX(render)` (event handlers)
- Formulaires inline via `startInlineEdit(container, { rows, onSave, onCancel, onInput, onReady })`

## Architecture

```
js/
  models/                     ← données pures, aucun side effect
    vault-schema.js             structure vault + ensureStructure
    validators.js               sanitizeId, labelToId, validate*
    template-refactor.js        refactoring refs ${service.field} dans templates
  services/                   ← logique métier pure (data in → data out)
    service-ops.js              CRUD services + cleanup secrets/templates
    environment-ops.js          CRUD environnements
    secret-ops.js               CRUD secrets + move avec refactoring
    template-ops.js             CRUD templates + parseEnvFile + buildServiceFieldTree
    env-generator.js            resolveSecrets + generateEnv
    search.js                   buildSearchIndex + filterSearch
  vault.js                    ← orchestrateur stateful (état + crypto/storage + délègue aux services)
  crypto.js                   ← AES-256-GCM + Argon2id via IPC
  storage.js                  ← file handles via Electron API
  autolock.js                 ← timer inactivité
  generator.js                ← génération mots de passe (utilitaire crypto, pas logique métier)
  ui/                         ← composants UI (render + bind)
    helpers.js                  état partagé (currentSection, selectedEnv) + utilitaires (esc, fileName, dirName, shortenPath)
    components/                 boutons, inline-edit, toast, etc.
    services.js, environments.js, secrets.js, templates.js, generate.js, welcome.js
  app.js                      ← orchestrateur principal (routing, nav, modals)
```

### Règles d'architecture

- Les **models** et **services** sont des fonctions pures — pas d'état, pas d'IO, pas de DOM
- `vault.js` est un wrapper mince : il appelle un service puis `persist()`
- Les UI importent depuis `vault.js` pour les mutations async, et depuis `services/` ou `models/` pour la logique pure
- **Pas de logique métier dans les fichiers UI** — extraire dans `services/` ou `models/`
- **Pas de fonctions utilitaires dupliquées** — centraliser dans `ui/helpers.js` (formatage, échappement) ou dans `models/` (validation, sanitization)
- **Constantes UI** (labels, couleurs, mappings) : déclarer en haut du module, pas inline dans les fonctions

## Tests

- Vitest : `npm test` (run) / `npm run test:watch` (watch)
- Tests dans `tests/models/` et `tests/services/`
- Tout nouveau service/model doit avoir ses tests

## GIT

- Jamais de Co-Authored-By
