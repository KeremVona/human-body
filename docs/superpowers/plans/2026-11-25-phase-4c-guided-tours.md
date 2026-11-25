# Phase 4C Guided Tours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship five short narrated tours in English and Turkish. Each step sets the view (systems, opacity, dissection, selection, section, camera) and can start a motion demo. Tours can be linked to by step, and exiting always restores the visitor's previous view.

**Architecture:**
- **Data:** a language-neutral structure file (`content/tours.json`) whose steps embed `ViewStateV1` objects, plus per-locale text files (`content/<locale>/tours.json`), merged with field-level English fallback.
- **Validation:** `check:content` validates ids, motions, text and step counts.
- **Playback:** a `tour` slice plus thunks reuse `captureViewState` and `applyViewState`. `applyViewState` gains options for animated camera moves, keeping undo history and keeping shared pins.
- **Boot:** `bootShare` also recognises `#tour/<id>/<n>`.

**Tech Stack:** Existing. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-25-phase-4-design.md` §6 ("P4 §"). **Depends on:** Plan 4B merged (the measurements assume its renderer and boot path). **Code baseline:** `main` after 4B.

## Global Constraints

- **Step count:** 4–7 steps per tour.
- **Text limits:** tour title ≤ 60, summary ≤ 160, step title ≤ 60, step body ≤ 400 characters. Plain text only, using the same markup regex as structure content.
- **Steps:** a step's `view` is a `ViewStateV1` object validated with `ViewStateV1Schema`, with **no `p` (pins)**. Its optional `motion` is `{ id: MotionId; phase?: number in [0,1]; play?: boolean }`.
- **Applying a step:** `applyViewState(step.view, { animate: true, keepHistory: true, keepPins: true })`. Then, when `motion` is present:
  1. `startMotion(id)`.
  2. If `play` isn't true, dispatch `motionPaused(phase ?? 0.25)` and `motionScrubbed(phase ?? 0.25)`.

  Without `motion`, any running demo is stopped.
- **Exit and Finish:** stop motion, then `applyViewState(savedView, { animate: true, keepHistory: true, keepPins: true })`.
- **Tour link hash:** `#tour/<tourId>/<step>`, where step is 1-based. An invalid id or step shows the `tour.notFound` notice, and nothing is applied.
- **Mutual exclusion with the quiz:** `startTour` is refused during a quiz (`quiz.status !== 'off'`). The quiz start is refused during a tour, and its button is disabled with the title `t('tour.finishFirst')`.
- **Keyboard, while a tour is active and no text field or dialog has focus:**
  - `ArrowRight` → next step, `ArrowLeft` → back.
  - `Escape` → deselect if something is selected, otherwise exit the tour.
- **Copy (i18n keys, `en` and `tr`):**

  | Key | English |
  |---|---|
  | `tour.button` | `Tours` |
  | `tour.start` | `Start` |
  | `tour.steps` | `{n} steps` |
  | `tour.progress` | `Step {i} of {n}` |
  | `tour.back` | `Back` |
  | `tour.next` | `Next` |
  | `tour.finish` | `Finish` |
  | `tour.exit` | `Exit tour` |
  | `tour.notFound` | `This tour couldn't be found.` |
  | `tour.linkStep` | `Link to this step` |
  | `tour.finishFirst` | `Finish the tour first` |
  | `tour.dialogTitle` | `Guided tours` |

  The dev-only button text `Copy as tour step` is not translated.
- **Lazy loading:** tours code and data load on first use (the `Tours` button or a tour hash), never at boot otherwise.

## Review Focus

1. **Exiting a tour after the visitor dissected or orbited mid-tour.** The view returns to the pre-tour state, and undo history from before the tour still works. → Task 3, `exit restores the pre-tour view and keeps history`.
2. **A tour step referencing a mesh or motion removed by an asset rebuild.** CI fails with a clear message. → Task 1, `checkContent` tour errors.
3. **Opening a tour link for a step beyond the tour's length**, or for an unknown tour. The notice appears and the default view is untouched. → Task 4 tests.
4. **Switching language mid-tour.** The text swaps without restarting or losing the step. → Task 3, `locale change keeps the step`.
5. **The bar and dialog in Turkish on a phone**, where the text runs longer. No overflow, and the buttons stay reachable. → Task 6 e2e.

---

## Task 0: Gate

- [ ] **Step 1:** Confirm Plan 4B is merged and `npm run ci && npm run test:e2e` pass.

### Task 1: Tour schemas and validation

