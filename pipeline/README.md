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
