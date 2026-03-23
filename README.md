# Licord

Modern, Linux-first screen recorder + editor (inspired by Screen Studio / Cap).

## Repo layout

- `app/`: Electron main + preload (TypeScript, compiled to `app/dist/`)
- `ui/`: React renderer (Vite)
- `core/`: Rust backend (planned; scaffold only for now)
- `shared/`: shared types/IPC constants (early placeholders)

See `ARCHITECTURE.md` for the full plan.

## Development

First-time setup:

- `npm install`
- `npm --prefix ui install`

Then run:

- `npm run dev`

Environment:

- Copy `.env.example` → `.env` to override the dev server URL if needed.

## Build

- `npm run build`
- `npm start`
