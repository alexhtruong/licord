# `core/` (Rust backend) — scaffold

This folder is reserved for the **Rust backend process** described in `ARCHITECTURE.md`.

## Status

Rust is **not** initialized yet on this machine (no `cargo` found). When you're ready:

1. Install Rust toolchain (Fedora):
   - `sudo dnf install rust cargo`
   - or use rustup (recommended for newer toolchains)
2. Initialize the backend:
   - `cargo new licord-core --bin` (or `cargo init --bin`)

## Intended responsibilities

- capture/session orchestration (PipeWire / portals)
- telemetry collection (cursor/events where available)
- project persistence/validation
- later: render/export orchestration

## IPC (MVP)

Electron main will spawn this process and communicate via:

- stdin/stdout
- newline-delimited JSON (NDJSON)

Example messages:

```json
{"cmd":"start_recording","payload":{}} 
```

```json
{"event":"recording_progress","elapsedMs":3200}
```

