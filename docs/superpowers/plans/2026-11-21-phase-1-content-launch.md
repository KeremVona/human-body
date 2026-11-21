# Phase 1 Content & Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every structure a proper English name, and write fact-checked plain-English content for about 125 featured structures. Then add the About/Credits dialog and the portfolio docs, and launch Phase 1 on a public GitHub Pages URL.

**Architecture:**
- Content stays in `content/` as JSON validated by Plan 1's schemas.
- This plan adds "featured" quality rules to `checkContent`, plus a report script, so CI enforces completeness.
- The app gets one small UI piece, the About dialog, which uses Plan 2's components.

**Tech Stack:** As in Plans 1–2. No new dependencies, except `cross-env` if Plan 2 hasn't already added it.

**Spec:** `docs/superpowers/specs/2026-11-21-anatomy-atlas-design.md` (§). **Prior plans:**
- `docs/superpowers/plans/2026-11-21-foundation-asset-spike.md` ("Plan 1")
- `docs/superpowers/plans/2026-11-21-phase-1-viewer-dissection.md` ("Plan 2")

## Global Constraints

The Global Constraints of Plans 1 and 2 still apply. In addition:

- **Audience (§1):** curious non-experts. Plain English first, Latin second.
- **Who writes:** the implementing agent drafts all content (§7.5, an [Owner] decision).
  - Every factual field (origin, insertion, innervation, blood supply, action, bone type, articulations, key facts) must be **checked against a source listed in that entry's `sources[]`** while drafting.
  - The owner may spot-check, but isn't a gate.
- **What text may be adapted:**
  - Only CC-BY-SA- or CC-BY-licensed text may be adapted: Wikipedia (CC-BY-SA 4.0) and OpenStax *Anatomy and Physiology 2e* (CC-BY 4.0).
  - Adapted text must be **rewritten in plain language, not pasted**.
  - Other references may be cited for facts only.
- **License field values:** `CC-BY-SA-4.0` for Wikipedia, `CC-BY-4.0` for OpenStax, and `facts-only` for anything else cited.
- **Featured set:** 125 structures. Skeletal 35, muscular 45, cardiovascular 20, organs 25 (spread across nervous, respiratory, digestive, urinary and lymphatic).
- **Length limits:** `overview` ≤ 400 characters, which is 1–3 sentences. `function` ≤ 600 characters.
- **Text fields are plain text.** No HTML or Markdown.
- **Disclaimer copy, exact:** `This atlas is for learning and curiosity. It is not medical advice.`
- **App name:** `APP_NAME` lives in `src/app/brand.ts`, default `Anatomy Atlas`. The owner may rename it; nothing else hard-codes the name.
- **Repo URL:** comes from `VITE_REPO_URL`. When it's unset, nothing links to a repo.
- **Publishing gate:** creating the GitHub repo, pushing, enabling Pages and tagging the release are publishing actions. The implementing agent asks the owner and waits for an explicit yes before each one.

## Review Focus

1. **A featured entry cites only Z-Anatomy**, so no fact source exists. CI must reject it. → Task 1, `featured needs a non-Z-Anatomy source`.
2. **Markup sneaks into content text** (`<b>`, `**bold**`, `[link](url)`). CI must reject it, so the plain-text Inspector never shows raw markup. → Task 1, `rejects markup in text fields`.
3. **A bone's `articulatesWith` points at an id that doesn't exist.** The Inspector would then show a blank. → Task 1, `rejects unknown articulation ids`.
4. **The longest real name overflows the Inspector or the hover label on a phone.** → Task 7, e2e `longest names wrap inside the Inspector`.
5. **`VITE_REPO_URL` is unset.** The About dialog must show no dead link. → Task 6, `hides the repo link when no URL is configured`.

---

## Task 0: Gate

- [ ] **Step 1:** Confirm Plan 2 is complete: `npm run ci && npm run test:e2e` pass.
- [ ] **Step 2:** Read `docs/phase-1-performance.md`. If it says "Needs optimisation", stop and report to the owner; the launch waits for that work.

---

### Task 1: Featured-content rules, report and style guide

**Files:**
- Modify: `src/data/checkContent.ts`, `src/data/checkContent.test.ts`
- Create: `src/data/contentReport.ts` (+test), `scripts/content-report.ts`, `content/STYLE.md`
- Modify: `package.json` (`content:report` = `tsx scripts/content-report.ts`)

