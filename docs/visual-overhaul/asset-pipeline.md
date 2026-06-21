# Phase 0.5 Asset Pipeline

This file records the Phase 2 runtime asset conventions before production sprite work begins.

## Manifest Contract

- Runtime assets are declared in `src/shared/assets/manifest.ts`.
- Phaser loads assets through `phaserPreloadAssets`; scenes should reference stable `key` values from the manifest rather than hardcoded paths.
- CSS skin assets use the same public files and CSS variables from `src/shared/assets/skin.css`.
- Placeholder assets are allowed only when `placeholder: true` is set in the manifest.

## Directory Layout

- `public/assets/scene/`: decorative non-gameplay backgrounds only.
- `public/assets/towers/`: tower source frames, normalized exports, and later atlas inputs.
- `public/assets/enemies/`: approved seed frames, normalized frames, strips, and previews.
- `public/assets/reactions/`: ground decals, air flipbooks, and overlay inputs.
- `public/assets/ui/`: panel, card, chip, icon, and frame assets shared by Phaser and CSS.

## Atlas Strategy

- 0.5a uses direct SVG/PNG loading for placeholder UI/field chrome and can move to one small `ui-field` atlas once production board, tower, and reaction assets exist.
- 0.5b should use one bounded creature atlas for normal enemies and a separate boss atlas only if the boss frames are too large for the enemy atlas.
- Keep atlas keys category-prefixed: `ui.*`, `scene.*`, `towers.*`, `enemies.*`, `reactions.*`.

## Naming

- Source frames: `<category>/<id>/source/<id>-seed-01.png`.
- Normalized stills: `<category>/<id>/<id>-idle-<direction>-01.png`.
- Strips: `<category>/<id>/<id>-<animation>-<direction>-strip.png`.
- Preview sheets: `<category>/<id>/preview/<id>-<animation>-<direction>-preview.png`.
- Phaser animation keys: `<category>.<id>.<animation>.<direction>`.
- Manifest keys stay lowercase, dot-separated, and stable after first runtime use.

Directions:

- Normal enemies default to `side` plus horizontal flip until Phase 7 proves that four directions are worth the cost.
- Direction labels, when present, are `side`, `up`, `down`, `left`, `right`.
- Boss direction labels may diverge after the Phase 7 facing spike, but must be documented before Phase 8.

## Sprite Normalization Workflow

1. Store only approved source frames in the repo. Keep failed raw generations outside tracked assets.
2. Build an edit canvas from the approved seed frame when requesting a strip.
3. Generate one full transparent strip at once; do not stitch independent frame generations.
4. Normalize with one shared scale and bottom-center anchor.
5. Lock frame 01 back to the approved seed frame when identity drift is visible.
6. Render a preview sheet and inspect it before adding manifest entries.
7. Verify the normalized asset in-game before marking a production sprite task complete.

## QA Checklist

- Transparent edges are clean at 100% and game scale.
- Bottom-center anchor is stable across frames.
- Frame count, frame size, and direction label match the manifest.
- Creature and tower silhouettes read at phone scale without text labels.
- Reaction decals do not hide enemy HP bars or slot state.
- UI panel assets work as Phaser SVGs and CSS `background-image` assets.
- Text metadata files are UTF-8 without BOM.
