# Anatomical Journeys

A **journey** is a continuous, path-based 3D walkthrough with narrated stages. The v2 engine ships three journeys (`#journey/digestion`, `#journey/blood`, `#journey/breath`):
- **Digestion** (`#journey/digestion` — "Follow a bite of food" / "Bir lokmanın yolculuğu"): moves a food bolus/chyme/stool along digestive centerlines with peristaltic squeeze/churn, secreting gland pulses + duct droplets, and nutrient meters.
- **Blood** (`#journey/blood` — "Follow a drop of blood" / "Bir damla kanın yolculuğu"): traces one resting loop from the left hand's capillaries up the arm veins, through the right heart (with live `heartbeat` rhythm and valve/coronary highlights), pulmonary circuit (`lung-capillary` close-up), left heart, aorta, and back down the arm arteries, tracking O₂ saturation and relative CO₂.
- **Breath** (`#journey/breath` — "Follow a breath of air" / "Bir nefes havanın yolculuğu"): follows one breath from the nostrils through pharynx, larynx, trachea, and right bronchi to alveolar gas exchange (`alveolus` close-up) and back out, driving scrubbed `breathing` lung/diaphragm motion (`0.4` full-inhale peak at `alveoli`) and inspired/alveolar/expired O₂ & CO₂ meters.

## Data Format

1. **`content/journeys.json`** (language-neutral v2 structure, validated by `src/features/journey/schema.ts` and `npm run check:content`):
   - `id`, `systems`, `meters[]` (`{ id, unit, max, decimals, monotonic, secondary? }`), `metersStart` (`Record<string, number>` covering every meter id), `stages[]`:
     - `durationS` (`2..30` s playback length at `1×` speed), optional `realTime` (`min`, `max`, `unit`: `'s' | 'min' | 'h'`).
     - `look` (`'bolus' | 'chyme' | 'stool' | 'blood-deoxy' | 'blood-oxy' | 'air-fresh' | 'air-stale'`), `radius` (`(0, 0.03]`), `motion` (`'squeeze' | 'churn' | 'none'`).
     - Optional `rhythm`: `{ motion, mode: 'play' }` or `{ motion, mode: 'scrub', from, to }` (phases in `[0, 1]`).
     - Optional `closeUp`: `'capillary' | 'lung-capillary' | 'alveolus'` (renders `CloseUpCard` in `JourneyBar`).
     - `organs` (meshes highlighted in the `'active'` state during the stage) and optional `inside` (meshes checked by the route-containment gate).
     - `view` (`TourViewState` applied on stage entry).
     - `path` (concatenated sequence of `{ line, from?, to?, reverse? }` centerline slices and `{ mesh, anchor }` bounds-relative waypoints).
     - `modelled` (`boolean`; `false` renders the segment dashed and exposes stage notes for unmodelled anatomy).
     - `events` (`{ at, kind: 'secrete' | 'highlight', mesh, id, via? }`): triggers a `1.2 s` active pulse on the helper mesh; when `kind === 'secrete'` and `via` is provided, streams up to 40 droplets along that centerline for `3 s`.
     - `meters` (`Record<string, number>` covering every meter id in `meters[]`, non-decreasing across stages for `monotonic: true` meters).
2. **`content/<locale>/journeys.json`** (`en` and `tr`):
   - Localized `title`, `summary`, optional `follow`, `inspectorLink`, `metersTitle`, `metersNote`, `meters` (`Record<id, { label?: string; value?: string }>` using `{v}` / `{s}` placeholders), stage `{ title, body, note? }`, and `events.<id>` labels with field-level English fallback.
3. **`public/models/centerlines.<sha8>.json`** (referenced by `manifest.centerlines`):
   - `{ version: 1, lines: Record<id, [x, y, z][]> }` in model space (Y-up, 4-decimal precision, max 200 pts/line).

## Rhythm Ownership Rule

- While a journey stage sets `rhythm`, it starts the target motion demo under `motion.owner = 'journey'` (without toggling unrelated systems or letting `systemsSet` cancel the motion on stage views).
- Leaving a `rhythm` stage, cancelling, or calling `exitJourney()` stops only `owner === 'journey'` motions so user-started motion demos are never disturbed.
- `MotionPanel` treats `owner === 'journey'` as inactive on the Motion tab (with demo buttons disabled while any journey is active).

## Centerlines Step & Inside Gate

