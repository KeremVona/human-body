# Phase 2 Layering, Search & Study Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 2:
- per-system opacity sliders,
- real system toggles in place of "Major Organs",
- autocomplete search that reveals and flies to its result,
- a virtualised, keyboard-accessible hierarchy tree,
- the Find & Click quiz,
- quality-gated visual polish (ambient occlusion, selection outline, x-ray ghosts, muscle sheen),

all within the §9.1 budgets.

**Architecture:**
- Everything builds on Plan 2's slices and the resolve → diff → apply loop.
- New cross-slice flows (reveal-and-focus, quiz start and end) are thunks. They reach the imperative camera through a `CameraApi` ref passed as the thunk extra argument.
- The tree and search read only `content.index`, `taxonomy` and the manifest, so they work before any heavy bundle loads.

**Tech Stack:** As before, plus `minisearch`, `@tanstack/react-virtual`, `@radix-ui/react-slider`, `@radix-ui/react-tabs`, `@radix-ui/react-radio-group`, `@react-three/postprocessing`, `postprocessing`, and (dev) `@axe-core/playwright`.

**Spec:** `docs/superpowers/specs/2026-11-21-anatomy-atlas-design.md` (§). **Prior plans:**
- Plan 1 `…/2026-11-21-foundation-asset-spike.md`
- Plan 2 `…/2026-11-21-phase-1-viewer-dissection.md`
- Plan 3 `…/2026-11-21-phase-1-content-launch.md`

**Phase 3** (cross-sections, animation, pins and shareable URLs) is out of scope for v1 (§10). It has no plan yet.

## Global Constraints

The Global Constraints of Plans 1–3 still apply. In addition:

- **Opacity (§6.2):** sliders go from 0–100% in steps of 5.
  - At 100%, materials are opaque with `depthWrite` on.
  - Below 100%, they're transparent with `depthWrite` off.
  - At **0%, meshes are not visible**, but the toggle stays on.
  - The slider and the toggle are independent.
- **Pickability:** a mesh is pickable only if it's visible and its effective opacity is ≥ 0.5 (unchanged from Plan 2).
- **Search (§6.6):**
  - Fields: common, Latin, synonyms. Prefix matching on. Fuzzy matching 0.2 for terms longer than 3 characters. Boosts: common 3, Latin 2, synonyms 1.5.
  - Matching is case- and diacritic-insensitive.
  - Up to 8 results, one per structure.
- **Quiz (§6.8):**
  - The pool is featured structures in enabled systems, with `sizeClass` of `medium` or `large`. Paired structures enter as separate sides.
  - A round is 10 questions, or the pool size if smaller.
  - 3 attempts per question, then the answer is revealed.
  - A correct answer within 3 attempts scores 1; a revealed answer scores 0.
  - The best score is stored in `localStorage['atlas.quiz.best']`.
  - Dissection is restored when the round ends.
  - Hover labels, the Inspector, the context menu and the H/I/G/F shortcuts are off during a quiz.
- **Quality:** the setting is `auto | high | low`, persisted in `localStorage['atlas.quality']`.
  - `auto` resolves to `low` if the pointer is coarse, OR the viewport is under 768 px wide, OR `navigator.hardwareConcurrency < 4`. Otherwise it resolves to `high`.
  - High quality enables ambient occlusion (N8AO), the selection outline, the x-ray ghost shader and muscle sheen.
- **Copy is exact** where this plan quotes it.

## Review Focus

1. **A search pick whose bundle fails or times out.** The search box must show an alert and leave the state consistent, without hanging. → Task 3, `revealAndFocus rejects when the bundle fails` and the SearchBox alert test.
2. **The quiz pool is empty, or smaller than 10.** Show a clear message, or run a shorter round. Never loop or crash. → Task 5, pool and start tests.
3. **Opacity at exactly 0, 0.5 and 1.** 0 hides, 0.5 is still pickable, 1 is opaque with depth writes. → Task 1 tests.
4. **Keyboard focus moving past the visible window of the virtualised tree.** The focused row must stay rendered and focused. → Task 4, `End focuses the last row in a 500-row tree`.
5. **Ending a quiz mid-question.** Dissection is restored and quiz highlights are cleared. → Task 5, `endQuiz restores dissection and selection`.

---

## Task 0: Gate

