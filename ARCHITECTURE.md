# Linux-First Demo Recorder: Architecture Brief

## Goal
Build a **Screen Studio / Cap / Screenix / Recordly-style** desktop app focused on **Linux-first quality** while still optimizing for **fast learning and shipping**.

The core UX target is not just generic screen recording. The product should eventually support:

- polished capture workflow
- clean recording HUD
- smooth cursor rendering
- zoom/pan camera motion
- cinematic cursor-follow behavior
- deterministic preview/export
- timeline-based editing
- modern visual styling

The current strategic conclusion is:

> Start with **Electron for the shell/UI**, but architect the system so that the **important logic lives outside Electron** in a backend that can evolve toward more native Linux quality.

---

## Current Product/Tech Conclusions

### What matters most
The product will succeed or fail based on:

1. **capture quality**
2. **cursor/input telemetry**
3. **motion engine / auto-zoom / camera path quality**
4. **render/export pipeline**
5. **Linux-native capture behavior**

The desktop shell choice matters, but it is **not** the main product moat.

### Why not pure Electron for everything
A pure Electron monolith is attractive for speed, but it will likely hit ceilings around:

- cursor hiding/control during capture
- Linux-native capture fidelity
- renderer determinism
- long-term maintainability of media/render logic

Electron/Chromium capture paths are also known to have limitations around cursor handling. For this category of app, that matters because a polished product often wants to **hide the real cursor** and **re-render a synthetic cursor** with smoothing, click animations, motion blur, shadows, etc.

### Why not full Rust/wgpu from day one
A fully native Rust + wgpu app is likely a stronger long-term ceiling, but it dramatically increases initial complexity:

- graphics/render loop ownership
- GPU/shader work
- more difficult UI iteration
- slower time-to-MVP

Conclusion:

> Use a **hybrid architecture** as the direction, but implement it in stages.

---

# Final Architectural Direction

## Summary
Use:

- **Electron** for shell/window management and fast UI iteration
- **React + TypeScript** for the editor/HUD/source-picker UI
- **Rust backend process** for capture/session orchestration and other native/media-critical logic
- **wgpu-based render core later** for higher-end preview/export rendering and deterministic composition

This is intentionally designed so Electron is **replaceable later** if needed.

---

# High-Level Architecture

```text
+------------------------------------------------------+
|                  Electron App Shell                  |
|------------------------------------------------------|
| React UI                                             |
| - source picker                                      |
| - floating recording HUD                             |
| - editor timeline                                    |
| - inspector/settings                                 |
|                                                      |
| Electron Main                                        |
| - window lifecycle                                   |
| - menus/dialogs                                      |
| - preload bridge                                     |
| - IPC bridge                                         |
+--------------------------+---------------------------+
                           |
                           | IPC / commands / events
                           v
+------------------------------------------------------+
|                Rust Core Orchestrator                |
|------------------------------------------------------|
| session manager                                      |
| project manager                                      |
| capture controller                                   |
| telemetry controller                                 |
| preview/render controller                            |
| export controller                                    |
+-----------+---------------+---------------+----------+
            |               |               |
            v               v               v
+----------------+  +----------------+  +----------------------+
| Capture Engine |  | Telemetry Core |  | Render / Export Core |
|----------------|  |----------------|  |----------------------|
| PipeWire/X11   |  | cursor path    |  | wgpu preview         |
| audio capture  |  | clicks/scroll  |  | scene graph          |
| source enum    |  | timestamps     |  | zoom/camera engine   |
| timestamps     |  | cursor shape   |  | synthetic cursor     |
+----------------+  +----------------+  | FFmpeg/video encode  |
                                        +----------------------+
```

---

# Core Design Principles

## 1. Electron is the shell, not the brain
Electron should handle:

- app windows
- menus
- file dialogs
- preload bridge
- UI shell
- forwarding commands/events

Electron should **not** own:

- screen/audio capture
- cursor smoothing logic
- timeline/project truth
- export renderer
- motion engine

## 2. Project model is the source of truth
The app should not treat a session as “just a video file.” It should treat a session as a **project** containing:

- raw media assets
- telemetry
- timeline edits
- zoom/camera data
- visual settings
- export settings

## 3. Telemetry is first-class
A polished recorder is not just pixel capture. It also records:

- cursor movement over time
- clicks
- scrolls
- cursor shape changes
- source/window changes
- timestamps for synchronization

This is what enables synthetic cursor rendering, smart zooming, and smoother visual polish.

## 4. Preview and export should share as much render logic as possible
Avoid having a cheap preview path and a completely separate export path. That creates consistency bugs.

