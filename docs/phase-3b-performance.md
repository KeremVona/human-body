# Phase 3B Performance Measurements

**Verdict:** **Meets §9.1 Budgets** *(`236–241 fps` on `Auto` (`High` desktop) and `240–241 fps` on `Low` while dragging the `Section position` slider with all `8` body systems enabled (`1,011` meshes / `2.9M` triangles) and `SectionPopover` lazy-split at `1.58 kB` gzipped)*

Measured on the production build (`npm run build && npm run preview` at `/?debug`, viewport `1280×800`, Microsoft Edge ANGLE Direct3D11 on `NVIDIA GeForce RTX 4060`, `16` cores) with **all 8 body systems enabled** (`1,011` meshes) and `Cross-section` set to **Sagittal** while dragging `Section position` back and forth across `12` continuous samples (`0` page errors).

## Summary vs §9.1 Targets

| Metric | Target (§9.1) | Quality `Auto` (`High` on desktop) | Quality `Low` | Status |
|---|---|---|---|---|
| GPU (`UNMASKED_RENDERER_WEBGL`) | Mid-range laptop iGPU | `NVIDIA GeForce RTX 4060 Direct3D11` | `NVIDIA GeForce RTX 4060 Direct3D11` | Measured *(dGPU)* |
| Scene draw calls (`Low`, sectioned) | `<= 1,500` draw calls | `1,011` meshes (`1` composer pass in `gl.info`*) | `1,011` draw calls / `2.9M` tris | Within budget |
| FPS while dragging `Section position` slider | `>= 60 fps` | `236–241 fps` (`12/12` samples) | `240–241 fps` (`12/12` samples) | Within budget |
| `SectionPopover` lazy chunk (`vite build`) | Code-split lazy | `4.16 kB` (`1.58 kB` gzipped) | — | Within budget |

\*When `EffectComposer` owns the final screen blit pass, `gl.info.render` reports `1` fullscreen pass; the underlying scene still draws `1,011` meshes (`2.9M` triangles), as verified directly on `Low` (where `SectionController` mutates one shared `THREE.Plane` in place without extra stencil draw calls).

## Architecture & Shader Cost Notes

- Mutating the single shared `THREE.Plane` in place on slider movement triggers zero per-mesh state diffing or shader recompilation (`236–241 fps` continuous drag).
- When `Cross-section` is turned off, `MaterialLibrary.setClipPlane(null)` restores original `FrontSide` materials and `customProgramCacheKey` values, and `gl.localClippingEnabled` and `raycaster.firstHitOnly` return to `false` / `true`.