- [ ] **Step 1:** Confirm that Plan 2 is complete and Plan 3 Tasks 1–5 are complete: names, featured content, `check:content` with 0 errors. Search needs the names, and the quiz needs the featured set.
- [ ] **Step 2:** Run `npm run ci && npm run test:e2e`. Expected: PASS.

---

### Task 1: Per-system opacity

**Files:**
- Modify: `src/features/systems/systemsSlice.ts`, `src/scene/resolveMeshState.ts`, `src/scene/materials.ts`, `src/scene/SceneStateApplier.tsx`, `src/features/systems/SystemsPanel.tsx`
- Test: extend `systemsSlice.test.ts`, `resolveMeshState.test.ts`, `materials.test.ts`, `SystemsPanel.test.tsx`
- Install: `npm i @radix-ui/react-slider`

**Interfaces:**
- Consumes (Plan 2): the systems slice, `resolveMeshState`, `createMaterialLibrary`, `SceneStateApplier`, `ToggleRow`.
- Produces:
  - `opacitySet({ systems: SystemId[]; opacity: number })`. Clamped to [0, 1] and rounded to 0.05.
  - `resolveMeshState`: when `systemOpacity === 0`, the result is `visible: false, pickable: false`. Everything else is unchanged.
  - Material library `setSystemOpacity(system: SystemId, opacity: number): void`.
    - Updates the `base`, `hovered` and `selected` materials of that system, including ones created later.
    - Sets `transparent = opacity < 1`, `depthWrite = opacity === 1` and `opacity`.
    - Sets `needsUpdate = true` when `transparent` flips.
  - `SceneStateApplier` calls `setSystemOpacity` whenever a system's opacity changes, then invalidates.
  - Each row of the Systems panel gets a Radix Slider labelled `{label} opacity`, showing `{n}%`.
    - A group row sets all its systems, and shows the highest of their values.

- [ ] **Step 1: Write the failing tests.**

| Test | Expect |
|---|---|
| `opacitySet clamps and rounds` | `0.47` → `0.45`; `1.3` → `1`; `-1` → `0`; applied to every system in the payload |
| `opacity 0 hides` (resolve) | `systemOpacity: 0` → `visible: false, pickable: false, highlight: 'none'` |
| `opacity 0.5 stays pickable` (resolve) | `systemOpacity: 0.5` → `pickable: true` |
| `setSystemOpacity toggles transparency and depth writes` | 0.3 → base material `transparent`, `!depthWrite`, `opacity 0.3`; then 1 → `!transparent`, `depthWrite`, `opacity 1`; a material created after the call already has the system's opacity |
| `slider dispatches opacity` | press `End` then `ArrowLeft` ×4 on `Skeletal opacity` → `systems.skeletal.opacity === 0.8`, label `80%` |

- [ ] **Step 2: Run** `npx vitest run src/features/systems src/scene`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(systems): per-system opacity sliders"`

---

### Task 2: Split "Major Organs" into real systems

