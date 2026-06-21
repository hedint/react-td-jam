# Phase 0.5 Visual Overhaul Plan

## Status

- Current phase: Phase 5 - HUD, Cards, Draft, and Result UI
- Overall status: Phase 0 complete; Phase 1 visual direction approved; Phase 2 complete; Phase 3 complete; Phase 4 complete; Phase 5 next
- Source docs: `docs/design.md`, `docs/setting.md`, `docs/plans/p0-implementation-plan.md`
- Visual reference: user-provided `React TD` concept screenshot in the planning thread.
- Goal: turn the completed P0 from a readable schematic prototype into a polished demo-facing visual slice without changing P0 gameplay rules.

## Agent Instructions

This document is both the implementation plan and the execution log for Phase 0.5.

When working on this plan:

- Update checkboxes in this file as work is completed.
- Do not mark a checkbox complete until the behavior or asset is implemented and verified at the level described by the checkbox.
- Keep implementation aligned with `docs/design.md` and `docs/setting.md`; this phase changes presentation, not core rules.
- If an implementation detail must diverge from this plan, write the divergence in the current phase's "Phase notes" before moving on.
- At the end of each phase, fill in "Phase completion summary" with:
  - what was implemented;
  - what was intentionally deferred;
  - any contradictions, tradeoffs, or accepted deviations;
  - tests/checks that were run.
- Keep Phaser scenes thin. Rendering and animation may live in Phaser helpers, but game rules remain in serializable TypeScript simulation code.
- Keep player-facing text in Russian fiction naming from `docs/setting.md`; internal ids may remain English.
- Use UTF-8 without BOM for all new or modified text files.
- Prefer `npm run lint:fix` over `npm run lint`.
- Do not revert unrelated worktree changes. The P0 worktree may already contain user or previous-agent changes.

Stop-gate rule:

- Phase 1 produces a single in-game visual mockup target. Do not proceed into bulk asset generation or animation production until the user approves that mockup direction.

Sequencing principle:

- Phase 0.5 is intentionally split into two internal deliveries.
- **0.5a Visual Core:** approved live-combat style frame, layered board, towers, reactions, HUD, cards, and browser QA.
- **0.5b Creature Animation Pack:** full enemy and boss sprite sets with the approved facing model, hit, and death/vulnerable states.

## Phase 0.5 Scope

Build an asset-heavy top-down 2D visual overhaul for the existing Vue + Phaser + TypeScript game:

- Preserve current 540x960 portrait layout and existing board/gameplay geometry.
- Preserve P0 mechanics, balance, save format semantics, draft rules, enemy rules, boss rules, and headless simulation behavior.
- Replace schematic board/tower/enemy rendering with production-style 2D assets and controlled procedural overlays.
- Use a layered 2D scene: non-gameplay atmosphere/background layers plus dynamic geometry-driven Phaser/Vue render layers.
- Use original AI-generated bitmap assets, normalized and committed as shipping assets with source prompts/specs.
- Keep procedural rendering for interactions and timing-sensitive feedback: selected cells, valid slots, lightning, glow pulses, hit flashes, danger cues, and short reaction callouts.
- Redesign the normal run HUD, lower tray/cards, draft overlay, pause overlay, and result screen in a compact "iron control panel" style.
- Add full P0 creature animation coverage: seven enemy archetypes plus Бочкоед.

Explicitly out of scope:

- Full isometric board refactor.
- 3D, Three.js, lighting engines, or camera work.
- New P1 mechanics such as Холод, global diversity multiplier, adaptive boss resistance, new reactions, relics, or endless mode.
- Gameplay rebalance except for visual-readability bugs caused by the new presentation.
- Required audio.
- Copying the reference image exactly.
- Keeping failed raw generation attempts in the repo.

## Key Product Decisions

- Visual direction: top-down "chunky industrial gremlin fortress" with dark metal, rock, soot, brass/copper, magma orange, electric cyan, steam white, and strong reaction color coding.
- Perspective: keep current top-down gameplay coordinates; create depth through painted shadows, bevels, material texture, local glow, parallax-free layers, and sprite grounding.
- Asset strategy: asset-heavy 2D, not pure procedural; however, procedural overlays remain mandatory for live gameplay feedback.
- Scene model: layered 2D background under dynamic objects, not a single flat screenshot and not fully modular tilemap production.
- Background rule: never bake gameplay-significant path, slots, gate/checkpoint, or Куб into the static background. These must render from the existing board/core geometry.
- Куб rule: the Великий Перегонный Куб is a dynamic runtime object with separate sprite/layers for fill, damage, glow, and pulse states.
- VFX model: decals/flipbooks plus procedural effects.
- UI language: compact riveted iron/brass panels; no generic dashboard styling.
- UI skin rule: Vue DOM UI and Phaser canvas UI/field chrome must share palette tokens and panel/frame textures instead of recreating the iron-panel language twice.
- Field priority: field, VFX, towers, and cards first; creatures and full animation second.
- Card art: reuse tower art as the hero visual for tower cards and lower tray items; do not generate separate illustrations for each card unless needed later.
- Callouts: rare field callouts only for new reactions, T2/T3 reactions, boss Reaction Break, and acute danger.
- Asset storage policy: commit optimized shipping assets plus prompts/specs and approved source frames; do not commit failed raw generations.

## Architecture Contracts

- Simulation remains the source of truth for board, towers, enemies, reactions, boss, phase, draft, and stats.
- Phaser owns scene boot, asset loading, sprite/atlas rendering, canvas layers, tweens, animation playback, and procedural combat VFX.
- Vue owns text-heavy UI: HUD, tray, draft, pause, resume prompt, and result screen.
- `GameSnapshot` remains the renderer/UI read model. Do not add Phaser, DOM, or asset objects to serializable state.
- Asset definitions belong in a manifest/registry, not scattered string paths.
- Shared panel/frame assets must be usable from both Phaser and CSS: atlas or frame keys for Phaser, plus CSS-friendly image slices/backgrounds and shared color variables for Vue.
- Use a small number of atlases where practical. Avoid many independent texture loads for small game sprites.
- Maintain clickable slot/cell behavior from P0. Visual sprites must not shift gameplay hit targets.
- Preserve mobile-first 540x960 layout and desktop phone-frame behavior.
- Keep debug tooling optional and visually separate from player-facing polish.

Suggested asset organization:

- `public/assets/scene/` for non-gameplay background layers.
- `public/assets/towers/` for approved tower source frames or packed tower exports.
- `public/assets/enemies/` for enemy source frames, normalized frames, and sprite sheets.
- `public/assets/reactions/` for decals/flipbooks.
- `public/assets/ui/` for shared HUD/card frames, icons, panel textures, and CSS/Phaser skin assets.
- `src/shared/assets/manifest.ts` for stable asset keys and paths.

## Phase 0 - Preparation and Baseline

