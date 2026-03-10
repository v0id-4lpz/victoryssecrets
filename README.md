# Victory's Secrets

Local secrets & environment config manager. Built with Electron.

## Features

- **AES-256-GCM + Argon2id** encryption (256MB memory, 3 iterations)
- **Password never stored** — only a non-extractable CryptoKey is kept in memory
- **Secrets never in the DOM** — values stored in a JS Map, not in HTML attributes
- **Clipboard auto-clear** after 10 seconds
- **Auto-lock** after inactivity (configurable)
- **Privacy overlay** when the window loses focus
- **Strict CSP** — `script-src 'self'`, no external scripts
- **.env generator** with templates and per-environment overrides
- **Update checker** — notifies when a new release is available

## Getting started

```bash
npm ci
npm start
```

## Development

```bash
npm run dev          # Start with DevTools
npm run css:watch    # Watch Tailwind changes
npm test             # Run tests
```

## Build

```bash
npm run build        # All platforms
npm run build:mac    # macOS (dmg + zip)
npm run build:win    # Windows (nsis + portable)
npm run build:linux  # Linux (AppImage + tar.gz)
```

## License

ISC
