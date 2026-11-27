# Z-Anatomy Asset Pipeline Survey

## Critical Finding: Paired Structures vs. Mirror Modifiers

**Paired structures are already separate `.l` and `.r` objects.** In `1: Skeletal system`, there are `118` `.l` and `118` `.r` anatomical mesh objects (zero unpaired `.l` or `.r` orphans).

Only `42` objects across the entire `.blend` use a `MIRROR` modifier, and **all 42 are unpaired midline structures** (for example `Xiphoid process` in `1: Skeletal system`, `Thyroid gland`, `Soft palate`, `Nasopharynx`, `Oropharynx`, `Corpus callosum`, and spinal cord tracts) mirrored across `X = 0` (`use_axis = [True, False, False]`).

- `export.py` must **not** split `MIRROR` modifiers by loose parts into `.l` / `.r` objects.
- `export.py` only needs `export_apply=True` so modifiers (`MIRROR`, `SUBSURF`, `BOOLEAN`, `SOLIDIFY`, `HOOK`) evaluate cleanly before glTF export.
- `Ethmoid bone` carries `BOOLEAN` modifiers referencing six hidden cutter meshes (`Anterior/Middle/Posterior cells of ethmoid bone.l/.r`, `hide_render = True`, zero materials); Task 6 excludes these helper meshes from selection.

---

## Source Provenance

- **Download source:** Z-Anatomy Google Drive folder (`https://drive.google.com/drive/folders/18M7IuH2ai2fl21Ud0YH1mSlNEPPmcZzq`, linked from `https://github.com/LluisV/Z-Anatomy`), archive `Z-Anatomy_Template.zip` → `Z-Anatomy.zip` → `Startup.blend`
- **Saved as:** `pipeline/source/Z-Anatomy.blend` (304,817,801 bytes)
- **Survey date:** 2026-11-21
- **SHA-256:** `9de642d94eb00ffe19c2f1e1ae27f2042269951d86e6689a7eb925369b32a86d`
- **Blender version:** `5.3.0` (invoked headless with `--factory-startup --disable-autoexec` so the embedded `z-anatomy.py` startup script is skipped)
- **Inventory totals (`pipeline/out/inventory.json`):** `7,184` objects (`4,569` `MESH`, `1,660` `FONT`, `951` `CURVE`, `3` `LIGHT`, `1` `CAMERA`)

---

## Top-Level Collection Tree (Two Levels)

- `1: Skeletal system` (2,218 direct objects; no child collections)
- `2: Muscular insertions` (705 direct objects)
- `3: Joints` (593 direct objects)
- `4: Muscular system` (894 direct objects)
- `5: Cardiovascular system` (757 direct objects)
- `6: Lymphoid organs` (276 direct objects)
- `7: Nervous system & Sense organs` (842 direct objects)
- `8: Visceral systems` (479 direct objects)
- `9: Regions of human body` (343 direct objects)
- `Reference lines, reference planes, movements` (54 direct objects)
- `Cross section planes` (3 direct objects)
- `Bonus collection` (1,604 direct objects; hierarchical classification shared with objects in `1:`–`9:`):
  - `Bonus collection/Skeletal system` (15 child collections: `Appendicular skeleton`, `Auditory ossicles`, `Axial skeleton`, `Bones of lower limb`, `Bones of upper limb`, `Bony pelvis`, `Cartilages`, `Cranium`, `Extracranial bones of head`, `Teeth`, `Thoracic skeleton`, `Vertebral column`, plus region/landmark groupings)
  - `Bonus collection/Muscular insertions` (2 child collections)
  - `Bonus collection/Arthrology` (8 child collections)
  - `Bonus collection/Muscular system` (14 child collections)
  - `Bonus collection/Cardiovascular system` (8 child collections)
  - `Bonus collection/Nervous system` (1 direct object, 3 child collections)
  - `Bonus collection/Visceral systems` (8 child collections)
  - `Bonus collection/Regions of human body` (9 child collections)
  - `Bonus collection/Reference lines, planes & movements'` (5 child collections)

---

## Skeletal Collections & UVs