Purpose: establish the current P0 visual baseline, confirm the repo state, and prepare a non-destructive asset workflow.

### Tasks

- [x] Read `docs/design.md`, `docs/setting.md`, and `docs/plans/p0-implementation-plan.md`.
- [x] Inspect current Phaser rendering in `RunScene.ts` and `runSceneRender.ts`.
- [x] Inspect current Vue HUD/card surfaces in `RunHud.vue` and `RunHud.css`.
- [x] Capture or select baseline screenshots for ready state, live combat, draft, boss, and result screens.
- [x] Record current worktree status and identify unrelated pre-existing changes before editing.
- [x] Confirm current commands still pass or record pre-existing failures: `npm run typecheck`, `npm test`, `npm run build`.
- [x] Create the initial asset folder structure only when implementation begins.
- [x] Define image generation prompt/spec files for style, board, tower, reaction, UI, enemy, and boss assets.

### Acceptance Criteria

- [x] The visual baseline is documented with screenshots and notes.
- [x] The implementer knows which files own Phaser render, Vue UI, and asset manifest concerns.
- [x] Pre-existing failures or dirty worktree changes are recorded before visual work starts.

### Tests

- [x] Baseline `npm run typecheck`.
- [x] Baseline `npm test`.
- [x] Baseline `npm run build`.

### Verification

- [x] Baseline screenshots are saved under ignored output or documented if already available.
- [x] No P0 mechanics are changed in this phase.

### Phase notes

- Decisions/contradictions:
  - Phase 0.5 starts from the completed P0 implementation. `docs/plans/p0-implementation-plan.md` records P0 complete through Phase 8 with 62 passing tests in the current repo.
  - Current Phaser ownership:
    - `src/app/phaser/scenes/RunScene.ts` owns scene lifecycle, event bridge wiring, fixed-step driver use, pointer-to-slot tap flow, autosave, and the high-level render order.
    - `src/app/phaser/scenes/runSceneRender.ts` owns reusable geometry helpers and current procedural glyph/VFX helpers for enemies, towers, and reactions.
    - `src/app/phaser/scenes/BootScene.ts` currently loads only `assets.placeholder` from `src/shared/assets/manifest.ts`, so Phase 2 should expand the manifest before adding production art.
  - Current Vue ownership:
    - `src/widgets/run-hud/ui/RunHud.vue` owns top HUD, lower bench, resume prompt, draft overlay, pause overlay, and victory/defeat result overlay.
    - `src/widgets/run-hud/ui/RunHud.css` owns the current generic dark-panel HUD/card styling that Phase 5 will replace with the iron/brass skin.
  - Current asset manifest is a single placeholder SVG entry in `src/shared/assets/manifest.ts`; production asset groups are not wired yet.
  - Pre-edit worktree was already dirty only in `docs/plans/p05-visual-overhaul-plan.md`. The pre-existing diff changed the plan toward dynamic Куб/background rules, shared UI skin assets, and approved creature facing model language. These changes were kept.
  - Baseline screenshot set:
    - Fresh current ready: `output/playwright/phase05-baseline-ready-current.png`.
    - Fresh current live placement check: `output/playwright/phase05-baseline-live-current.png`.
    - Fresh current late wave check: `output/playwright/phase05-baseline-after-wave-current.png`.
    - Selected live-combat/wow #1 baseline: `output/playwright/phase8-final-live-placement-wow1.png`.
    - Selected draft baseline: `output/playwright/phase8-final-draft-tower.png` and `output/playwright/phase8-final-draft-upgrade.png`.
    - Selected boss baseline: `output/playwright/phase8-final-wow3-boss-vulnerable.png`.
    - Selected result baseline: `output/playwright/phase8-final-victory-stats.png` and `output/playwright/phase8-final-defeat-stats.png`.
  - Added initial tracked asset folders through README files under `public/assets/scene/`, `public/assets/towers/`, `public/assets/enemies/`, `public/assets/reactions/`, and `public/assets/ui/`.
  - Added initial image-generation prompt/spec files under `docs/visual-overhaul/asset-specs/` for style, board, towers, reactions, UI, enemies, and boss.
  - No runtime code, simulation rules, balance, save semantics, or gameplay tests were changed in this phase.

### Phase completion summary

- Implemented:
  - Phase 0.5 source docs were read and current render/UI/asset ownership was mapped.
  - Baseline screenshot paths were captured or selected from existing ignored Playwright output.
  - Initial asset directory structure and prompt/spec documentation were added for future visual phases.
- Intentionally deferred:
  - No mockup, production art, runtime manifest expansion, Phaser asset loading, UI restyle, or gameplay presentation change was started. Phase 1 remains the approval mockup stop-gate.
- Accepted deviations/tradeoffs:
  - Late-game baseline surfaces use already existing Phase 8/Phase 7 Playwright screenshots rather than replaying a full public run during Phase 0. Fresh current screenshots were added for ready/live sanity checks.
- Tests/checks run:
  - `npm run typecheck` passed.
  - `npm test` passed: 2 test files, 62 tests.
  - `npm run build` passed with Vite's existing large chunk warning for `dist/assets/index-*.js` over 500 kB.

## Phase 1 - Visual Direction and Approval Mockup

Purpose: produce one representative live-combat in-game mockup and stop for user approval before bulk asset production.

### Tasks

- [x] Create one `540x960` live-combat style target showing: board, Великий Куб, path, four P0 tower types, at least two enemy types, two or three reactions, top HUD, lower tray/cards, and thematic panels.
- [x] Keep the mockup top-down and aligned with current board geometry.
- [x] Use the reference screenshot only as concept guidance for rich ground reactions, towers, background atmosphere, and panel material language.
- [x] Define the final 0.5 palette, material language, line weight, shadow style, and glow intensity from the mockup.
- [x] Define tower silhouette rules: each tower must read at game scale without relying on label text.
- [x] Define reaction readability rules: color plus shape/pattern, with ground and air reactions visually separated.
- [x] Define UI hierarchy rules: core HP, wave/phase, threat, speed/pause, tower tray, draft cards, and result stats.
- [x] Save the approved mockup or style frame in the project documentation or ignored output location, and document the prompt/spec used to create it.
- [x] Stop and request user approval before Phase 2.

### Acceptance Criteria

- [x] The mockup reads as the same game, not a separate concept poster.
- [x] The center playfield stays usable and not buried under UI.
- [x] The user approves the style direction before production assets begin.
- [x] The mockup explicitly resolves top-down perspective, material style, color palette, UI style, and reaction density.

### Tests

- [x] Visual scale check at 540x960.
- [x] Visual scale check in desktop phone-frame.

### Verification

- [x] Approved mockup path or reference is recorded in Phase notes.
- [x] No bulk sprite or animation production begins before approval.

### Exit gate

- [x] **User-approved live-combat style mockup.**

### Phase notes