**Files:**
- Modify: `content/taxonomy.json`, `src/data/schema.test.ts` (Plan 1's Major Organs assertion), `src/features/systems/selectors.test.ts`, `src/features/systems/SystemsPanel.test.tsx`, `e2e/*.spec.ts` (any `Major Organs` references)

- [ ] **Step 1: Check the condition.** §10 says to split only "if the content supports it". Run `npm run content:report`. Split only if each of nervous, respiratory, digestive, urinary and lymphatic has at least one featured structure. If any has none, skip this task and say so in the commit log of Task 7.
- [ ] **Step 2: Update the tests first.**
  - `selectToggleRows` on the real taxonomy now gives `['skeletal','muscular','cardiovascular','nervous','respiratory','digestive','urinary','lymphatic']` (only systems with structures).
  - The schema test asserts `uiGroups` is `[]`.
  - The panel test expects those switch names.
- [ ] **Step 3: Run** `npm test`. Expected: FAIL.
- [ ] **Step 4: Edit the taxonomy.** Set `content/taxonomy.json` `uiGroups` to `[]`. The schema still allows groups; no code changes.
- [ ] **Step 5: Run** `npm test && npm run test:e2e`. Expected: PASS, after updating e2e tests that clicked `Major Organs`.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(systems): separate toggles for organ systems"`

---

### Task 3: Search and reveal-and-focus

**Files:**
- Create: `src/features/search/searchIndex.ts`, `src/features/search/revealAndFocus.ts`, `src/features/search/SearchBox.tsx`
- Modify: `src/app/store.ts` (thunk extra argument), `src/scene/CameraRig.tsx` (fills the ref), `src/features/dissection/dissectionSlice.ts` (adds `unhide`), `src/features/about/TopBar.tsx` (search slot), `src/app/shortcuts.ts` (`/` → `focus-search`)
- Test: `src/features/search/searchIndex.test.ts`, `revealAndFocus.test.ts`, `SearchBox.test.tsx`, extend `src/app/shortcuts.test.ts` and `dissectionSlice.test.ts`
- Install: `npm i minisearch`

**Interfaces:**
- Consumes: `IndexFile` (Plan 1); `CameraApi`, `selectBundlesForSystem`, the `bundlesRequested`, `systemToggled`, `reveal` and `selected` actions (Plan 2).
- Produces:
  - `makeStore(preloaded?, extra = { camera: { current: null } as CameraRef })`, where `type CameraRef = { current: CameraApi | null }`. The thunk `extraArgument` is `{ camera: CameraRef }`. `CameraRig` sets `camera.current` on mount.
  - `type SearchHit = { structureId: StructureId; common: string; latin?: string; system: SystemId }`
  - `buildSearchIndex(index: IndexFile): { search(q: string, limit?: number): SearchHit[] }`. `limit` defaults to 8.
    - Normalise with `processTerm`: NFD, strip combining marks, lowercase.
    - A query that's empty after trimming returns `[]`.
    - Special characters never throw.
  - `waitForBundles(store, ids: string[], timeoutMs = 30000): Promise<void>`. Rejects with `Error('bundle failed: <id>')` or `Error('bundle timeout: <id>')`.
  - `revealAndFocus(structureId: StructureId, side: 'left' | 'right' | 'both' = 'both'): AppThunk<Promise<void>>`, in this order:
    1. Resolve the meshIds from the manifest.
    2. Enable the structure's system if it's off.
    3. Request its bundles and `waitForBundles`.
    4. `reveal(meshIds)`, then `selected(meshIds)`.
    5. `await camera.current?.focusMeshes(meshIds)`.

    On rejection, it dispatches nothing more and rethrows.
  - `unhide(ids: MeshId[])`: removes ids from `hidden` only. Undoable, and a no-op if nothing changes. The tree (Task 4) uses it.
  - `<SearchBox />`: an `input` with `role="combobox"`, `aria-label="Search structures"`, `aria-expanded` and `aria-controls` pointing at the listbox.
    - Each option shows `common`, the italic `latin` and a system chip.
    - Arrow keys move the active option, Enter picks it, Escape clears and closes, and clicking picks.
    - A pick runs `revealAndFocus`. On failure it shows `<p role="alert">Couldn't load {system label}.</p>` under the box.
    - No results gives the option text `No matches`.
  - `shortcutFor`: `'/'` → `'focus-search'` (not while typing). `useShortcuts` focuses the search input.

- [ ] **Step 1: Write the failing tests.**

```ts
// searchIndex.test.ts — fixture index: femur (latin 'Femur', synonyms ['thigh bone']), biceps-brachii, sternum ('breastbone')
const s = buildSearchIndex(fixtureIndex);
it.each([
  ['fem', 'femur'], ['FEMUR', 'femur'], ['fémur', 'femur'], ['femr', 'femur'],
  ['thigh bone', 'femur'], ['bic', 'biceps-brachii'], ['breast', 'sternum'],
])('%s → %s first', (q, id) => expect(s.search(q)[0]?.structureId).toBe(id));
it('returns nothing for empty or unknown queries and never throws on punctuation', () => {
  expect(s.search('   ')).toEqual([]);
  expect(s.search('zzzz')).toEqual([]);
  expect(() => s.search('(*[')).not.toThrow();
});
it('respects the limit and returns one hit per structure', () => {
  const many = buildSearchIndex(indexWith(20, 'rib'));
  expect(many.search('rib')).toHaveLength(8);
  expect(new Set(many.search('rib').map((h) => h.structureId)).size).toBe(8);
});
```

  - **`revealAndFocus.test.ts`:** a real store, a fake camera `{ focusMeshes: vi.fn() }`, and bundle readiness simulated by dispatching `bundleReady`.

| Test | Expect |
|---|---|
| `reveals a hidden paired structure in a disabled system` | start: muscular off, `hidden: ['biceps-brachii--l']`, `isolated: ['femur--l']` → after: `systems.muscular.enabled`, hidden `[]`, `isolated: null`, selection `['biceps-brachii--l','biceps-brachii--r']`, camera called with the same ids |
| `selects one side when asked` | `side: 'left'` → selection `['biceps-brachii--l']` |
| `revealAndFocus rejects when the bundle fails` | dispatch `bundleFailed('muscular')` while waiting → rejects with `bundle failed: muscular`; selection unchanged; camera not called |
| `times out` | fake timers, 30 s → rejects with `bundle timeout: muscular` |

  - **`SearchBox.test.tsx`:**
    - Typing `thi` shows the option `Femur`. ArrowDown then Enter calls a mocked `revealAndFocus('femur','both')` and closes the list.
    - Escape clears the input.
    - A rejected pick shows `Couldn't load Muscular.`
    - `zzz` shows `No matches`.
  - **`shortcuts.test.ts`:** `'/'` → `'focus-search'`; with `targetTag: 'INPUT'` → `null`.
  - **`dissectionSlice.test.ts`:** `unhide(['a'])` after `hide(['a','b'])` → `hidden ['b']`, history +1; `unhide(['zz'])` returns the same state.
- [ ] **Step 2: Run** `npx vitest run src/features/search src/app src/features/dissection`. Expected: FAIL.
- [ ] **Step 3: Implement.** Build the search index once with `useMemo` when `content.index` changes.
- [ ] **Step 4: Run** `npm test && npm run test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(search): autocomplete search with reveal-and-focus"`

---

### Task 4: Hierarchy tree

**Files:**
- Create: `src/features/tree/buildTree.ts`, `src/features/tree/TreeView.tsx`, `src/features/tree/LeftPanel.tsx`
- Modify: `src/App.tsx` (`LeftPanel` replaces the bare `SystemsPanel`)
- Test: `src/features/tree/buildTree.test.ts`, `TreeView.test.tsx`
- Install: `npm i @tanstack/react-virtual @radix-ui/react-tabs`

**Interfaces:**
- Consumes: `Taxonomy`, `IndexFile`, `Manifest` (Plan 1); `hide` (Plan 2); `unhide`, `revealAndFocus` (Task 3).
- Produces:
  - `type TreeNode = { key: string; kind: 'system' | 'region' | 'group' | 'structure' | 'mesh'; label: string; meshIds: MeshId[]; children: TreeNode[] }`
    - Keys: `sys:<system>`, `reg:<system>/<region>`, `grp:<system>/<region>/<group>`, `str:<structureId>`, `mesh:<meshId>`.
    - Mesh leaves exist only for paired structures, labelled `Left` and `Right`.
    - Only structures that have meshes are included.
    - Ordering: systems by taxonomy `order`, regions in taxonomy order, groups and structures by label (`localeCompare`).
    - A node's `meshIds` are all mesh ids beneath it.
  - `buildTree(taxonomy: Taxonomy, index: IndexFile, manifest: Manifest): TreeNode[]`
  - `type TreeRow = { key: string; depth: number; label: string; kind: TreeNode['kind']; hasChildren: boolean; expanded: boolean; meshIds: MeshId[] }`
  - `flattenTree(nodes: TreeNode[], expanded: ReadonlySet<string>): TreeRow[]`
  - `ancestorsOf(key: string, nodes: TreeNode[]): string[]`. Ordered from the root to the parent.
  - `<TreeView />`: `role="tree"`, `aria-label="Anatomy hierarchy"`, virtualised with TanStack Virtual (row height 32 px).
    - Rows are `role="treeitem"` with `aria-level`, `aria-expanded` and `aria-selected`, using a roving `tabIndex`.
    - Keys:
      - Up and Down move between rows.
      - Right expands, or moves to the first child.
      - Left collapses, or moves to the parent.
      - Home and End go to the first and last rows.
      - Enter or Space on a structure or mesh row runs `revealAndFocus`; on other rows it toggles.
    - The focused row is always rendered (`virtualizer.scrollToIndex` before focusing).
    - Each row has an eye button. It's labelled `Hide {label}` when none of the row's meshes are hidden and dispatches `hide(meshIds)`; otherwise it's labelled `Show {label}` and dispatches `unhide(meshIds)`.
    - The tree auto-expands `ancestorsOf` the current selection.
  - `<LeftPanel />`: the Plan 2 `Panel` with Radix Tabs `Systems` and `Browse`.

- [ ] **Step 1: Write the failing tests.**

```ts
// buildTree.test.ts — fixture: femur (paired, skeletal/lower-limb), sternum (skeletal/thorax), biceps-brachii (paired, muscular/upper-limb, group 'arm-anterior')
const tree = buildTree(taxonomy, index, manifest);
it('nests system › region › group › structure › side', () => {
  expect(tree.map((n) => n.key)).toEqual(['sys:skeletal', 'sys:muscular']);
  const arm = tree[1].children[0].children[0];
  expect(arm.key).toBe('grp:muscular/upper-limb/arm-anterior');
  expect(arm.children[0].children.map((c) => c.label)).toEqual(['Left', 'Right']);
  expect(tree[0].children.map((r) => r.key)).toEqual(['reg:skeletal/thorax', 'reg:skeletal/lower-limb']); // taxonomy region order
  expect(tree[0].meshIds.sort()).toEqual(['femur--l', 'femur--r', 'sternum']);
});
it('flattens only expanded nodes', () => {
  expect(flattenTree(tree, new Set()).map((r) => r.key)).toEqual(['sys:skeletal', 'sys:muscular']);
  expect(flattenTree(tree, new Set(['sys:skeletal'])).map((r) => [r.key, r.depth])).toEqual([
    ['sys:skeletal', 0], ['reg:skeletal/thorax', 1], ['reg:skeletal/lower-limb', 1], ['sys:muscular', 0],
  ]);
});
it('finds ancestors', () =>
  expect(ancestorsOf('mesh:femur--l', tree)).toEqual(['sys:skeletal', 'reg:skeletal/lower-limb', 'str:femur']));
```

  - In the fixture taxonomy, `thorax` is listed before `lower-limb`, matching Plan 1's region order.
  - **`TreeView.test.tsx`:**

| Test | Expect |
|---|---|
| `keyboard navigation` | focus the first row → `ArrowRight` expands Skeletal → `ArrowDown` focuses `Thorax` → `ArrowLeft` returns to `Skeletal` |
| `Enter on a structure reveals it` | navigate to `Femur`, press Enter → mocked `revealAndFocus('femur','both')`; on the `Left` row → `('femur','left')` |
| `eye button hides and shows` | click `Hide Femur` → `hidden` contains both sides; the button becomes `Show Femur` → click → hidden `[]` |
| `auto-expands to the selection` | dispatch `selected(['femur--l'])` → the row `Left` under Femur is in the document with `aria-selected="true"` |
| `End focuses the last row in a 500-row tree` | fixture of 500 structures in one region, all expanded → focus the first row, press `End` → the active element is the last structure's row and has its label |

- [ ] **Step 2: Run** `npx vitest run src/features/tree`. Expected: FAIL.
- [ ] **Step 3: Implement.** jsdom has no layout, so in the tests mock TanStack's `measureElement` and give the scroll container a fixed `getBoundingClientRect`, so the virtualiser renders rows.
- [ ] **Step 4: Run** `npm test && npm run test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(tree): virtualised accessible hierarchy browser"`

---

### Task 5: Find & Click quiz

**Files:**
- Create: `src/features/quiz/pool.ts`, `src/features/quiz/rng.ts`, `src/features/quiz/quizSlice.ts`, `src/features/quiz/thunks.ts`, `src/features/quiz/QuizBanner.tsx`, `src/features/quiz/QuizSummary.tsx`
- Modify:
  - `src/features/dissection/dissectionSlice.ts` (adds `dissectionRestored`)
  - `src/scene/Picking.tsx` (during `asking`, clicks dispatch `answerQuiz`, and hover is suppressed)
  - `src/features/selection/HoverLabel.tsx`, `src/features/inspector/Inspector.tsx`, `src/features/dissection/DissectionMenu.tsx` and `src/app/useShortcuts.ts` (each disabled while quiz `status !== 'off'`)
  - `src/features/about/TopBar.tsx` (a `Start quiz` button)
- Test: `src/features/quiz/pool.test.ts`, `rng.test.ts`, `quizSlice.test.ts`, `thunks.test.ts`, `QuizBanner.test.tsx`

**Interfaces:**
- Consumes: `IndexFile`, `Manifest` (Plan 1); the systems, dissection and selection slices, and the camera extra argument (Task 3); `reveal` (Plan 2).
- Produces:
  - `buildQuizPool(index: IndexFile, manifest: Manifest, enabled: (s: SystemId) => boolean): MeshId[]`. Sorted.
  - `createRng(seed: number): () => number`, mulberry32.
  - `pickQuestions(pool: MeshId[], n: number, rng: () => number): MeshId[]`. A partial Fisher–Yates, with no repeats. Returns `min(n, pool.length)` questions.
  - quiz slice:

    ```
    {
      status: 'off' | 'asking' | 'correct' | 'wrong' | 'revealed' | 'summary';
      questions: MeshId[]; current: number; attempts: number; score: number;
      lastWrong: MeshId | null; savedDissection: DissectionSnapshot | null; best: number;
    }
    ```

    Actions:
    - `quizStarted({ questions, savedDissection, best })`
    - `answered(meshId)`:
      - correct → `correct`, `score + 1`
      - wrong → `attempts + 1` and `lastWrong`; the third wrong → `revealed`
      - otherwise → `wrong`
    - `retryAfterWrong()`: `wrong` → `asking`
    - `nextQuestion()`: to the next question with `attempts` 0, or to `summary` after the last
    - `quizEnded()`: resets to `off` and keeps `best`
  - `dissectionRestored(snapshot: DissectionSnapshot)`: replaces `hidden`, `isolated` and `faded`, and leaves `past` untouched.
  - Thunks:
    - `startQuiz(seed = Date.now()): AppThunk<'started' | 'empty-pool'>`. Saves the dissection snapshot, reads the best score from storage (0 if storage throws), and dispatches `quizStarted`.
    - `answerQuiz(meshId: MeshId): AppThunk`
      - Dispatches `answered`.
      - On `revealed`: `reveal([target])`, `selected([target])` and `camera.focusMeshes([target])`.
      - On `correct`: `selected([target])`.
      - On `wrong`: flashes the wrong mesh by selecting it for 800 ms, then `retryAfterWrong` and `selectionCleared`.
    - `skipQuestion(): AppThunk`, which counts as revealed.
    - `endQuiz(): AppThunk`. Dispatches `dissectionRestored(savedDissection)`, `selectionCleared()`, writes `best = max(best, score)` (with try/catch), then `quizEnded`.
  - **Copy:**
    - Prompt: `Find: {common}`, or `Find: {common} ({left|right})` for a side.
    - Progress: `Question {i} of {n}`. Score: `Score {score}`.
    - Correct: `Correct!`. Wrong: `That's the {common} ({side})`, or without the side for unpaired structures, followed by `.`.
    - Reveal: `Here it is: {label}.`
    - Summary: `You found {score} of {n}.` and `Best: {best}`.
    - Empty pool alert: `Turn on a body system with featured parts to start the quiz.`
    - Buttons: `Start quiz`, `Next`, `Skip`, `End quiz`, `Play again`, `Close`.

- [ ] **Step 1: Write the failing tests.**

```ts
// pool.test.ts — femur (featured, paired, large), stapes (featured, tiny), sternum (not featured), biceps (featured, muscular, medium)
it('keeps featured, enabled, medium/large meshes, sides separately', () => {
  expect(buildQuizPool(index, manifest, (s) => s === 'skeletal')).toEqual(['femur--l', 'femur--r']);
  expect(buildQuizPool(index, manifest, () => true)).toEqual(['biceps-brachii--l', 'biceps-brachii--r', 'femur--l', 'femur--r']);
  expect(buildQuizPool(index, manifest, () => false)).toEqual([]);
});
// rng.test.ts
it('is deterministic and never repeats', () => {
  const pool = Array.from({ length: 30 }, (_, i) => `m${i}`);
  const a = pickQuestions(pool, 10, createRng(42)), b = pickQuestions(pool, 10, createRng(42));
  expect(a).toEqual(b); expect(new Set(a).size).toBe(10);
  expect(pickQuestions(pool.slice(0, 4), 10, createRng(1))).toHaveLength(4);
});
```

  - **`quizSlice.test.ts`:** a transition table, starting from `asking` with questions `['femur--l','sternum']`.

| From | Action | To |
|---|---|---|
| asking | `answered('femur--l')` | `correct`, score 1 |
| asking | `answered('sternum')` | `wrong`, attempts 1, lastWrong `sternum` |
| wrong | `retryAfterWrong()` | `asking` |
| asking, attempts 2 | `answered('sternum')` | `revealed`, attempts 3, score unchanged |
| correct, current 0 | `nextQuestion()` | `asking`, current 1, attempts 0 |
| correct, current 1 | `nextQuestion()` | `summary` |
| summary, best 3 | `quizEnded()` | `off`, best 3 kept |

  - **`thunks.test.ts`:**
    - `startQuiz returns empty-pool when nothing qualifies`: everything disabled → `'empty-pool'`, status stays `off`.
    - `startQuiz runs a shorter round for a small pool`: pool of 4 → 4 questions.
    - `endQuiz restores dissection and selection`: start with `hidden: ['a']`, `reveal` the target during the quiz, then `endQuiz()` → `hidden` is `['a']` again, `selectedIds` is `[]`, status `off`, and `past` is the same length as before the quiz.
    - `best score survives a throwing localStorage`: `getItem` and `setItem` throw → start and end complete, and `best` is the round's score.
  - **`QuizBanner.test.tsx`:**
    - Asking shows `Find: Femur (left)`, `Question 1 of 2` and `Score 0`.
    - In `wrong` with lastWrong sternum it shows `That's the Sternum.`
    - `summary` shows `You found 1 of 2.`
    - Clicking `End quiz` dispatches `endQuiz`.
    - With the quiz on, `Inspector` renders nothing and `HoverLabel` renders nothing.
- [ ] **Step 2: Run** `npx vitest run src/features/quiz`. Expected: FAIL.
- [ ] **Step 3: Implement** the Produces list and its wiring.
  - `QuizBanner` sits at the top centre. In the `correct` and `revealed` states it shows `Next`; in `asking` it shows `Skip`.
  - `QuizSummary` is a Radix Dialog with `Play again`, which runs `endQuiz` and then `startQuiz`, and `Close`, which runs `endQuiz`.
- [ ] **Step 4: Run** `npm test && npm run test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(quiz): find-and-click quiz with restore and best score"`

---

### Task 6: Quality setting and visual polish

**Files:**
- Create: `src/features/settings/quality.ts`, `src/features/settings/SettingsMenu.tsx`, `src/scene/Effects.tsx`
- Modify: `src/scene/materials.ts` (`setQuality`, x-ray ghost, muscle sheen), `src/scene/AtlasCanvas.tsx` (mounts `Effects`), `src/features/about/TopBar.tsx` (settings button), the `ui` slice (adds `quality`)
- Test: `src/features/settings/quality.test.ts`, extend `src/scene/materials.test.ts`
- Install: `npm i @react-three/postprocessing postprocessing @radix-ui/react-radio-group`

**Interfaces:**
- Consumes: the material library and `MeshRegistry` (Plans 1–2), the selection slice.
- Produces:
  - `type QualitySetting = 'auto' | 'high' | 'low'`
  - `resolveQuality(setting: QualitySetting, env: { coarsePointer: boolean; width: number; cores: number }): 'high' | 'low'`
  - `ui.quality: QualitySetting`, persisted under `atlas.quality` (try/catch), with the action `qualitySet`.
  - Material library `setQuality(q: 'high' | 'low'): void`.
    - On `high`: ghost materials get an `onBeforeCompile` fresnel rim, `alpha = fadeOpacity * mix(0.35, 1.0, pow(1.0 - abs(dot(normal, viewDir)), 2.0))`, and muscle materials get `sheen` 0.4.
    - On `low`: both are removed. Materials recompile through `needsUpdate`.
  - `<Effects />`, only when the resolved quality is `high`: an `EffectComposer` with `N8AO` (`aoRadius` relative to body height, `intensity` around 1.5) and an `Outline` whose `selection` is the registry meshes of `selectedIds`.
  - `<SettingsMenu />`: a top-bar button `Settings` opening a popover with a radio group `Graphics quality` and the options `Auto`, `High`, `Low`.

- [ ] **Step 1: Write the failing tests.**

```ts
it.each([
  ['auto', { coarsePointer: false, width: 1440, cores: 8 }, 'high'],
  ['auto', { coarsePointer: true, width: 1440, cores: 8 }, 'low'],
  ['auto', { coarsePointer: false, width: 700, cores: 8 }, 'low'],
  ['auto', { coarsePointer: false, width: 1440, cores: 2 }, 'low'],
  ['high', { coarsePointer: true, width: 400, cores: 2 }, 'high'],
  ['low', { coarsePointer: false, width: 1440, cores: 16 }, 'low'],
] as const)('resolveQuality(%s, %o) = %s', (s, env, q) => expect(resolveQuality(s, env)).toBe(q));
```

  - **`materials.test.ts`:**
    - After `setQuality('high')`: muscle base `sheen === 0.4`, and ghost materials have an `onBeforeCompile` function.
    - After `setQuality('low')`: `sheen === 0`, and `onBeforeCompile` is the default.
    - Both switches set `needsUpdate`.
- [ ] **Step 2: Run** `npx vitest run src/features/settings src/scene/materials.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Look at it.** Run `npm run dev` and compare High and Low with muscles faded around a selected femur. Save `docs/img/phase-2-high.png` and `phase-2-low.png`.
- [ ] **Step 5: Run** `npm test && npm run test:e2e`. Expected: PASS.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(render): quality setting with AO, outline, x-ray ghosts, muscle sheen"`

---

### Task 7: Accessibility closure, Phase 2 e2e, performance

**Files:**
- Create: `e2e/phase2.spec.ts`, `e2e/a11y.spec.ts`, `docs/phase-2-performance.md`
- Modify: `src/app/testHooks.ts` (adds `startQuiz(seed)` and `quizTarget()`), `README.md` (remove the keyboard-selection gap; update features), `src/features/about/AboutDialog.tsx` (adds `/` to the shortcuts table)
- Install: `npm i -D @axe-core/playwright`

- [ ] **Step 1: Write the failing e2e tests.**

| Test | Steps → expectation |
|---|---|
| `search reveals a structure in a hidden system` | muscular off → type `biceps` in `Search structures` → Enter → `getState().systems.muscular.enabled`, selection contains both biceps sides, the Inspector shows `Biceps brachii` |
| `keyboard-only selection via the tree` | press Tab until the `Browse` tab is focused → Enter → Tab into the tree → navigate with arrows to `Femur` → Enter → the Inspector shows `Femur`; press `H` → hidden; `Control+Z` → visible |
| `opacity slider ghosts the skeleton` | turn on muscles, focus `Muscular opacity` → `Home` → the muscular meshes are not visible (`getState()` plus `__atlas.meshVisible('biceps-brachii--l') === false`) |
| `quiz round with a known seed` | `__atlas.startQuiz(7)` → read `__atlas.quizTarget()` → click `screenPointOf(target)` → banner shows `Correct!` and `Score 1` |
| `ending the quiz restores dissection` | hide femur--l → start quiz → `End quiz` → `hidden` contains `femur--l` |

  - Add `meshVisible(id)` to the test hooks alongside `startQuiz` and `quizTarget`.
  - **`a11y.spec.ts`:** run axe on (1) the default view, (2) the Inspector open, (3) the About dialog, (4) the quiz banner. Expect no violations with impact `serious` or `critical`.
- [ ] **Step 2: Run** `npm run test:e2e`. Fix the real issues found. Expected: all PASS on the desktop and mobile projects. Quiz clicking is desktop-only, since the target may be off-screen on mobile.
- [ ] **Step 3: Measure** as in Plan 2 Task 12, with quality High and then Auto, all systems on, and some opacity below 100%. Record the results in `docs/phase-2-performance.md`.
  - §10 Phase 2 is done only if the §9.1 budgets hold with quality set to Auto.
  - If they don't, write "Needs optimisation" with the numbers and stop for the owner.
- [ ] **Step 4: Update the README and About dialog.** Remove the keyboard-selection known gap, list the Phase 2 features, and add `/` to the shortcuts table.
- [ ] **Step 5: Run** `npm run ci && npm run test:e2e`. Expected: PASS.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "test: phase 2 e2e and accessibility; docs: performance"`. Pushing and redeploying are publishing actions: ask the owner first (Plan 3's publishing gate).
