# Foundation & Asset Spike (Phase 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the repo, the shared data contracts and a reproducible Z-Anatomy → GLB pipeline. Prove it end to end with the skeletal bundle rendering in a minimal R3F viewer, measure it, and decide whether the design's asset budgets hold.

**Architecture:**
- The pipeline splits into two parts:
  - **Thin Blender Python scripts:** `inventory.py` dumps the objects, and `export.py` exports the objects it's told to, already renamed.
  - **Tested TypeScript stages** for every decision: rule matching, ID proposals, plan resolution, optimisation, the manifest, the content scaffold and verification.
- Zod schemas in `src/data/` are the single contract shared by the pipeline, the CI content check and the app.
- The viewer is already built from the final architecture's parts (`MeshRegistry`, `BundleModel`, `AtlasCanvas`), so Plan 2 extends it rather than replacing it.

**Tech Stack:** Node 24, Vite, React 19, TypeScript (strict), Tailwind CSS v4 (`@tailwindcss/vite`), Zod, Vitest + React Testing Library, Playwright, three.js + @react-three/fiber + @react-three/drei + three-mesh-bvh, glTF-Transform (`@gltf-transform/core`, `/extensions`, `/functions`) + `meshoptimizer`, `tsx`, Blender 4.5 LTS or newer (headless).

**Spec:** `docs/superpowers/specs/2026-11-21-anatomy-atlas-design.md`. Executors read it alongside this plan. Section references below (§) point into it.

**Plan map.** This is Plan 1 of 4, and all four are written upfront. Plans 2–4 consume this plan's Interfaces exactly. Each starts with a gate step that reads `docs/phase-0-results.md` (Task 10) before any work.
1. Foundation & asset spike: Phase 0 plus the repo scaffold. **This plan.**
2. Phase 1 app: all four bundles, store, materials, camera, picking, dissection, systems panel, Inspector, mobile layout, Pages deploy.
3. Phase 1 content and launch: ~100–150 featured entries drafted by Claude and checked against cited sources (§7.5), Credits dialog, README with GIF, cross-browser and phone check.
4. Phase 2: opacity sliders, search, tree, quiz, visual polish.

## Prerequisites (owner, before Task 5)

These downloads need the owner's go-ahead or the owner's own hands:
- Install **Blender 4.5 LTS or newer**, for example with `winget install BlenderFoundation.Blender`. Put the full path to `blender.exe` in `.env.local` as `BLENDER_PATH=...`; that file is gitignored.
- Download the main Z-Anatomy `.blend` from the Google Drive folder linked under "Models" in the README at https://github.com/LluisV/Z-Anatomy: https://drive.google.com/drive/folders/18M7IuH2ai2fl21Ud0YH1mSlNEPPmcZzq. Save it as `pipeline/source/Z-Anatomy.blend`.
  - Fallback: the Blender application template `Z-Anatomy.zip` from https://github.com/Z-Anatomy/Models-of-human-anatomy. Unzip it and use the atlas `.blend` inside.
  - Open the file once in Blender to confirm that the full body appears.

**GitHub:** the repo is https://github.com/KeremVona/human-body. It was empty when this plan was written, and the Pages base path will be `/human-body/`.

## Global Constraints

