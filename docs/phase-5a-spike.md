# Phase 5A Centerline & Mesh Spike

**Date:** 2026-11-26  
**Blender:** `Blender 5.3.0` headless (`--factory-startup --disable-autoexec --python-exit-code 1`) on `pipeline/source/Z-Anatomy.blend`.

## Curve Centerlines

| Curve Object | Splines | Type | Points per Spline | Max Chaining Gap | Blender World Start | Blender World End | Recommended Direction |
|---|---|---|---|---|---|---|---|
| `Oesophagus` | 1 | `BEZIER` | `8` | `0.0000 m` (single spline) | `[0.00000, -0.00315, 1.47481]` (superior neck) | `[0.01269, -0.01451, 1.19863]` (inferior cardia) | `reverse: false` (top → bottom) |
| `Jejunum` | 1 | `BEZIER` | `97` | `0.0000 m` (single spline) | `[-0.08048, -0.02478, 0.96522]` (inferior-right / ileocecal side) | `[0.02492, -0.03996, 1.08559]` (superior-left / duodenojejunal flexure) | **`reverse: true`** (duodenum → colon) |
| `Bile duct` | 1 | `BEZIER` | `8` | `0.0000 m` (single spline) | `[-0.03019, -0.03916, 1.15737]` (hepatic end) | `[-0.05757, -0.02922, 1.09015]` (duodenal end) | `reverse: false` (liver/gallbladder → duodenum) |
| `Pancreatic duct` | 35 | `BEZIER` | Spline `0`: `24`; splines `1..34`: `3–4` | `0.018127 m` (`18.1 mm`) across side branches | Spline `0`: `[0.06575, -0.00255, 1.14628]` (pancreatic tail) | Spline `0`: `[-0.05313, -0.03518, 1.09421]` (duodenal papilla) | `reverse: false`, using primary spine (`spline 0` / `<= 2 mm` chain) so side twigs (`splines 1..34`) do not cause backward jumps |

### Gate Results
- **`Jejunum` gate (`<= 5 mm` chaining gap):** **PASS** — `Jejunum` is a single continuous 97-point non-cyclic Bezier spline (`0 mm` gap), needing `reverse: true` so it starts near the duodenum (`z = 1.08559`) and ends near the ascending colon (`z = 0.96522`). No waypoint fallback required unless needed later by the inside-mesh test.
- **Duct gates (`Bile duct`, `Pancreatic duct`):** **PASS** — Both have usable Bezier curves terminating within ~4 mm of each other at the descending duodenum (`x ≈ -0.055, z ≈ 1.092`). For `Pancreatic duct`, chaining only within `2 mm` (or taking the main duct spline `0`) cleanly isolates the 24-point main duct from its 34 small side branches.

## New Meshes Check

All 7 target objects exist as clean `MESH` objects with no `.i/.j/.s/.t/.g` helper suffixes (related helper objects `Ligaments of epiglottis.g` [`FONT`] and `Ligaments of epiglottis.j` [2 verts] remain excluded by `exclude: ["\\.(i|j|s|t|g)$"]`).

| Blender Object Name | Type | Vertices | Collection | Planned Bundle / System / MeshId |
|---|---|---|---|---|
| `Epiglottis` | `MESH` | `1,650` | `Bonus collection/Visceral systems/Digestive system` | `organs` / `respiratory` / `epiglottis` |
| `Superior pharyngeal constrictor.l` | `MESH` | `2,669` | `Muscular system/.../Pharyngeal muscles` | `muscular` / `muscular` / `superior-pharyngeal-constrictor--l` |
| `Superior pharyngeal constrictor.r` | `MESH` | `2,669` | `Muscular system/.../Pharyngeal muscles` | `muscular` / `muscular` / `superior-pharyngeal-constrictor--r` |
| `Middle pharyngeal constrictor.l` | `MESH` | `1,476` | `Muscular system/.../Pharyngeal muscles` | `muscular` / `muscular` / `middle-pharyngeal-constrictor--l` |
| `Middle pharyngeal constrictor.r` | `MESH` | `1,476` | `Muscular system/.../Pharyngeal muscles` | `muscular` / `muscular` / `middle-pharyngeal-constrictor--r` |
| `Inferior pharyngeal constrictor.l` | `MESH` | `1,850` | `Muscular system/.../Pharyngeal muscles` | `muscular` / `muscular` / `inferior-pharyngeal-constrictor--l` |
| `Inferior pharyngeal constrictor.r` | `MESH` | `1,850` | `Muscular system/.../Pharyngeal muscles` | `muscular` / `muscular` / `inferior-pharyngeal-constrictor--r` |