- Decisions/contradictions:
  - Produced Phase 1 style target with the built-in `image_gen` flow, then copied the generated output into the workspace so the project does not depend on `$CODEX_HOME`.
  - Mockup paths:
    - Generated source copy: `docs/visual-overhaul/mockups/phase1-live-combat-style-target.png`.
    - Exact mobile scale check: `docs/visual-overhaul/mockups/phase1-live-combat-style-target-540x960.png`.
    - Prompt/spec and direction notes: `docs/visual-overhaul/mockups/phase1-live-combat-style-target.md`.
  - The mockup establishes the intended 0.5 direction: top-down chunky industrial gremlin fortress, dark iron/rock base, brass and copper frames, strong magma-orange Куб focal glow, electric-cyan reaction accents, steam-white air effects, and compact iron/brass HUD and tray panels.
  - Tower silhouette rules from the style target:
    - Водомёт: tank plus cannon/nozzle mass.
    - Маслонасос: dark barrel and hose/pump mass.
    - Разрядник: coil tower and lightning-prong crown.
    - Магмовый кран: hot crucible/core and valve/pipe form.
  - Reaction readability rules from the style target:
    - Ground reactions are floor decals with irregular footprints and bounded glow.
    - Air reactions are raised cloud/plume/vortex masses and must stay visually separated from path tiles and enemies.
    - Color is duplicated with shape and layer height: cyan cracks/arcs for Электролужа, white/gray plume for Пар, orange flame/scorch for Пожар, dark cloud plus blue bolts for Грозовое облако.
  - UI hierarchy rules from the style target:
    - Top HUD priority is Куб HP, wave/phase, enemy pressure, speed, and pause/start.
    - Lower tray priority is art-first tower identity, compact status/cost chips, and a workshop rail frame that does not cover the center playfield.
    - Draft/result surfaces should reuse the same riveted iron/brass material language in Phase 5.
  - Accepted pre-production deviation: the generated mockup is top-down and geometry-aware, but not pixel-accurate to current Phaser path bounds. Phase 3 must translate this direction back onto the exact runtime board centers, slots, checkpoint, and Куб footprint.
  - User approval recorded on 2026-06-21: the overall visual direction and style language are approved.
  - Approval scope: the mockup is approved as a style direction only, not as a detail-accurate layout or production asset specification.
  - Explicit detail caveats from approval:
    - Towers must not stand on the walkway in runtime; they must remain aligned to valid slot centers.
    - Reaction decals such as Электролужа must align cleanly to path cells instead of drifting across the lane.
    - The lower tower tray can be more compact than the mockup if the final layout does not need that much vertical space.
    - Runtime path, slots, Куб, and UI proportions must be driven by existing game geometry and playability, not copied from the generated image.
  - No runtime code, gameplay mechanics, bulk sprites, animation strips, or asset manifest integration were started before approval.

### Phase completion summary

- Implemented:
  - One live-combat style target was generated, normalized to `540x960`, visually inspected, and documented with its prompt/spec.
  - Palette, material language, tower silhouette rules, reaction readability rules, and UI hierarchy rules were extracted from the mockup.
- Intentionally deferred:
  - Phase 2 asset manifest/pipeline work and all bulk sprite/animation production remain deferred.
- Accepted deviations/tradeoffs:
  - The mockup is a style direction candidate, not a pixel-accurate runtime layout export.
  - User-approved direction explicitly excludes copying the mockup's tower placement, reaction decal placement, lower tray height, and exact layout proportions.
- Tests/checks run:
  - Visual inspection of generated source image.
  - Image dimension check for the normalized `540x960` file.
  - Desktop phone-frame check by reviewing the exact `540x960` target as the centered phone canvas.

## Phase 2 - Asset Pipeline and Runtime Asset Manifest

Purpose: add the technical asset pipeline and manifest layer needed to integrate 2D production assets cleanly.

### Tasks

- [x] Add or finalize asset directories for scene, towers, enemies, reactions, and UI.
- [x] Extend `src/shared/assets/manifest.ts` with typed asset groups and stable keys.
- [x] Update `BootScene.ts` to load the new assets from the manifest.
- [x] Choose atlas strategy for 0.5a and 0.5b: single atlas if practical, otherwise a small bounded set by category.
- [x] Add shared skin tokens and assets for Vue and Phaser: palette variables, panel textures, frame slices, card frames, and button/chip materials.
- [x] Ensure shared panel assets can be used as Phaser frames/NineSlice-style assets and as CSS `background-image`/`border-image` or equivalent.
- [x] Add naming conventions for sprite sheets, frame keys, animation keys, and source-frame files.
- [x] Add prompt/spec documentation for image generation and approved seed frames.
- [x] Add local normalization workflow for transparent sprites: source frame, chroma-key or alpha cleanup, normalized frame, preview sheet.
- [x] Add a lightweight asset QA checklist: transparent edges, scale, anchor, frame count, direction labels, and in-game size.
- [x] Ensure generated and optimized project assets are UTF-8-safe metadata and no BOM text files are introduced.

### Acceptance Criteria

- [x] Phaser loads assets through the manifest, not scattered hardcoded paths.
- [x] Future asset additions have an obvious folder, key, and QA path.
- [x] Failed raw generations are not required for the repo.
- [x] Vue and Phaser can consume the same UI skin assets without visual drift.
- [x] The asset pipeline supports the later approved creature facing model.

### Tests

- [x] Typecheck catches invalid manifest shape.
- [x] Browser boot succeeds with missing/placeholder fallback only when intentionally configured.

### Verification

- [x] `npm run typecheck`.
- [x] `npm run build`.
- [x] Manual boot check that assets load without console errors.

### Phase notes

- Decisions/contradictions:
  - Added a typed runtime asset manifest in `src/shared/assets/manifest.ts` with `scene`, `towers`, `enemies`, `reactions`, and `ui` groups. Current Phase 2 entries are explicit placeholders plus shared UI skin assets; production art remains a later-phase replacement.
  - `BootScene.ts` now preloads through `phaserPreloadAssets` and supports SVG, image, spritesheet, and atlas entries from the manifest.
  - Added shared skin tokens in `src/shared/assets/skin.css` and matching `visualSkin` tokens in the manifest for Phaser-facing code.
  - Added shared SVG UI assets for iron panel, brass card frame, and rivet chip frame. These are loadable by Phaser and referenced by CSS variables as `background-image` sources.
  - Added category placeholder SVGs for scene, tower, enemy, and reaction groups so browser boot checks can verify the manifest path without requiring production art before Phase 3/4/7.
  - Added `docs/visual-overhaul/asset-pipeline.md` to document atlas strategy, naming conventions, approved seed frame handling, sprite normalization workflow, and the asset QA checklist.
  - Atlas strategy chosen:
    - 0.5a can stay with direct SVG/PNG loading until production board/tower/reaction assets exist, then consolidate into one small `ui-field` atlas if practical.
    - 0.5b should use one bounded creature atlas, with a separate boss atlas only if Бочкоед frames are too large.
  - No runtime render behavior, simulation state shape, gameplay rules, balance, or save semantics changed in this phase.