- **Collections holding the skeleton:**
  - `1: Skeletal system` contains all `1,244` skeletal `MESH` objects and `974` `FONT` labels flatly.
  - Of those `1,244` meshes: `622` are `.j` leader lines, `344` are `.i` indicator lines, `1` is the hidden text mesh `Skeletal system.g`, `6` are hidden Boolean cutter meshes (`* cells of ethmoid bone.{l,r}`: `3` `.l`, `3` `.r`), and **`271` are anatomical skeletal meshes** (`115` `.l`, `115` `.r`, and `41` midline without `.l`/`.r`).
  - Note: `1: Skeletal system` includes `28` teeth (`Teeth`), `31` cartilages (`Cartilages`), `2` internal sinus meshes (`Sinus of frontal bone`, `Sinus of sphenoid bone`), and `6` auditory ossicles (`Incus`, `Malleus`, `Stapes`).
  - `Bonus collection/Skeletal system/*` provides clean anatomical subcollections for all `271` anatomical skeletal meshes. Note that `Bonus collection/Skeletal system/Bones of upper limb` contains only shoulder/arm/forearm bones (`Clavicle`, `Scapula`, `Humerus`, `Radius`, `Ulna`, plus `Manubrium of sternum`), while carpal/metacarpal/phalangeal hand bones live in `Bonus collection/Skeletal system/Appendicular skeleton` and `Bonus collection/Regions of human body/Main divisions/{Left,Right} upper limb`. `Bonus collection/Skeletal system/Vertebral column` also includes ligaments and intervertebral discs from `3: Joints`.
- **UVs:** Skeletal meshes mostly **do not** have UVs (`1,191` without UVs vs. `53` with UVs across `1: Skeletal system`). Runtime materials in the viewer must not require UV coordinates.
- **Coordinate orientation in Blender:** World bounding box of `1: Skeletal system` spans `Z` from `-0.073` to `1.714` m (`+Z` superior), `Y` anterior is `-Y` (pectoralis at `Y = -0.069`), and `+X` is patient's left (`.l` at `+X`, `.r` at `-X`). Blender's glTF exporter (`export_yup=True`) maps Blender `+Z` → glTF `+Y` (superior) and Blender `-Y` → glTF `+Z` (anterior) while keeping `+X` as patient's left.

---

## Naming Patterns & Suffix Survey (20 Sample Meshes)

Object names are primarily **English** (Terminologia Anatomica 2nd ed. 2019), with zero `.001` numeric duplicate suffixes (`0` found in `inventory.json`). Suffixes encode object roles:

- `.l` / `.r`: paired left / right anatomy meshes (`115` anatomical pairs + `3` Boolean cutter pairs in `1: Skeletal system`).
- _(no suffix)_: unpaired midline anatomy meshes (`41` in `1: Skeletal system`, including `Atlas (C1)` and `Axis (C2)` with parentheses).
- `.j`: 2-vertex `MESH` leader lines connecting 3D labels to structures (`1,228` total, `622` in `1: Skeletal system`).
- `.i`: 2-vertex `MESH` landmark indicator pins (`344` total, all in `1: Skeletal system`).
- `.g`: group label objects (`FONT`, except `11` converted to `MESH`, e.g. `Skeletal system.g`, `hide_render=True`).
- `.t` / `.s`: `FONT` 3D text labels (`1,660` total `FONT` objects).
- `.ol` / `.or`, `.el` / `.er`, `.o1l`..`.e26r`: muscular origin/insertion surface patches in `2: Muscular insertions`.
- Edge cases in names: parentheses (`Atlas (C1)`, `(Adductor minimus).l`) and leading spaces (`" Posterior transverse collateral sulcus.l"`).