**Files:**
- Create: `src/features/tours/schema.ts`
- Modify: `src/data/checkContent.ts` (adds optional inputs `tours` and `tourTexts: Record<string /*locale*/, unknown>`), `scripts/check-content.ts` (reads `content/tours.json` and every `content/<locale>/tours.json`), `src/data/contentReport.ts` (a tours coverage row per locale)
- Test: `src/features/tours/schema.test.ts`, extend `src/data/checkContent.test.ts`

**Interfaces:**
- Consumes: `ViewStateV1Schema` (`src/features/share/viewState.ts`), `MotionsFileSchema`.
- Produces:
  - `TourStepSchema`: `{ id: kebab; view: ViewStateV1 without p; motion?: { id; phase?; play? } }`
  - `TourSchema`: `{ id: kebab; systems?: SystemId[]; steps: TourStep[] (4–7) }`. Step ids are unique within a tour.
  - `ToursFileSchema`: `{ tours: Tour[] }`. Tour ids are unique.
  - `TourTextsFileSchema`: `{ tours: Record<TourId, { title?; summary?; steps?: Record<StepId, { title?; body? }> }> }`. Fields are optional, because they fall back to English.
  - **New `checkContent` errors:**
    - `tours.json: "<tour>/<step>" references unknown mesh "<id>"`, checked across `h`, `i`, `f` and `sel`
    - `tours.json: "<tour>/<step>" references unknown system "<id>"`
    - `tours.json: "<tour>/<step>" references unknown motion "<id>"`
    - `tours.json: "<tour>" has <n> steps (allowed 4–7)`
    - `content/en/tours.json: missing <field> for "<tour>"` (title, summary) or `"<tour>/<step>"` (title, body)
    - `content/<loc>/tours.json: "<tour>" is not in tours.json`, and the same for unknown step ids
    - `content/<loc>/tours.json: "<tour>/<step>" body is <n> characters (max 400)`, with the equivalents for every limited field
    - `content/<loc>/tours.json: "<tour>/<step>" <field> contains markup`

- [ ] **Step 1: Write the failing tests.** Use a minimal valid fixture: 1 tour with 4 steps, en text complete, tr text partial.

| Test | Mutation | Expect |
|---|---|---|
| `valid tours pass` | none | no tour errors |
| `unknown mesh` | step 2 `sel: ['gone--l']` | `tours.json: "arm-bone-to-muscle/step-2" references unknown mesh "gone--l"` |
| `unknown motion` | `motion.id: 'jump'` | the unknown motion error |
| `step count` | 3 steps | `tours.json: "arm-bone-to-muscle" has 3 steps (allowed 4–7)` |
| `english text required` | drop the en body of step 3 | `content/en/tours.json: missing body for "arm-bone-to-muscle/step-3"` |
| `partial translations are fine` | the tr file lacks step 4 | no error |
| `unknown ids in locale text` | tr has a `ghost-tour` entry | `content/tr/tours.json: "ghost-tour" is not in tours.json` |
| `limits and markup` | tr body of 401 chars; en title containing `**x**` | the length error and the markup error |
| `pins not allowed in steps` | a step view with `p` | schema error prefixed `tours.json:` |

- [ ] **Step 2: Run** `npx vitest run src/features/tours src/data`. Expected: FAIL.
- [ ] **Step 3: Implement.** Add an empty `content/tours.json` (`{"tours":[]}`) and `content/en/tours.json` (`{"tours":{}}`), so CI passes until Task 5.
- [ ] **Step 4: Run** `npm test && npm run check:content`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(tours): tour schemas and content validation"`

### Task 2: `applyViewState` options and step text localisation

**Files:**
- Modify: `src/features/share/thunks.ts`
- Create: `src/features/tours/localizeTours.ts`
- Test: extend `src/features/share/thunks.test.ts`; create `src/features/tours/localizeTours.test.ts`

**Interfaces:**
- Produces:
  - `applyViewState(view: ViewStateV1, opts?: { animate?: boolean; keepHistory?: boolean; keepPins?: boolean }): AppThunk<Promise<void>>`. Every option defaults to `false`, which is exactly today's behaviour.
    - `keepHistory: true` uses `dissectionRestored` (the history-preserving action that already exists) instead of `dissectionBaselineSet`.
    - `keepPins: true` skips `sharedPinsLoaded`.
    - `animate: true` passes `animate` to `setPose` (still forced off under reduced motion by the rig).
  - `type TourText = { title: string; summary: string; steps: Record<StepId, { title: string; body: string }>; fallback: boolean }`
  - `localizeTourTexts(en: TourTextsFile, loc: TourTextsFile | null): Record<TourId, TourText>`. Field-level fallback. `fallback` is true when any field came from English.