### Phase completion summary

- Implemented:
  - Typed asset groups and stable keys for all Phase 0.5 asset categories.
  - Manifest-driven Phaser preload in `BootScene`.
  - Shared Vue/Phaser UI skin asset placeholders and CSS variables.
  - Asset pipeline documentation for atlas strategy, naming, normalization, seed-frame handling, and QA.
  - Manifest tests covering category presence, unique keys, committed public files, explicit placeholder fallbacks, Phaser preload usage, and skin tokens.
- Intentionally deferred:
  - Production board, tower, reaction, enemy, and boss art remains deferred to later phases.
  - Real atlas packing remains deferred until enough production assets exist to pack.
- Accepted deviations/tradeoffs:
  - Phase 2 uses committed SVG placeholders as intentional load targets so the manifest and BootScene can be verified before production asset generation.
  - CSS and TypeScript skin tokens are kept in parallel rather than generated from a build-time token source; this is sufficient for Phase 2 and avoids adding a pipeline dependency.
- Tests/checks run:
  - `npm run typecheck` passed.
  - `npm test` passed: 3 test files, 68 tests.
  - `npm run build` passed with Vite's existing large chunk warning for `dist/assets/index-*.js` over 500 kB.
  - `npm run lint:fix` passed.
  - Manual browser boot check on `http://127.0.0.1:5190` returned HTTP 200, created one Phaser canvas, and had no failed asset requests. Headless Chromium reported WebGL context/performance warnings only, not asset load errors.

## Phase 3 - Board, Dynamic Куб, and Tower Visual Core

Purpose: deliver the main 0.5a visual jump by replacing the schematic board and tower markers with a real scene and tower sprites.

### Tasks

- [x] Generate or produce non-gameplay top-down background layers: cavern floor, fortress walls/edges, soot, debris, atmospheric lighting, and decorative depth.
- [x] Integrate background layers into Phaser beneath existing dynamic render layers.
- [x] Render the осадная галерея path from `board.pathCells`/geometry using dynamic path segments, tile/decal sprites, or procedural mesh-like drawing; do not bake it into the background.
- [x] Render gate/checkpoint from gameplay geometry as a separate dynamic marker/layer; do not bake it into the background.
- [x] Render the Великий Перегонный Куб as a separate dynamic object at the configured board center; do not bake it into the background.
- [x] Add Куб runtime states: Batch fill/level indication, glow pulse, damage overlay, and phase-sensitive intensity driven from existing snapshot data.
- [x] Preserve the current logical path cell centers and slot centers.
- [x] Replace path and slot schematic drawing with thematic ground markers that remain readable and tappable.
- [x] Add mobile-first selection/valid-placement feedback that follows P0 placement rules; desktop hover is intentionally omitted.
- [x] Generate and integrate static tower sprites for Водомёт, Маслонасос, Разрядник, and Магмовый кран.
- [x] Ground tower sprites with shadows, bases, and lane-aware positioning so inner/outer slots remain readable.
- [x] Add procedural tower activation feedback: glow, recoil, small sparks/steam/heat pulses as appropriate.
- [x] Keep labels optional or reduced; the tower silhouette and card/tray context should do most of the work.
- [x] Keep the current P0 click/tap behavior unchanged.

### Acceptance Criteria

- [x] The board looks like a place, not a wireframe.
- [x] The Куб is a strong first-viewport visual anchor.
- [x] The path, slots, gate/checkpoint, and Куб align pixel-accurately with existing gameplay coordinates.
- [x] Куб visual state can change with core HP/phase without changing simulation state shape.
- [x] All four tower types are distinguishable at phone scale.
- [x] Slots remain understandable without tutorial text.
- [x] Existing placement tests and interactions still pass.

### Tests

- [x] Existing placement reducer and geometry tests remain unchanged and passing.
- [x] Add tests only if manifest or render helper logic introduces non-trivial mapping.

### Verification

- [x] `npm run typecheck`.
- [x] `npm test`.
- [x] Manual browser check: new run, tower selection, live placement, pause-to-edit move/remove/swap.
- [x] Screenshot: ready state with towers and empty/occupied slots.

### Phase notes

