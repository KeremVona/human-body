# Phase 3D More Systems & a Second Language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Add lymphatic detail, and skin if licensable full-body geometry exists, within a hard cap of 450 meshes and 12,000,000 bytes.
- Make the whole app, both the UI and the anatomy content, available in one additional language chosen by the owner, with English fallback field by field.

**Architecture:**
- **Systems:** reuse the Plan 1 pipeline. Add new bundles through `pipeline/config.json` rules plus name-map curation. Add new tissues `skin` and `lymph` to the schema and the material looks. The load order is extended.
- **Locales:**
  - UI strings move into a typed English catalogue (`src/i18n/messages/en.ts`), read through a tiny `t()` helper. The other catalogue is checked against it at compile time with `satisfies Messages`.
  - Content gains `content/<locale>/…` folders with the same schemas. The content slice merges the localised content over English per field.
  - The locale lives in the `ui` slice, persisted as `atlas.locale`.

**Tech Stack:** Existing. No i18n library [P3 §7.2].

**Spec:** `docs/superpowers/specs/2026-11-24-phase-3-design.md` §7 ("P3 §"). **Depends on:** Plans 3A–3C merged. **Code baseline:** `main` after Plan 3C.

## Global Constraints

- **Mesh budget:**
  - New meshes ≤ 450 in total, so the total stays ≤ 1,461 draw calls.
  - New bytes ≤ 12,000,000.
  - All bundles together ≤ 41,943,040 bytes (v1 budget).
- **Licensing:** only Z-Anatomy and BodyParts3D geometry. Every exclusion in `pipeline/README.md` "Excluded for licensing" stays. New candidates are documented there before any rule selects them.
- **Skin:** ships only if Task 1 finds a full-body surface of verified provenance. Its tissue is `skin`, and the `integumentary` system defaults to **opacity 0.35**.
- **Share-link `o` field:** from now on it holds opacities that differ from the **default** opacity map (`DEFAULT_OPACITY`), not from 1. Links made before this plan still decode correctly, because an `o` entry equal to 1 just sets 1.
- **Load order:** append the new bundles after `cardiovascular`.
- **Locale code:** the BCP-47 primary tag, such as `tr` or `de`. Owner-chosen; call it `LOC` below.
- **Choosing the locale:**
  1. `?lang=` when that locale is available,
  2. else stored `atlas.locale`,
  3. else the first `navigator.languages` entry whose primary tag is available,
  4. else `en`.

  `<html lang>` always matches the active locale.
- **Fallback:** a missing translated field falls back to English. The Inspector shows `t('content.notTranslated')`, which is `Not yet translated` in English, whenever any shown field fell back.
- **Copy:**
  - English copy stays byte-identical, so every existing exact-copy test still passes unchanged.
  - New English keys: `settings.language` = `Language`, `content.notTranslated` = `Not yet translated`, `about.translationNote` = `Translations are machine-assisted drafts.`
- **Search:** in `LOC`, the index includes both `LOC` and English names, so either works.
- **Boot cost:** the `LOC` catalogue and content are lazy-loaded. English stays in the main chunk.

## Review Focus

1. **A visitor whose browser language is `LOC` but whose `LOC` content files 404** (for example, a partial deploy). The app falls back to English with no boot error. → Task 7, `missing locale files fall back to English`.
2. **The `LOC` catalogue missing a key** that the code uses. It must fail typechecking, not show raw keys at runtime. → Task 6, the `satisfies` compile check, plus a key-parity test.
3. **The new skin layer at default opacity covering everything.** Picking must still reach the structures underneath, because skin at 0.35 is below the 0.5 pickable threshold. → Task 4, `skin at default opacity is not pickable`.
4. **A share link from before this plan** (no `o` for integumentary) opened after it. The skin opacity comes from the defaults. → Task 4, codec default test.
5. **Long translated strings** (some languages run 30–40% longer) overflowing the panels, toolbar or Inspector on mobile. → Task 9 e2e overflow checks in `LOC`.

---

## Task 0: Gate and the owner's language choice

- [ ] **Step 1:** Confirm Plan 3C is merged and `npm run ci && npm run test:e2e` pass.
- [ ] **Step 2:** If the owner's kickoff message doesn't name the additional language, **stop and ask**: "Which language should Phase 3D add?" Record the answer as `LOC` in the commit message of Task 6. Tasks 1–5 (systems) can go ahead while waiting.

