# Victory's Secrets (vsv)

Encrypted secrets manager — desktop app (Electron) + CLI/SDK (`packages/vsv`). Manages per-service, per-environment secrets in a single `.vsv` vault file with zero-knowledge encryption.

# Guidelines

## Stack

- TypeScript strict, AES-256-GCM + Argon2id encryption, esbuild, Vitest

## Monorepo structure

### `packages/electron` — Desktop app (Electron)

- Main/preload in CommonJS, renderer in ESM
- Tailwind v4: `npm run css` / `npm run css:watch`
- Build: `npm run build:ts` (`src/app.ts` → `build/app.js`)
- UI: `renderX()` (HTML string) + `bindX(render)` (event handlers)
- **No business logic in UI files** — extract into `services/` or `models/`
- **No duplicated utilities** — centralize in `ui/helpers.ts` or `models/`

### `packages/vsv` — CLI + SDK (Node.js)

- Build: `npm run build`
- Tests: `npm test` / `npm run test:watch`
- Every new service/model must have tests

### Shared architecture (both packages)

- **Models** and **services** are pure functions — no state, no IO, no DOM
- `vault.ts` is a thin wrapper: calls a service then `persist()`
- **Central types** in `src/types/vault.ts` — always import types from there
- Security is the top priority — never weaken crypto, validation, or isolation

## Git

- No Co-Authored-By
- **Never push directly to `master`** — always merge from `develop`