- Decisions/contradictions:
  - First Phase 3 slice implemented the board/core layer only, not tower production sprites. This keeps the first remaining slice bounded while preserving the later tower-art tasks.
  - Added two committed non-gameplay SVG background layers: `public/assets/scene/cavern-fortress-floor.svg` and `public/assets/scene/cavern-fortress-atmosphere.svg`. They contain cavern floor, frame, wall/edge, mist, debris, soot, and atmosphere only; gameplay-significant path, slots, gate/checkpoint, and Куб remain runtime-drawn from snapshot geometry.
  - Added `src/app/phaser/scenes/runSceneBoardRender.ts` for Phase 3 board-specific rendering, keeping `RunScene.ts` focused on lifecycle/input and `runSceneRender.ts` focused on existing enemy/reaction/tower helpers.
  - The dynamic Куб is derived from existing snapshot/config data only: board center from path bounds, HP fill from `coreHp / gameConfig.balance.coreHp`, glow pulse from elapsed time, damage crack at low HP, and phase-sensitive intensity. No simulation or save-state shape changed.
  - Path, gate/checkpoint, and slot markers were restyled procedurally but still use `board.pathCells` and `board.slots`; pointer placement hit detection remains `findSlotAtPoint` over the same slot centers.
  - Added Phase 3 placement feedback as Phaser-only view state:
    - `RunScene.ts` renders placement feedback without adding anything to serializable run state.
    - `runSceneBoardRender.ts` renders low-alpha valid-placement hints and selected-slot anchors from the existing P0 placement rules.
    - `slotPlacementFeedback.ts` keeps the P0 placement feedback mapping testable outside Phaser drawing.
    - Placement feedback uses a separate `placementGraphics` overlay above towers/enemies, but intentionally avoids desktop hover-only states.
  - Accepted mobile-first deviation from the original task wording: hover feedback was removed after review because the game is designed for portrait touch play and hover does not exist on the target input model.
  - After visual review, valid placement feedback was muted: valid cells now use only a low-alpha cell tint and thin ring, while stronger overlay treatment is reserved for selected placed towers.
  - Tuned board scale after visual review:
    - Increased the rendered осадная галерея road width so path cells have enough visual surface for later reaction VFX.
    - Reduced visual slot platform/ring scale so tower slots no longer read larger than the road.
    - Slightly reduced current procedural placeholder tower bodies until production tower sprites replace them.
    - Gameplay geometry and tap targets were not changed.
  - Screenshots:
    - Ready board core: `output/playwright/phase3-board-core-ready.png`.
    - Tower placed on updated board: `output/playwright/phase3-board-core-placed.png`.
    - Mobile-first selected-tower valid placement hints: `output/playwright/phase3-slot-valid-selection-mobile.png`.
    - Road/slot scale ready check: `output/playwright/phase3-road-scale-ready.png`.
    - Road/slot scale selected tower check: `output/playwright/phase3-road-scale-selection.png`.
    - Road/slot scale placed tower check: `output/playwright/phase3-road-scale-placed.png`.
  - Placement feedback browser check covered a fresh run and tower selection with no console/page errors.
  - Generated one approved tower source sheet with the built-in `imagegen` workflow, copied it into `public/assets/towers/source/phase3-tower-set-source-01.png`, then locally chroma-keyed/cropped it into transparent `192x192` runtime PNG stills:
    - `public/assets/towers/water-cannon.png`;
    - `public/assets/towers/oil-pump.png`;
    - `public/assets/towers/spark-discharger.png`;
    - `public/assets/towers/magma-crane.png`.
  - Added the four tower stills to `src/shared/assets/manifest.ts` and Phaser preload through stable `towers.*` keys.
  - Added `src/app/phaser/scenes/runSceneTowerRender.ts` for tower-specific sprite keys, phone-scale lane sizing, grounding shadows/bases, selected-tower ring, reduced selected-only field labels, and procedural activation feedback.
  - `RunScene.ts` now pools Phaser `Image` objects for placed towers. Tower visuals remain view state only; no asset, DOM, or Phaser object enters serializable run state.
  - Accepted activation-feedback tradeoff: P0 snapshots do not expose individual tower fire events, so Phase 3 uses bounded phase-driven procedural pulses during countdown/wave/boss. This gives readable water/oil/spark/heat identity without changing simulation shape.
  - Tower labels are reduced to selected-tower context only. Normal field readability is carried by the sprite silhouette and HUD/tray text.
  - Tower sprite browser screenshots:
    - Ready/all four tower types: `output/playwright/phase3-tower-sprites-ready.png`.
    - Live wave/activation feedback: `output/playwright/phase3-tower-sprites-live.png`.
    - Pause remove: `output/playwright/phase3-tower-pause-remove.png`.
    - Pause move: `output/playwright/phase3-tower-pause-move.png`.
    - Pause swap: `output/playwright/phase3-tower-pause-swap.png`.
    - Post-refactor smoke: `output/playwright/phase3-tower-sprites-ready-refactor-check.png`.
  - Browser checks reported no page errors or asset-load errors. Chromium emitted `ReadPixels` WebGL performance warnings while screenshots were captured; this appears tied to Playwright screenshot capture rather than gameplay runtime.

### Phase completion summary

- Implemented:
  - Phase 3 board/core visuals, dynamic Куб, path/slot/gate rendering, placement feedback, and all four static tower sprites are integrated.
  - Tower sprites now have runtime manifest entries, Phaser image pooling, lane-aware sizing, grounding shadows/bases, selected-only labels, and bounded procedural activation feedback.
- Intentionally deferred:
  - Card/tray reuse of tower art remains in Phase 5 with the full HUD/card redesign.
  - Reaction decal/flipbook production remains in Phase 4.
- Accepted deviations/tradeoffs:
  - Tower assets were generated as one chroma-key sheet and locally cleaned into transparent PNGs instead of separately generated native-alpha files.
  - Tower activation feedback is phase-driven view state rather than exact shot-timed animation because P0 exposes no per-tower firing event in `GameSnapshot`.
- Tests/checks run:
  - `npm run lint:fix` passed.
  - `npm run typecheck` passed.
  - `npm test` passed: 4 files, 71 tests.
  - Playwright browser checks covered ready state, live wave, tower selection/readability, pause-to-edit remove, pause-to-edit move, and pause-to-edit swap.

## Phase 4 - Reaction VFX and Combat Readability

Purpose: make the core fantasy visible: reactions should feel like the board is becoming a machine of war.

### Tasks

- [x] Replace or augment current `Graphics` reaction drawings with decal/flipbook assets for all P0 reactions.
- [x] Implement Электролужа as a ground decal with water shape, electric arcs, and pulsing edge.
- [x] Implement Пар as an air-layer steam plume that does not obscure ground slots permanently.
- [x] Implement Пожар as a ground fire/oil burn decal with ember motion and dark scorch shape.
- [x] Implement Грозовое облако as an air-layer cloud with procedural lightning strikes.
- [x] Implement Огненный вихрь as an air-layer vortex with rotating fire form.
- [x] Implement Огненный Шторм as the T3 climax effect with strong but bounded screen presence.
- [x] Add rare field callouts for new reactions, T2/T3 creation, boss Reaction Break, and acute core danger.
- [x] Ensure callouts do not stack into unreadable noise.
- [x] Preserve colorblind-friendly duplication through shape, pattern, layer height, and motion.
- [x] Keep VFX performance bounded: no blur/post-processing dependency; avoid unbounded particles; reuse objects where practical.
- [x] Ensure enemies remain visible under VFX and HP/danger cues stay readable.

### Acceptance Criteria

- [x] Wow #1, wow #2, and wow #3 read more clearly than in P0 screenshots.
- [x] Ground and air reactions are visually distinct.
- [x] T1, T2, and T3 feel progressively more powerful without obscuring gameplay.
- [x] Reaction VFX do not break mobile performance expectations.

### Tests

- [x] Existing reaction simulation tests remain unchanged and passing.
- [x] Add a render-budget or asset-key test if the implementation introduces a dedicated VFX registry.

### Verification

- [x] `npm run typecheck`.
- [x] `npm test`.
- [x] Manual browser check using fixtures or playthrough states for all six P0 reactions.
- [x] Screenshots: Электролужа, Грозовое облако, Огненный Шторм, boss vulnerable.

### Exit gate

- [x] **All P0 reactions have production-style visual coverage.**

### Phase notes

