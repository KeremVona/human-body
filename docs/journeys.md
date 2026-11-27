# Anatomical Journeys

A **journey** is a continuous, path-based 3D walkthrough with narrated stages. Phase 5 ships the **Digestion** journey (`#journey/digestion`, "Follow a bite of food" / "Bir lokmanın yolculuğu"), moving a food bolus/chyme/stool along anatomical centerlines inside the digestive tract while lighting active organs, pulsing secreting glands/ducts, tracking nutrient breakdown and absorption, and following with the camera.

## Data Format

1. **`content/journeys.json`** (language-neutral structure, validated by `src/features/journey/schema.ts` and `npm run check:content`):
   - `id`, `systems`, `stages[]`:
     - `durationS` (`2..30` s playback length at `1×` speed), optional `realTime` (`min`, `max`, `unit`: `'s' | 'min' | 'h'`).
     - `food` (`'bolus' | 'chyme' | 'stool'`), `radius` (`(0, 0.03]`), `motion` (`'squeeze' | 'churn' | 'none'`).
     - `organs` (meshes highlighted in the `'active'` state during the stage) and optional `inside` (meshes checked by the route-containment gate).
     - `view` (`TourViewState` applied on stage entry).
     - `path` (concatenated sequence of `{ line, from?, to? }` centerline slices and `{ mesh, anchor }` bounds-relative waypoints).
     - `modelled` (`boolean`; `false` renders the segment dashed and exposes stage notes for unmodelled anatomy such as rectum/anal canal).
     - `events` (`{ at, kind: 'secrete', mesh, id, via? }`): triggers a `1.2 s` active pulse on the secreting helper mesh and, when `via` is provided, streams up to 40 droplets along that centerline for `3 s`.
     - `nutrients` (`{ carbs, protein, fat, water, absorbed }`, monotonically non-decreasing `0–100`).
2. **`content/<locale>/journeys.json`** (`en` and `tr`):
   - Localized `title`, `summary`, stage `{ title, body, note? }`, and `events.<id>` labels with field-level English fallback.
3. **`public/models/centerlines.<sha8>.json`** (referenced by `manifest.centerlines`):
   - `{ version: 1, lines: Record<id, [x, y, z][]> }` in model space (Y-up, 4-decimal precision, max 200 pts/line).

## Centerlines Step & Inside Gate

- `pipeline/blender/export.py` exports Blender `CURVE` objects (`Oesophagus`, `Jejunum`, `Bile duct`, `Pancreatic duct`) through the same `offset @ world_matrix` centering matrix as mesh geometry into `pipeline/out/raw/centerlines-curves.json`.
- `pipeline/src/centerlines.ts` computes mesh-derived centerlines (`stomach`, `duodenum`, `ascending-colon`, `transverse-colon`, `descending-colon`, `sigmoid-colon`) via `slice` or `polar` binning from the unquantized raw GLBs, smooths with a 5-point moving average, resamples, and writes `public/models/centerlines.<sha8>.json` (`npm run assets:centerlines`).
- `pipeline/src/journeyInside.test.ts` samples each `inside`-checked stage route every `2 mm` against the packed GLBs using `three-mesh-bvh` (3-ray parity for closed organs; dual thin-wall lumen ray checks for Solidify-extruded tubes `esophagus` and `*-colon`) and requires `>= 85%` containment per stage.

## Adding a Stage or Journey

1. Add any new `CURVE` or `MESH` centerline rules under `pipeline/config.json -> centerlines` and run `npm run assets:centerlines` (or `npm run assets:build` if modifying Blender exports).
2. Add or edit the journey definition in `content/journeys.json` and localized copy in `content/en/journeys.json` and `content/tr/journeys.json`.
3. Verify schema parity and route containment with `npm run check:content` and `npx vitest run pipeline/src/journeyInside.test.ts`, and inspect control points visually in dev mode with `/?journey-debug`.

## Digestion Facts & Sources

Educational copy and rounded teaching ranges/nutrient values adapt facts in plain language (`content/STYLE.md`, never copied verbatim) from:
- **OpenStax _Anatomy and Physiology 2e_** (CC-BY 4.0) — §23.2–23.7 (digestive system processes, mouth/pharynx/esophagus, stomach, small and large intestines, accessory organs, chemical digestion and absorption).
- **Wikipedia** (CC-BY-SA 4.0) — supporting overview facts for swallowing, peristalsis, bile/pancreatic ducts, and colonic fermentation.