**Interfaces:**
- Consumes (Plan 1): `checkContent(input): ContentReport`, the schemas.
- Produces:
  - **New `checkContent` rules:**
    - Errors, for featured structures only:
      - `index.json: featured "<id>" has no Latin name`
      - `index.json: featured "<id>" has no entry in structures/<system>.json`
      - `structures/<system>.json: featured "<id>" is missing overview`
      - `structures/<system>.json: featured "<id>" is missing function`
      - `structures/<system>.json: featured "<id>" needs a source other than Z-Anatomy`. A source counts as Z-Anatomy when its URL contains `Z-Anatomy` (case-insensitive).
      - `structures/<system>.json: featured muscle "<id>" has no muscle details`
      - `structures/<system>.json: featured bone "<id>" has no bone details`
    - Errors, for every entry:
      - `structures/<system>.json: "<id>" overview is <n> characters (max 400)`
      - `structures/<system>.json: "<id>" function is <n> characters (max 600)`
      - `structures/<system>.json: "<id>" <field> contains markup`. Applies to `overview`, `function` and every string in `details`, using `/<\/?[a-z][^>]*>|\*\*|\[[^\]]+\]\([^)]+\)/i`.
      - `structures/<system>.json: "<id>" articulates with unknown "<other>"`
    - Warning: `index.json: <n> featured structures (target 125)`, whenever the count isn't 125.
  - **`contentReport(input same as checkContent): { system: SystemId; structures: number; featured: number; featuredComplete: number; missingLatin: number; gaps: { id: StructureId; missing: string[] }[] }[]`**
    - `featuredComplete` counts featured entries with no featured-rule errors.
    - `missing` uses the field names `latin`, `overview`, `function`, `details` and `source`.
  - The `content:report` CLI prints one table row per system, then the gaps, and always exits 0.

- [ ] **Step 1: Write the failing tests** in `checkContent.test.ts`. Extend Plan 1's consistent fixture, marking femur `featured: true` with a full, valid entry.

| Test | Mutation | Expect |
|---|---|---|
| `featured content passes when complete` | none | no errors |
| `featured needs a Latin name` | drop `names.latin` | `index.json: featured "femur" has no Latin name` |
| `featured needs an entry` | delete the femur entry | `index.json: featured "femur" has no entry in structures/skeletal.json` |
| `featured needs overview and function` | delete both | both "missing" errors |
| `featured needs a non-Z-Anatomy source` | sources = `[{ title: 'Z-Anatomy', url: 'https://github.com/LluisV/Z-Anatomy', license: 'CC-BY-SA-4.0' }]` | `structures/skeletal.json: featured "femur" needs a source other than Z-Anatomy` |
| `featured bone needs bone details` | delete details | `structures/skeletal.json: featured bone "femur" has no bone details` |
| `enforces length limits` | overview of 401 chars | `structures/skeletal.json: "femur" overview is 401 characters (max 400)` |
| `rejects markup in text fields` | overview `'The <b>femur</b>…'`, then `'**long**'`, then `'[see](https://x.y)'` | `structures/skeletal.json: "femur" overview contains markup` each time |
| `rejects unknown articulation ids` | `articulatesWith: ['tibiaa']` | `structures/skeletal.json: "femur" articulates with unknown "tibiaa"` |
| `warns when featured count is off target` | 1 featured | warning `index.json: 1 featured structures (target 125)` |

  - **`contentReport.test.ts`:** on the same fixture, femur featured and complete, sternum not featured and without Latin, gives a skeletal row of `{ structures: 2, featured: 1, featuredComplete: 1, missingLatin: 1, gaps: [] }`. Removing femur's `function` gives `gaps: [{ id: 'femur', missing: ['function'] }]` and `featuredComplete: 0`.
- [ ] **Step 2: Run** `npx vitest run src/data`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the rules, `contentReport` and the CLI.
- [ ] **Step 4: Write `content/STYLE.md`.** Cover:
  - **Audience:** curious adults with no science background.
  - **Overview:** what it is and where it is, in 1–3 sentences.
  - **Function:** what it does, in everyday terms.
  - Explain any unavoidable term in the same sentence.
  - No medical or diagnostic advice.
  - Rewrite, never paste.
  - Every fact is backed by a cited source. List which sources may be adapted, and the license value for each.
  - **Latin** means the Terminologia Anatomica name.
  - **Synonyms** means lay names people search for, such as "thigh bone" or "collarbone".
  - Two worked examples: one bone (femur) and one muscle (biceps brachii), as complete JSON entries that pass `check:content`.
- [ ] **Step 5: Run** `npm test && npm run check:content`. Expected: PASS. Only the featured-count warning appears, since nothing is featured yet.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(content): featured quality rules, content report, style guide"`

---

### Task 2: Names pass for every structure