| #   | Object name                                      | Vertices | Has UV  | Primary collection                             | Role                           |
| --- | ------------------------------------------------ | -------- | ------- | ---------------------------------------------- | ------------------------------ |
| 1   | `Anterior cells of ethmoid bone.l`               | 72       | `true`  | `1: Skeletal system`                           | Hidden Boolean cutter (`.l`)   |
| 2   | `Arytenoid cartilage.l`                          | 322      | `false` | `1: Skeletal system`                           | Paired cartilage (`.l`)        |
| 3   | `Calcaneus.l`                                    | 726      | `false` | `1: Skeletal system`                           | Paired bone (`.l`)             |
| 4   | `Capitate bone.l`                                | 238      | `false` | `1: Skeletal system`                           | Paired carpal bone (`.l`)      |
| 5   | `Anterior cells of ethmoid bone.r`               | 72       | `true`  | `1: Skeletal system`                           | Hidden Boolean cutter (`.r`)   |
| 6   | `Arytenoid cartilage.r`                          | 322      | `false` | `1: Skeletal system`                           | Paired cartilage (`.r`)        |
| 7   | `Atlas (C1)`                                     | 1106     | `true`  | `1: Skeletal system`                           | Midline bone with parentheses  |
| 8   | `Axis (C2)`                                      | 1168     | `true`  | `1: Skeletal system`                           | Midline bone with parentheses  |
| 9   | `Body of sternum`                                | 2240     | `false` | `1: Skeletal system`                           | Unpaired midline bone          |
| 10  | `(Canal for vertebral artery).j`                 | 2        | `false` | `1: Skeletal system`                           | 2-vertex label leader (`.j`)   |
| 11  | `(External occipital crest).j`                   | 2        | `false` | `1: Skeletal system`                           | 2-vertex label leader (`.j`)   |
| 12  | ` Posterior transverse collateral sulcus.l`      | 102      | `false` | `7: Nervous system & Sense organs`             | Leading space + `.l`           |
| 13  | ` Posterior transverse collateral sulcus.r`      | 102      | `false` | `7: Nervous system & Sense organs`             | Leading space + `.r`           |
| 14  | `(Supra-orbital notch).j`                        | 2        | `false` | `1: Skeletal system`                           | 2-vertex label leader (`.j`)   |
| 15  | `(Vermian fossa).j`                              | 2        | `false` | `1: Skeletal system`                           | 2-vertex label leader (`.j`)   |
| 16  | `(Posterior obturator tubercle).i`               | 2        | `false` | `1: Skeletal system`                           | 2-vertex indicator (`.i`)      |
| 17  | `(Third trochanter).i`                           | 2        | `false` | `1: Skeletal system`                           | 2-vertex indicator (`.i`)      |
| 18  | `(Abdominal part of pectoralis major muscle).ol` | 62       | `true`  | `2: Muscular insertions`                       | Muscle origin patch (`.ol`)    |
| 19  | `Abductor digiti minimi of foot.er`              | 33       | `false` | `2: Muscular insertions`                       | Muscle insertion patch (`.er`) |
| 20  | `General terms.g`                                | 498      | `true`  | `Reference lines, reference planes, movements` | Group text mesh (`.g`)         |

---

## Excluded for Licensing

Per `pipeline/source/Z-Anatomy-License.txt` and the embedded `1.Licence` text block, Z-Anatomy adapts third-party reference models alongside BodyParts3D and Z-Anatomy's own work. Objects in `.blend` do **not** carry per-object upstream author tags, so every non-commercial (`CC-BY-NC`, `CC-BY-NC-SA`) model and every model with unverified license/provenance is **excluded** from all pipeline rules (`pipeline/config.json`):

1. **"Anatomy of the Inner Ear - by University of Dundee School of Medicine - CC-BY-NC-SA 4.0"** _(non-commercial — incompatible with CC-BY-SA 4.0)_
   - `Bonus collection/Nervous system/Sense organs/Ear/Internal ear` (`Cochlea.l`, `Cochlea.r`, `Vestibule.l`, `Vestibule.r`)
   - `Tympanic membrane.l` (`Bonus collection/Nervous system/Sense organs/Ear/External ear/Tympanic membrane`)
   - `Bonus collection/Skeletal system/Auditory ossicles` (`Incus.l`, `Incus.r`, `Malleus.l`, `Malleus.r`, `Stapes.l`, `Stapes.r`) — excluded in Task 6 because these high-poly ossicles (`1,268`–`2,171` verts each) cannot be proven distinct from the Dundee ear model
2. **"Kidney - by lissiecowley - CC-BY-NC 4.0"** _(non-commercial — incompatible with CC-BY-SA 4.0)_
   - `Bonus collection/Visceral systems/Urinary system/Kidney` (`Kidney.l`, `Kidney.r`, `Renal pelvis.l`, `Renal pelvis.r`)
3. **"Brainder" and "White matter" from the University of Washington** _(no license stated in `Z-Anatomy-License.txt` — excluded as unverified provenance)_
   - `Bonus collection/Nervous system/Central nervous system/Brain` (`234` meshes, including `White matter of telencephalon.l`, `White matter of telencephalon.r`, `Corpus callosum`, sulci/gyri, brainstem nuclei, etc.) and `White matter of spinal cord`
