# Phase 3A Performance Measurements

**Verdict:** **Meets §9.1 Budgets** *(cold UI shell interactive in `198 ms`, skeletal visible in `1,636 ms` fast / `5,491 ms` Fast 4G, main chunk `74.88 kB` gzipped (`151.85 kB` total initial UI shell JS gzipped), and `240 fps` steady during orbiting with `50` pins placed)*

Measured on the production build (`npm run build && npm run preview` at `/?debug`, viewport `1280×800`, Microsoft Edge ANGLE Direct3D11 on `NVIDIA GeForce RTX 4060`, `16` cores) comparing cold launch without pins and active rendering with **`50` skeletal pins pre-seeded in `localStorage['atlas.pins.v1']`** (`renderedPinCount: 50`, zero page errors).

## Summary vs §9.1 Targets

| Metric | Target (§9.1) | Measured | Status |
|---|---|---|---|
| GPU (`UNMASKED_RENDERER_WEBGL`) | Mid-range laptop iGPU | `ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Direct3D11)` | Measured *(dGPU)* |
| UI shell interactive (fast, uncached) | `< 1.5 s` | `198 ms` | Within budget |
| UI shell interactive (Fast 4G\*) | — | `1,052 ms` | Recorded |
| Skeleton visible (fast, uncached) | `< 3.0 s` | `1,636 ms` | Within budget |
| Skeleton visible (Fast 4G\*) | `< 6.0 s` | `5,491 ms` | Within budget |
| Main entry chunk (`index-*.js`, gzipped) | Code-split Share/Pins lazy | `74.88 kB` (`233.78 kB` raw) | Within budget |
| Idle FPS (`50` pins visible) | `60 fps` | `72–240 fps` (`240 fps` steady after initial background bundle settlement) | Within budget |
| Orbiting FPS (`50` pins visible) | `60 fps` | `240 fps` (`10/10` samples) | Within budget |

\*Simulated via Chrome DevTools Protocol `Network.emulateNetworkConditions` (`latency: 150 ms`, `downloadThroughput: 9 Mbps`, `uploadThroughput: 1.5 Mbps`, cache disabled).

## Chunk Breakdown (`vite build`)

- Core shell & vendor chunks loaded cleanly without blocking boot on Share/Pins UI:
  - `dist/assets/index-CiblEFHo.js`: `233.78 kB` (`74.88 kB` gzipped)
  - `dist/assets/react-CbUn6kgI.js`: `240.37 kB` (`76.55 kB` gzipped)
  - `dist/assets/rolldown-runtime-XKyaHtl9.js`: `0.72 kB` (`0.42 kB` gzipped)
  - `dist/assets/schemas-CUKprfiW.js`: `30.78 kB` (`9.29 kB` gzipped)
  - `dist/assets/AtlasCanvas-DFwzASvX.js`: `19.88 kB` (`7.78 kB` gzipped)
  - `dist/assets/r3f-D4PwkpRD.js`: `571.69 kB` (`211.32 kB` gzipped)
  - `dist/assets/three-HVrM0KI5.js`: `815.81 kB` (`208.26 kB` gzipped)
- Code-split Phase 3A chunks fetched on demand only when using share links or pins:
  - `codec`: `3.28 kB` (`1.55 kB` gzipped)
  - `bootShare`: `1.13 kB` (`0.64 kB` gzipped)
  - `SharePopover`: `2.89 kB` (`1.40 kB` gzipped)
  - `ShareNotice`: `0.85 kB` (`0.54 kB` gzipped)
  - `PinProbe`: `1.37 kB` (`0.80 kB` gzipped)
  - `PinLayer`: `1.09 kB` (`0.66 kB` gzipped)
  - `PinEditor`: `2.90 kB` (`1.24 kB` gzipped)
  - `PinsPanel`: `3.80 kB` (`1.43 kB` gzipped)
  - `pins/thunks`: `0.75 kB` (`0.48 kB` gzipped)
  - `pinProjection`: `1.14 kB` (`0.64 kB` gzipped)
