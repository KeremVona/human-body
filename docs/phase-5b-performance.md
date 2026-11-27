# Phase 5B Performance & Budget Measurements

**Verdict:** **Build & CPU Budgets Met — Real GPU / Mobile Frame Times Unverified (SwiftShader CPU Rendering Only)**

## Bundle & Data Budgets (P5 §10)

Measured from `npm run build` (`vite v8.3.8`, production client build):

| Measure | Budget | Measured | Status |
| --- | --- | --- | --- |
| Route build time (`buildRoute` on `digestion`, 20 runs) | `<= 30 ms` | **`2.21 ms` median**, `3.41 ms` p95 (`3.94 ms` max) | Pass |
| Lazy `JourneyPlayer` chunk | `<= 25 kB` gzip combined | `10.00 kB` raw / **`4.07 kB` gzip** | Pass |
| Lazy `JourneyBar` chunk | — | `11.25 kB` raw / **`3.36 kB` gzip** | Pass |
| Journey thunks + hash chunks | — | `7.76 kB` (`3.18 kB` gzip) + `0.56 kB` (`0.31 kB` gzip) | Pass (~`10.9 kB` gzip total) |
| Initial `index` bundle | Unchanged (lazy on start) | `193.90 kB` raw / `60.56 kB` gzip | Pass (`JourneyPlayer`/`JourneyBar` split) |
| Extra draw calls while journey plays | `<= 4` | `2` idle (`route` + `bite`), `3` peristalsis/droplets, `4` both (`journeyDrawCalls() <= 4` verified in E2E) | Pass |
| Added asset bytes (Phase 5A meshes + centerlines) | `<= 400,000 B` | **`+271,701 B`** (`+232,176 B` GLB + `39,525 B` `centerlines.2f091312.json`) | Pass |

## Frame Time During 20 s Playback (`#journey/digestion/1`)

| Environment | Frame Target | Measured (`1280×800`, 20 s playback) | Status |
| --- | --- | --- | --- |
| Chromium SwiftShader CPU WebGL (`vite preview` @ `4179`, `--use-angle=swiftshader`) | `<= 16.7 ms` p95 (laptop iGPU target) | `52` frames, `p50 = 383.4 ms`, `p95 = 416.7 ms` (`max = 583.3 ms`) | **Emulated (CPU software rasterizer), not verified on hardware** |
| Reference laptop iGPU (`?debug`) | `<= 16.7 ms` p95 | — | **Unverified** (requires hardware GPU check) |
| Mobile phone (`?debug`) | — | — | **Unverified** (requires physical phone check) |