- **Stack:** React 19 with TypeScript `strict: true`, built with Vite. Tailwind CSS v4 through the `@tailwindcss/vite` plugin. **No PostCSS config file exists in the repo.**
- **Licenses:** code is MIT (`LICENSE`). `public/models/` and `content/` are CC-BY-SA 4.0 (`LICENSE-ASSETS`).
- **StructureId:** lowercase kebab-case ASCII, regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- **MeshId:** a StructureId plus an optional `--l` or `--r` suffix. **The GLB node name is the MeshId.**
- **Orientation:** +Y superior, +Z anterior, +X patient's left. The origin is the centre of the skeletal bundle's bounding box. Units are metres; a body height between 1.4 and 2.2 counts as plausible.
- **Budgets** (the spec's "MB" taken as MiB):
  - skeletal bundle ≤ 5,242,880 bytes,
  - every other bundle ≤ 15,728,640 bytes,
  - all bundles together ≤ 41,943,040 bytes.
- **GLB contents:** no materials, textures, cameras, lights or animations. Compression is Meshopt (`EXT_meshopt_compression`), not Draco.
- **What gets committed:** the raw `.blend` and `pipeline/out/` are never committed. The generated `public/models/*.glb` files and `manifest.json` are.
- **Bundle filenames:** `<bundleId>.<first 8 hex of sha256>.glb`. Stale bundle files are deleted on every build.
- **Base path:** the Vite `base` comes from the env var `ATLAS_BASE_PATH`, default `/`. The repo name isn't chosen yet.
- **Platform:** the dev machine is Windows. Use `path.join` for disk paths and `/` for URLs. npm scripts must run unchanged from PowerShell and from bash.
- **Content files:** keep JSON sorted by id, so diffs are stable.

## Review Focus

These are the failure modes most likely to hurt a person using this software that no other test covers. Each line's test lives in the task named.

1. **A bundle fails to download** (404 or a corrupt GLB). The visitor should see a clear error message, not a blank screen or a crashed page. → Task 9, e2e `shows an error when the skeletal bundle fails`.
2. **three.js puts the named node *above* the mesh that was actually hit.** This happens with multi-primitive meshes or name-sanitised children. Picking and registration must still find the MeshId. → Task 9, `meshIdOf walks up to the nearest valid ancestor`.
3. **Source names with diacritics, parentheses or Blender `.001` suffixes.** They must still become valid ASCII ids, and be flagged for human review instead of slipping through silently. → Task 6, `proposeMeshId` cases.
4. **Two Blender objects map to the same MeshId.** The pipeline must stop with an error naming both objects, not quietly export one of them. → Task 7, `rejects two sources mapping to one mesh id`.
5. **A rebuild leaves stale hashed GLBs in `public/models/`.** The site would then ship dead megabytes and blow the size budget. → Task 8, `writeOutputs removes stale bundle files`.

---

## File structure

```
.github/workflows/ci.yml            CI: npm run ci + e2e
package.json  vite.config.ts  vitest.config.ts  playwright.config.ts
tsconfig.json  tsconfig.app.json  tsconfig.node.json  eslint.config.js  .prettierrc
index.html  .gitignore  LICENSE  LICENSE-ASSETS  README.md
src/
  main.tsx  App.tsx  App.test.tsx  index.css
  test/setup.ts                     RTL + jest-dom setup
  data/ids.ts (+test)               id regexes, parse/format
  data/schema.ts (+test)            zod: manifest, taxonomy, index, structure files
  data/checkContent.ts (+test)      pure content/manifest consistency check
  data/manifest.ts                  cached manifest fetch for the app
  scene/meshRegistry.ts (+test)     Map<MeshId, Mesh> + meshIdOf
  scene/AtlasCanvas.tsx             Canvas, lights, CameraControls, Bvh, Suspense
  scene/BundleModel.tsx             load one GLB, register meshes
  scene/BundleErrorBoundary.tsx     per-bundle error UI
  scene/DebugStats.tsx              ?debug probe + overlay
  app/testHooks.ts                  window.__atlas in dev only
scripts/check-content.ts            CLI wrapper for checkContent
content/taxonomy.json  content/en/index.json  content/en/structures/.gitkeep
public/models/manifest.json  public/models/skeletal.<hash>.glb
pipeline/
  README.md  config.json  name-map.json
  blender/inventory.py  blender/export.py
  src/types.ts                      inventory, export-plan, stub types
  src/config.ts (+test)             zod pipeline config + defaults
  src/select.ts (+test)             rule matching
  src/nameMap.ts (+test)            id proposals, name-map merge
  src/resolvePlan.ts (+test)        export plan + structure stubs
  src/optimize.ts (+test)           glTF-Transform chain, mesh stats, file naming
  src/outputs.ts (+test)            write GLBs + manifest, delete stale
  src/scaffold.ts (+test)           merge stubs into content/en/index.json
  src/verify.ts (+test)             budgets, hashes, orientation, height
  src/blender.ts                    spawn Blender headless
  cli.ts                            inventory | namemap | build | verify
e2e/viewer.spec.ts
docs/phase-0-results.md
```

---

### Task 1: Repo scaffold, tooling and CI script

**Files:**
- Create: everything at the repo root listed above, plus `src/main.tsx`, `src/App.tsx`, `src/App.test.tsx`, `src/index.css`, `src/test/setup.ts` and `.github/workflows/ci.yml`.

**Interfaces:**
- Produces:
  - npm scripts `dev`, `build`, `preview`, `typecheck` (`tsc -b`), `lint`, `format`, `test` (`vitest run`), `test:e2e`, `check:content`, `assets:inventory`, `assets:namemap`, `assets:build`, `assets:verify`, and `ci`.
  - `ci` runs `typecheck && lint && test && check:content && assets:verify && build`.
  - The scripts not yet backed by code (`check:content`, `assets:*`, `test:e2e`) are wired in the task that creates their entry point, and `ci` is extended at the same moment.
  - `App` renders `<main aria-label="Anatomy viewer">`.

- [ ] **Step 1: Init git.** Run `git init -b main` in the repo root (the `docs/` folder already exists), then `git remote add origin https://github.com/KeremVona/human-body.git`. Push only as the owner's kickoff instructions allow.
- [ ] **Step 2: Scaffold.** Run `npm create vite@latest` with the `react-ts` template into a temporary folder, then move its files into the repo root, keeping `docs/`. Delete the template's demo assets and CSS.
- [ ] **Step 3: Install dependencies.**
  - `npm i tailwindcss @tailwindcss/vite zod`
  - `npm i -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event prettier tsx @types/node`
- [ ] **Step 4: Configure the tooling.**
  - `vite.config.ts`: plugins `[react(), tailwindcss()]`, `base: process.env.ATLAS_BASE_PATH ?? '/'`.
  - `src/index.css` is exactly `@import "tailwindcss";`.
  - `vitest.config.ts` defines two `projects`:
    - `web`: `src/**/*.test.{ts,tsx}`, `environment: 'jsdom'`, `setupFiles: ['src/test/setup.ts']`.
    - `node`: `pipeline/**/*.test.ts` and `scripts/**/*.test.ts`, `environment: 'node'`.
  - Both Vitest projects set `extends: true`, so they inherit the root Vite plugins.
  - `src/test/setup.ts` is `import '@testing-library/jest-dom/vitest';`.
  - `tsconfig.app.json` adds `resolveJsonModule: true`; tests import `content/*.json`.
  - `tsconfig.node.json` includes `pipeline/**/*.ts`, `scripts/**/*.ts` and the config files.
  - `.gitignore`: `node_modules`, `dist`, `pipeline/source/`, `pipeline/out/`, `test-results`, `playwright-report`, `.env*.local`.
- [ ] **Step 5: Write the failing test** in `src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import App from './App';

it('renders the full-bleed viewer shell', () => {
  render(<App />);
  const main = screen.getByRole('main', { name: 'Anatomy viewer' });
  expect(main).toHaveClass('h-dvh', 'w-full');
});
```

- [ ] **Step 6: Run** `npm test`. Expected: FAIL, because the template App has no such `main`.
- [ ] **Step 7: Implement `App(): JSX.Element`.** A `<main aria-label="Anatomy viewer" className="h-dvh w-full overflow-hidden bg-[radial-gradient(ellipse_at_center,#2a3038_0%,#14171c_100%)]">` (the §5.2 background) that contains nothing yet.
- [ ] **Step 8: Run** `npm test`. Expected: PASS.
- [ ] **Step 9: Add licenses and the CI workflow.**
  - `LICENSE`: MIT, copyright "the project contributors", 2026.
  - `LICENSE-ASSETS`: states that `public/models/` and `content/` are CC-BY-SA 4.0, derived from Z-Anatomy (CC-BY-SA 4.0), which is built on BodyParts3D (© The Database Center for Life Science). Task 5 replaces this paragraph with the exact upstream attribution wording.
  - `.github/workflows/ci.yml`: `ubuntu-latest`, Node 24, `npm ci`, `npm run ci`. Task 9 adds the e2e steps.
- [ ] **Step 10: Verify.**
  - `npm run typecheck && npm run lint && npm test && npm run build` all pass.
  - `ls postcss.config.* 2>/dev/null` prints nothing.
  - `npm run dev` shows the dark gradient page.
- [ ] **Step 11: Commit.** `git add -A && git commit -m "chore: scaffold Vite + React + TS + Tailwind v4 + Vitest"`

---

### Task 2: Id rules

**Files:**
- Create: `src/data/ids.ts`
- Test: `src/data/ids.test.ts`

**Interfaces:**
- Produces:
  - `type StructureId = string`, `type MeshId = string`, `type Side = 'left' | 'right' | null`
  - `STRUCTURE_ID_RE: RegExp`, `MESH_ID_RE: RegExp`
  - `isStructureId(s: string): boolean`, `isMeshId(s: string): boolean`
  - `parseMeshId(id: string): { structureId: StructureId; side: Side }`, which throws `Error('invalid mesh id "<id>"')`
  - `toMeshId(structureId: StructureId, side: Side): MeshId`

- [ ] **Step 1: Write the failing tests.**

```ts
import { isStructureId, isMeshId, parseMeshId, toMeshId } from './ids';

it('accepts kebab-case structure ids', () => {
  for (const ok of ['femur', 'biceps-brachii', 'vertebra-c1']) expect(isStructureId(ok)).toBe(true);
});
it('rejects malformed structure ids', () => {
  for (const bad of ['Femur', 'femur--l', '-femur', 'femur-', 'fé-mur', 'femur_l', ''])
    expect(isStructureId(bad)).toBe(false);
});
it('accepts mesh ids with an optional side suffix only', () => {
  for (const ok of ['femur--l', 'femur--r', 'sternum']) expect(isMeshId(ok)).toBe(true);
  for (const bad of ['femur--x', 'femur---l', 'femur--', 'Femur.l']) expect(isMeshId(bad)).toBe(false);
});
it('parses and formats sides', () => {
  expect(parseMeshId('femur--l')).toEqual({ structureId: 'femur', side: 'left' });
  expect(parseMeshId('sternum')).toEqual({ structureId: 'sternum', side: null });
  expect(() => parseMeshId('Femur.l')).toThrow('invalid mesh id "Femur.l"');
  expect(toMeshId('femur', 'right')).toBe('femur--r');
  expect(toMeshId('sternum', null)).toBe('sternum');
});
```

- [ ] **Step 2: Run** `npx vitest run src/data/ids.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the Produces list in `src/data/ids.ts`. `MESH_ID_RE` is `^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[lr])?$`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(data): structure and mesh id rules"`. Run `git add` first for new files.

