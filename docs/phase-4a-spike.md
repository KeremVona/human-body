# Phase 4A Spike: BatchedMesh + three-mesh-bvh (`skeletal`)

Date: 2026-11-25  
Branch tested: `spike/batching` (deleted after measurement)  
Baseline commit: `e990333` (`three@0.187.0`, `three-mesh-bvh@0.9.18`)  
Environment: Desktop Windows (NVIDIA GeForce RTX 4060 via Edge `--headless=new` D3D11 ANGLE) with Low quality (`localStorage['atlas.quality'] = 'low'`), Chrome DevTools 4× CPU throttle (`Emulation.setCPUThrottlingRate`), and headless SwiftShader 1× fallback (`--use-angle=swiftshader`).

## Scope

Batched only the `skeletal` bundle (`263` meshes) inside `BundleModel.tsx` grouped by appearance key (`system|tissue|color`), packing each group into a `THREE.BatchedMesh` with `computeBatchedBoundsTree` (`strategy: CENTER`, `targetLeafSize: 10`, `setBoundingBox: true`) and `acceleratedRaycast`, and mapping `hit.batchId` -> `MeshId` in `src/scene/gestures.ts`.

## Findings & Attribute Compatibility

- On first run against `skeletal.6c6d593d.glb`, `BatchedMesh.addGeometry()` threw:
  `Error: THREE.BatchedMesh: Added geometry missing "uv". All geometries must have consistent attributes.`
- Inspection showed mixed UV presence within appearance groups (`skeletal|bone|`: `33/232` meshes had `uv`; `skeletal|cartilage|`: `1/31` meshes had `uv`; `nonIndexed = 0`).
- Because atlas materials (`src/scene/materials.ts`) are untextured `MeshPhysicalMaterial` instances, copying only `{ position, normal }` + `index` onto a temporary wrapper `BufferGeometry` resolved the mismatch without modifying source geometries or altering shading.
- `computeBatchedBoundsTree` + `acceleratedRaycast` worked out of the box once geometry attributes were normalized, producing `2` skeletal batches (`skeletal|bone|` with `232` meshes, `skeletal|cartilage|` with `31` meshes).

## Measurements (`/?debug`, Low Quality, Full 6-Bundle Load = `1,406` Registered Meshes)

| Metric | Baseline (`main`, unbatched) | Spike (`spike/batching`, skeletal batched) | Budget / Notes |
| --- | --- | --- | --- |
| Draw calls idle (`gl.info.render.calls`) | `263` | `2` | `<= 40` (**Pass**) |
| Draw calls during 5 s orbit drag | `103–138` | `2` | `<= 40` (**Pass**) |
| Triangles rendered (idle / drag) | `511.6K` / `349.3K–427.2K` | `511.6K` / `334.7K–423.9K` | Geometry unchanged |
| FPS — Desktop RTX 4060 (`1x` CPU) | `240` idle / `240` drag | `240` idle / `238–240` drag | Display/RAF cap |
| FPS — Desktop RTX 4060 (`4x` CPU throttle, emulated) | `181` idle / `208–228` drag | `238` idle / `196–230` drag | CPU-throttled desktop GPU |
| FPS — SwiftShader (`1x` CPU, emulated software GL) | `6` idle / `6` drag | `6` idle / `6–7` drag | Triangle raster-bound |
| `usedJSHeapSize` — Desktop RTX 4060 (`1x`, idle / post-drag) | `175.4 MB` / `170.7 MB` | `188.0 MB` / `188.0 MB` | `~1.07×–1.10×` (`<= 1.5×`) |
| `usedJSHeapSize` — Desktop RTX 4060 (`4x`, idle / post-drag) | `176.7 MB` / `183.5 MB` | `188.0 MB` / `195.8 MB` | `~1.06×–1.07×` (`<= 1.5×`) |
| Raycasting (`20` skeletal clicks) | — | `0/20` mis-picks (`20/20` exact `MeshId`) | **Pass (`0/20`)** |

## Verdict: **Go**

`THREE.BatchedMesh` (`three@0.187.0`) paired with `three-mesh-bvh@0.9.18` `computeBatchedBoundsTree` and `acceleratedRaycast` dropped `skeletal` draw calls from `263` down to `2` (`<= 40` budget) with `0/20` raycasting mis-picks and only ~`12–17 MB` (`~1.07×`) JS heap overhead while keeping source meshes intact for per-mesh promotion. The sole compatibility constraint found — inconsistent `uv` attributes across sub-meshes in real Z-Anatomy GLBs — is solved cleanly by normalizing batch geometries to `{ position, normal }` + `index` in the batch builder (keeping source geometries untouched for promoted individual meshes and `?batching=off`).