**Files:**
- Modify: `content/en/index.json`

**Interfaces:**
- Consumes: the `content:report` `missingLatin` count (Task 1).
- Produces: every index entry has:
  - an English `names.common`, which is what hover labels show,
  - `names.latin` (the TA name) wherever one exists,
  - lay `synonyms` where people commonly use one.

  Ids never change (§7.5).

- [ ] **Step 1: Run** `npm run content:report` and note `missingLatin` per system.
- [ ] **Step 2: Rewrite names, system by system.**
  - Wherever the pipeline stub put the Latin source name into `common`, move it to `latin` and write the English name in `common`.
  - Names that are the same in both, such as "Biceps brachii", keep the same text in both fields.
  - Keep the side out of names; the side comes from the MeshId.
- [ ] **Step 3: Run** `npm run check:content && npm run content:report`.
  - Expected: no errors.
  - `missingLatin` is 0, or is only for structures that have no TA name. List those in the commit message.
- [ ] **Step 4: Check in the app.** In `npm run dev`, hover 10 random structures in each system and confirm the English labels.
- [ ] **Step 5: Commit.** `git commit -am "content: English common names and Latin names for all structures"`

---

### Task 3: Pick the featured set

**Files:**
- Modify: `content/en/index.json` (`featured: true` on 125 entries)

- [ ] **Step 1: Choose** 35 skeletal, 45 muscular, 20 cardiovascular and 25 organ structures.
  - Prefer structures a lay visitor would recognise.
  - Prefer manifest `sizeClass` of `medium` or `large`.
  - Cover every region.
  - Cardiovascular must include the heart.
  - Organs must include at least the brain, lungs, liver, stomach, small and large intestine, kidneys, bladder and spleen, wherever those meshes exist.
- [ ] **Step 2: Set `featured: true`** on them.
- [ ] **Step 3: Run** `npm run check:content`. Expected: the count warning is gone, and featured "missing" errors are listed. Content is written in Tasks 4–5.
  - To keep CI green between commits, this task and Task 4 may be committed together. If committed separately, temporarily mark only the structures already written as featured.
- [ ] **Step 4: Commit,** together with Task 4's first system.

---

### Task 4: Write skeletal and muscular content

**Files:**
- Create/modify: `content/en/structures/skeletal.json`, `content/en/structures/muscular.json`, `content/en/index.json` (synonyms if newly found)

**Interfaces:**
- Consumes: `content/STYLE.md`, the featured rules (Task 1).
- Produces: complete, valid entries for all 35 skeletal and 45 muscular featured structures. Non-featured structures may get entries too, but don't have to.

- [ ] **Step 1: Draft skeletal entries.**
  - Every entry gets `overview`, `function`, and `details: { kind: 'bone', boneType, articulatesWith }`.
  - Use real StructureIds in `articulatesWith`, and at least one `sources[]` item pointing at the exact page used.
- [ ] **Step 2: Fact-check each skeletal entry.** Open its cited source and confirm the bone type and each articulation.
  - Record the check by putting the exact section-anchor URL in `sources[].url`, where the source has anchors.
- [ ] **Step 3: Run** `npm run check:content && npm run content:report`. Expected: no skeletal errors, and skeletal `featuredComplete` is 35.
- [ ] **Step 4: Commit.** `git add -A && git commit -m "content: featured skeletal entries"`
- [ ] **Step 5: Draft muscular entries:** `overview`, `function`, and `details: { kind: 'muscle', origin, insertion, innervation, bloodSupply, action }`.
  - Origins and insertions use the bone's common name in plain words, for example "Top of the shoulder blade (scapula)".
- [ ] **Step 6: Fact-check each muscular entry** against its source, field by field: origin, insertion, innervation, blood supply, action.
- [ ] **Step 7: Run** the same commands. Expected: no muscular errors, and muscular `featuredComplete` is 45.
- [ ] **Step 8: Commit.** `git add -A && git commit -m "content: featured muscular entries"`

---

### Task 5: Write cardiovascular and organ content

**Files:**
- Create/modify: `content/en/structures/cardiovascular.json`, `nervous.json`, `respiratory.json`, `digestive.json`, `urinary.json`, `lymphatic.json`

**Interfaces:**
- Consumes: as in Task 4.
- Produces: complete entries for the 20 cardiovascular and 25 organ featured structures. Each uses `details: { kind: 'facts', facts }` with 2–5 short facts.