---

### Task 3: Shared schemas and taxonomy

**Files:**
- Create: `src/data/schema.ts`, `content/taxonomy.json`
- Test: `src/data/schema.test.ts`

**Interfaces:**
- Consumes: `STRUCTURE_ID_RE`, `MESH_ID_RE` (Task 2).
- Produces (each is a Zod schema plus its inferred type of the same name without `Schema`):
  - **Enums:**
    - `SystemIdSchema`: `skeletal|muscular|cardiovascular|nervous|respiratory|digestive|urinary|lymphatic|integumentary`
    - `RegionIdSchema`: `head|neck|thorax|abdomen|pelvis|back|upper-limb|lower-limb|multiple`
    - `KindSchema`: `muscle|bone|organ|vessel|nerve|other`
    - `TissueSchema`: `bone|cartilage|muscle|tendon|ligament|artery|vein|nerve|organ|other`
    - `HexColorSchema`: `^#[0-9a-fA-F]{6}$`
  - `TaxonomySchema`: `{ systems: {id: SystemId; label; color: HexColor; order: number}[]; regions: {id: RegionId; label}[]; uiGroups: {id: string; label: string; systems: SystemId[]}[] }`
  - `ManifestSchema`, with `Vec3 = [number, number, number]`:

    ```
    {
      version: 1,
      generatedAt: string,
      source: { name, version, license },
      bundles: { id: kebab string, file: /^[a-z0-9-]+\.[0-9a-f]{8}\.glb$/, bytes: int, sha256: /^[0-9a-f]{64}$/, meshIds: MeshId[] }[],
      meshes: Record<MeshId, { bundle: string; bounds: { min: Vec3; max: Vec3 }; triangles: int; sizeClass: 'tiny'|'small'|'medium'|'large' }>
    }
    ```

  - `IndexEntrySchema`: `{ id: StructureId; system; region; group?: string; paired: boolean; kind; tissue; color?: HexColor; names: { common: string(min 1); latin?: string; synonyms: string[] }; featured: boolean }`
  - `IndexFileSchema`: `{ locale: string; structures: IndexEntry[] }`
  - `DetailsSchema`, a discriminated union on `kind`:
    - `{kind:'muscle', origin, insertion, innervation, bloodSupply, action}`, all non-empty strings
    - `{kind:'bone', boneType: 'long'|'short'|'flat'|'irregular'|'sesamoid', articulatesWith: StructureId[]}`
    - `{kind:'facts', facts: string[] (min 1)}`
  - `SourceSchema`: `{ title; url: URL string; license }`
  - `StructureFileSchema`: `{ system: SystemId; entries: { id: StructureId; overview?; function?; details?: Details; sources: Source[] (min 1) }[] }`

- [ ] **Step 1: Write the failing tests.** Example objects are built inline in the test file.

```ts
import taxonomy from '../../content/taxonomy.json';
import { ManifestSchema, IndexEntrySchema, DetailsSchema, TaxonomySchema } from './schema';

const bundle = { id: 'skeletal', file: 'skeletal.1a2b3c4d.glb', bytes: 10, sha256: 'a'.repeat(64), meshIds: ['femur--l'] };
const mesh = { bundle: 'skeletal', bounds: { min: [0, 0, 0], max: [1, 1, 1] }, triangles: 12, sizeClass: 'large' };
const manifest = { version: 1, generatedAt: '2026-11-21T00:00:00Z', source: { name: 'Z-Anatomy', version: 'x', license: 'CC-BY-SA-4.0' }, bundles: [bundle], meshes: { 'femur--l': mesh } };

it('accepts a valid manifest', () => expect(ManifestSchema.safeParse(manifest).success).toBe(true));
it('rejects bundle files that contain a path or lack a hash', () => {
  for (const file of ['models/skeletal.1a2b3c4d.glb', 'skeletal.glb', 'skeletal.1A2B3C4D.glb'])
    expect(ManifestSchema.safeParse({ ...manifest, bundles: [{ ...bundle, file }] }).success).toBe(false);
});
it('rejects invalid mesh ids as manifest keys', () =>
  expect(ManifestSchema.safeParse({ ...manifest, meshes: { 'Femur.l': mesh } }).success).toBe(false));
it('rejects an unknown tissue', () => {
  const entry = { id: 'femur', system: 'skeletal', region: 'lower-limb', paired: true, kind: 'bone', tissue: 'wood', names: { common: 'Femur', synonyms: [] }, featured: false };
  expect(IndexEntrySchema.safeParse(entry).success).toBe(false);
  expect(IndexEntrySchema.safeParse({ ...entry, tissue: 'bone' }).success).toBe(true);
});
it('requires all five muscle detail fields', () =>
  expect(DetailsSchema.safeParse({ kind: 'muscle', origin: 'a', insertion: 'b', innervation: 'c', action: 'e' }).success).toBe(false));
it('ships a valid taxonomy with nine systems and the Major Organs group', () => {
  const t = TaxonomySchema.parse(taxonomy);
  expect(t.systems).toHaveLength(9);
  const organs = t.uiGroups.find((g) => g.id === 'major-organs')!;
  expect(organs.label).toBe('Major Organs');
  expect(organs.systems).toEqual(['nervous', 'respiratory', 'digestive', 'urinary', 'lymphatic']);
});
```

- [ ] **Step 2: Run** `npx vitest run src/data/schema.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `src/data/schema.ts`** per the Produces list. Manifest `meshes` keys are validated with `z.record(z.string().regex(MESH_ID_RE), …)`.
- [ ] **Step 4: Write `content/taxonomy.json`.**
  - Systems, in this order with these colours:
    1. skeletal `#E8DCC4`
    2. muscular `#C0504D`
    3. cardiovascular `#D93A3A`
    4. nervous `#E5C34B`
    5. respiratory `#E89AA6`
    6. digestive `#C98A4B`
    7. urinary `#8E7CC3`
    8. lymphatic `#5FB58A`
    9. integumentary `#D8A98A`
  - Labels are the capitalised names.
  - All nine regions, **in `RegionIdSchema`'s order** (head, neck, thorax, abdomen, pelvis, back, upper limb, lower limb, multiple), with labels such as "Upper limb" and "Multiple regions". Later plans sort by this order.
  - One uiGroup: `major-organs`.
- [ ] **Step 5: Run** the tests. Expected: PASS.
- [ ] **Step 6: Commit.** `git commit -m "feat(data): zod contracts for manifest, taxonomy and content"`

---

### Task 4: Content check (CI gate)

**Files:**
- Create: `src/data/checkContent.ts`, `scripts/check-content.ts`, `content/en/index.json` (`{"locale":"en","structures":[]}`), `content/en/structures/.gitkeep`, and `public/models/manifest.json`. The manifest starts as a valid empty placeholder: `bundles: []`, `meshes: {}`, Z-Anatomy source info.
- Modify: `package.json`, wiring `check:content` = `tsx scripts/check-content.ts`.
- Test: `src/data/checkContent.test.ts`