- Decisions/contradictions:
  - Added six committed reaction identity assets under `public/assets/reactions/`: `electro-puddle.svg`, `steam-plume.svg`, `fire-decal.svg`, `storm-cloud.svg`, `fire-vortex.svg`, and `fire-storm.svg`.
  - Added stable manifest entries for all six P0 reactions and a dedicated `reactionVfxRegistry` in `src/app/phaser/scenes/runSceneReactionRender.ts`.
  - Added `src/app/phaser/scenes/runSceneReactionPresenter.ts` so `RunScene.ts` remains under the local line-count limit and continues to act as orchestration rather than a large VFX owner.
  - Runtime VFX now use pooled Phaser `Image` objects for reaction decal/plume identity plus the existing procedural `Graphics` overlays for pulse, arcs, lightning, embers, vortex spin, and T3 energy accents.
  - Ground reactions use lower path-aligned decal depths; air reactions use raised y-offsets and higher effect depth while still staying under enemies and HP/danger cues.
  - Added a separate low-depth reagent projection layer in `src/app/phaser/scenes/runSceneReagentRender.ts`. It uses the existing pure `projectReagents` simulation helper to show одиночные Вода/Нефть/Искра/Жар effects on path tiles before they combine into reactions.
  - Initial schematic `Graphics` reagent markers were rejected. The layer was replaced with pooled Phaser image overlays using committed material assets: `reagent-water-puddle.svg`, `reagent-oil-slick.svg`, `reagent-spark-charge.svg`, and `reagent-heat-scorch.svg`.
  - Reagent visuals are intentionally quieter than reaction VFX but still material-specific: water reads as a puddle, oil as a dark slick, spark as a charged electric field, and heat as a scorch/glow patch. They stay under reaction decals and tower/enemy sprites.
  - Added rare field callouts for first-seen reaction types, T2/T3 reactions, boss Reaction Break, and acute Куб danger. Callouts are capped at two visible labels and throttled to avoid stacking noise.
  - Accepted 0.5a asset tradeoff: Phase 4 uses optimized SVG decal/plume assets rather than generated bitmap flipbook strips. This keeps the VFX slice lightweight and testable; motion-sensitive detail remains procedural. Full creature animation production is still deferred to 0.5b.
  - Browser fixture state for all six reactions was generated under ignored output: `output/playwright/phase4-reaction-fixture-save.json`.
  - Browser screenshots:
    - All six P0 reactions: `output/playwright/phase4-reaction-vfx-all.png`.
    - Boss vulnerable / Reaction Break: `output/playwright/phase4-reaction-vfx-boss-vulnerable.png`.
  - Browser check result: `output/playwright/phase4-reaction-vfx-browser-check.json` recorded no console errors, page errors, or asset-load errors. All six reaction SVG assets were observed in browser resource timing.

### Phase completion summary

- Implemented:
  - All six P0 reactions now have production-style decal/plume asset coverage and procedural overlays for live readability.
  - Reaction VFX are manifest-backed, pooled, and covered by a registry test that validates every configured reaction has a non-placeholder Phaser asset matching its simulation layer and tier.
  - Oдиночные башни now visibly project their own asset-backed reagent/effect coverage onto path tiles, so players can understand tower contribution before a reaction is formed.
  - Rare bounded field callouts cover new reactions, T2/T3 creation, boss Reaction Break, and low-core danger without changing serializable game state.
- Intentionally deferred:
  - Multi-frame flipbook/atlas production was deferred; the current Phase 4 slice uses still SVG identity assets plus procedural motion.
  - HUD/card reuse of reaction/tower visual language remains in Phase 5.
- Accepted deviations/tradeoffs:
  - SVG decals were accepted for the 0.5a reaction slice instead of bitmap flipbooks to keep performance and integration risk bounded.
  - The all-reaction browser fixture intentionally uses six towers and dense effects to verify coverage; it is not a normal-run composition target.
- Tests/checks run:
  - `npm run lint:fix` passed.
  - `npm run typecheck` passed.
  - `npm test` passed: 5 files, 73 tests.
  - `npm run build` passed with Vite's existing large chunk warning for `dist/assets/index-*.js` over 500 kB.
  - Playwright browser check on `540x960` captured all-reaction and boss-vulnerable screenshots with no browser issues and all six reaction assets loaded.
  - Additional Playwright reagent checks captured `output/playwright/phase4-single-reagents.png` for the rejected schematic pass and `output/playwright/phase4-single-reagents-assets.png` for the asset-backed pass. The final asset-backed check had no browser issues; fixture had no active reactions but showed Вода, Нефть, Искра, and Жар projections.

## Phase 5 - HUD, Cards, Draft, and Result UI

Purpose: make the game interface match the new field quality while protecting the playfield.

### Tasks

- [ ] Redesign top HUD as compact iron/brass control panels with clear priority: Куб HP, wave/phase, threat, speed, pause/start.
- [ ] Redesign lower tray as a workshop/card rail that supports tower selection and placed/reserve state.
- [ ] Reuse tower art for tower cards and lower tray items.
- [ ] Add element/type icon treatment for Вода, Нефть, Искра, and Жар.
- [ ] Redesign draft overlay with thematic card frames, role labels, upgrade stack info, and reroll state.
- [ ] Redesign pause overlay in the same material language without covering unnecessary context.
- [ ] Redesign victory/defeat result screen with readable stats and reaction damage list.
- [ ] Preserve all existing actions and keyboard/pointer behavior.
- [ ] Keep text fitting within panels on mobile and desktop phone-frame sizes.
- [ ] Keep debug HUD excluded from player-facing polish unless it visually conflicts when enabled.

### Acceptance Criteria

- [ ] UI no longer looks like a generic web app overlay.
- [ ] The field remains the hero during normal play.
- [ ] Draft and result screens feel like the same game as the board.
- [ ] No text clips or overlaps at mobile widths.
- [ ] Existing run lifecycle actions still work.

### Tests

- [ ] Existing store/action tests remain passing.
- [ ] Add UI behavior tests only if component logic changes.

### Verification

- [ ] `npm run typecheck`.
- [ ] `npm test`.
- [ ] Manual browser check: start wave, pause/resume, speed, tower selection, draft reroll, upgrade pick, result restart/new run.
- [ ] Screenshots: normal HUD, tower draft, upgrade draft, pause, victory/defeat result.

### Phase notes

- Decisions/contradictions:
  - During Phase 5 visual review, board geometry was corrected before continuing HUD work:
    - the 16-cell path now uses an explicit orthogonal 5x5 grid loop with one equal tile step between all neighboring path cells;
    - `cell-0` is the lower-left entrance tile; the gate marker and enemy spawn point use this cell;
    - `slot-0-outer` is intentionally omitted, so the entrance tile has no outside tower and no starting reaction coverage from an external tower;
    - middle straight cells keep adjacent grid positions on the inside and outside of their path cell;
    - adjacent-to-corner inner slots are collapsed into one physical inner-corner junction slot, avoiding two tower slots occupying the same point;
    - the four inner-corner junction slots are `slot-0-inner`, `slot-4-inner`, `slot-8-inner`, and `slot-12-inner`; each affects the two straight path cells touching that inner corner and not the corner path tile itself;
    - corner outer slots remain diagonal single-cell slots that affect only their own corner path tile, except the omitted entrance outer slot;
    - `defaultBoardGeometryConfig.lockInnerCornerSlots` is currently `false` for the visual slice. The combat-intended feature flag exists and locks only the inner-corner junction slots when enabled;
    - path reaction cells now render as explicit square red-outlined road tiles rather than ambiguous circular markers or a stadium-shaped path stroke;
    - ground reaction and reagent sprites now share the same square path-tile presentation helper as the visible tile outlines.
  - Accepted user-requested mechanics deviation from the original Phase 0.5 "presentation only" rule: the authored board geometry changed from 32 logical per-cell slots to 23 physical slots, including 4 inner-corner junction slots with two-cell influence and no outside entrance tower.
  - Tower art follow-up: inner-corner junction towers need a dedicated visual state or generated corner variant because directional tower silhouettes such as Водомёт/Маслонасос must read as influencing two adjacent cells.
  - Verification screenshots for this correction:
    - first square-tile check: `output/playwright/p05-square-tiles-slot-grid.png`;
    - current grid road check: `output/playwright/p05-grid-loop-square-road.png`.
    - current inner-corner junction check: `output/playwright/p05-inner-corner-junction-slots.png`.
    - lower-left entrance check without `slot-0-outer`: `output/playwright/p05-bottom-left-entrance.png`.