## 5. Shell should be replaceable later
If the backend, project model, and render engine are kept shell-agnostic, the app can migrate later toward:

- Tauri
- a more native shell
- a full native app

without rewriting the entire product.

---

# Why Electron First

## Reasons to start with Electron
- fastest path to a usable MVP
- easiest iteration for complex UI/editor workflow
- predictable frontend stack with React/TypeScript
- easier debugging and tooling
- easier to learn the product constraints quickly

## Why Electron is not the full long-term answer
Electron itself does not solve:

- Linux-native capture fidelity
- cursor suppression/control limitations
- deterministic rendering
- native media integration needs

So the decision is:

> **Use Electron first for speed, but avoid building an Electron-only monolith.**

---

# Why Rust Exists in the Architecture

Rust is introduced for the parts where native/system/media control matters most.

## Backend responsibilities that fit Rust well
- screen capture orchestration
- audio capture orchestration
- Linux-specific integrations (PipeWire, X11, portals)
- cursor/input telemetry handling
- project persistence/validation
- later: render/export core

## Why not Node-only
A Node-only backend is fast initially, but weaker for:

- system integration
- performance-sensitive pipelines
- future native backend evolution

Rust also creates a clean path toward a later **native renderer** or **Linux-first high-performance core**.

---

# How Electron Communicates With Rust

A key clarification:

> Electron’s built-in IPC only covers **renderer <-> Electron main**.

It does **not** directly communicate with Rust.

## Communication model
Use a two-step bridge:

```text
React renderer
  -> preload API
  -> Electron main (ipcMain / ipcRenderer)
  -> Rust backend process
```

## Recommended MVP transport
Spawn the Rust backend as a **child process** from Electron main and communicate through:

- `stdin`
- `stdout`
- newline-delimited JSON messages

That means:

1. Renderer calls an exposed preload API
2. Electron main receives the request
3. Electron main writes a JSON command to Rust
4. Rust processes it and sends JSON results/events back
5. Electron main forwards results/events to the renderer

This gives:

- crash isolation
- clean backend boundary
- easy logging/debugging
- future shell portability

## Example flow
User clicks **Start Recording**:

1. React calls `window.app.startRecording(config)`
2. Preload forwards to Electron main
3. Electron main writes a command to Rust:

```json
{"cmd":"start_recording","payload":{...}}
```

4. Rust starts capture and emits events like:

```json
{"event":"recording_progress","elapsedMs":3200}
```

5. Electron main forwards that to the HUD/editor UI

---

# Major Subsystems

## 1. Electron Shell

### Responsibilities
- create and manage windows
- source picker window
- floating recording HUD
- main editor window
- app menus
- preload APIs
- command/event forwarding

### Likely windows
- **Main editor**
- **Recording HUD**
- **Source picker**
- maybe later: **transparent overlay window**

---

## 2. Rust Core Orchestrator

This is the control plane of the backend.

### Responsibilities
- manage recording sessions
- coordinate capture + telemetry startup/shutdown
- create/open/save projects
- answer preview requests
- manage exports
- send events back to UI

### Example commands
- `list_sources()`
- `start_recording(config)`
- `stop_recording()`
- `open_project(path)`
- `save_project(path)`
- `patch_project(...)`
- `request_preview_frame(time)`
- `export_project(config)`

### Example events
- `recording_started`
- `recording_progress`
- `recording_stopped`
- `project_updated`
- `preview_ready`
- `export_progress`
- `export_complete`
- `error`

---

## 3. Capture Engine

### Responsibilities
- enumerate displays/windows/sources
- start/stop screen capture
- start/stop mic and possibly system audio capture
- handle timestamps
- write raw media assets

### Linux-specific backends
Likely backend split:

- **Wayland**: PipeWire + portal path
- **X11**: dedicated X11 capture path
- audio handled separately but synchronized

### Recording outputs
A session should produce something like:

```text
/session-123/
  screen.mp4
  mic.wav
  system.wav
  telemetry.jsonl
  session.json
  thumbnails/
```

Format may evolve, but the idea is that the recording generates both **media** and **metadata**.

---

## 4. Telemetry Core

This is crucial for polish.

### Responsibilities
- timestamped cursor position stream
- mouse click events
- scroll events
- cursor shape changes
- focus/source changes if needed

### Why it matters
This enables:

- synthetic cursor
- cursor smoothing
- click bounce/ripple effects
- motion blur
- smart auto-zoom suggestions
- cursor-follow camera logic