4. **Cranial Nerves and Foramina — by University of Dundee, CAHID — CC-BY 4.0** _(license compatible in principle, but listed here for explicit provenance tracking before any future phase selects cranial nerve meshes)_
   - `Bonus collection/Nervous system/Peripheral nervous system/Cranial nerves`

---

## Phase 1 Bundle Rules & Exclusions

Phase 1 adds the `muscular` (`459` meshes), `cardiovascular` (`216` meshes), and `organs` (`73` meshes) bundles alongside `skeletal` (`263` meshes) for `1,011` meshes across `582` structures:

- **Licensing exclusions upheld:** Neither `.blend` object metadata nor upstream author tags separate BodyParts3D/Z-Anatomy from third-party imports on a per-object basis. Therefore `Kidney.l`/`.r` & `Renal pelvis.l`/`.r` (`CC-BY-NC 4.0`), `Bonus collection/.../Brain` & `White matter*` (`Brainder` / Univ. of Washington, no license stated), `Internal ear` / `Tympanic membrane` & `Auditory ossicles` (`CC-BY-NC-SA 4.0`), and `Cranial nerves` (University of Dundee — excluded to keep shipped geometry strictly Z-Anatomy/BodyParts3D) remain excluded. `Intrarenal` vessels (`cardiovascular`) and `Mucosa of stomach` (`0` vertices) are also excluded.
- **Beveled `CURVE` vessels/organs (`rule.types`):** Systemic arteries/veins (`5: Cardiovascular system`), `Oesophagus`, `Jejunum`, lobar/main bronchi, `Ureter.{l,r}`, `Urethra`, and major spinal nerves (`Sciatic`, `Femoral`, `Median`, `Radial`, `Ulnar`, `Sympathetic trunk`) are stored as beveled `CURVE` objects (`bevel_depth > 0`) rather than `MESH` objects in `Z-Anatomy.blend`. Rules opt in via `types: ["MESH", "CURVE"]`, and `export.py` converts selected curves to solid meshes cleanly before glTF export.
- **Name curation fixes:** Source object `Iliocostalis colli muscle` lacks `.l` in Z-Anatomy despite sitting on `+X` (patient left, symmetric with `Iliocostalis colli muscle.r` on `-X`) and maps to `iliocostalis-colli-muscle--l`; `Middle lobar bronchus.r` maps to unpaired `right-middle-lobar-bronchus`.

---

## Phase 3D Survey

Inspection of `pipeline/out/inventory.json`, `pipeline/source/Z-Anatomy-License.txt`, embedded `1.Licence`, and headless Blender 5.3 inspection of `Z-Anatomy.blend`:

### Provenance Verdict

- **License checks (`1.Licence` & `Z-Anatomy-License.txt`):** Third-party attributions remain strictly the four previously excluded modules (Dundee inner ear, Lissiecowley kidney, UW Brainder/white matter, Dundee cranial nerves). Neither `6: Lymphoid organs` nor `9: Regions of human body` carries any third-party credit; both originate from BodyParts3D (`CC-BY-SA 2.1 Japan`) / Z-Anatomy (`CC-BY-SA 4.0`).

### Skin (`9: Regions of human body` & `Bonus collection/Regions of human body`)

- **Skin: ship** — `9: Regions of human body` directly contains `256` anatomical `MESH` objects (`Bonus collection/Regions of human body` tags existing bones/muscles under anatomical regions alongside the surface meshes).
- **Surface integrity:** Excluding the `14` hair and nail appendages (`Hairs of head` [`8,282` verts], `Hairs of eyebrow.{l,r}` [`397` each], `Eyelashes.{l,r}` [`45` each], `Pubic hairs` [`820`], `Nail plate.{l,r}` [`197` each], `Nail plate (foot).{l,r}` [`148` each], `Perionyx.{l,r}` [`64` each], `Perionyx (foot).{l,r}` [`54` each]), the remaining **`242` meshes** (`27,726` total vertices, `24,946` polygons; `Skin-1`..`Skin-8` and `Skin-in` materials; `0` zero-polygon objects) tile into a contiguous full-body skin envelope covering head, face, neck, trunk, perineum, and all limbs. Verified visually via headless Workbench render.

### Lymphatic Detail (`6: Lymphoid organs`)