**Interfaces:**
- Consumes: schemas (Task 3) and `parseMeshId` (Task 2).
- Produces:
  - `checkContent(input: { manifest: unknown; taxonomy: unknown; index: unknown; structureFiles: Record<string /* e.g. "structures/skeletal.json" */, unknown> }): ContentReport`
  - `type ContentReport = { errors: string[]; warnings: string[] }`
  - The CLI reads `public/models/manifest.json`, `content/taxonomy.json`, `content/en/index.json` and `content/en/structures/*.json`. It prints a summary and exits 1 if there are any errors.

- [ ] **Step 1: Write the failing tests.**
  - Build one consistent fixture inline: the taxonomy from `content/taxonomy.json`; an index with `femur` (paired, bone, skeletal, lower-limb) and `sternum` (unpaired); a manifest with `femur--l`, `femur--r` and `sternum`; and `structures/skeletal.json` with femur bone details.
  - Each test mutates one thing and asserts the exact message:

| Test | Mutation | Expect |
|---|---|---|
| `passes on consistent content` | none | `{ errors: [], warnings: [] }` |
| `reports duplicate index ids` | second `femur` entry | error `index.json: duplicate structure id "femur"` |
| `reports a mesh with no structure` | add manifest mesh `tibia--l` | error `manifest: mesh "tibia--l" has no structure "tibia" in index.json` |
| `warns on a structure with no meshes` | add index entry `patella` | warning `index.json: structure "patella" has no meshes in manifest` |
| `reports unknown region` | femur region `"leg"` | error starts with `index.json:` (schema) |
| `reports a sided mesh on an unpaired structure` | femur `paired: false` | error `manifest: mesh "femur--l" has a side but structure "femur" is not paired` |
| `reports an unsided mesh on a paired structure` | sternum `paired: true` | error `manifest: mesh "sternum" has no side but structure "sternum" is paired` |
| `warns on a missing side` | drop `femur--r` | warning `manifest: paired structure "femur" has no right mesh` |
| `reports details for an unknown id` | details entry `humerus` | error `structures/skeletal.json: "humerus" is not in index.json` |
| `reports details in the wrong system file` | femur details in `structures/muscular.json` (system muscular) | error `structures/muscular.json: "femur" belongs to system "skeletal"` |
| `reports details whose kind disagrees` | femur details `{kind:'muscle',…}` | error `structures/skeletal.json: "femur" has muscle details but kind "bone"` |

  - Kind compatibility: muscle → `muscle`, bone → `bone`, every other kind → `facts`.

- [ ] **Step 2: Run** `npx vitest run src/data/checkContent.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `checkContent`.** If any input fails its schema, return the formatted schema errors (`<file>: <dotted.path>: <message>`) and skip the cross-checks.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Implement the CLI** and add `check:content` to `ci`. Run `npm run check:content`. Expected: `0 errors, 0 warnings`, exit 0.
- [ ] **Step 6: Commit.** `git commit -m "feat(data): content consistency check for CI"`

---

### Task 5: Blender runner, inventory, and naming survey

**Requires:** the Prerequisites above.

**Files:**
- Create: `pipeline/blender/inventory.py`, `pipeline/src/blender.ts`, `pipeline/src/types.ts`, `pipeline/cli.ts`, `pipeline/README.md`
- Modify: `package.json` (`assets:inventory` = `tsx pipeline/cli.ts inventory`), `LICENSE-ASSETS`

**Interfaces:**
- Produces:
  - `type InventoryObject = { name: string; type: string; collections: string[]; vertices: number; hasUV: boolean }`
    - `collections` holds every full collection path the object belongs to, joined with `/`, for example `"Skeletal system/Lower limb"`.
  - `type Inventory = { blenderVersion: string; sourceFile: string; objects: InventoryObject[] }`
  - `runBlender(args: { blend: string; script: string; scriptArgs: string[] }): Promise<void>`
    - Spawns `BLENDER_PATH` (read from `process.env`, loading `.env.local` with Node's `process.loadEnvFile` if present), falling back to `blender`.
    - Arguments: `-b <blend> --factory-startup --python-exit-code 1 -P <script> -- ...scriptArgs`.
    - Streams output, and rejects with an error that includes the exit code.
  - Command `npm run assets:inventory` writes `pipeline/out/inventory.json`.

- [ ] **Step 1: Implement `inventory.py`.**
  - Parse the arguments after `--` (`--out <path>`).
  - Walk `bpy.data.objects`. Each object's collection paths come from a recursive walk of `bpy.context.scene.collection` children.
  - Record `len(obj.data.vertices)` and `bool(obj.data.uv_layers)` for MESH objects, and 0/false otherwise.
  - Write the JSON with `bpy.app.version_string`.
- [ ] **Step 2: Implement `runBlender`** and the `inventory` subcommand in `pipeline/cli.ts`. The CLI uses `process.argv[2]` as the subcommand.
- [ ] **Step 3: Run** `npm run assets:inventory`. Expected: exit 0, and `pipeline/out/inventory.json` exists with thousands of objects. Count MESH objects with `node -e` reading the JSON.
- [ ] **Step 4: Write the survey into `pipeline/README.md`.** Record:
  - the source download URL and date,
  - the source file's SHA-256 (`certutil -hashfile pipeline/source/Z-Anatomy.blend SHA256` or `sha256sum`),
  - the Blender version,
  - the top-level collection tree (two levels),
  - 20 sample mesh object names showing the naming patterns: side suffixes, Latin vs English, `.001` duplicates, label/text objects,
  - whether skeletal meshes have UVs,
  - which collections hold the skeleton,
  - **whether paired structures are separate objects, or one object with a Mirror modifier.** If it's a Mirror modifier, `export.py` must apply the modifier and split the result by loose parts into `.l` and `.r` objects before renaming. Write this finding at the top of the README; Task 7 depends on it.
- [ ] **Step 5: Confirm the license.** Copy the exact attribution wording from the Z-Anatomy README and from BodyParts3D's license page into `LICENSE-ASSETS`. Note which BodyParts3D license version applies (CC-BY-SA 2.1 JP or CC-BY 4.0).
- [ ] **Step 5b: Find the incompatibly licensed models.** The Z-Anatomy README lists extra reference models under CC-BY, **CC-BY-NC-SA and CC-BY-NC**. Non-commercial models are **not** compatible with this project's CC-BY-SA 4.0 assets.
  - Find which collections or objects in the `.blend` come from those models.
  - List them in `pipeline/README.md` under "Excluded for licensing".
  - Make sure no config rule in Task 6 ever selects them.
  - Only Z-Anatomy and BodyParts3D geometry ships.
- [ ] **Step 6: Commit.** `git commit -m "feat(pipeline): headless Blender inventory and source survey"`. The inventory JSON itself stays in the ignored `pipeline/out/`.

---

### Task 6: Pipeline config, rule matching and id proposals

**Files:**
- Create: `pipeline/src/config.ts`, `pipeline/src/select.ts`, `pipeline/src/nameMap.ts`, `pipeline/config.json`, `pipeline/name-map.json`
- Modify: `pipeline/cli.ts` (adds `namemap`), `package.json` (`assets:namemap`)
- Test: `pipeline/src/config.test.ts`, `pipeline/src/select.test.ts`, `pipeline/src/nameMap.test.ts`

**Interfaces:**
- Consumes: `InventoryObject` (Task 5), schema enums (Task 3), `isMeshId` and `toMeshId` (Task 2).
- Produces:
  - `PipelineConfigSchema` / `PipelineConfig`:

    ```
    {
      source: { file: string; name: string; version: string; license: string },
      originBundle: string,               // must equal a bundles[].id; default "skeletal"
      orientation: {
        rotateZDeg: number,               // default 0
        scale: number,                    // default 1
        checks: { above: [MeshId, MeshId][]; anterior: [MeshId, MeshId][]; leftSide: MeshId[] }
      },
      simplify: { ratio: number; error: number },   // defaults 1 and 0.001
      budgets: { perBundleBytes: Record<string, number>; defaultBundleBytes: number; totalBytes: number },
      bundles: {
        id: string;
        rules: {
          system: SystemId; region: RegionId; kind: Kind; tissue: Tissue; color?: HexColor;
          match: { collection?: string; name?: string /* regex source, case-insensitive */ };
          exclude?: string[] /* regex sources */
        }[]
      }[]
    }
    ```

  - `selectObjects(config: PipelineConfig, objects: InventoryObject[]): { selected: Selection[]; unmatched: number }`
    - `type Selection = { object: InventoryObject; bundleId: string; rule: PipelineConfig['bundles'][number]['rules'][number] }`
  - `proposeMeshId(sourceName: string): { meshId: MeshId | null; needsReview: boolean }`
  - `type NameMap = Record<string /* source object name */, MeshId>`
  - `updateNameMap(existing: NameMap, sourceNames: string[]): { map: NameMap; added: string[]; needsReview: string[] }`
  - Command `npm run assets:namemap` reads the config and `pipeline/out/inventory.json`, runs `selectObjects`, then merges into `pipeline/name-map.json` (keys sorted). It prints the added and needs-review lists.

- [ ] **Step 1: Write the failing tests.**

```ts
// nameMap.test.ts
it.each([
  ['Femur.l', 'femur--l', false],
  ['Os coxae.r', 'os-coxae--r', false],
  ['Thyroid cartilage_L', 'thyroid-cartilage--l', false],
  ['Kidney left', 'kidney--l', false],
  ['Sternum', 'sternum', false],
  ['Músculo', 'musculo', false],
  ['Vertebra C1.001', 'vertebra-c1', true],
  ['Os sacrum (vertebrae sacrales)', 'os-sacrum-vertebrae-sacrales', true],
  ['***', null, true],
])('proposeMeshId(%s)', (name, meshId, needsReview) =>
  expect(proposeMeshId(name)).toEqual({ meshId, needsReview }));

