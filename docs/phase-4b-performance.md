# Phase 4B Performance Measurements

**Verdict:** **Emulated Budgets Met — Physical Phone Gate Unverified (Playwright CDP Throttling)**  
All automated Phase 4B checks and emulated Fast 4G benchmarks pass cleanly (`1,445 ms` median first view vs `< 3,000 ms` budget; `5,817 ms` median interactive skeleton vs `< 6,500 ms` budget; `947 ms` warm Service Worker repeat visit vs `< 1,500 ms` budget). Physical phone verification remains unverified until measured on real mobile hardware via `?debug`.

Measured on the production build (`npm run build && vite preview`, viewport `1280×800`, Playwright Chromium with `--use-angle=swiftshader --enable-unsafe-swiftshader`). Note that `vite preview` serves assets uncompressed (`2,078 KiB` precache shell, `490,452`-byte preview GLB, `4,701,748`-byte skeletal GLB) without HTTP gzip/Brotli, making these wire timings conservative compared to compressed CDN/GitHub Pages hosting.

## Preview Bundle & Precache Footprint

| Asset Group | Raw Size | Compressed / Budget | Notes |
| --- | --- | --- | --- |
| `skeletal-preview.7b4156d0.glb` | `490,452 B` (`~479 KiB`) | `387,208 B` gzipped / `<= 600,000 B` budget | Single merged, Meshopt-quantized mesh (`20,136` triangles, `ratio: 0.03`, `error: 0.02`); `< 4 px` silhouette swap alignment verified in `e2e/first-view.spec.ts`. |
| `skeletal.6c6d593d.glb` | `4,701,748 B` (`263` meshes) | Sequenced after preview | `startPreloads()` awaits `skeletal-preview` before queuing `skeletal`. |
| Vite PWA precache shell | `46` entries (`2,078.05 KiB`) | App shell only | Excludes `models/**` and `content/**`; runtime-cached in `atlas-models` (`CacheFirst`) and `atlas-content` (`StaleWhileRevalidate`) with `ignoreVary: true`. |
| Full opt-in offline download | `30,486,100 B` models (`29 MB` rounded) + `20` content JSONs | Quota pre-checked | Triggered manually in `Settings → Offline access`. |

## First View & Warm Repeat Timings (`performance.mark`)

| Condition (5 Cold Runs / Repeat SW Visit) | Budget | `atlas:first-view` | `atlas:interactive-skeleton` | Status |
| --- | --- | --- | --- | --- |
| Fast 4G cold (`9 Mbps` down, `1.5 Mbps` up, `60 ms` RTT, cache disabled) | `< 3,000 ms` / `< 6,500 ms` | **`1,445 ms` median** (`1435, 1440, 1445, 1458, 1701`) | **`5,817 ms` median** (`5797, 5808, 5817, 5847, 6138`) | Pass (emulated) |
| Slow 4G / Fast 3G (`1.6 Mbps` down, `750 Kbps` up, `150 ms` RTT, cache disabled) | Informational | `7,472 ms` median (`7421, 7442, 7472, 7475, 7480`) | `29,240 ms` median (`29231, 29240, 29240, 29330, 29395`) | `~3.9×` earlier preview |
| Warm Service Worker repeat reload | `< 1,500 ms` | **`947 ms`** | **`947 ms`** | Pass (emulated) |

## Physical Phone Verification

| Target Device | Status | Measured `?debug` Marks | Notes |
| --- | --- | --- | --- |
| Physical phone (Fast 4G cold & warm repeat) | **Unverified** (not yet measured on hardware) | Pending owner device reading | Emulated desktop Chromium CDP figures above are **emulated, not verified** for real mobile radio/GPU conditions. |
