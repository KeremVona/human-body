# Phase 6A Centerline & Mesh Spike

**Date:** 2026-11-27  
**Blender:** `Blender 5.3.0` headless (`--factory-startup --disable-autoexec --python-exit-code 1`) on `pipeline/source/Z-Anatomy.blend`.  
**Reference points (Blender world):** Heart bbox center `[0.01716, -0.02920, 1.29079]`, Trachea min corner `[-0.01383, -0.01766, 1.35520]`.

## Curve Centerlines (19 Curves)

All 19 target objects are `CURVE` objects with `bevel_depth = 0.0005` (`BEZIER`, non-cyclic) and no `bevel_object`. `Intermediate bronchus.r` is a beveled curve identical in setup to the other bronchi.

| Id | Source Curve | Splines | Points | Chain Len | Max Gap | Blender World Start | Blender World End | Recommended `reverse` | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `radial-veins--l` | `Radial veins.l` | 1 | 9 | `0.2251 m` | `0.0000 m` | `[0.28324, -0.02659, 0.86721]` | `[0.22995, 0.01478, 1.07410]` | `false` | Arm veins chain toward heart; end meets `Brachial veins.l` start (`0 mm`) |
| `brachial-veins--l` | `Brachial veins.l` | 1 | 9 | `0.2557 m` | `0.0000 m` | `[0.22995, 0.01478, 1.07410]` | `[0.15356, 0.00358, 1.30936]` | `false` | End meets `Axillary vein.l` start (`0 mm`) |
| `axillary-vein--l` | `Axillary vein.l` | 1 | 7 | `0.1142 m` | `0.0000 m` | `[0.15356, 0.00358, 1.30936]` | `[0.09335, -0.00207, 1.40031]` | `false` | End meets `Left subclavian vein` start (`0 mm`) |
| `left-subclavian-vein` | `Left subclavian vein` | 1 | 5 | `0.0734 m` | `0.0000 m` | `[0.09335, -0.00207, 1.40031]` | `[0.02548, -0.02015, 1.41153]` | `false` | End ~`0.9 mm` from `Left brachiocephalic vein` start |
| `left-brachiocephalic-vein` | `Left brachiocephalic vein` | 1 | 4 | `0.0581 m` | `0.0000 m` | `[0.02525, -0.02025, 1.41244]` | `[-0.01439, -0.02300, 1.37415]` | `false` | End meets `Superior vena cava` start (`0 mm`) |
| `superior-vena-cava` | `Superior vena cava` | 1 | 2 | `0.0339 m` | `0.0000 m` | `[-0.01439, -0.02300, 1.37415]` | `[-0.01662, -0.01777, 1.34080]` | `false` | Top → RA |
| `bifurcation-of-pulmonary-trunk` | `Bifurcation of pulmonary trunk` | 2 | `3 + 3` | `0.0348 m` | `0.01717 m` (skipped `spline 1`) | `[0.02932, -0.02961, 1.34460]` | `[0.03392, 0.00429, 1.34661]` | `false` | `chain_splines` isolates `spline 0` (left branch); end meets `Left pulmonary artery` (`0 mm`); right branch `spline 1` skipped |
| `left-pulmonary-artery` | `Left pulmonary artery` | 1 | 8 | `0.1103 m` | `0.0000 m` | `[0.03392, 0.00429, 1.34661]` | `[0.08625, 0.02802, 1.26867]` | `false` | Hilum → left lung |
| `left-superior-pulmonary-vein` | `Left superior pulmonary vein` | 3 | `2 + 2 + 2` | `0.0240 m` | `0.0000 m` (1 branch skipped) | `[0.04945, 0.00833, 1.31608]` | `[0.05415, 0.00928, 1.31426]` | **`true`** | Reverse so `0.05415` (lung) → `0.04945` (LA) walks toward heart; `spline 2` (`0.0096 m`) skipped at Y-fork |
| `ascending-aorta` | `Ascending aorta` | 1 | 3 | `0.0515 m` | `0.0000 m` | `[0.01955, -0.01932, 1.31642]` | `[0.00583, -0.02857, 1.36022]` | `false` | End meets `Aortic arch` start (`0 mm`) |
| `aortic-arch` | `Aortic arch` | 1 | 3 | `0.0857 m` | `0.0000 m` | `[0.00583, -0.02857, 1.36022]` | `[0.01926, 0.03328, 1.36041]` | `false` | LV/root → descending thoracic transition |
| `left-subclavian-artery` | `Left subclavian artery` | 1 | 5 | `0.0860 m` | `0.0000 m` | `[0.02308, 0.00535, 1.38900]` | `[0.07960, 0.00307, 1.41202]` | `false` | End meets `Axillary artery.l` start (`0 mm`) |
| `axillary-artery--l` | `Axillary artery.l` | 1 | 5 | `0.0747 m` | `0.0000 m` | `[0.07960, 0.00307, 1.41202]` | `[0.13476, 0.01131, 1.36475]` | `false` | End meets `Brachial artery.l` start (`0 mm`) |
| `brachial-artery--l` | `Brachial artery.l` | 1 | 11 | `0.2948 m` | `0.0000 m` | `[0.13476, 0.01131, 1.36475]` | `[0.22471, 0.01298, 1.09012]` | `false` | End meets `Radial artery.l` start (`0 mm`) |
| `radial-artery--l` | `Radial artery.l` | 1 | 12 | `0.2640 m` | `0.0000 m` | `[0.22471, 0.01298, 1.09012]` | `[0.28593, -0.01486, 0.84437]` | `false` | End meets `Deep palmar arch.l` **end** (`0 mm`) |
| `deep-palmar-arch--l` | `Deep palmar arch.l` | 1 | 9 | `0.0727 m` | `0.0000 m` | `[0.25272, -0.02692, 0.85996]` | `[0.28593, -0.01486, 0.84437]` | **`true`** | **`radial-artery--l` connects to `end` (`[0.28593, -0.01486, 0.84437]`), so `reverse: true` continues away from heart (radial → medial palm)**; stage 1 (`hand`) can slice from medial/radial end toward `radial-veins--l` (`[0.28324, -0.02659, 0.86721]`) |
| `right-main-bronchus` | `Right main bronchus` | 1 | 2 | `0.0263 m` | `0.0000 m` | `[-0.01381, 0.01703, 1.34816]` | `[-0.00099, 0.01131, 1.37043]` | **`true`** | Reversed walks trachea carina → intermediate bronchus (`0.5 mm` gap) |
| `intermediate-bronchus` | `Intermediate bronchus.r` | 1 | 2 | `0.0361 m` | `0.0000 m` | `[-0.03149, 0.02131, 1.31746]` | `[-0.01381, 0.01703, 1.34863]` | **`true`** | Reversed walks `0.5 mm` from `Right main bronchus` end → `0.5 mm` to `Right inferior lobar bronchus` |
| `right-inferior-lobar-bronchus` | `Right inferior lobar bronchus` | 1 | 5 | `0.0717 m` | `0.0000 m` | `[-0.05280, 0.04707, 1.25714]` | `[-0.03149, 0.02131, 1.31793]` | **`true`** | Reversed walks into right inferior lobe; breath-out uses `reverse: true` on path slice |

