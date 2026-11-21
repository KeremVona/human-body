# 3D Human Anatomy Atlas

Open-source interactive 3D human anatomy atlas built with React Three Fiber, Three.js, and Meshopt-compressed glTF assets.

See [docs/superpowers/specs/2026-11-21-anatomy-atlas-design.md](docs/superpowers/specs/2026-11-21-anatomy-atlas-design.md) for the design specification and [docs/phase-0-results.md](docs/phase-0-results.md) for the Phase 0 baseline measurements.

## Running the App

Requires **Node.js 24+**.

```sh
npm install
npm run dev
```

Append `?debug` to the URL to display the live FPS, draw-call, and triangle HUD.

Verification commands:

```sh
npm run ci        # typecheck, lint, unit tests, content & asset verification, production build
npm run test:e2e  # Playwright Chromium smoke tests against production build
```

## Rebuilding 3D Assets

The pre-built skeletal bundle is committed under `public/models/`. To regenerate assets from source:

### Prerequisites

1. Install **Blender 5.3** (tested on 5.3.0) and set `BLENDER_PATH` in `.env.local` (ignored by git):
   ```ini
   BLENDER_PATH=C:\Program Files\Blender Foundation\Blender 5.3\blender.exe
   ```
2. Place `Z-Anatomy.blend` (version `2023-05-02`) at `pipeline/source/Z-Anatomy.blend` (ignored by git).

### Pipeline Commands

```sh
npm run assets:inventory  # survey .blend objects into pipeline/out/inventory.json
npm run assets:namemap    # reconcile pipeline/name-map.json against current selection
npm run assets:build      # export from Blender, Meshopt-optimize, update manifest & scaffold index
npm run assets:verify     # validate exported GLBs, dimensions, and orientation probes
```

See [pipeline/README.md](pipeline/README.md) for detailed pipeline rules and license exclusions.

## Licensing

- **Code** (`src/`, `pipeline/`, `scripts/`, tests, config): [MIT License](LICENSE).
- **3D Assets & Content** (`public/models/`, `content/`): [CC-BY-SA 4.0](LICENSE-ASSETS) (derived from Z-Anatomy and BodyParts3D). Third-party non-commercial (`CC-BY-NC*`) and unverified-license models present in the upstream `.blend` are excluded.

## Credits

- **Z-Anatomy** — <https://github.com/LluisV/Z-Anatomy> (`CC-BY-SA 4.0`)
- **BodyParts3D** — © The Database Center for Life Science (`https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html`)