- [ ] **Step 1: Draft cardiovascular entries.** Then fact-check each fact against its source.
- [ ] **Step 2: Run** `npm run check:content && npm run content:report`. Expected: no errors, and cardiovascular `featuredComplete` is 20.
- [ ] **Step 3: Commit.** `git add -A && git commit -m "content: featured cardiovascular entries"`
- [ ] **Step 4: Draft organ entries,** each in the file of the organ's real system. Fact-check them.
- [ ] **Step 5: Run** the same commands. Expected: `check:content` reports 0 errors and 0 warnings, and every system's `featuredComplete` equals its featured count.
- [ ] **Step 6: Check in the app.** In `npm run dev`, open the Inspector for 10 featured structures across systems. Check that all sections render, the Left/Right chips work, and the sources open.
- [ ] **Step 7: Commit.** `git add -A && git commit -m "content: featured organ entries"`

---

### Task 6: About & Credits dialog and top bar

**Files:**
- Create: `src/app/brand.ts`, `src/features/about/AboutDialog.tsx`, `src/features/about/TopBar.tsx`
- Modify: `src/App.tsx`, `index.html` (`<title>` and meta description from `APP_NAME`; set by hand in `index.html`, mirrored in `brand.ts`)
- Test: `src/features/about/AboutDialog.test.tsx`