it('never changes an existing mapping', () => {
  const r = updateNameMap({ 'Femur.l': 'thigh-bone--l' }, ['Femur.l', 'Tibia.r', 'Vertebra C1.001', '***']);
  expect(r.map).toEqual({ 'Femur.l': 'thigh-bone--l', 'Tibia.r': 'tibia--r', 'Vertebra C1.001': 'vertebra-c1' });
  expect(Object.keys(r.map)).toEqual(['Femur.l', 'Tibia.r', 'Vertebra C1.001']);
  expect(r.added).toEqual(['Tibia.r', 'Vertebra C1.001']);
  expect(r.needsReview).toEqual(['Vertebra C1.001', '***']);
});
```

```ts
// select.test.ts — config built with a test helper `cfg(rules)`
it('matches a collection on whole path segments only', () => {
  const objs = [obj('A', ['Skeletal system/Lower limb/Femur']), obj('B', ['Skeletal system/Lower limb']), obj('C', ['Skeletal system/Lower limbs'])];
  expect(selectObjects(cfg([{ match: { collection: 'Skeletal system/Lower limb' } }]), objs).selected.map((s) => s.object.name)).toEqual(['A', 'B']);
});
it('applies name regex and exclude, skips non-mesh, first rule wins', () => {
  const objs = [obj('Femur.l', ['S']), obj('Femur label', ['S']), obj('Rib 2', ['S']), obj('Rib 1', ['S'], 'FONT')];
  const r = selectObjects(cfg([
    { match: { collection: 'S' }, exclude: ['label$'], region: 'lower-limb' },
    { match: { collection: 'S', name: '^rib' }, region: 'thorax' },
  ]), objs);
  // 'Rib 2' matches both rules; the first one wins
  expect(r.selected.map((s) => [s.object.name, s.rule.region])).toEqual([['Femur.l', 'lower-limb'], ['Rib 2', 'lower-limb']]);
  expect(r.unmatched).toBe(1); // 'Femur label' is a MESH matched by no rule; 'Rib 1' isn't a mesh and isn't counted
});
```

```ts
// config.test.ts
it('fills defaults', () => {
  const c = PipelineConfigSchema.parse(minimalConfig);
  expect(c.originBundle).toBe('skeletal');
  expect(c.orientation).toMatchObject({ rotateZDeg: 0, scale: 1 });
  expect(c.simplify).toEqual({ ratio: 1, error: 0.001 });
});
it('rejects an originBundle that is not a bundle', () =>
  expect(PipelineConfigSchema.safeParse({ ...minimalConfig, originBundle: 'organs' }).success).toBe(false));
