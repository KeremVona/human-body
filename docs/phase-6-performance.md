# Phase 6 Performance & Budget Measurements

**Verdict:** **Build, Chunk, CPU & Batched Draw-Call Budgets Met — Hardware GPU & Physical Phone Frame Times Unverified (SwiftShader CPU Rendering Only)**

## Bundle, Pipeline & Route Budgets (P6 §6–§7)

Measured from `npm run build` (`vite v8.3.8`, production client build) and `pipeline/src/`:

| Measure | Budget | Measured | Status |
| --- | --- | --- | --- |
| `JourneyBar` + close-ups chunk | — | `25.14 kB` raw / **`5.75 kB` gzip** | Pass |
| `JourneyPlayer` chunk | — | `11.46 kB` raw / **`4.50 kB` gzip** | Pass |
| Journey `route` + `thunks` + `hash` chunks | — | `1.47 kB` + `4.11 kB` + `0.31 kB` gzip | Pass |
| Combined lazy Journey chunks | `<= 30 kB` gzip | **`16.14 kB` gzip** total | Pass |
| Initial `index` bundle | Unchanged (lazy on start) | `191.21 kB` raw / `59.37 kB` gzip | Pass |
| Close-up SVG source size | `<= 6 kB` each | `3,583 B` (`Capillary`), `3,161 B` (`LungCapillary`), `2,989 B` (`Alveolus`) | Pass |
| Centerlines file (`centerlines.81d77e72.json`, 30 lines) | `<= 120,000 B` | **`83,210 B`** | Pass |
| Added meshes (`intermediate-bronchus`, `nasal-cavity-lining`) | `<= 150,000 B` | **`+62,848 B`** | Pass |
| `buildRoute` CPU time (20 runs, Node) | `<= 30 ms` | **`blood` `2.45 ms` median (`5.00 ms` p95)**; **`breath` `1.88 ms` median (`2.36 ms` p95)** | Pass |

## Draw Calls & 20 s Playback Frame Time

Measured in headless Chromium (`1280×800`, `--use-gl=angle --use-angle=swiftshader`):

| Environment / Stage | Budget | Measured | Status |
| --- | --- | --- | --- |
| `#journey/blood/8` (`left-heart`, batched) | `<= 200` total / `<= 4` journey | **`24` total** (`4` batches + `20` promoted heart/valve meshes), **`2` journey draw calls** | Pass |
| `#journey/breath/6` (`alveoli`, batched) | `<= 200` total / `<= 4` journey | **`12` total** (`6` batches + `6` promoted lung/diaphragm meshes), **`2` journey draw calls** | Pass |
| `#journey/blood/1` 20 s playback (`vite preview` @ `4179`) | `<= 16.7 ms` p95 (iGPU target) | `98` frames, `p50 = 183.3 ms`, `p95 = 350.0 ms` (`max = 533.3 ms`) | **Emulated (CPU SwiftShader), not verified on hardware** |
| `#journey/breath/1` 20 s playback (`vite preview` @ `4179`) | `<= 16.7 ms` p95 (iGPU target) | `73` frames, `p50 = 266.7 ms`, `p95 = 283.4 ms` (`max = 1100.0 ms`) | **Emulated (CPU SwiftShader), not verified on hardware** |
| Reference laptop iGPU (`?debug`) | `<= 16.7 ms` p95 | — | **Unverified** (requires hardware GPU run) |
| Physical phone (`?debug`) | — | — | **Unverified** (requires physical phone run) |