### Example event stream
```text
CursorMoved { t, x, y }
MouseDown   { t, button }
MouseUp     { t, button }
Scroll      { t, dx, dy }
CursorShape { t, kind }
FocusChange { t, source_id }
```

### Storage suggestion
For MVP, store telemetry in **JSONL** because it is easy to inspect and debug.

---

## 5. Project Model

The project model is the canonical representation of an edited session.

### Contents
- metadata
- raw asset references
- timeline data
- trims
- zoom segments
- cursor style/effect settings
- annotations
- background/frame style
- export settings

### Conceptual shape
```text
Project
  metadata
  assets[]
  timeline
  export_settings
```

### More detailed version
```text
Project
  id
  version
  created_at
  assets:
    screen_video
    mic_audio
    system_audio
    telemetry
  timeline:
    duration
    trims
    zoom_segments[]
    annotations[]
    cursor_effects
    background_style
  export:
    aspect_ratio
    resolution
    fps
    codec
```

### Important requirement
The project format should be **shell-agnostic** and versioned.

---

## 6. Timeline / Editor State Split

### Frontend owns
- selection state
- drag interactions
- panel visibility
- temporary UI state

### Backend/project engine owns
- canonical project data
- validation
- serialization
- render-relevant edit state

This keeps the UI responsive without letting it become the source of truth.

---

## 7. Render Engine (later, with wgpu)

This is the premium rendering layer and likely long-term differentiator.

### Responsibilities
At time `t`, render a frame from:

- screen video texture
- camera transform
- synthetic cursor
- annotations
- background/frame styling
- optional later webcam overlay

### Core frame pipeline
```text
decode source frame at time t
-> apply crop/fit/padding
-> apply virtual camera transform
-> composite synthetic cursor
-> apply cursor effects
-> composite overlays/annotations
-> output frame
```

### Internal render layers
- `BackgroundLayer`
- `ScreenLayer`
- `CursorLayer`
- `AnnotationLayer`
- `CameraOverlayLayer`

### Why wgpu
A custom GPU-based renderer gives:

- smooth preview performance
- deterministic composition
- shared preview/export code
- better ceiling for effects and polish

### Important caveat
This is **not** day-one MVP scope. It is part of the hybrid direction, but should be added when the simpler architecture proves itself.

---

## 8. Motion / Camera Engine

This is the “cinematic” part of the app.

### Responsibilities
Convert user edits and/or telemetry into virtual camera motion:

- smooth cursor-follow motion
- click-centered zooms
- safe margins so the point of focus is comfortably framed
- easing/hysteresis to avoid jittery motion
- later: smart auto-generated zoom suggestions

### Suggested output
A timeline of camera states or keyframes, such as:

```text
CameraKeyframe { t, center_x, center_y, zoom }
```

or a segment-based interpolation model.

### Suggested modules
```text
motion/
  smoothing.rs
  click_detection.rs
  camera_path.rs
  easing.rs
  auto_zoom.rs
```

This is a key product-quality subsystem.

---

## 9. Synthetic Cursor Engine

This should be independent from raw capture.

### Responsibilities
- read telemetry
- compute cursor visual state at time `t`
- choose cursor sprite/type/theme
- apply smoothing
- apply click scale/ripple effects
- apply shadow and motion blur
- align cursor hotspot correctly

### Output
At time `t`, produce something like:

```text
CursorVisualState {
  x, y,
  scale,
  opacity,
  sprite_kind,
  click_phase,
  blur_amount
}
```

### Why separate it
It keeps cursor polish modular and allows later experimentation with:

- themed cursors
- larger demo cursors
- cursor highlight rings
- text beam / resize state changes

---

## 10. Preview System

Preview should reuse as much of the final render logic as possible.

### Goal
Avoid this situation:

```text
preview path != export path
```

because it causes mismatches and bugs.

### Preview strategy
- same scene graph / compositing model
- possibly lower resolution for interactivity
- same transforms and layer logic

---

## 11. Export Pipeline

### Responsibilities
- iterate timeline over frames
- render each frame
- encode video
- mix/sync audio
- mux final output

### Suggested modules
```text
export/
  planner.rs
  renderer.rs
  audio_mix.rs
  encoder.rs
  mux.rs
```

### Flow
```text
Project
-> export planner
-> per-frame render jobs
-> audio alignment/mixing
-> encoder
-> mux
-> final mp4
```

### Initial recommendation
Use **FFmpeg** first for reliability. Hardware acceleration can come later.

---

# Process Model Recommendation

## MVP process model
```text
Electron main
Electron renderer(s)
Rust backend process
```

That is enough for initial development.