- [ ] **Step 1: Write the failing tests.**

| Test | Expect |
|---|---|
| `defaults unchanged` | the existing `applyViewState` tests pass untouched |
| `keepHistory preserves undo` | store with `past.length === 3` → apply with `keepHistory: true` → `past.length === 3`, and the sets equal the view's |
| `keepPins keeps shared pins` | 1 shared pin loaded → apply with `keepPins: true` → still 1 |
| `animate forwards` | `setPose` called with `animate: true` |
| `localizeTourTexts` | tr title present, tr step-2 body missing → title from tr, step-2 body from en, `fallback: true`; full tr → `fallback: false` |

- [ ] **Step 2: Run** `npx vitest run src/features/share src/features/tours`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(tours): applyViewState options and tour text localisation"`

### Task 3: Tour slice and thunks

**Files:**
- Create: `src/features/tours/tourSlice.ts`, `src/features/tours/thunks.ts`
- Modify: `src/app/store.ts` (the `tour` reducer), `src/app/listeners.ts` (`localeSet` reloads tour texts; quiz start is guarded during a tour), `src/features/quiz/thunks.ts` (`startQuiz` refuses during a tour)
- Test: `src/features/tours/tourSlice.test.ts`, `thunks.test.ts`

**Interfaces:**
- Produces:
  - tour state:

    ```
    {
      defs: Tour[] | null; texts: Record<TourId, TourText> | null;
      loadStatus: 'idle' | 'loading' | 'ready' | 'error';
      activeId: TourId | null; stepIndex: number; savedView: ViewStateV1 | null;
      notice: 'not-found' | null;
    }
    ```

  - Actions: `toursLoaded({ defs, texts })`, `tourTextsLoaded(texts)`, `toursFailed()`, `tourStarted({ id, savedView })`, `tourStepSet(index)`, `tourEnded()`, `tourNoticeSet(notice)`, `tourNoticeDismissed()`.
  - `loadTours(): AppThunk<Promise<void>>`. Fetches `content/tours.json`, `content/en/tours.json` and, when the locale isn't `en`, `content/<locale>/tours.json`. The locale file 404ing or failing its schema means `null` (fallback).
  - `startTour(id: TourId, stepIndex = 0): AppThunk<Promise<'started' | 'refused' | 'not-found'>>`
    - `refused` during a quiz.
    - `not-found` for an unknown id or an out-of-range step. This also sets the notice.
    - Otherwise: `savedView = captureViewState({ includePins: false })`, then `tourStarted`, then `goToStep(stepIndex)`.
  - `goToStep(index: number): AppThunk<Promise<void>>`. Clamps to the range, dispatches `tourStepSet`, then applies the step as described in the Global Constraints.
  - `nextStep()`, `prevStep()`. On the last step, `nextStep` behaves like `exitTour`.
  - `exitTour(): AppThunk<Promise<void>>`. Stops motion, applies `savedView` with all three options true, then `tourEnded`.
  - Selectors:
    - `selectTourActive(state): boolean`
    - `selectCurrentStep(state): { tourId; index; count; title; body; fallback } | null`

- [ ] **Step 1: Write the failing tests.** Use a real `makeStore`, a fake camera, fake motion thunks (spies) and a 4-step fixture tour.

| Test | Expect |
|---|---|
| `start captures and applies step 1` | `savedView` equals `captureViewState` from before; the systems and selection equal step 1's view; `setPose` animate true |
| `next/back walk the steps` | `nextStep` ×2 → index 2 with step 3's view applied; `prevStep` → index 1 |
| `motion steps start paused at phase` | step 3 has `{ id: 'elbow-flexion', phase: 0.4 }` → `startMotion('elbow-flexion')`, `motionPaused(0.4)`, `motionScrubbed(0.4)` |
| `non-motion step stops motion` | going from step 3 to step 4 (no motion) → `stopMotion` called |
| `exit restores the pre-tour view and keeps history` | before the tour: `hidden: ['sternum']` and `past.length 2`; mid-tour `hide(['femur--l'])` → `exitTour()` → `hidden: ['sternum']`, `past.length >= 2`, tour inactive |
| `finish on the last step` | at index 3, `nextStep()` → tour inactive and view restored |
| `refused during quiz` | quiz asking → `'refused'`, no state change |
| `quiz refused during tour` | a tour active → `startQuiz()` leaves the quiz `off` |
| `not-found` | `startTour('nope')` and `startTour('arm-bone-to-muscle', 9)` → `'not-found'`, `notice: 'not-found'`, and the view untouched |
| `locale change keeps the step` | at index 2, `localeSet('tr')` → `tourTextsLoaded` dispatched; `stepIndex` is still 2 and `activeId` unchanged |