### Phase completion summary

- Implemented:
- Intentionally deferred:
- Accepted deviations/tradeoffs:
- Tests/checks run:

## Phase 6 - 0.5a Browser QA and Visual-Core Approval

Purpose: harden the visual core before committing to full creature animation production.

### Tasks

- [ ] Run browser QA on mobile portrait and desktop phone-frame.
- [ ] Verify all normal play surfaces: ready, wave, placement, pause edit, draft, countdown, boss, victory, defeat.
- [ ] Verify all three wow moments from `docs/design.md`.
- [ ] Verify no UI element blocks critical tower placement or core/path reading.
- [ ] Verify no new visual layer breaks pointer targeting.
- [ ] Compare new screenshots against P0 baseline screenshots and record the improvement.
- [ ] Tune colors, contrast, shadow strength, and effect opacity based on screenshots.
- [ ] Get user approval that 0.5a visual core is good enough to proceed to creature animation.

### Acceptance Criteria

- [ ] The game is visually demoable before full creature animation is complete.
- [ ] The user approves the visual core direction.
- [ ] Known remaining visual gaps are explicitly listed for 0.5b.

### Tests

- [ ] `npm run lint:fix`.
- [ ] `npm run typecheck`.
- [ ] `npm test`.
- [ ] `npm run build`.

### Verification

- [ ] Browser screenshots saved for the required surfaces.
- [ ] Console checked for asset load errors.
- [ ] Mobile frame checked for text fitting and touch target readability.

### Exit gate

- [ ] **0.5a visual core approved.**

### Phase notes

- Decisions/contradictions:

### Phase completion summary

- Implemented:
- Intentionally deferred:
- Accepted deviations/tradeoffs:
- Tests/checks run:

## Phase 7 - Creature and Boss Seed Frames

Purpose: create approved source frames and validate the facing model on one creature before generating animation strips.

### Tasks

- [ ] Define final creature scale, anchor, shadow, and lane offset rules.
- [ ] Generate or produce approved source frames for all seven P0 enemy archetypes: Грунт, Сварм, Танк, Летун, Бегун, Грязевик, Магма-выползень.
- [ ] Generate or produce approved source frame for Бочкоед.
- [ ] Ensure every enemy silhouette maps to its gameplay role: basic, swarm, tank, flying, runner, electric-resistant, fire-resistant.
- [ ] Ensure Бочкоед reads as a large deep-cave batch-drinking threat and works on the existing path.
- [ ] Normalize all approved seed frames to consistent in-game scale and bottom-center anchors.
- [ ] Build preview sheets for approved seed frames.
- [ ] Build a facing spike with one representative creature, preferably Бегун or Грунт: source frame, minimal movement loop, in-engine playback on the real loop, and corner transitions.
- [ ] Compare facing models in the spike: `left/right + flip`, `4-direction`, and any cheap hybrid needed for Бочкоед.
- [ ] Choose and document the approved facing model before Phase 8 bulk animation begins.
- [ ] Default to `left/right + flip` for normal enemies unless the spike proves `4-direction` is worth the extra production and corner-switching cost.
- [ ] Decide Бочкоед separately if needed; because he is larger and slower, he may justify more bespoke direction frames than normal enemies.
- [ ] Record prompts/specs and approved source frame paths.

### Acceptance Criteria

- [ ] Each creature is readable at game scale before animation.
- [ ] The seven enemy archetypes are visually distinct without needing labels.
- [ ] Бочкоед is visually larger and more important than normal enemies.
- [ ] Approved seed frames are stable enough to drive animation generation.
- [ ] Direction/facing changes look acceptable on the real rectangular loop before mass animation production starts.
- [ ] The selected facing model has a documented production cost and runtime mapping.

### Tests

- [ ] Manifest/typecheck if seed frames are referenced by code.
- [ ] Direction helper test if the facing spike introduces reusable path-segment-to-facing logic.

### Verification

- [ ] In-game preview scene or fixture showing all seed frames on the board.
- [ ] In-game spike capture or screenshot sequence showing the representative creature moving around the real loop.
- [ ] `npm run typecheck` if code references are added.

### Exit gate

- [ ] **Creature facing model approved before bulk animation production.**

### Phase notes

- Decisions/contradictions:

### Phase completion summary

- Implemented:
- Intentionally deferred:
- Accepted deviations/tradeoffs:
- Tests/checks run:

## Phase 8 - Creature Animation Strip Production

Purpose: produce full movement, hit, and death/vulnerable animation coverage with stable identity and anchors.

### Tasks

- [ ] For each normal enemy, create movement loops using the approved Phase 7 facing model.
- [ ] For each normal enemy, create hit reaction animation.
- [ ] For each normal enemy, create death animation.
- [ ] For Бочкоед, create crawl loops using the Phase 7 boss facing decision.
- [ ] For Бочкоед, create vulnerable animation or overlay-compatible frames.
- [ ] For Бочкоед, create death animation.
- [ ] Use approved seed frames as the first or identity-locking reference for each animation set.
- [ ] Generate animation strips as full strips, not independent frames.
- [ ] Normalize each strip with shared scale and bottom-center anchor.
- [ ] Lock frame 01 back to the approved seed frame where continuity matters.
- [ ] Render preview sheets for each animation set.
- [ ] Reject and regenerate strips with identity drift, scale drift, bad transparency, bad direction, or unreadable motion.
- [ ] Optimize final PNG/WebP outputs and atlas packing.

### Acceptance Criteria

- [ ] Every P0 enemy has move, hit, and death coverage using the approved facing model.
- [ ] Бочкоед has crawl, vulnerable, and death coverage.
- [ ] Frame-to-frame scale and anchor are stable.
- [ ] Sprites remain readable under reaction VFX.
- [ ] Asset size remains reasonable for a browser game.

### Tests

- [ ] Add asset manifest coverage tests if animation keys are declarative.
- [ ] Existing enemy/boss simulation tests remain unchanged and passing.

### Verification