## Longer-term evolution
```text
Electron
  -> Rust app backend
      -> capture worker
      -> export worker
```

This helps with isolation:

- capture can crash without killing editor
- export can run independently
- long tasks do not block control flow

---

# Suggested Repo Structure

```text
/apps
  /desktop
    /electron
      main/
      preload/
      renderer/
        src/
          components/
          features/
          pages/
          state/

/crates
  /app-core
    src/
      commands/
      events/
      session/
      project/
      timeline/
      motion/

  /capture-core
    src/
      sources/
      pipewire/
      x11/
      audio/
      recorder/

  /telemetry-core
    src/
      cursor/
      clicks/
      scroll/
      events/

  /render-core
    src/
      scene/
      layers/
      cursor/
      camera/
      preview/
      shaders/

  /export-core
    src/
      planner/
      render_jobs/
      audio/
      encoder/
      mux/

  /project-schema
    src/
      lib.rs

/shared
  types/
  protocol/
```

This structure is just a sketch, but it reflects the desired boundaries.

---

# IPC / Protocol Design

Use a stable typed protocol between Electron and Rust.

## Commands
- `GetSources`
- `StartRecording`
- `StopRecording`
- `PauseRecording`
- `OpenProject`
- `SaveProject`
- `PatchProject`
- `GetPreviewFrame`
- `ExportProject`
- `CancelExport`

## Events
- `SourcesUpdated`
- `RecordingStateChanged`
- `SessionProgress`
- `ProjectPatched`
- `PreviewFrameReady`
- `ExportProgress`
- `ExportFinished`
- `BackendError`

### MVP transport recommendation
- newline-delimited JSON messages over `stdin/stdout`

### Why this is good initially
- easy to inspect
- easy to log
- easy to debug
- transport can be replaced later if needed

---

# MVP Scope Recommendation

The hybrid direction is correct, but the initial implementation should be narrow.

## What the first MVP should include
- Electron shell
- React/TypeScript UI
- Rust child process backend
- start/stop screen recording
- source enumeration
- session folder creation
- raw media + metadata persistence
- open/reopen project
- basic export path

## What should come soon after
- cursor telemetry
- synthetic cursor in export
- simple trims
- manual zoom regions

## What should wait until later
- full wgpu renderer
- auto-zoom intelligence
- sophisticated cursor effects
- advanced timeline/editor UX
- webcam bubble/compositing
- deep annotation system

### Important staging principle
The app should first prove:

1. capture works
2. Electron <-> Rust communication works
3. project model works
4. export works

Only after that should the more ambitious renderer/motion systems become priorities.

---

# Recommended Development Path

## Stage 0: Research / reverse engineering
Study OpenScreen and Recordly primarily as **reference implementations**, not necessarily as foundations.

Goal:
- understand recording flow
- understand project/timeline ideas
- understand export structure

## Stage 1: Foundational MVP
Build:
- Electron shell
- Rust backend process
- screen capture orchestration
- session/project persistence
- basic export

## Stage 2: Interaction-aware editing
Add:
- cursor telemetry
- simple timeline trims
- manual zoom segments
- synthetic cursor in export

## Stage 3: Polish / rendering evolution
Add:
- shared preview/export render logic
- wgpu renderer
- smoother camera/cursor systems
- better Linux-native quality paths

## Stage 4: Optional future shell reevaluation
Only after the important logic is modular and native enough, reevaluate whether Electron remains the right shell.

Possible later options:
- keep Electron
- migrate to Tauri
- move further native

---

# Decisions Already Reached

## 1. Hybrid is the right direction
Yes, the architecture should be hybrid.

## 2. Full hybrid should not all land in the first sprint
The long-term architecture is hybrid, but the first iteration should be minimal and prove the core boundaries.

## 3. Electron should be used first
Because learning + shipping speed matters slightly more right now.

## 4. Linux-native quality will come from backend/render work, not from shell choice alone
The real quality gains will come from:
- native capture quality
- telemetry fidelity
- motion engine quality
- renderer/export determinism

## 5. wgpu is promising, but later
A custom renderer is likely a strong long-term differentiator, but not the first thing to build.

---

# Final Strategic Statement

The chosen strategy is:

> **Use Electron first to learn and ship, but keep it on the surface.**
>
> Put the real product value into a Rust backend, a project-centric data model, interaction telemetry, and later a custom render/export core.

In practical terms:

- **Electron** is for UX speed
- **Rust** is for native/media control
- **wgpu later** is for premium rendering quality

This gives the project the best shot at both:

- actually shipping
- and eventually becoming a serious Linux-native competitor in this category
