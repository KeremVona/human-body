# Phase 4C Performance Measurements

**Verdict:** **Desktop & Emulated Fast 4G Budgets Met — Physical Phone Gate Unverified**  
Cold Fast 4G boot timings (`1,404 ms` median first view vs `< 3,000 ms` budget; `5,630 ms` median interactive skeleton vs `< 6,500 ms` budget) stay squarely within budget, and active guided tour playback (`How the heart beats` step 2: live coronal cross-section + heartbeat motion on `Auto`) holds a steady **`60 fps` (`151/151` frames, `0` drops under 60 Hz vsync)** on desktop ANGLE Direct3D11 (`NVIDIA GeForce RTX 4060`). Physical mobile device testing remains unverified until measured on hardware.

## Bundle Footprint & Lazy-Loading Check (`npm run build`)

Comparing the Phase 4C production build against Phase 4B (`e04b4ff`, measured identically via `tsc -b && vite build`):

| Chunk / Asset | Phase 4B (`e04b4ff`) | Phase 4C (`HEAD`) | Delta | Notes |
|---|---|---|---|---|
| Main entry (`index-*.js`) | `249.58 kB` (`80.19 kB` gzip) | `254.32 kB` (`81.60 kB` gzip) | `+4.74 kB` (`+1.41 kB` gzip) | Reflects `tourSlice` reducer, `14` EN label keys, `Tours` TopBar trigger, and `ArrowLeft`/`ArrowRight` shortcut wiring (`ToursDialog`, `TourBar`, `tours/thunks`, `tourHash`, and tour JSON stay outside main bundle). |
| `ToursDialog-*.js` (lazy) | — | `3.33 kB` (`1.38 kB` gzip) | New lazy chunk | Loaded only when opening **Tours**. |
| `TourBar-*.js` (lazy) | — | `2.36 kB` (`0.93 kB` gzip) | New lazy chunk | Loaded only while a tour is active. |
| Tours thunks (`thunks-*.js`, lazy) | — | `3.18 kB` (`1.56 kB` gzip) | New lazy chunk | Fetches `content/tours.json` + `content/<locale>/tours.json` on first use. |
| `tourHash-*.js` (lazy) | — | `0.23 kB` (`0.20 kB` gzip) | New lazy chunk | Loaded via `bootShare` (`#tour/` links) or `SharePopover`. |
| Vite PWA precache shell | `46` entries (`2,078.89 KiB`) | `52` entries (`2,096.80 KiB`) | `+6` entries (`+17.91 KiB`) | Includes lazy tour chunks; `content/tours.json` and `content/{en,tr}/tours.json` are cached in `atlas-content` (`StaleWhileRevalidate`) and included in `offlineUrls()`. |

## Runtime Measurements (`vite preview`, `1280×800`, Playwright)

| Measurement | Condition | Result | Notes |
|---|---|---|---|
| `atlas:first-view` (Fast 4G cold, cache off) | `9 Mbps` down / `1.5 Mbps` up / `60 ms` RTT, `3` runs | **`1,404 ms` median** (`1578, 1404, 1393`) | Under `< 3,000 ms` budget (`uncompressed` Vite preview HTTP). |
| `atlas:interactive-skeleton` (Fast 4G cold, cache off) | Same `3` Fast 4G runs | **`5,630 ms` median** (`5682, 5621, 5630`) | Under `< 6,500 ms` budget. |
| Heartbeat tour step 2 FPS (`How the heart beats`, coronal clip + `heartbeat` on `Auto`) | ANGLE D3D11 (`NVIDIA GeForce RTX 4060`) | **`60 fps` avg / `60 fps` min / `60 fps` p95** (`151` frames / `2.5 s`) | Zero dropped frames against 60 Hz browser vsync. |
| Heartbeat tour step 2 FPS (CI software fallback) | Chromium `--use-angle=swiftshader` | `3 fps` (`7` frames / `2.7 s`) | Expected CPU-rasterizer floor when running N8AO post-processing without a GPU. |
| Physical mobile phone (`Fast 4G` + tour gestures) | Real device hardware | **Unverified** | Emulated desktop & `Pixel 7` Chromium checks pass; real phone hardware not yet tested. |