- [ ] Preview sheets inspected.
- [ ] In-game animation fixture inspected.
- [ ] `npm run typecheck`.
- [ ] `npm run build`.

### Phase notes

- Decisions/contradictions:

### Phase completion summary

- Implemented:
- Intentionally deferred:
- Accepted deviations/tradeoffs:
- Tests/checks run:

## Phase 9 - Creature Runtime Integration

Purpose: replace procedural enemy and boss shapes with sprite animations while preserving P0 behavior.

### Tasks

- [ ] Add Phaser animation key registration for all enemy and boss animations.
- [ ] Select facing based on the approved Phase 7 model and current path segment.
- [ ] Replace procedural enemy bodies with animated sprites.
- [ ] Keep or restyle HP bars, resist telegraphs, flying cues, and danger cues.
- [ ] Add hit feedback when enemies take damage without creating unreadable flicker.
- [ ] Play death animation or dissolve without blocking simulation cleanup.
- [ ] Replace procedural Бочкоед body with animated boss sprite.
- [ ] Apply Бочкоед vulnerable visual state through animation or overlay.
- [ ] Ensure sprite depth sorting keeps air reactions, ground reactions, towers, enemies, and boss readable.
- [ ] Preserve object pooling or bounded creation to avoid runtime churn.
- [ ] Remove obsolete procedural enemy/boss drawing only after sprite replacement is verified.

### Acceptance Criteria

- [ ] Existing enemy and boss behavior is unchanged.
- [ ] Runtime facing behavior matches the Phase 7 approved spike.
- [ ] Boss and normal enemies remain readable under dense T2/T3 VFX.
- [ ] No animation state leaks into serializable run state.

### Tests

- [ ] Existing enemy, wave, boss, and save/resume tests remain passing.
- [ ] Add tests for direction helper if implemented outside Phaser scene code.

### Verification

- [ ] `npm run lint:fix`.
- [ ] `npm run typecheck`.
- [ ] `npm test`.
- [ ] Manual browser check: waves with all enemy archetypes, boss vulnerable, victory, defeat.
- [ ] Screenshots or short captures for movement, hit, death, and boss vulnerable.

### Phase notes

- Decisions/contradictions:

### Phase completion summary

- Implemented:
- Intentionally deferred:
- Accepted deviations/tradeoffs:
- Tests/checks run:

## Phase 10 - Final Polish, Optimization, and Documentation

Purpose: close Phase 0.5 with a stable, visually coherent demo build and documented asset workflow.

### Tasks

- [ ] Run a final visual pass across board, towers, VFX, creatures, HUD, draft, pause, and result screens.
- [ ] Remove or archive unused placeholder visual code and unused placeholder assets if they are no longer referenced.
- [ ] Verify atlas sizes, texture counts, and asset load times are acceptable.
- [ ] Verify no required asset is stored only outside the workspace.
- [ ] Document the final asset pipeline, prompt/spec locations, and how to add a new enemy/tower/reaction asset.
- [ ] Update README or docs if they still describe P0 as procedural placeholder art.
- [ ] Confirm all generated text files are UTF-8 without BOM.
- [ ] Run full checks.
- [ ] Run final browser QA on mobile portrait and desktop phone-frame.
- [ ] Fill all phase summaries and record final screenshot paths.

### Acceptance Criteria

- [ ] The game presents as a polished visual demo, not a schematic prototype.
- [ ] P0 mechanics, tests, and deterministic headless behavior remain intact.
- [ ] Asset workflow is clear enough for future P1 content.
- [ ] All three wow moments reproduce with the new visual layer.
- [ ] Normal play, draft, boss, and result surfaces all share one coherent visual language.

### Tests

- [ ] `npm run lint:fix`.
- [ ] `npm run typecheck`.
- [ ] `npm test`.
- [ ] `npm run build`.

### Final Verification

- [ ] Manual browser check: new run, wave 1, live bench placement, pause-to-edit removal/move, draft, save/reload/resume, pause/speed, all P0 reactions, all enemy archetypes, boss, victory/defeat stats, and all three wow moments.
- [ ] Screenshots saved for final ready/combat/draft/boss/result states.

### Phase notes

- Decisions/contradictions:

### Phase completion summary

- Implemented:
- Intentionally deferred:
- Accepted deviations/tradeoffs:
- Tests/checks run:

## Global Test Matrix

Use this as the minimum regression checklist while implementing Phase 0.5.

- [ ] P0 simulation tests still pass.
- [ ] Seeded runs remain deterministic.
- [ ] Save/resume round-trips still work.
- [ ] Live bench placement still works during waves.
- [ ] Pause-only move/remove/swap still works.
- [ ] All six P0 reactions are visible and distinguishable.
- [ ] Ground and air reaction layers remain visually distinct.
- [ ] Flying enemies remain visually distinct and gameplay-distinct.
- [ ] Resist enemies remain visually distinct.
- [ ] Boss Reaction Break and vulnerable state are visually obvious.
- [ ] Draft tower cards and upgrade cards remain readable.
- [ ] Victory/defeat stats remain readable.
- [ ] Mobile portrait text does not clip or overlap.
- [ ] Desktop phone-frame layout still works.
- [ ] Pointer/tap targets are not shifted by sprites.
- [ ] Static background contains no baked gameplay path, slots, gate/checkpoint, or Куб.
- [ ] Dynamic Куб state is visible and driven from existing snapshot data.
- [ ] Vue and Phaser panel/chrome assets remain visually synchronized through shared skin assets/tokens.
- [ ] Creature facing model is validated on the real loop before bulk animation production.
- [ ] No Phaser/DOM/asset objects enter serializable state.
- [ ] No required project asset remains only in `$CODEX_HOME`, temp folders, or ignored output.

## Final Phase 0.5 Done Definition

Phase 0.5 is complete only when all of the following are true:

- [ ] The visual core has an approved live-combat style direction.
- [ ] The schematic board has been replaced by a layered top-down 2D scene.
- [ ] The central Куб, path, slots, and tower positions are polished and readable.
- [ ] The background is decorative only; path, slots, gate/checkpoint, and Куб are dynamic geometry-aligned layers.
- [ ] Куб has dynamic fill/glow/damage presentation.
- [ ] Four P0 tower types have production-style sprites and card/tray usage.
- [ ] Six P0 reactions have production-style VFX coverage.
- [ ] Run HUD, lower tray, draft, pause, and result UI share one thematic style.
- [ ] Vue and Phaser share the same UI skin palette and panel/frame assets.
- [ ] Seven P0 enemy archetypes have move, hit, and death animation coverage using the approved facing model.
- [ ] Бочкоед has crawl, vulnerable, and death animation coverage.
- [ ] P0 gameplay rules and deterministic tests remain intact.
- [ ] Final verification commands pass.
- [ ] Final browser QA passes on mobile portrait and desktop phone-frame.
- [ ] Phase summaries above are filled in.
