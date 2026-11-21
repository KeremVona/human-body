# Phase 1 Performance Measurements

**Verdict:** **Needs optimisation**

Measured against [docs/superpowers/specs/2026-11-21-anatomy-atlas-design.md](superpowers/specs/2026-11-21-anatomy-atlas-design.md) §9.1 and §8.6 on the production build (`npm run build && npm run preview` at `/?debug`) with all four systems (`Skeletal`, `Muscular`, `Cardiovascular`, `Major Organs`) enabled (`1,011` meshes total), plus `?debug` picking timing on `npm run dev`.

## Summary vs §9.1 & §8.6 Budgets

| Metric | Target (§9.1 / §8.6) | Measured (RTX 4060 dGPU) | Measured (Intel Arc iGPU) | Status |
|---|---|---|---|---|
| GPU (`UNMASKED_RENDERER_WEBGL`) | Mid-range laptop integrated GPU | `NVIDIA GeForce RTX 4060 (0x00002808) Direct3D11` | `Intel(R) Arc(TM) Graphics (0x00007D55) Direct3D11` | Measured |
| Draw calls (all 4 systems) | `<= 1,500` | `1,011` | `1,011` | Within budget |
| Triangles rendered | Recorded | `2.9M` (`2,890,824` indexed tris) | `2.9M` (`2,890,824` indexed tris) | Recorded |
| Idle FPS (`?debug` continuous) | `60 fps` | `60 fps` | `60 fps` | Within budget |
| Orbiting FPS (all 4 systems) | `60 fps` | `60 fps` | `57–60 fps` (`57, 60, 58, 60, 60`) | Below 60 fps on iGPU |
| Picking (`pickMeshId`, 100 moves) | `< 2 ms` per move | `0.300 ms` total (`0.0030 ms/move`) | `0.400 ms` total (`0.0040 ms/move`) | Within budget |
| UI shell interactive (fast) | `< 1.5 s` | `244 ms` | `292 ms` | Within budget |
| UI shell interactive (Fast 4G\*) | — | `1,153 ms` | `1,419 ms` | Recorded |
| Skeleton visible (fast, uncached) | `< 3.0 s` | `3,630 ms` | `727 ms` | Over budget on cold dGPU |
| Skeleton visible (Fast 4G\*, uncached) | `< 6.0 s` | `6,718 ms` | `6,035 ms` | Over budget |
| Production JS bundle (§8.6) | `< 400 KB` gzipped | `1,627.26 kB` (`462.51 kB` gzipped) | `1,627.26 kB` (`462.51 kB` gzipped) | Over budget |

\*Simulated via Chrome DevTools Protocol `Network.emulateNetworkConditions` (`latency: 150 ms`, `downloadThroughput: 9 Mbps / 1,179,648 B/s`, `uploadThroughput: 1.5 Mbps`, cache disabled).

## Raw Observations

- **`vite build` output:**
  - `dist/index.html`: `0.40 kB` (`0.27 kB` gzipped)
  - `dist/assets/index-CjCU6Y7u.css`: `27.32 kB` (`5.73 kB` gzipped)
  - `dist/assets/index-ByOMXxTn.js`: `1,627.26 kB` (`462.51 kB` gzipped)
- **Debug overlay (`?debug`) with all 4 bundles enabled:**
  - `fps 60 · draw calls 1011 · triangles 2.9M · meshes 1011`
- **Dev picking cost log (`/?debug`, 120 pointer moves over chest/femur projections, all 4 systems visible):**
  - `[picking] 100 moves: 0.300 ms total (0.0030 ms/move)` (RTX 4060 run)
  - `[picking] 100 moves: 0.400 ms total (0.0040 ms/move)` (Intel Arc iGPU run)

## Findings & Why Verdict Is "Needs optimisation"

1. **Integrated-GPU orbit frame dips (`57–58 fps`):** With all 1,011 meshes visible (`1,011` draw calls, `2.9M` triangles), orbiting on `Intel(R) Arc(TM) Graphics` briefly dips below 60 fps (`57–58 fps`). Draw calls (`1,011`) stay under the `1,500` ceiling, so the `BatchedMesh` consolidation (§7.3) is deferred to its own plan as specified.
2. **Skeleton-visible cold load (`3.63 s` fast on RTX 4060 cold shader init; `6.04–6.72 s` on Fast 4G, cache disabled):** Fetching the monolithic `462.51 kB` gzipped JS chunk + `4.48 MiB` `skeletal` GLB + PMREM `Lightformer` setup exceeds the `< 3 s` (cold fast) / `< 6 s` (uncached Fast 4G) budgets.
3. **JS bundle budget (§8.6):** Single Vite entry chunk is `462.51 kB` gzipped (`> 400 KB`). Splitting Three.js/R3F vs UI shell (or lazy-loading secondary UI/three chunks) alongside `BatchedMesh` batching belongs in a follow-up optimisation plan.