- [ ] **Step 2: Run** `npx vitest run src/features/tours src/features/quiz`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(tours): tour state, step playback and safe exit"`

### Task 4: Tour links and keyboard

**Files:**
- Modify: `src/features/share/bootShare.ts` (handles `#tour/…` through a lazy tours import), `src/features/share/ShareNotice.tsx` (or a sibling notice for `tour.notFound`), `src/features/share/SharePopover.tsx` (`Link to this step` while a tour is active; dev-only `Copy as tour step`), `src/app/shortcuts.ts` and `useShortcuts.ts` (arrow keys and Escape while a tour is active)
- Create: `src/features/tours/tourHash.ts`
- Test: `src/features/tours/tourHash.test.ts`, extend `src/features/share/bootShare` tests, `src/app/shortcuts.test.ts`

**Interfaces:**
- Produces:
  - `parseTourHash(hash: string): { id: string; step: number } | null`. It matches `^#tour/([a-z0-9-]+)/([1-9][0-9]?)$` and returns a 0-based `step`.
  - `tourHash(id: string, stepIndex: number): string`, giving `#tour/<id>/<stepIndex + 1>`.
  - `bootShare`: a tour hash leads to `loadTours()` then `startTour(id, step)`. A `not-found` result shows the notice. The tours module isn't imported for non-tour hashes.
  - `shortcutFor` gains an input flag `tourActive: boolean`:
    - when true, `ArrowRight` → `'tour-next'` and `ArrowLeft` → `'tour-prev'`;
    - `useShortcuts` maps `'deselect'` to `exitTour` when the tour is active and nothing is selected.
  - `Link to this step` copies `origin + pathname + tourHash(id, index)` and shows `Link copied`.
  - `Copy as tour step` (only when `import.meta.env.DEV`) copies `JSON.stringify({ id: 'step-x', view: captureViewState({ includePins: false }) }, null, 2)`.

- [ ] **Step 1: Write the failing tests.**

| Test | Expect |
|---|---|
| `parses tour hashes` | `#tour/how-the-heart-beats/3` → `{ id, step: 2 }`; `#tour/x/0`, `#tour/X/1`, `#tour/x`, `#v1.abc` → `null` |
| `builds tour hashes` | `tourHash('lymph-nodes', 0)` → `#tour/lymph-nodes/1` |
| `boot starts a tour at the step` | hash `#tour/<fixture>/2` → the tour active at index 1 |
| `boot shows not-found` | `#tour/<fixture>/9` → the notice text `This tour couldn't be found.`; systems still default |
| `arrows only during tours` | `ArrowRight` with `tourActive: false` → `null`; with true → `'tour-next'`; in an input → `null` |
| `copy as tour step is dev-only` | rendered with `import.meta.env.DEV` stubbed false → no such button |

- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(tours): tour links, notices and keyboard navigation"`

### Task 5: Tours UI and the starter tours

**Files:**
- Create: `src/features/tours/ToursDialog.tsx`, `src/features/tours/TourBar.tsx`
- Modify: `src/features/about/TopBar.tsx` (a lazy `Tours` button), `src/App.tsx` (mounts `TourBar` above the toolbar while active), the i18n catalogues (`en.ts`, `tr.ts`), `src/features/about/AboutDialog.tsx` (adds ←/→ during tours to the shortcuts table)
- Content: `content/tours.json`, `content/en/tours.json`, `content/tr/tours.json`
- Test: `src/features/tours/ToursDialog.test.tsx`, `TourBar.test.tsx`

**Interfaces:**
- Produces:
  - `<ToursDialog />`: a Radix Dialog titled `t('tour.dialogTitle')`. One card per tour, with the title, the summary, `t('tour.steps', { n })` and a `Start` button. It's disabled with the `title` attribute `t('motion.finishQuizTitle')` (`Finish the quiz first`) during a quiz. Starting closes the dialog.
  - `<TourBar />`: `role="region"` with `aria-label` = the tour title. It shows the step title (as a heading), the body, `t('tour.progress', { i, n })` and the buttons `Back` (disabled on step 1), `Next` (or `Finish` on the last step) and `Exit tour`.
    - An `aria-live="polite"` region announces the step title on change.
    - Bodies wrap. On narrow screens it sits above the toolbar, and the body scrolls inside a max height of `40vh`.

- [ ] **Step 1: Write the failing tests.**