### Task 1: Provenance survey for lymphatic and skin

**Files:**
- Modify: `pipeline/README.md` (new sections "Phase 3D survey" and any new "Excluded for licensing" entries)

- [ ] **Step 1: Survey.** Using `pipeline/out/inventory.json` (re-run `npm run assets:inventory` if it's missing), list:
  - every MESH in `6: Lymphoid organs`, grouped by subcollection, with vertex counts;
  - every MESH in `9: Regions of human body` and `Bonus collection/Regions of human body`, looking for a contiguous full-body surface (skin). Record the names, the vertex counts, and whether they tile the body surface. Check this visually in Blender if needed (`blender pipeline/source/Z-Anatomy.blend`, with scripts disabled).
- [ ] **Step 2: Decide provenance.**
  - Anything credited in `pipeline/source/Z-Anatomy-License.txt` to a third party, or of unclear origin, is excluded and listed.
  - Write **`Skin: ship`** or **`Skin: not shipped — <reason>`** in the survey section.
- [ ] **Step 3: Pick the lymphatic set.** Choose lymph nodes and lymphoid organs up to the remaining mesh budget: 450 minus the skin meshes. Prefer node groups a visitor would recognise (cervical, axillary, inguinal), plus the thymus, the tonsils and the cisterna chyli if present.
- [ ] **Step 4: Commit.** `git commit -am "docs(pipeline): phase 3D provenance survey"`

### Task 2: Schema and material looks for the new tissues

**Files:**
- Modify: `src/data/schema.ts` (`TissueSchema` gains `skin` and `lymph`), `src/scene/materials.ts` (`TISSUE_LOOKS`), `pipeline/src/config.ts` (accepts the new tissues)
- Test: extend `src/data/schema.test.ts` and `src/scene/materials.test.ts`

**Interfaces:**
- Produces:
  - `TISSUE_LOOKS.skin`: a warm neutral colour (builder's choice), roughness ≥ 0.7, clearcoat 0, sheen 0.2.
  - `TISSUE_LOOKS.lymph`: a green distinct from every other tissue colour, roughness 0.45, clearcoat 0.3.

- [ ] **Step 1: Write the failing tests.**
  - `IndexEntrySchema` accepts `tissue: 'skin'` and `'lymph'`.
  - The existing "every tissue colour is distinct" test covers 12 tissues.
  - Skin roughness ≥ 0.7.
- [ ] **Step 2: Run** `npx vitest run src/data src/scene/materials.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(data): skin and lymph tissues"`

### Task 3: New bundles through the pipeline

**Files:**
- Modify: `pipeline/config.json` (bundles `lymphatic`, and `skin` if shipping), `pipeline/name-map.json`, `src/features/assets/scheduler.ts` (`BUNDLE_LOAD_ORDER` appends `'lymphatic', 'skin'`)
- Generated, committed: `public/models/*`, `content/en/index.json`
- Test: extend `src/features/assets/scheduler.test.ts`

- [ ] **Step 1: Add the rules.**
  - Lymphatic: `system: 'lymphatic'`, `tissue: 'lymph'`, `kind: 'organ'`, with the right regions.
  - Skin: `system: 'integumentary'`, `tissue: 'skin'`, `kind: 'other'`, `region: 'multiple'`.
  - Use `exclude` patterns for everything that Task 1 excluded.
- [ ] **Step 2: Run** `npm run assets:namemap`, then curate English ids as in Plan 1 Task 6. Re-run. Expected: `0 added`, and no needs-review entries.
- [ ] **Step 3: Set the budgets** in `pipeline/config.json`: `perBundleBytes.lymphatic` and `.skin` such that together they're ≤ 12,000,000. Then run `npm run assets:build`.
  - Expected: it passes.
  - The new mesh count is ≤ 450: compare `Object.keys(manifest.meshes).length` with 1,011.
  - If over: tighten the rules and `simplify`. Never raise budgets.
- [ ] **Step 4: Update the scheduler test.** The test that lists the order now expects `[..., 'cardiovascular', 'lymphatic', 'skin']`, and manifest-only bundles still come after.
- [ ] **Step 5: Run** `npm run ci`. Expected: PASS.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(assets): lymphatic (and skin) bundles"`

### Task 4: Default opacities, the skin toggle and the codec

**Files:**
- Modify: `src/features/systems/systemsSlice.ts` (`DEFAULT_OPACITY` exported; integumentary 0.35), `src/features/share/thunks.ts` (`o` diffs against `DEFAULT_OPACITY`, and missing systems are reset to their default), `content/en/index.json` (English names for the new structures; Plan 3 Task 2 rules)
- Test: extend `systemsSlice.test.ts`, `src/features/share/thunks.test.ts`, `src/scene/resolveMeshState.test.ts`

**Interfaces:**
- Produces: `DEFAULT_OPACITY: Record<SystemId, number>`. Every system is 1 except `integumentary`, which is 0.35.

- [ ] **Step 1: Write the failing tests.**

| Test | Expect |
|---|---|
| `skin defaults to 0.35` | initial `systems.integumentary.opacity === 0.35` |
| `skin at default opacity is not pickable` | `resolveMeshState` with `systemOpacity: 0.35` → `pickable: false`, `visible: true` |
| `codec stores only non-default opacities` | integumentary 0.35 and muscular 1 → capture has no `o`; integumentary 0.6 → `o: { integumentary: 0.6 }` |
| `old links get default skin opacity` | apply a view with `s` including `integumentary` and no `o` → opacity 0.35 |

- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement.** Write English names and Latin names for every new index entry. `npm run content:report` should show `missingLatin` 0 for `lymphatic`, apart from structures with no TA name, listed in the commit message.
- [ ] **Step 4: Run** `npm run ci && npm run test:e2e`. Expected: PASS. Update e2e tests that count systems or rows to include the new rows.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(systems): skin default opacity; lymphatic names; share defaults"`

### Task 5: Systems performance check

**Files:**
- Create: `docs/phase-3d-performance.md`

- [ ] **Step 1: Measure** with every system on, including skin at 0.35, on Auto and Low: draw calls (Low), fps idle and orbiting, and the skeleton-visible time on Fast 4G.
- [ ] **Step 2:** If draw calls exceed 1,500 or any v1 §9.1 budget fails, write "Needs optimisation" and stop for the owner. The `BatchedMesh` work is a separate plan.
- [ ] **Step 3: Commit.** `git add -A && git commit -m "docs: phase 3D systems performance"`

### Task 6: UI message catalogue and `t()`

**Files:**
- Create: `src/i18n/messages/en.ts`, `src/i18n/messages/LOC.ts` (the real code, for example `tr.ts`), `src/i18n/t.ts`, `src/i18n/locale.ts`
- Modify: every component with user-visible copy (`src/features/**`, `src/App.tsx`, `src/scene/BundleErrorBoundary`-related DOM messages); `src/features/settings/uiSlice.ts` (adds `locale`)
- Test: `src/i18n/t.test.ts`, `src/i18n/locale.test.ts`, `src/i18n/parity.test.ts`

**Interfaces:**
- Produces:
  - `en`: a nested `as const` object of every UI string, including the exact copy listed in Plans 2–4, 3A, 3B and 3C. Placeholders use `{name}` syntax.
  - `type Messages = DeepStringRecord<typeof en>`. The `LOC` catalogue is declared `export const LOC = { … } satisfies Messages;` with every key present.
  - `type MessageKey`: dot-paths into `en`.
  - `t(key: MessageKey, vars?: Record<string, string | number>): string`. Reads the active catalogue, falls back to `en` for a missing key (a dev-only `console.warn`), and replaces `{name}`.
  - `AVAILABLE_LOCALES = ['en', 'LOC'] as const`, and `type Locale = typeof AVAILABLE_LOCALES[number]`.
  - `resolveInitialLocale(input: { query: string | null; stored: string | null; navigatorLanguages: readonly string[] }): Locale`
  - `ui.locale: Locale`, with `localeSet(locale)`, which persists `atlas.locale` (try/catch) and sets `document.documentElement.lang`.
  - `loadMessages(locale): Promise<void>`. Dynamically imports the `LOC` catalogue; `en` is static.
  - `useT(): typeof t`. Re-renders on locale change.

- [ ] **Step 1: Write the failing tests.**

```ts
it.each([
  [{ query: 'LOC', stored: 'en', navigatorLanguages: ['en-US'] }, 'LOC'],
  [{ query: 'xx', stored: 'LOC', navigatorLanguages: ['en-US'] }, 'LOC'],
  [{ query: null, stored: null, navigatorLanguages: ['LOC-XX', 'en'] }, 'LOC'],
  [{ query: null, stored: null, navigatorLanguages: ['fr-FR'] }, 'en'],
])('resolveInitialLocale(%o) = %s', (input, want) => expect(resolveInitialLocale(input)).toBe(want));
```

  - Replace `LOC` with the real code in the test.
  - **`t.test.ts`:**
    - `t('share.copied')` is `Link copied` in `en`.
    - Placeholders: `t('motion.playing', { label: 'X' })` is `Playing X.`
    - A missing `LOC` key falls back to `en`.
  - **`parity.test.ts`:** every leaf key of `en` exists in `LOC` and is non-empty, and every `{placeholder}` set matches per key.
- [ ] **Step 2: Run** `npx vitest run src/i18n`. Expected: FAIL.
- [ ] **Step 3: Implement** the catalogue and helpers. Then replace every literal user-visible string in components with `t(…)`, one feature folder per commit if that's easier to review.
  - The **English output must be byte-identical**. The whole existing unit and e2e suite is the safety net and must pass unchanged.
  - Draft the `LOC` translation of the full catalogue at the same time.
- [ ] **Step 4: Run** `npm run ci && npm run test:e2e`. Expected: PASS with no test edits, other than imports where a test file builds a component tree that now needs the i18n provider.
- [ ] **Step 5: Commit** each step, ending with `git commit -m "feat(i18n): typed message catalogue, t(), LOC UI translation"`.

### Task 7: Localised content and fallback

**Files:**
- Create: `content/LOC/index.json`, `content/LOC/structures/<system>.json`, `src/features/content/localize.ts`
- Modify: `src/features/content/contentSlice.ts` (loads by locale, with merging), `src/data/checkContent.ts` and `scripts/check-content.ts` (validate locale folders, report coverage), `src/data/contentReport.ts` (a per-locale coverage row), `src/features/inspector/Inspector.tsx` (the not-translated note), `src/features/search/searchIndex.ts` (indexes both name sets)
- Test: `src/features/content/localize.test.ts`, extend `contentSlice.test.ts`, `checkContent.test.ts`, `searchIndex.test.ts`, `Inspector.test.tsx`

**Interfaces:**
- Produces:
  - `localizeIndex(en: IndexFile, loc: IndexFile | null): { file: IndexFile; fallbackIds: ReadonlySet<StructureId> }`
    - It overlays only `names.common`, `names.latin` and `names.synonyms` from `loc`. Ids, systems and everything else always come from `en`.
    - An id is in `fallbackIds` when `loc` has no entry for it.
  - `localizeStructures(en: StructureFile | null, loc: StructureFile | null): { file: StructureFile | null; fallbackIds: ReadonlySet<StructureId> }`
    - It overlays per field: `overview`, `function`, the string fields of `details`, and `sources`.
    - An id is in `fallbackIds` when any field that `en` has is missing in `loc`.
  - `content` state adds `locale: Locale`, `fallback: { index: StructureId[]; structures: Record<SystemId, StructureId[]> }`.
  - `bootstrap` and `loadStructures` fetch `content/en/...` and, when the locale isn't `en`, also `content/<locale>/...`. **A 404 or a schema failure in the locale file is treated as `null`, never as a boot error.**
  - `localeSet` triggers a reload of the localised content: index and loaded systems.
  - **`checkContent` errors:**
    - `content/LOC/index.json: "<id>" is not in content/en/index.json`
    - `content/LOC/structures/<s>.json: "<id>" belongs to system "<x>"`
    - The usual schema, markup and length rules apply to the localised text.
  - `contentReport` adds `{ locale, names: { translated, total }, featured: { translated, total } }`.
  - The search index includes `LOC` names plus English names when the locale is `LOC`.

- [ ] **Step 1: Write the failing tests.**

| Test | Expect |
|---|---|
| `overlays names only` | `en` femur `{common:'Femur', system:'skeletal'}`, `loc` femur `{common:'Uyluk kemiği', system:'muscular'}` → common from `loc`, system `'skeletal'` |
| `tracks index fallback` | `loc` lacks sternum → `fallbackIds` has sternum |
| `overlays structure fields and tracks partial fallback` | `loc` femur has an overview but no function → overview from `loc`, function from `en`, femur in `fallbackIds` |
| `missing locale files fall back to English` | fetch 404s for `content/LOC/*` → `boot: 'ready'`, English content, all ids in fallback |
| `checkContent validates locale folders` | `loc` index with an unknown id → the error above |
| `search matches both languages` | locale `LOC` → searching the `LOC` common name and the English name both find femur |
| `Inspector shows the not-translated note` | femur in the structures fallback → `Not yet translated` (rendered in `en`) |

- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(content): per-locale content with field-level English fallback"`

### Task 8: Language setting and translation drafting

**Files:**
- Modify: `src/features/settings/SettingsMenu.tsx` (a `Language` radio group: `English` plus the `LOC` native name), `src/App.tsx` (resolves the initial locale before the first render and sets `<html lang>`), `src/features/about/AboutDialog.tsx` (`about.translationNote`), `README.md` (the same note in English)
- Create/modify: `content/LOC/index.json` (all structures' names), `content/LOC/structures/*.json` (all 125 featured entries, plus any other English entries)

- [ ] **Step 1: Write the failing component tests.**
  - Choosing the `LOC` option → `ui.locale === 'LOC'`, `document.documentElement.lang === 'LOC'`, `localStorage['atlas.locale'] === 'LOC'`, and the top-bar search placeholder is the `LOC` string.
  - The About dialog shows the translation note in both languages.
- [ ] **Step 2: Run** them. Expected: FAIL. **Implement.** Run them again. Expected: PASS.
- [ ] **Step 3: Draft the translations.**
  - Every structure's `names.common` (and synonyms where natural), then all 125 featured entries, following `content/STYLE.md`, which applies in `LOC` too.
  - Latin names stay Latin, so copy them over.
  - `sources` stay the same unless a `LOC` source is used (the same license rules apply).
- [ ] **Step 3b: Spot-check.** Have the owner read 10 random featured entries if they speak `LOC`. This isn't a gate.
- [ ] **Step 4: Run** `npm run check:content && npm run content:report`. Expected: 0 errors. The report shows `LOC` names at 100% and featured at 125/125.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "content(LOC): names and featured entries; language setting"`

### Task 9: End-to-end tests, docs and performance

**Files:**
- Create: `e2e/locale.spec.ts`, `e2e/systems-3d.spec.ts`
- Modify: `docs/phase-3d-performance.md`, `README.md`, `docs/architecture.md`, `src/app/testHooks.ts` (if needed)

- [ ] **Step 1: Write the e2e tests.**

| Test | Steps → expectation |
|---|---|
| `?lang=LOC renders the UI and content in LOC` | `/?lang=LOC` → `html[lang="LOC"]`, the `LOC` top-bar strings, and the Inspector for `femur--l` shows the `LOC` common name |
| `browser language picks LOC` | a Playwright context with `locale: 'LOC-XX'` → `html[lang="LOC"]` |
| `language persists` | Settings → `LOC` → reload → still `LOC` |
| `no overflow in LOC` | desktop and mobile projects: open the Inspector on the structure with the longest `LOC` name, plus the Systems, Pins and Motion tabs and the toolbar → each container `scrollWidth <= clientWidth` |
| `lymphatic system toggles and is pickable` | enable `Lymphatic` → bundle ready → click `screenPointOf(<a lymph node id>)` → selected |
| `skin is see-through by default` (only if skin ships) | enable `Integumentary` → click `screenPointOf('sternum')` → `sternum` selected (skin at 0.35 isn't pickable) |

- [ ] **Step 2: Run** `npm run test:e2e`. Fix real bugs until it passes.
- [ ] **Step 3: Measure.** Re-measure the Fast 4G skeleton-visible time in `en` and in `LOC`, and append to `docs/phase-3d-performance.md`. Stop for the owner if a budget fails.
- [ ] **Step 4: Update docs.** README features and languages, the translation note, and the `i18n` and locale-content flow in `docs/architecture.md`.
- [ ] **Step 5: Run** `npm run ci && npm run test:e2e`. Expected: PASS.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "test(e2e): locales and new systems; docs"`