**Interfaces:**
- Consumes: the Radix Dialog (installed in Plan 2), `LICENSE-ASSETS` wording (Plan 1 Task 5).
- Produces:
  - `APP_NAME = 'Anatomy Atlas'`
  - `REPO_URL: string | undefined = import.meta.env.VITE_REPO_URL || undefined`
  - `<TopBar />`, top-left: the app name, a slot for Phase 2's search, and an icon button `About this atlas` (top-right) that opens `<AboutDialog />`.
  - `<AboutDialog />`: a Radix Dialog titled `About {APP_NAME}`. It contains:
    1. A one-paragraph description.
    2. The disclaimer copy, exactly.
    3. A **Credits** section:
       - **3D models:** Z-Anatomy (link https://github.com/LluisV/Z-Anatomy, CC-BY-SA 4.0), based on BodyParts3D (© The Database Center for Life Science). The license wording is copied from `LICENSE-ASSETS`.
       - **Content:** adapted from Wikipedia (CC-BY-SA 4.0) and OpenStax *Anatomy and Physiology 2e* (CC-BY 4.0). The atlas's models and content are CC-BY-SA 4.0. The code is MIT.
    4. A **Keyboard shortcuts** table: H, I, G, F, Ctrl/Cmd+Z, Esc, 1–6, 0, +/−.
    5. `Source code on GitHub`, a link to `REPO_URL`, shown only when it's set.

- [ ] **Step 1: Write the failing tests.**

| Test | Expect |
|---|---|
| `opens from the top bar` | clicking `About this atlas` shows a dialog named `About Anatomy Atlas` |
| `shows the disclaimer` | text `This atlas is for learning and curiosity. It is not medical advice.` |
| `credits the models and content` | links named `Z-Anatomy`, `Wikipedia` and `OpenStax` are present; text contains `CC-BY-SA 4.0` and `MIT` |
| `lists shortcuts` | a table row containing `Ctrl/Cmd+Z` and `Undo` |
| `hides the repo link when no URL is configured` | with `VITE_REPO_URL` unset (`vi.stubEnv`), there's no link named `Source code on GitHub`; with it set to `https://github.com/x/y`, the link has that `href` |
| `closes with Escape` | dialog gone, and focus returns to the `About this atlas` button |

- [ ] **Step 2: Run** `npx vitest run src/features/about`. Expected: FAIL.
- [ ] **Step 3: Implement**, and mount `TopBar` in `App`.
- [ ] **Step 4: Run** `npm test && npm run test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(ui): top bar and About & Credits dialog"`

---

### Task 7: Layout robustness and docs

**Files:**
- Create: `e2e/layout.spec.ts`, `docs/architecture.md`, `docs/pipeline-writeup.md`, `docs/img/demo.gif`
- Modify: `README.md`

- [ ] **Step 1: Write the failing e2e test.** It runs in both the desktop and mobile Playwright projects.

```ts
test('longest names wrap inside the Inspector and hover label', async ({ page, request }) => {
  const index = await (await request.get('/content/en/index.json')).json();
  const longest = index.structures.reduce((a: any, b: any) =>
    (b.names.latin ?? b.names.common).length > (a.names.latin ?? a.names.common).length ? b : a);
  const manifest = await (await request.get('/models/manifest.json')).json();
  const meshId = Object.keys(manifest.meshes).find((m) => m === longest.id || m.startsWith(`${longest.id}--`))!;
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__atlas?.ready === true);
  await page.evaluate((id) => (window as any).__atlas.select([id]), meshId);
  const aside = page.getByRole('complementary', { name: 'Structure details' });
  await expect(aside).toBeVisible();
  const overflow = await aside.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
```

  - If the longest structure isn't skeletal, the test first runs `__atlas.dispatch({ type: 'systems/systemToggled', payload: longest.system })`, and waits until `__atlas.getState().assets.bundles` reports that system's bundle as `ready`.
- [ ] **Step 2: Run** `npm run test:e2e`. If it fails, fix the Inspector styles (`break-words`, `min-w-0`) and the hover label's `max-w`. Expected: PASS.
- [ ] **Step 3: Write `docs/architecture.md`.** Cover:
  - the layer diagram (§8.1),
  - the "meshes are not React components" rule and the resolve → diff → apply loop,
  - the slices table,
  - bundles vs systems,
  - the progressive loading sequence,
  - the test strategy.

  Link to the spec for anything deeper.
- [ ] **Step 4: Write `docs/pipeline-writeup.md`.** A portfolio write-up of about 800–1,200 words: the problem (a huge raw atlas, a phone-friendly web budget), the pipeline design, the hardest problems found (from `pipeline/README.md`), the before and after numbers from `docs/phase-0-results.md` and `docs/phase-1-performance.md`, and the trade-offs and what's next.
- [ ] **Step 5: Record `docs/img/demo.gif`.** About 15 s at 1280×720 and ≤ 8 MB:
  1. rotate,
  2. click a bone and show the Inspector,
  3. enable muscles,
  4. Fade others,
  5. Isolate,
  6. Show all.
- [ ] **Step 6: Rewrite `README.md`.** Sections:
  1. the GIF, a one-line pitch, and the live URL (a placeholder until Task 8),
  2. features,
  3. the stack,
  4. a short architecture summary linking `docs/architecture.md`,
  5. running locally,
  6. rebuilding assets,
  7. contributing content (link `content/STYLE.md`),
  8. known gaps: keyboard-only selection arrives in Phase 2 (§9.3); Safari status from Task 8,
  9. the license split,
  10. credits,
  11. the disclaimer.
- [ ] **Step 7: Run** `npm run ci && npm run test:e2e`. Expected: PASS.
- [ ] **Step 8: Commit.** `git add -A && git commit -m "docs: architecture, pipeline write-up, README with demo"`

---

### Task 8: Launch

**Files:**
- Create: `docs/launch-checklist.md`
- Modify: `README.md` (live URL, Safari status)

- [ ] **Step 1: Check the remote.** The repo already exists at https://github.com/KeremVona/human-body, and the remote `origin` was added in Plan 1. Ask the owner for an explicit go-ahead to push the launch state, unless their kickoff instructions already allow pushing.
- [ ] **Step 2: After the go-ahead:**
  - `git push origin main`.
  - Ask the owner to confirm Settings → Pages → Source is "GitHub Actions", which is a repo setting and theirs to change.
  - Set the repo variable `VITE_REPO_URL`, and pass it through in `deploy.yml`'s build step.
- [ ] **Step 3: Verify the deploy.**
  - The workflow is green, and `https://<owner>.github.io/<repo>/` loads.
  - The skeleton appears with no alert.
  - All four systems toggle on.
- [ ] **Step 4: Fill in `docs/launch-checklist.md`.** It's a table with one row per browser and device:
  - Chrome, Firefox and Edge on desktop,
  - Safari on macOS and iOS,
  - Chrome on Android, on a real phone.

  The columns:
  - loads under 6 s
  - orbit/zoom/pan
  - hover label (desktop)
  - click/tap select
  - Inspector layout
  - Hide → Undo
  - Isolate → Show all
  - Fade others
  - context menu (right-click / long-press)
  - systems toggles
  - About dialog
  - rough fps from `?debug`

  For Safari, use a real device if the owner has one, otherwise BrowserStack's free open-source plan. If neither is possible, mark it "not tested" and say so in the README's known gaps.
- [ ] **Step 5: Fix any launch blocker** found in Step 4 (a crash, a broken core action, or a broken layout on any tested browser), each in its own commit with a regression test. Record non-blocking issues as GitHub issues, but only after asking the owner.
- [ ] **Step 6: Update the README** with the live URL and the Safari status.
- [ ] **Step 7: Commit.** `git add -A && git commit -m "docs: launch checklist and live URL"`. Push only with the owner's go-ahead from Step 1.
- [ ] **Step 8: Ask the owner** before tagging. On a yes: `git tag v1.0.0 && git push origin v1.0.0`.