| Test | Expect |
|---|---|
| `lists tours` | the fixture with 2 tours → 2 cards showing titles and `4 steps` |
| `start from the dialog` | click `Start` → `startTour` (mocked) with the id; the dialog closes |
| `disabled during quiz` | quiz active → `Start` disabled with the title text |
| `bar navigation` | at step 1 of 4: `Back` disabled; `Next` → `nextStep`; at step 4 the label is `Finish`; `Exit tour` → `exitTour` |
| `progress and announcement` | `Step 2 of 4`; the live region contains step 2's title |
| `renders text as text` | a body containing `<b>` renders literally |

- [ ] **Step 2: Run** `npx vitest run src/features/tours`. Expected: FAIL.
- [ ] **Step 3: Implement the UI.**
- [ ] **Step 4: Author the five starter tours** (P4 §6.4). Use the dev-only `Copy as tour step` button to capture each view, then paste and edit the JSON.

  | Tour | Steps |
  |---|---|
  | `arm-bone-to-muscle` | skeleton overview → isolate the left humerus, radius and ulna → enable muscular, isolate the arm muscles → select biceps → fade others around the biceps |
  | `how-the-heart-beats` | enable cardiovascular, frame the heart → coronal section through the heart → select the left ventricle → heartbeat motion playing → the major vessels leaving the heart |
  | `bending-the-elbow` | arm bones → elbow motion paused at 0 → paused at 0.25 (agonists glowing) → playing → the triceps on extension (phase 0.75) |
  | `slice-through-the-chest` | organs plus skeleton → axial section at the level of the heart → select a lung → select the heart → flip the side |
  | `lymph-nodes` | enable lymphatic, anterior view → the neck (cervical) nodes selected → the armpit (axillary) nodes → the groin (inguinal) nodes → the spleen and thymus |

  - Write the English text following `content/STYLE.md`. Facts must be supported by the `sources` of the structure entries involved.
  - Write the Turkish text to the same rules.
  - Validate with `npm run check:content`, which should show 0 errors and tours at 100% in both locales in `content:report`.
- [ ] **Step 5: Visual check.** Play every tour in `en` and `tr` on desktop and in a 375-px viewport. Every step must frame its subject, and exiting must restore the starting view.
- [ ] **Step 6: Run** `npm test && npm run check:content`. Expected: PASS.
- [ ] **Step 7: Commit.** `git add -A && git commit -m "feat(tours): tours dialog, tour bar and five starter tours (en, tr)"`

### Task 6: End-to-end tests, docs and performance

**Files:**
- Create: `e2e/tours.spec.ts`, `docs/phase-4c-performance.md`
- Modify: `src/app/testHooks.ts` (adds `tour(): { activeId; stepIndex } `), `README.md`, `docs/architecture.md` (the tours data model and playback flow)

- [ ] **Step 1: Write the e2e tests.**

| Test | Steps → expectation |
|---|---|
| `play a tour end to end` | hide `sternum` → `Tours` → start `arm-bone-to-muscle` → `Next` until `Finish` (wait for idle each step) → after `Finish`, `hidden` contains `sternum` and `getPose()` is within 0.01 of before |
| `motion step` | start `bending-the-elbow`, go to step 3 → `motionPhase()` advances; `Exit tour` → `motion.activeId === null` and the `radius--l` transform is restored |
| `tour link` | open `/#tour/how-the-heart-beats/2` → the tour is active at index 1 and the section is enabled (`coronal`) |
| `bad tour link` | `/#tour/how-the-heart-beats/99` → `This tour couldn't be found.` |
| `keyboard` | during a tour, `ArrowRight` → index +1; `Escape` with nothing selected → the tour ends |
| `turkish on mobile` | mobile project, `?lang=tr` → start `lymph-nodes` → the tour bar's `scrollWidth <= clientWidth`, and `Sonraki` (or the tr `tour.next` value) is visible and clickable |
| `quiz and tour exclusive` | a tour active → the quiz start control is disabled; after exit it's enabled |

- [ ] **Step 2: Run** `npm run test:e2e`. Fix real bugs until it passes.
- [ ] **Step 3: Measure.** Repeat the Phase 4B boot measurements to confirm the tours code adds nothing to the boot path: the main-chunk gzip is unchanged within 1 KB, and `atlas:first-view` and `atlas:interactive-skeleton` are within run-to-run noise. Also measure fps while playing `how-the-heart-beats` (section plus heartbeat) on Auto. Record everything in `docs/phase-4c-performance.md`, with the real-device rule from P4 §3.
- [ ] **Step 4: Update docs.** README features (tours, tour links), architecture.
- [ ] **Step 5: Run** `npm run ci && npm run test:e2e`. Expected: PASS.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "test(e2e): guided tours; docs"`