## Topology & Inside-Check Decision for Phase 6B

### Converted Curve Samples (`convert(target="MESH")`)

| Sample | Verts | Faces | Boundary Edges | Non-Manifold Edges | Topology | 6B Inside-Check Method |
|---|---|---|---|---|---|---|
| `Radial veins.l` | `1,164` | `1,152` | `24` | `24` | Open-ended single-walled tube | **Single-wall tube lumen** (`posHits >= 1 && negHits >= 1` within vessel radius on `>= 2` axes) |
| `Superior vena cava` | `156` | `144` | `24` | `24` | Open-ended single-walled tube | **Single-wall tube lumen** |
| `Right main bronchus` | `156` | `144` | `24` | `24` | Open-ended single-walled tube | **Single-wall tube lumen** |

Notice that converted curves are **open-ended, single-walled tubes** (two open 12-edge end caps -> `24` boundary edges), unlike Solidify double-walled GI tubes (`posHits >= 2`) and unlike closed parity solids. Even-number parity raycasts along perpendicular axes return `0` odd votes, so Phase 6B will add a `SINGLE_WALL_TUBE_IDS` lumen check (`>= 1` hit on both `+axis` and `-axis` within local lumen distance on `>= 2` orthogonal axes).

### Heart Chambers, Trachea & Nasal Mucosa

| Mesh | Verts | Faces | Boundary Edges | Closed? | 6B Inside-Check Method |
|---|---|---|---|---|---|
| `Mucosa of nasal cavity` (`nasal-cavity-lining`) | `318` | `308` | `36` | `false` (open lining sheet) | **`none`** (sheet, not a closed volume) |
| `Right atrium` | `2,878` | `2,850` | `119` | `false` (open ostia) | **`none`** |
| `Right ventricle` | `2,850` | `2,814` | `167` | `false` | **`none`** |
| `Left atrium` | `2,609` | `2,610` | `121` | `false` | **`none`** |
| `Left ventricle` | `2,856` | `2,797` | `180` | `false` | **`none`** |
| `Pulmonary trunk` | `138` | `115` | `46` | `false` | **`none`** |
| `Trachea` | `2,400` | `4,516` | `42` | `false` (open top/bottom rims) | **Single-wall tube lumen** (verify ring spacing in 6B) |