```

  - The tests define their helpers: `obj(name, collections, type = 'MESH')`, `cfg(rules)` (one bundle `skeletal`, rule defaults `system: 'skeletal'`, `region: 'lower-limb'`, `kind: 'bone'`, `tissue: 'bone'`), and `minimalConfig`.

- [ ] **Step 2: Run** `npx vitest run pipeline/src`. Expected: FAIL.
- [ ] **Step 3: Implement the three modules.**
  - `proposeMeshId` steps, in order:
    1. Note `needsReview` if the name matches `/\.\d{3}$/`, then strip that suffix.
    2. Detect the side with `/[._\s](l|r|left|right)$/i`, then strip it.
    3. Note `needsReview` if the remainder contains any character outside letters (including accented ones), digits, spaces and `-`.
    4. Normalise NFD and drop combining marks, lowercase, replace each run of non-`[a-z0-9]` with `-`, and trim the dashes.
    5. If the result is empty, return `null`.
  - `updateNameMap` puts names whose proposal is `null` in `needsReview` and leaves them out of `map`.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Write the skeletal section of `pipeline/config.json`.**
  - Use the collection tree recorded in Task 5. One rule per anatomical region of the skeleton, `tissue: "bone"`, `kind: "bone"`, plus a cartilage rule if cartilages are separate objects.
  - Set `orientation.checks` from real names, for example `above: [["skull","femur--l"]]`, `anterior: [["sternum","<a thoracic vertebra id>"]]`, `leftSide: ["femur--l"]`. Finish these after Step 7 once the ids exist.
  - Set budgets per Global Constraints.
- [ ] **Step 6: Run** `npm run assets:namemap`. Expected: it prints about 200 added entries for the skeleton.
- [ ] **Step 7: Hand-curate `pipeline/name-map.json` for the skeleton.**
  - Change every Latin-derived id to its **English common-name** id (`os-femoris--l` → `femur--l`). Ids are permanent (§7.5).
  - Resolve every needs-review entry.
  - Re-run `npm run assets:namemap`. Expected: `0 added`.
- [ ] **Step 8: Commit.** `git commit -m "feat(pipeline): config rules, id proposals, curated skeletal name-map"`

---

### Task 7: Export plan and Blender export

**Files:**
- Create: `pipeline/src/resolvePlan.ts`, `pipeline/blender/export.py`
- Modify: `pipeline/cli.ts` (adds the `build` subcommand, stages 1–2), `package.json` (`assets:build` = `tsx pipeline/cli.ts build`)
- Test: `pipeline/src/resolvePlan.test.ts`

**Interfaces:**
- Consumes: `selectObjects`, `NameMap`, `PipelineConfig` (Task 6), `parseMeshId` (Task 2).
- Produces:
  - `type ExportPlan = { originBundle: string; rotateZDeg: number; scale: number; bundles: { id: string; objects: { source: string; meshId: MeshId }[] }[] }`
    - Objects are sorted by `meshId`.
  - `type StructureStub = { id: StructureId; displayName: string; system; region; kind; tissue; color?: HexColor; paired: boolean; meshIds: MeshId[] }`
  - `resolvePlan(config: PipelineConfig, inventory: Inventory, nameMap: NameMap): { plan: ExportPlan; stubs: StructureStub[]; problems: string[] }`
  - `export.py` takes `--plan <path> --out <dir>` and writes `<dir>/<bundleId>.glb` for every bundle.

- [ ] **Step 1: Write the failing tests.** Inline fixtures: `femur.l`, `femur.r`, `sternum` in the skeletal bundle.

| Test | Expect |
|---|---|
| `groups selected objects into bundles sorted by mesh id` | `plan.bundles[0].objects` = `[{source:'Femur.l',meshId:'femur--l'},{source:'Femur.r',meshId:'femur--r'},{source:'Sternum',meshId:'sternum'}]` |
| `derives one paired stub per structure` | stub `femur` has `paired: true`, `meshIds: ['femur--l','femur--r']`, `displayName: 'Femur'`, plus the rule's system, region, kind and tissue |
| `reports a selected object missing from the name-map` | problem `name-map: no id for "Patella.l" (run npm run assets:namemap)` |
| `rejects two sources mapping to one mesh id` | problem `name-map: "Femur.l" and "Femur.l.001" both map to "femur--l"` |
| `reports meshes of one structure that disagree` | `femur--l` matched with region lower-limb and `femur--r` with pelvis → problem `structure "femur": meshes disagree on region (lower-limb vs pelvis)` |
| `copies origin and orientation settings` | `plan.originBundle === 'skeletal'`, `plan.rotateZDeg === 0`, `plan.scale === 1` |

  - `displayName` comes from the source name of the structure's first mesh (sorted by meshId), with the duplicate and side suffixes removed and the first letter capitalised.

- [ ] **Step 2: Run** `npx vitest run pipeline/src/resolvePlan.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `resolvePlan`.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Implement `export.py`**, in this order:
  1. Load the plan.
  2. For every planned object: make it visible and selectable. This means `hide_set(False)` and `hide_viewport = False`, un-exclude every `LayerCollection` on its path, and `hide_select = False`.
  3. `make_single_user(object=True, obdata=True)`, then clear the parent while keeping the transform.
  4. Apply a rotation of `rotateZDeg` and a scale of `scale` around the world origin.
  5. Compute the world bounding-box centre of all `originBundle` objects. Translate every planned object by minus that centre, then `transform_apply(location=True, rotation=True, scale=True)`.
  6. Rename each object to its `meshId`.
  7. For each bundle: select only its objects, then `bpy.ops.export_scene.gltf(filepath=..., export_format='GLB', use_selection=True, export_apply=True, export_materials='NONE', export_yup=True, export_cameras=False, export_lights=False, export_animations=False, export_skins=False, export_morph=False, export_extras=False)`.
  8. Exit non-zero listing any planned source names that don't exist in the file.
- [ ] **Step 6: Wire stages 1–2 of `build`:** resolve the plan (exit 1 printing `problems` if any), write `pipeline/out/export-plan.json`, then run Blender `export.py` into `pipeline/out/raw/`.
- [ ] **Step 7: Run** `npm run assets:build`. Expected: `pipeline/out/raw/skeletal.glb` exists. Open it in https://gltf-viewer.donmccurdy.com (or Blender) and check that the node names are MeshIds and the body faces +Z.
- [ ] **Step 8: Commit.** `git commit -m "feat(pipeline): export plan resolution and headless glTF export"`

---

### Task 8: Optimise, manifest, scaffold, verify

**Files:**
- Create: `pipeline/src/optimize.ts`, `pipeline/src/outputs.ts`, `pipeline/src/scaffold.ts`, `pipeline/src/verify.ts`
- Modify: `pipeline/cli.ts` (stages 3–6 of `build`, plus a `verify` subcommand), `package.json` (`assets:verify` = `tsx pipeline/cli.ts verify`; add it to `ci`)
- Generated, committed: `public/models/skeletal.<hash>.glb`, `public/models/manifest.json`, `content/en/index.json`
- Test: `pipeline/src/optimize.test.ts`, `outputs.test.ts`, `scaffold.test.ts`, `verify.test.ts`
- Install: `npm i -D @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer`

**Interfaces:**
- Consumes: `ExportPlan`, `StructureStub` (Task 7), `PipelineConfig` (Task 6), `Manifest`, `IndexFile` (Task 3).
- Produces:
  - `type MeshStats = Omit<Manifest['meshes'][string], 'bundle'>`
  - `optimizeBundle(glb: Uint8Array, opts: { ratio: number; error: number }, bodyHeight?: number): Promise<{ glb: Uint8Array; meshes: Record<MeshId, MeshStats>; height: number }>`
    - `bodyHeight` defaults to the bundle's own y-extent and is returned as `height`. `build` runs the `originBundle` first and passes its height to every other bundle.
  - `sizeClassFor(radius: number, bodyHeight: number): 'tiny' | 'small' | 'medium' | 'large'`
    - `radius` is half the diagonal of the mesh's world bounding box.
    - Thresholds on `radius / bodyHeight`: under 0.005 is tiny, under 0.02 small, under 0.08 medium, otherwise large.
  - `bundleFileName(id: string, glb: Uint8Array): string`
  - `writeOutputs(dir: string, bundles: { id: string; glb: Uint8Array; meshes: Record<MeshId, MeshStats> }[], source: Manifest['source']): Manifest`
    - Adds `bundle` to each mesh entry, sets `generatedAt` to now, and writes the GLBs and `manifest.json`.
    - Deletes `*.glb` files in `dir` that the new manifest doesn't reference.
  - `scaffoldIndex(existing: IndexFile, stubs: StructureStub[]): IndexFile`
  - `verifyManifest(manifest: Manifest, config: PipelineConfig, files: Record<string, { bytes: number; sha256: string } | undefined>): string[]`

- [ ] **Step 1: Write the failing tests.**

