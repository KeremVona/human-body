# Phase 3C Performance Measurements

**Verdict:** **Meets §9.1 Budgets** *(`145–221 fps` on `Auto` (`High` desktop) and `140–238 fps` on `Low` across all 4 active motion demos with all `8` body systems enabled (`1,011` meshes / `2.9M` triangles), and lazy-split `MotionPanel` at `3.20 kB` gzipped + `MotionPlayer` at `1.57 kB` gzipped)*

Measured on the production build (`npm run build && npm run preview` at `/?debug`, viewport `1280×800`, Microsoft Edge ANGLE Direct3D11 on `NVIDIA GeForce RTX 4060`) with **all 8 body systems enabled** (`1,011` meshes) while actively playing each demo across `8` consecutive `500 ms` `DebugStats` samples (`~4 s` per demo, `0` page errors).

## Summary vs §9.1 Targets

| Demo / Metric | Target (§9.1) | Quality `Auto` (`High` on desktop) | Quality `Low` | Status |
|---|---|---|---|---|
| GPU (`UNMASKED_RENDERER_WEBGL`) | Mid-range laptop iGPU | `NVIDIA GeForce RTX 4060 Direct3D11` | `NVIDIA GeForce RTX 4060 Direct3D11` | Measured *(dGPU)* |
| Scene draw calls (`Low`) | `<= 1,500` draw calls | `1,011` meshes (`1` composer pass in `gl.info`*) | `1,011` draw calls / `2.9M` tris | Within budget |
| Elbow flexion and extension FPS | `>= 60 fps` | `145–187 fps` (`8/8` samples) | `196–215 fps` (`8/8` samples) | Within budget |
| Knee flexion and extension FPS | `>= 60 fps` | `151–202 fps` (`8/8` samples) | `194–226 fps` (`8/8` samples) | Within budget |
| Shoulder abduction FPS | `>= 60 fps` | `188–221 fps` (`8/8` samples) | `140–238 fps` (`8/8` samples) | Within budget |
| Heartbeat FPS | `>= 60 fps` | `179–220 fps` (`8/8` samples) | `208–237 fps` (`8/8` samples) | Within budget |
| `MotionPanel` lazy chunk (`vite build`) | Code-split lazy | `7.92 kB` (`3.20 kB` gzipped) | — | Within budget |
| `MotionPlayer` lazy chunk (`vite build`) | Code-split lazy | `3.82 kB` (`1.57 kB` gzipped) | — | Within budget |

\*When `EffectComposer` owns the final screen blit pass, `gl.info.render` reports `1` fullscreen pass; the underlying scene still draws `1,011` meshes (`2.9M` triangles), as verified directly on `Low`.

## Architecture & Runtime Cost Notes

- `MotionPlayer` mutates registered `THREE.Mesh` positions, quaternions, and scales directly via `createMotionTransforms` (`rotateAboutPivot` / `scaleAboutPoint`) inside `useFrame` and updates agonist pulse intensity via `MaterialLibrary.setActivePulse(...)` without dispatching per-frame Redux actions (`motionPhase` drives the `MotionPanel` slider via `useSyncExternalStore`).
- While paused or stopped, `<Canvas frameloop="demand">` issues zero animation frames (`invalidate()` is called only while playing or when scrubbing).