- `6: Lymphoid organs` contains `220` `MESH` objects total (`0` `CURVE` objects): `57` `.j`/`.i`/`.s`/`.t`/`.g` helper objects and `163` anatomical `MESH` objects:
  - `Bonus collection/Visceral systems/Lymphoid system` (`54` objects, including `Spleen`, `Left lobe of thymus`, `Right lobe of thymus`, `Palatine tonsil.{l,r}`, plus major cervical, axillary, iliac, epigastric, and tibial nodes; `54` share membership in `6: Lymphoid organs`)
  - Directly in `6: Lymphoid organs` (`109` additional node groups across jugular, supraclavicular, mediastinal/tracheobronchial, coeliac/mesenteric/para-aortic, pelvic, inguinal, and popliteal groups)
- **Exclusions (`10` meshes):**
  - `5` already shipped in `organs` (`Spleen`, `Left lobe of thymus`, `Right lobe of thymus`, `Palatine tonsil.l`, `Palatine tonsil.r`) to prevent cross-bundle duplicate IDs.
  - `5` degenerate `0`-polygon placeholders (`Median sacral nodes`, `(Medial lacunar node).{l,r}`, `(Intermediate lacunar node).{l,r}`).
- **Selected lymphatic set:** **`153` meshes** (`55,814` total vertices, `62,304` polygons; `Lymph-1`..`Lymph-8` materials).
- **Combined 3D budget:** `242` (`skin`) + `153` (`lymphatic`) = **`395` new meshes** (`<= 450` hard cap; `1,406` total atlas meshes `<= 1,461`).

---

## Centerlines (`centerlines` step)

Phase 5 adds anatomical centerline polylines (`public/models/centerlines.<sha8>.json`, linked via `manifest.centerlines`) for journey paths (`digestion` and future tracks). `assets:build` runs this step automatically after GLB packing, or you can re-run it standalone without Blender once `pipeline/out/raw/*.glb` (and `pipeline/out/raw/centerlines-curves.json` when using curves) already exist from a prior `npm run assets:build`:

```sh
npm run assets:centerlines
```

### Configuration (`pipeline/config.json` -> `centerlines`)

1. **`curves`** (`{ id, source, reverse? }`):
   - Exported by `pipeline/blender/export.py` into `pipeline/out/raw/centerlines-curves.json` from Blender `CURVE` objects (`sample_spline_world`), transformed using the same `offset @ world_matrix` centering matrix as mesh exports and converted to glTF Y-up `(x, z, -y)`.
   - Multi-spline curve objects (e.g. `Pancreatic duct` with 35 splines) follow the primary (longest) spline and chain consecutive splines only within `<= 2 mm` endpoint distance so side twigs are ignored.
   - Set `"reverse": true` when the Blender spline runs backwards relative to anatomical flow (e.g. `Jejunum`, where spline start is ileum and end is duodenum).

2. **`meshes`** (`{ id, method, ... }`):
   - Built in pure TypeScript (`pipeline/src/centerlines.ts`) directly from the unquantized raw GLB vertex buffers (`pipeline/out/raw/<bundle>.glb`) — `<= 200` points max per line, centered moving-average smoothed (`window = 5`, keeping endpoints fixed), uniformly arc-length resampled, and `round4` rounded:
     - `"method": "slice"`: bins vertices along `"axis"` (`"x" | "y" | "z"`) in `"direction"` (`1 | -1`) across `"bins"` slices and emits non-empty slice centroids.
     - `"method": "polar"`: bins vertices by polar angle in `"plane"` (`"xy" | "xz" | "yz"`) around normalized `[0,1]^3` bbox `"center"`, starting at `"startDeg"` and sweeping `"sweep"` (`1 | -1`) across `"bins"` slices — used for C-shaped or looped organs (`stomach`, `duodenum`, `sigmoid-colon`).

### Adding a New Line

1. If the organ is a `CURVE` in `Z-Anatomy.blend`, first inspect its spline count, direction, and inter-spline gaps in headless Blender, add `{ id, source, reverse }` under `centerlines.curves`, and run `npm run assets:build`.
2. If the organ is a shipped `MESH`, add a `slice` or `polar` entry under `centerlines.meshes` referencing an existing mesh `id` in `manifest.meshes`, then run `npm run assets:centerlines` (after `npm run assets:build` has populated `pipeline/out/raw/`) and verify route containment with `npx vitest run pipeline/src/journeyInside.test.ts`.