```ts
// optimize.test.ts — makeGlb(boxes) builds a Document with one node per [name, size] box mesh and returns NodeIO bytes
it('keeps node names and applies meshopt compression', async () => {
  const { glb } = await optimizeBundle(await makeGlb([['femur--l', 0.5], ['femur--r', 0.5]]), { ratio: 1, error: 0.001 });
  const doc = await readWithMeshopt(glb);
  expect(doc.getRoot().listNodes().map((n) => n.getName()).sort()).toEqual(['femur--l', 'femur--r']);
  expect(doc.getRoot().listExtensionsUsed().map((e) => e.extensionName)).toContain('EXT_meshopt_compression');
});
it('measures bounds, triangles and size class before quantization', async () => {
  const { meshes } = await optimizeBundle(await makeGlb([['skull', 0.5], ['stapes', 0.005]]), { ratio: 1, error: 0.001 }, 1.7);
  expect(meshes['skull']).toMatchObject({ triangles: 12, sizeClass: 'large' });
  expect(meshes['skull'].bounds.max[0]).toBeCloseTo(0.25, 3);
  expect(meshes['stapes'].sizeClass).toBe('tiny');
});
it('sizeClassFor uses the pinned thresholds', () => {
  expect([0.008, 0.03, 0.1, 0.2].map((r) => sizeClassFor(r, 1.7))).toEqual(['tiny', 'small', 'medium', 'large']);
});
it('names files by content hash', () => {
  const bytes = new TextEncoder().encode('x');
  expect(bundleFileName('skeletal', bytes)).toBe('skeletal.2d711642.glb'); // sha256("x") starts 2d711642
});
```

```ts
// outputs.test.ts — uses a temp dir from fs.mkdtemp(os.tmpdir())
it('writeOutputs removes stale bundle files', () => {
  // dir pre-seeded with skeletal.deadbeef.glb and notes.txt
  const m = writeOutputs(dir, [{ id: 'skeletal', glb: bytes, meshes }], source);
  expect(readdirSync(dir).sort()).toEqual([m.bundles[0].file, 'manifest.json', 'notes.txt'].sort());
  expect(ManifestSchema.parse(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))).bundles[0].meshIds).toEqual(Object.keys(meshes).sort());
});
```

```ts
// scaffold.test.ts
it('adds missing stubs, never edits existing entries, sorts by id', () => {
  const existing = { locale: 'en', structures: [{ ...femurEntry, names: { common: 'Thigh bone', synonyms: [] }, featured: true }] };
  const out = scaffoldIndex(existing, [femurStub, sternumStub]);
  expect(out.structures.map((s) => s.id)).toEqual(['femur', 'sternum']);
  expect(out.structures[0]).toEqual(existing.structures[0]);
  expect(out.structures[1]).toEqual({ id: 'sternum', system: 'skeletal', region: 'thorax', paired: false, kind: 'bone', tissue: 'bone', names: { common: 'Sternum', synonyms: [] }, featured: false });
});
```

```ts
// verify.test.ts — manifest built from boxes placed at chosen centres; body height 1.7
it.each([
  ['over budget', { skeletalBytes: 6_000_000 }, 'bundle "skeletal" is 6000000 bytes, over its 5242880-byte budget'],
  ['hash mismatch', { badHash: true }, 'bundle "skeletal": file hash does not match manifest'],
  ['missing file', { missingFile: true }, 'bundle "skeletal": file skeletal.1a2b3c4d.glb not found'],
  ['upside down', { skullY: -0.7 }, 'orientation: "skull" should be above "femur--l"'],
  ['facing backwards', { sternumZ: -0.1 }, 'orientation: "sternum" should be anterior to "vertebra-t6"'],
  ['mirrored', { femurLX: -0.1 }, 'orientation: "femur--l" should be on +X (patient left)'],
  ['wrong units', { height: 17 }, 'body height 17.00 is outside 1.4–2.2 (check orientation.scale)'],
])('reports %s', (_, tweak, message) => expect(verifyManifest(...fixture(tweak))).toContain(message));
it('passes a good manifest', () => expect(verifyManifest(...fixture({}))).toEqual([]));
```

- [ ] **Step 2: Run** `npx vitest run pipeline/src`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
  - `optimizeBundle` uses a `NodeIO` registered with `ALL_EXTENSIONS` plus `MeshoptEncoder` and `MeshoptDecoder` dependencies, all awaited `.ready`. The chain:
    1. `dedup()`, `weld()`, then `simplify({ simplifier: MeshoptSimplifier, ratio, error })`, skipped when `ratio === 1`.
    2. Measure meshes, using world bounds from `getBounds(node)`.
    3. `quantize()`.
    4. Add `EXTMeshoptCompression` (`setRequired(true)`, `EncoderMethod.QUANTIZE`), then `prune()`.
    5. Write the binary.
  - Never call `join()` or `flatten()`, which merge or rename nodes.
  - `verifyManifest` computes body height as the union y-extent of the `originBundle` meshes. A missing per-bundle budget falls back to `defaultBundleBytes`, and the total is checked against `totalBytes`.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Wire stages 3–6 of `build`.**
  - Optimise every `pipeline/out/raw/*.glb`, `originBundle` first.
  - `writeOutputs('public/models', …)`.
  - Run `scaffoldIndex` on `content/en/index.json` and write it back with 2-space JSON.
  - Run `verifyManifest`, then `checkContent`. Exit 1 on any problem.
  - The `verify` subcommand runs only the last step, hashing files from disk, so CI needs no Blender.
- [ ] **Step 6: Run** `npm run assets:build`, then `npm run ci`.
  - Expected: both pass.
  - `public/models/` holds exactly one hashed skeletal GLB plus `manifest.json`.
  - `content/en/index.json` lists every skeletal structure.
  - If an orientation check fails, fix `orientation.rotateZDeg` or `scale` in the config and rebuild.
- [ ] **Step 7: Commit.** `git add -A && git commit -m "feat(pipeline): meshopt optimisation, manifest, content scaffold, verification; first skeletal bundle"`

---

### Task 9: Minimal viewer on the final architecture

**Files:**
- Create: `src/data/manifest.ts`, `src/scene/meshRegistry.ts`, `src/scene/AtlasCanvas.tsx`, `src/scene/BundleModel.tsx`, `src/scene/BundleErrorBoundary.tsx`, `src/scene/DebugStats.tsx`, `src/app/testHooks.ts`, `playwright.config.ts`, `e2e/viewer.spec.ts`
- Modify: `src/App.tsx`, `src/App.test.tsx` (mock `./scene/AtlasCanvas`), `package.json` (`test:e2e` = `playwright test`), `.github/workflows/ci.yml` (add `npx playwright install --with-deps chromium` and `npm run test:e2e`)
- Install: `npm i three @react-three/fiber @react-three/drei three-mesh-bvh`, `npm i -D @types/three @playwright/test`
- Test: `src/scene/meshRegistry.test.ts`

