# Launch Checklist (`v1.0.0`)

Verified live deployment at **<https://keremvona.github.io/human-body/>** on `2026-11-23` (workflow `Deploy to GitHub Pages`, commit `3a782ba`).

Note: Playwright mobile emulation (`Pixel 7`) also passes in `npm run test:e2e`; the physical-device Android and Safari/Firefox rows remain `not tested` because launch verification ran on a Windows workstation without macOS, iOS, Firefox, or a tethered Android phone.

| Browser / Device | Loads < 6 s | Orbit / Zoom / Pan | Hover label | Click / Tap select | Inspector layout | Hide → Undo | Isolate → Show all | Fade others | Context menu | Systems toggles (all 4) | About dialog | Rough FPS (`?debug`) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Desktop Chrome** (Windows) | Pass (`2.1 s`) | Pass | Pass | Pass | Pass (`0` overflow) | Pass | Pass | Pass | Pass | Pass (`1,011` meshes) | Pass (repo link visible) | `160–240 fps` |
| **Desktop Edge** (Windows) | Pass (`0.9 s`) | Pass | Pass | Pass | Pass (`0` overflow) | Pass | Pass | Pass | Pass | Pass (`1,011` meshes) | Pass (repo link visible) | `215–240 fps` |
| **Desktop Firefox** | not tested | not tested | not tested | not tested | not tested | not tested | not tested | not tested | not tested | not tested | not tested | — |
| **macOS Safari** | not tested | not tested | not tested | not tested | not tested | not tested | not tested | not tested | not tested | not tested | not tested | — |
| **iOS Safari** | not tested | not tested | — *(coarse pointer)* | not tested | not tested | not tested | not tested | not tested | not tested | not tested | not tested | — |
| **Android Chrome** (real phone) | not tested | not tested | — *(coarse pointer)* | not tested | not tested | not tested | not tested | not tested | not tested | not tested | not tested | — |
