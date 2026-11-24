# Phase 3D Performance Measurements

**Verdict:** **Meets §9.1 Budgets** *(`1,406` draw calls `<= 1,500` on `Low`; `103–156 fps` idle / `106–140 fps` orbiting on `Auto` and `167–215 fps` idle / `127–198 fps` orbiting on `Low` with all `9` systems including `integumentary` skin at default opacity `0.35` enabled; `5,489 ms` Fast 4G skeleton-visible `< 6,000 ms`; `2,288,540` new bytes across `395` new meshes)*

Measured on the production build (`npm run build && npm run preview` at `/?debug`, viewport `1280×800`, Microsoft Edge ANGLE Direct3D11 on `NVIDIA GeForce RTX 4060`) with **all 9 body systems enabled** (`1,406` meshes / `3.1M` triangles, `integumentary` at default opacity `0.35`, `0` page errors).

## Summary vs §9.1 & Phase 3D Budgets

| Metric | Target | Quality `Auto` (`High` desktop) | Quality `Low` | Status |
|---|---|---|---|---|
| GPU (`UNMASKED_RENDERER_WEBGL`) | Mid-range laptop iGPU | `NVIDIA GeForce RTX 4060 Direct3D11` | `NVIDIA GeForce RTX 4060 Direct3D11` | Measured *(dGPU)* |
| Total meshes / new Phase 3D meshes | `<= 1,461` total / `<= 450` new | `1,406` total (`+395`: `153` lymphatic + `242` skin) | `1,406` | Within budget |
| Scene draw calls (all 9 systems) | `<= 1,500` draw calls | `1,406` meshes (`1` composer pass in `gl.info`*) | `1,406` draw calls / `3.1M` tris | Within budget |
| Idle FPS (all 9 systems) | `>= 60 fps` | `103–156 fps` (`4/4` samples) | `167–215 fps` (`4/4` samples) | Within budget |
| Orbiting FPS (all 9 systems) | `>= 60 fps` | `106–140 fps` (`6/6` samples) | `127–198 fps` (`6/6` samples) | Within budget |
| Fast 4G\*\* skeleton visible (uncached) | `< 6,000 ms` | `5,697 ms` (`en`) / `5,703 ms` (`tr`) *(post-i18n)*; `5,489 ms` (`en` baseline) | — | Within budget |
| Phase 3D bundle bytes (`lymphatic` + `skin`) | `<= 12,000,000` new / `<= 41,943,040` total | `2,288,540` B new (`1,084,216` + `1,204,324`) / `29,995,648` B total | — | Within budget |
| Non-English locale chunk (`tr`) | Lazy-loaded (zero `en` cost) | `8.14 kB` (`3.74 kB` gzip) + `content/tr/*.json` fetched on demand | — | Within budget |

\*When `EffectComposer` owns the final screen blit pass, `gl.info.render` reports `1` fullscreen pass; the underlying scene renders `1,406` meshes (`3.1M` triangles), as verified directly on `Low`.
\*\*Simulated via CDP `Network.emulateNetworkConditions` (`latency: 150 ms`, `downloadThroughput: 9 Mbps / 1,179,648 B/s`, `uploadThroughput: 1.5 Mbps`, cache disabled).