**Interfaces:**
- Consumes: `ManifestSchema` (Task 3), `isMeshId` (Task 2), the committed manifest and GLB (Task 8).
- Produces (Plan 2 builds on these):
  - `loadManifest(): Promise<Manifest>`
    - Module-cached. Fetches `${import.meta.env.BASE_URL}models/manifest.json` and parses it with `ManifestSchema`.
  - `bundleUrl(file: string): string`
  - `type MeshRegistry = { register(id: MeshId, mesh: Mesh): void; unregister(ids: MeshId[]): void; get(id: MeshId): Mesh | undefined; ids(): MeshId[]; readonly size: number }`
    - `register` throws `Error('duplicate mesh id "<id>"')`.
  - `createMeshRegistry(): MeshRegistry`
  - `meshIdOf(object: Object3D): MeshId | null`
    - Returns the object's own name, or the nearest ancestor's, that passes `isMeshId`.
  - `MeshRegistryProvider` and `useMeshRegistry(): MeshRegistry`
  - `<BundleModel url: string; bundleId: string; onReady?(count: number): void />`
    - Calls `useGLTF(url, false, true)` (Meshopt on).
    - Registers each `Mesh` under `meshIdOf(mesh)` in a `useEffect`, with an `unregister` cleanup.
    - Gives every mesh one shared placeholder `MeshStandardMaterial({ color: '#E8DCC4', roughness: 0.85 })`. Plan 2 swaps in the MaterialLibrary.
  - `<BundleErrorBoundary bundleId: string; onError(bundleId: string): void>`
    - Lives *inside* the Canvas, so it renders `null` when it catches an error and calls `onError`. The R3F tree can't render DOM elements.
    - `App` keeps `failedBundles: string[]` and renders `<p role="alert">Couldn't load the {bundleId} model.</p>` for each one in a DOM overlay above the canvas.
  - `<AtlasCanvas debug: boolean>`
    - `frameloop={debug ? 'always' : 'demand'}`, camera `fov: 35`, `<CameraControls makeDefault />`.
    - Placeholder key, fill and rim directional lights, and `<Bvh firstHitOnly>` around the bundles.
    - Each bundle sits in its own `Suspense` and `BundleErrorBoundary`.
  - `DebugStats`: a probe inside the Canvas samples every 500 ms and reports `{ fps, calls, triangles }` from `gl.info.render`. An overlay outside the Canvas shows `fps 60 · draw calls 412 · triangles 1.2M · meshes 206`.
  - `installTestHooks(api: { registry: MeshRegistry; isReady(): boolean }): void`
    - Only when `import.meta.env.DEV`. Sets `window.__atlas = { meshCount(), meshIds(), ready }`, where `ready` is a getter.
  - `App` creates the registry once, loads the `skeletal` bundle from the manifest, and shows `DebugStats` when `?debug` is present.

- [ ] **Step 1: Write the failing unit tests.**

```ts
import { Group, Mesh } from 'three';
import { createMeshRegistry, meshIdOf } from './meshRegistry';

it('registers, finds and unregisters meshes; rejects duplicates', () => {
  const r = createMeshRegistry(); const m = new Mesh();
  r.register('femur--l', m);
  expect(r.get('femur--l')).toBe(m); expect(r.size).toBe(1); expect(r.ids()).toEqual(['femur--l']);
  expect(() => r.register('femur--l', new Mesh())).toThrow('duplicate mesh id "femur--l"');
  r.unregister(['femur--l']); expect(r.size).toBe(0);
});
it('meshIdOf walks up to the nearest valid ancestor', () => {
  const g = new Group(); g.name = 'femur--l';
  const child = new Mesh(); child.name = 'femur--l_1'; g.add(child);
  const plain = new Mesh(); plain.name = 'sternum';
  const orphan = new Mesh(); orphan.name = 'Scene';
  expect(meshIdOf(child)).toBe('femur--l');
  expect(meshIdOf(plain)).toBe('sternum');
  expect(meshIdOf(orphan)).toBeNull();
});
```

- [ ] **Step 2: Run** `npx vitest run src/scene`. Expected: FAIL.
- [ ] **Step 3: Implement `meshRegistry.ts`.** Run the tests. Expected: PASS.
- [ ] **Step 4: Write the failing e2e tests** in `e2e/viewer.spec.ts`.
  - `playwright.config.ts` uses `webServer: { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI }` and `use: { baseURL: 'http://localhost:5173' }`.
  - Chromium only, with `launchOptions.args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']`, which gives headless WebGL.

```ts
import { test, expect } from '@playwright/test';

test('loads the skeletal bundle and registers every mesh', async ({ page, request }) => {
  const manifest = await (await request.get('/models/manifest.json')).json();
  const expected = manifest.bundles.find((b: { id: string }) => b.id === 'skeletal').meshIds.length;
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForFunction(() => (window as any).__atlas?.ready === true, null, { timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).__atlas.meshCount())).toBe(expected);
});

test('shows an error when the skeletal bundle fails', async ({ page }) => {
  await page.route('**/models/skeletal.*.glb', (route) => route.fulfill({ status: 404 }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toHaveText("Couldn't load the skeletal model.");
  await expect(page.getByRole('main', { name: 'Anatomy viewer' })).toBeVisible();
});

test('?debug shows renderer stats', async ({ page }) => {
  await page.goto('/?debug');
  await expect(page.getByText(/draw calls \d+/)).toBeVisible({ timeout: 30_000 });
});
```

- [ ] **Step 5: Run** `npx playwright install chromium && npm run test:e2e`. Expected: FAIL.
- [ ] **Step 6: Implement** the remaining Produces items and update `App`. In `App.test.tsx`, add `vi.mock('./scene/AtlasCanvas', () => ({ AtlasCanvas: () => null }))`, because jsdom has no WebGL.
- [ ] **Step 7: Run** `npm run ci && npm run test:e2e`. Expected: all PASS. Then `npm run dev` and open `/`: the skeleton is visible, and orbit, pan and zoom work.
- [ ] **Step 8: Commit.** `git add -A && git commit -m "feat(scene): registry-based bundle viewer with debug stats and e2e smoke tests"`

---

### Task 10: Measure, record, decide (Phase 0 gate)

**Files:**
- Create: `docs/phase-0-results.md`
- Modify: `README.md`

- [ ] **Step 1: Measure.** Run `npm run build && npm run preview` and open `/?debug` on the owner's machine. Record the following in `docs/phase-0-results.md`:
  - source version and SHA-256, and Blender version,
  - inventory object count, and skeletal meshes exported,
  - raw vs optimised bytes,
  - triangle count, draw calls,
  - fps idle and while orbiting, plus the GPU name,
  - body height, and the orientation check results,
  - time until the skeleton is visible: DevTools Network throttled to "Fast 4G", from a hard reload until `__atlas.ready`, timed in the console with `performance.now()` in dev.
- [ ] **Step 2: Extrapolate.** Using skeletal bytes per mesh and triangles per mesh, estimate the four-bundle totals for §7.3's 1,000–1,500 meshes against the budgets.
- [ ] **Step 3: Decide.** In the doc, write **Go** (budgets look reachable) or **Revise**. Revise names which §7.3 or §7.4 numbers would need to change, and why. A Revise decision stops the work: report it to the owner, because the spec has to be updated before Plan 2 starts.
- [ ] **Step 4: Update the README.** Project one-liner; how to run (`npm i`, `npm run dev`); how to rebuild assets (Prerequisites, `assets:inventory`, `assets:namemap`, `assets:build`); the license split; and the credits for Z-Anatomy and BodyParts3D with links.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "docs: phase 0 results and README"`