- `pipeline/blender/export.py` exports Blender `CURVE` objects (`Oesophagus`, `Jejunum`, `Bile duct`, `Pancreatic duct`, plus systemic/pulmonary vessels and bronchi) through the same `offset @ world_matrix` centering matrix as mesh geometry into `pipeline/out/raw/centerlines-curves.json`.
- `pipeline/src/centerlines.ts` computes mesh-derived centerlines (`stomach`, `duodenum`, `ascending-colon`, `transverse-colon`, `descending-colon`, `sigmoid-colon`, `trachea`) via `slice` or `polar` binning from the unquantized raw GLBs, smooths with a 5-point moving average, resamples, and writes `public/models/centerlines.<sha8>.json` (`npm run assets:centerlines`).
- `pipeline/src/journeyInside.test.ts` samples each `inside`-checked stage route every `2 mm` against the packed GLBs using `three-mesh-bvh` (3-ray parity for closed organs; dual thin-wall lumen ray checks for Solidify-extruded tubes `esophagus` and `*-colon`; single-wall lumen ray checks for converted vessel/bronchus tubes and `trachea`) and requires `>= 85%` containment per stage.

## Route & Inside-Check Tuning Notes

- **Single-wall curve tubes (`blood`, `breath`):** The Phase 6A Blender spike established that converted beveled curves and `trachea` are open-ended single-walled tubes (24–42 boundary edges), while heart chambers and `nasal-cavity-lining` are open sheets/ostia (`inside` omitted).
- **Chamber & lobe entry anchors:** `right-heart` opens near the superior vena cava ostium (`right-atrium [0.45, 0.9, 0.35]`), `lung-capillaries` opens at the left upper lobe hilum (`[0.68, 0.23, 0.24]`), `left-heart` opens near the pulmonary vein ostium (`left-atrium [0.8, 0.7, 0.28]`), and `alveoli` opens/exits near the right inferior lobar bronchus termination (`[0.61, 0.48, 0.21]`) so preceding vessel/bronchus stages stay `>= 85%` inside target tubes.
- **`aortic-arch` slice:** `aorta` slices `{ "line": "aortic-arch", "to": 0.57 }` where `left-subclavian-artery` branches off the arch instead of overshooting down the descending arch.
- **`breathe-out` split & `soft-palate` visibility:** Because `cricoid-cartilage`, `thyroid-cartilage`, and `epiglottis` are non-closed cartilage waypoints (~`27%` of arc length above `trachea`), those exit waypoints sit at the start of `out-nose` so `breathe-out` stays `>= 85%` inside `bronchi` + `trachea`. All `breath` views enable `"digestive"` alongside `"respiratory"`, `"skeletal"`, `"muscular"` with `view.i` isolating only the 22 airway/lung/respiratory-muscle meshes so `soft-palate` remains visible without exposing unrelated digestive organs.

## Adding a Stage or Journey

1. Add any new `CURVE` or `MESH` centerline rules under `pipeline/config.json -> centerlines` and run `npm run assets:centerlines` (or `npm run assets:build` if modifying Blender exports).
2. Add or edit the journey definition in `content/journeys.json` and localized copy in `content/en/journeys.json` and `content/tr/journeys.json`.
3. Verify schema parity and route containment with `npm run check:content` and `npx vitest run pipeline/src/journeyInside.test.ts`, and inspect control points visually in dev mode with `/?journey-debug`.

## Facts & Sources

Educational copy and rounded resting physiological values adapt facts in plain language (`content/STYLE.md`, never copied verbatim) from:
- **OpenStax _Anatomy and Physiology 2e_** (CC-BY 4.0):
  - **Ch. 19 (§19.1–19.3)** — Heart anatomy, valves, coronary circulation, and the ~0.8 s (`~0.6–1 s`) resting cardiac cycle.
  - **Ch. 20 (§20.1–20.5)** — Systemic and pulmonary vascular pathways, venous valves, blood pressure/flow, and ~0.75 s resting pulmonary capillary transit time / capillary gas exchange.
  - **Ch. 22 (§22.1, §22.3–22.4)** — Nose/conchae, pharynx/larynx, 10–12 cm trachea, bronchial tree (~23 branching generations), ~300+ million alveoli, 12–20 breaths/min resting respiratory rate, ~500 mL tidal volume, and alveolar/expired O₂ (`21% -> ~14% -> ~16%`) & CO₂ (`0.04% -> ~5% -> ~4%`) partial-pressure-driven exchange.
  - **Ch. 23 (§23.2–23.7)** — Digestive system processes, mouth/pharynx/esophagus, stomach, small and large intestines, accessory organs, chemical digestion and absorption.
- **Wikipedia** (CC-BY-SA 4.0) — supporting overview facts for swallowing, peristalsis, bile/pancreatic ducts, colonic fermentation, systemic/pulmonary loops, and pulmonary gas exchange.
