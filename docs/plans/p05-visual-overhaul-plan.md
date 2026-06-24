# Phase 0.5 Visual Overhaul Plan

## Status

- Current phase: Phase 7 - Creature and Boss Seed Frames
- Overall status: Phase 0 complete; Phase 1 visual direction approved; Phase 2 complete; Phase 3 complete; Phase 4 complete; Phase 5 complete; Phase 6 QA complete; Phase 6A board/field readability accepted; Phase 7 next
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

- Visual direction: top-down "chunky industrial goblin fortress" with dark metal, rock, soot, brass/copper, magma orange, electric cyan, steam white, and strong reaction color coding.
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
  - The mockup establishes the intended 0.5 direction: top-down chunky industrial goblin fortress, dark iron/rock base, brass and copper frames, strong magma-orange Куб focal glow, electric-cyan reaction accents, steam-white air effects, and compact iron/brass HUD and tray panels.
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
- [x] Add Куб runtime states: potion brew level indication, glow pulse, damage overlay, and phase-sensitive intensity driven from existing snapshot data.
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

- [x] Redesign top HUD as compact iron/brass control panels with clear priority: Куб HP, wave/phase, threat, speed, pause/start.
- [x] Redesign lower tray as a workshop/card rail that supports tower selection and placed/reserve state.
- [x] Reuse tower art for tower cards and lower tray items.
- [x] Add element/type icon treatment for Вода, Нефть, Искра, and Жар.
- [x] Redesign draft overlay with thematic card frames, role labels, upgrade stack info, and reroll state.
- [x] Redesign pause overlay in the same material language without covering unnecessary context.
- [x] Redesign victory/defeat result screen with readable stats and reaction damage list.
- [x] Preserve all existing actions and keyboard/pointer behavior.
- [x] Keep text fitting within panels on mobile and desktop phone-frame sizes.
- [x] Keep debug HUD excluded from player-facing polish unless it visually conflicts when enabled.

### Acceptance Criteria

- [x] UI no longer looks like a generic web app overlay.
- [x] The field remains the hero during normal play.
- [x] Draft and result screens feel like the same game as the board.
- [x] No text clips or overlaps at mobile widths.
- [x] Existing run lifecycle actions still work.

### Tests

- [x] Existing store/action tests remain passing.
- [x] Add UI behavior tests only if component logic changes.

### Verification

- [x] `npm run typecheck`.
- [x] `npm test`.
- [x] Manual browser check: start wave, pause/resume, speed, tower selection, draft reroll, upgrade pick, result restart/new run.
- [x] Screenshots: normal HUD, tower draft, upgrade draft, pause, victory/defeat result.

### Phase notes

- Decisions/contradictions:
  - During Phase 5 visual review, board geometry was corrected before continuing HUD work:
    - the path now uses an explicit orthogonal 5x6 grid loop with one equal tile step between all neighboring path cells;
    - `cell-0` is the lower-left entrance tile; the gate marker and enemy spawn point use this cell;
    - path order now moves clockwise from the lower-left entrance: up the left side, right across the top, down the right side, then left along the bottom; enemy movement and next-cell effect propagation share this order;
    - `slot-0-outer` is intentionally omitted, so the entrance tile has no outside tower and no starting reaction coverage from an external tower;
    - middle straight cells keep adjacent grid positions on the inside and outside of their path cell;
    - adjacent-to-corner inner slots are collapsed into one physical inner-corner junction slot, avoiding two tower slots occupying the same point;
    - the active inner-corner junction slots are `slot-5-inner`, `slot-9-inner`, and `slot-14-inner`; each affects the two straight path cells touching that inner corner and not the corner path tile itself;
    - corner outer slots remain diagonal single-cell slots that affect only their own corner path tile, except the omitted entrance outer slot;
    - `defaultBoardGeometryConfig.lockInnerCornerSlots` is currently `false` for the visual slice. The combat-intended feature flag exists and locks only the inner-corner junction slots when enabled;
    - path reaction cells now render as explicit square red-outlined road tiles rather than ambiguous circular markers or a stadium-shaped path stroke;
    - ground reaction and reagent sprites now share the same square path-tile presentation helper as the visible tile outlines.
  - Accepted user-requested mechanics deviation from the original Phase 0.5 "presentation only" rule: the authored board geometry changed from 32 logical per-cell slots to 23 physical slots, including 4 inner-corner junction slots with two-cell influence and no outside entrance tower.
  - Accepted user-requested mechanics deviation for steam: `Вода + Жар` now creates `Пар` on the source path cell and the next path cell, so both cells deal steam damage and can feed higher-tier air reactions.
  - Tower art follow-up: inner-corner junction towers need a dedicated visual state or generated corner variant because directional tower silhouettes such as Водомёт/Маслонасос must read as influencing two adjacent cells.
  - Directional tower asset follow-up implemented:
    - generated a new layered PNG tower source sheet at `public/assets/towers/source/phase5-layered-tower-set-source-01.png`;
    - sliced and cleaned eight transparent 192x192 runtime PNGs under `public/assets/towers/`: `*-base.png` and `*-head.png` for Водомёт, Маслонасос, Разрядник, and Магмовый кран;
    - `base` assets stay unrotated and centered on slots, while `head` assets use a base direction pointing right and rotate around their mounting hub;
    - straight slots render one head, while corner slots render two heads on one base;
    - Phaser now derives tower render directions from `BoardSlot.cellIndexes` plus `PathCell` centers and uses the same directions for activation feedback;
    - no direction field was added to `TowerState`, save data, or simulation rules.
  - Reaction/reagent follow-up after tower regeneration:
    - generated the first animated reagent sprite sheet for Вода as a looped 8-frame 4x2 bitmap sheet;
    - source and cleaned files are under `public/assets/reactions/source/`: `reagent-water-ripple-source-01.png`, `reagent-water-ripple-alpha-01.png`, and `reagent-water-ripple-preview-01.png`;
    - runtime sheet is `public/assets/reactions/reagent-water-ripple-sheet.png`, loaded as a manifest spritesheet with 192x192 frames;
    - `RunSceneReagentPresenter` now uses the animated water sheet with an elapsed-time frame loop, without adding animation state to `RunState`;
    - Нефть, Искра, Жар, and combined reaction decals remain on the previous still-asset plus procedural-pulse path until the water pass is reviewed.
  - Follow-up tuning after reviewing the water pass:
    - water reagent playback was tuned to 500 ms per frame;
    - water reagent playback now uses one shared frame clock with no per-cell phase offset, pulse, or rotation drift;
    - procedural directional activation overlays were removed from tower rendering because the tower sprites and cell reagents already communicate coverage clearly enough;
    - tower head rotation/sway remains enabled.
  - Extended the animated bitmap-sheet approach from Вода to the remaining reagent/reaction surfaces:
    - generated and normalized 8-frame 4x2 sheets for Нефть, Искра, Жар, Электролужа, Пар, Пожар, Грозовое облако, Огненный вихрь, and Огненный Шторм;
    - all runtime sheets use 192x192 frames, manifest-backed `spritesheet` loading, and one shared 500 ms frame clock;
    - related effects intentionally share visual language: Вода/Электролужа, Нефть/Пожар, Искра/Грозовое облако, and Жар/Пожар/Огненный вихрь/Огненный Шторм;
    - old procedural reaction pulse/rotation/bob overlays are disabled for the new sheets so frame playback stays visually synchronized.
    - base tower reagent projections are hidden on cells that already have a ground or air reaction, so the more expensive reaction animation does not overlap with its source effects.
    - air reaction sheets are centered on their path cells instead of floating above them to preserve board readability.
  - Verification screenshots for this correction:
    - first square-tile check: `output/playwright/p05-square-tiles-slot-grid.png`;
    - current grid road check: `output/playwright/p05-grid-loop-square-road.png`.
    - current inner-corner junction check: `output/playwright/p05-inner-corner-junction-slots.png`.
    - lower-left entrance check without `slot-0-outer`: `output/playwright/p05-bottom-left-entrance.png`.
    - rejected whole-sprite rotation checks: `output/playwright/p05-tower-directional-assets.png` and `output/playwright/p05-tower-directional-assets-centered-origin.png`.
    - current layered base/head tower check: `output/playwright/p05-tower-layered-base-head.png`.
    - animated water reagent check: `output/playwright/p05-water-reagent-animated-field-a.png` and `output/playwright/p05-water-reagent-animated-field-b.png`.
    - animated water reagent browser result: `output/playwright/p05-water-reagent-animated-field-check.json`.
    - all animated reaction/reagent sheets stress check: `output/playwright/p05-animated-reactions-all.png`.
    - all animated reaction/reagent sheets browser result: `output/playwright/p05-animated-reactions-all-check.json`.
    - reaction-over-source suppression check: `output/playwright/p05-animated-reactions-hide-source-reagents.png`.
    - reaction-over-source suppression browser result: `output/playwright/p05-animated-reactions-hide-source-reagents-check.json`.
    - centered air reaction check: `output/playwright/p05-air-reactions-centered.png`.
    - centered air reaction browser result: `output/playwright/p05-air-reactions-centered-check.json`.
  - Phase 5 HUD/UI slice implemented:
    - top HUD now uses compact iron/brass control chips for Куб HP, phase/wave, threat, speed, and start/pause;
    - lower tray is now a workshop rail with tower art, selected/placed state, and element badges for Вода, Нефть, Искра, and Жар;
    - tower draft cards reuse tower art and show role labels plus element badges;
    - upgrade draft cards show stack count and element-themed treatment;
    - pause and result overlays now share the riveted iron/brass modal language and keep more field context visible;
    - victory/defeat result stats and reaction damage rows now use compact stat cells and reaction color markers.
  - Implementation note:
    - no store/action contract was changed; the new Vue helper functions derive visual classes from existing tower ids, labels, draft offer ids, upgrade ids, and damage source ids;
    - no UI behavior tests were added because action/event behavior was not changed.
  - Phase 5 browser screenshots:
    - normal HUD and tower selection: `output/playwright/p05-phase5-normal-hud.png`;
    - pause overlay: `output/playwright/p05-phase5-pause-overlay.png`;
    - tower draft: `output/playwright/p05-phase5-tower-draft.png`;
    - upgrade draft: `output/playwright/p05-phase5-upgrade-draft.png`;
    - victory result: `output/playwright/p05-phase5-result-victory.png`.
  - Browser verification detail:
    - start wave, pause, speed toggle, resume, and tower selection were checked through the live running game;
    - draft and result surfaces were checked with Vite-served Pinia UI snapshot fixtures so the real Vue component, CSS, and click handlers were exercised without playing a full run;
    - full end-to-end lifecycle coverage for all surfaces remains part of Phase 6 browser QA.
  - Correction after user review:
    - the initial Phase 5 lower tray presentation was rejected because it still looked visually noisy, showed already placed towers, exposed redundant `резерв`/`на поле` status text, and compressed tower names/art too aggressively;
    - lower tray now renders only reserve towers, leaving placed tower control to the field itself;
    - lower tray is hidden entirely when there are no reserve towers;
    - lower tray tower cards were changed to a taller vertical format: tower name in a dedicated top row and tower art below;
    - element badges were removed from lower tray tower cards for now;
    - new verification screenshot: `output/playwright/p05-phase5-normal-hud-reserve-only.png`;
    - Playwright check for this correction found 3 reserve cards, no placed `Водомёт`, and no measured overflow in tower names, top HUD chips, or buttons.
  - Tower draft correction after user review:
    - removed element badges from tower selection cards because the tower art already communicates the emitter family;
    - removed draft role labels and their icons (`связка`, `запас`, `поворот`) from tower selection cards;
    - tower selection cards now show only tower art and tower name;
    - removed the element-colored decorative dot from draft card backgrounds;
    - adjusted draft header line height after browser overflow check;
    - new verification screenshot: `output/playwright/p05-phase5-tower-draft-simple.png`;
    - Playwright check for this correction found badge count 0, meta count 0, card texts only `Водомёт`, `Магмовый кран`, `Маслонасос`, and no measured text overflow.
  - Draft window layout correction after user review:
    - replaced the temporary fixed-height draft panel sizing with padding-driven layout, so the panel opens just below the top HUD and runs almost to the lower hand tray;
    - mobile portrait padding is now `60px 12px 134px`, tuned from the user's `34px 12px 112px` experiment to avoid overlap with the current HUD/tray heights;
    - desktop/wide phone-frame padding is now `70px 18px 148px`;
    - new verification screenshots: `output/playwright/p05-phase5-tower-draft-window-tuned.png` and `output/playwright/p05-phase5-tower-draft-window-tuned-540.png`;
    - Playwright geometry check: 390px viewport has 6px gap after top HUD and 4px before lower tray; 540px viewport has 12px gaps on both sides; no measured text overflow.
  - Upgrade draft readability correction after user review:
    - renamed the upgrade draft heading from `Настройка контрапций` to `Выберите усиление`;
    - removed the diagonal pseudo-icon, element badge, and technical `стек` label from upgrade cards;
    - upgrade cards now show upgrade name, a short effect description, and a clear `Уровень current/max` chip;
    - added explicit descriptions for all P0 upgrades in the Vue presentation layer;
    - new verification screenshot: `output/playwright/p05-phase5-upgrade-draft-readable.png`;
    - Playwright check found title `Выберите усиление`, badge count 0, meta count 0, visible upgrade art count 0, no `стек` text, and no measured overflow.
  - Draft overlay lower-tray interaction correction after user review:
    - reserve tower buttons remain visible under both tower and upgrade draft overlays, but are disabled while any draft step is open;
    - lower tray selected styling is suppressed during draft, even if a tower was selected before the overlay opened;
    - `selectTower` now guards against draft state before emitting a run action;
    - hover/focus border effects no longer apply to disabled reserve tower cards;
    - Playwright behavior check found all visible reserve cards disabled during draft, selected visual count 0, and programmatic click did not change tower selection.

### Phase completion summary

- Implemented:
  - The Phase 5 DOM HUD, tower rail, draft overlay, pause overlay, and result overlay now share the Phase 0.5 iron/brass visual language and use existing tower art and shared skin tokens.
  - Element badges and reaction markers were added for the four P0 emitter families and result damage rows.
- Intentionally deferred:
  - No new UI behavior tests were added because this slice did not change action semantics.
  - Full end-to-end browser lifecycle QA across all normal play surfaces remains in Phase 6.
- Accepted deviations/tradeoffs:
  - Draft/result screenshots were produced from UI snapshot fixtures rather than a full played run, to verify the visual surfaces without spending Phase 5 on complete run automation.
  - The first Phase 5 pass was not accepted as visually ready; the lower tray was corrected after review and should be evaluated again in Phase 6 visual-core QA.
- Tests/checks run:
  - `npm run lint:fix` passed.
  - `npm run typecheck` passed.
  - `npm test` passed: 6 test files, 95 tests.
  - `npm run build` passed with Vite's existing large chunk warning for the Phaser bundle.
  - Playwright browser smoke passed with no page errors and no measured text overflow; Chromium logged only expected WebGL `ReadPixels` screenshot warnings.

## Phase 6 - 0.5a Browser QA and Visual-Core Approval

Purpose: harden the visual core before committing to full creature animation production.

### Tasks

- [x] Run browser QA on mobile portrait and desktop phone-frame.
- [x] Verify all normal play surfaces: ready, wave, placement, pause edit, draft, countdown, boss, victory, defeat.
- [x] Verify or explicitly waive all three wow moments from `docs/design.md`.
- [x] Verify no UI element blocks critical tower placement or core/path reading.
- [x] Verify no new visual layer breaks pointer targeting.
- [x] Compare new screenshots against P0 baseline screenshots and record the improvement.
- [x] Tune colors, contrast, shadow strength, and effect opacity based on screenshots.
- [x] Rework board readability so the road, tower slots, monster entrance, and monster exit match the approved/reference field language.
- [ ] Get user approval that 0.5a visual core is good enough to proceed to creature animation.

### Phase 6A - Board Field Readability Rework

Purpose: replace the current schematic field treatment with a reference-like top-down industrial board layer before 0.5a approval.

User review on 2026-06-22 rejected the current board/field as not good enough for approval. The road, tower slots, monster entrance, and monster exit must move closer to the provided reference: heavy stone/iron walkway, brass-rimmed tower sockets, clear gate/portal language, and readable industrial dungeon materials.

#### Tasks

- [x] Produce or generate dedicated 2D board assets for the road, tower slot sockets, monster entrance, and monster exit instead of relying on debug-like procedural rectangles/circles.
- [x] Keep the road dynamic and geometry-driven: do not bake the path into the static background; compose road art from runtime board path cells, segment/corner/cap pieces, or equivalent geometry-aware sprites.
- [x] Rework the road to read as a physical monster route like the reference: raised stone/metal walkway, beveled edges, rivets/plates, soot wear, and strong separation from surrounding cavern floor.
- [x] Rework tower slots to read as empty build sockets/pads like the reference: brass/iron circular mounts, clear empty/valid/selected/occupied states, and exact alignment with existing hit targets.
- [x] Add a clear monster entrance marker at the path start: gate, tunnel mouth, hatch, warning marker, or industrial portal that visually explains where enemies spawn.
- [x] Add a clear monster exit / Куб danger marker at the path end: drain, gate, spill channel, or breach indicator that visually explains how leaks damage the Куб.
- [x] Ensure entrance and exit are distinct from ordinary path cells and from tower slots at mobile scale.
- [x] Ensure reaction decals and reagent sprites still align to path cells after the road art changes.
- [x] Ensure tower sprites still sit on slots and never appear to stand on the road unless the underlying slot geometry says so.
- [x] Add the new board assets to the asset manifest and BootScene loading path, with stable keys and documented asset specs/prompts.
- [x] Capture refreshed ready, placement-selected, live wave, reaction-heavy, boss, and draft-overlay screenshots after the board rework.

#### Acceptance Criteria

- [x] At 390x844 and 540x960, a new player can identify the monster road, buildable tower sockets, spawn entrance, and leak/exit point without debug labels.
- [x] Road, slots, entrance, and exit look like the same industrial fortress material family as the provided reference and the Phase 1 approved style direction.
- [x] The static background remains decorative only; gameplay-significant path, slots, entrance, exit, and Куб stay runtime-aligned dynamic layers.
- [x] Pointer targeting and placement behavior are unchanged.
- [x] The user approves the field/board readability before 0.5a approval can pass.

#### Verification

- [x] Browser screenshots for board-ready, placement-selected, live wave, reaction-heavy, boss, and draft-overlay states.
- [x] Mobile and desktop phone-frame visual review.
- [x] Pointer placement smoke test against at least one outer slot and one inner slot.
- [x] Console checked for asset load errors.

### Acceptance Criteria

- [ ] The game is visually demoable before full creature animation is complete.
- [ ] The user approves the visual core direction.
- [x] Known remaining visual gaps are explicitly listed for 0.5b.

### Tests

- [x] `npm run lint:fix`.
- [x] `npm run typecheck`.
- [x] `npm test`.
- [x] `npm run build`.

### Verification

- [x] Browser screenshots saved for the required surfaces.
- [x] Console checked for asset load errors.
- [x] Mobile frame checked for text fitting and touch target readability.

### Exit gate

- [ ] **0.5a visual core approved.**

### Phase notes

- Decisions/contradictions:
  - Ran Phase 6 browser QA on 390x844 mobile portrait and 900x1000 desktop phone-frame through Vite-served real Vue + Phaser surfaces.
  - Captured required normal-play screenshots:
    - ready: `output/playwright/p05-phase6-ready-mobile.png` and `output/playwright/p05-phase6-ready-desktop.png`;
    - wave/live combat: `output/playwright/p05-phase6-wave-mobile.png` and `output/playwright/p05-phase6-wave-desktop.png`;
    - placement pointer check: `output/playwright/p05-phase6-placement-pointer-mobile.png` and `output/playwright/p05-phase6-placement-pointer-desktop.png`;
    - pause edit: `output/playwright/p05-phase6-pause-edit-mobile.png` and `output/playwright/p05-phase6-pause-edit-desktop.png`;
    - tower draft: `output/playwright/p05-phase6-draft-tower-mobile.png` and `output/playwright/p05-phase6-draft-tower-desktop.png`;
    - upgrade draft after readability tune: `output/playwright/p05-phase6-draft-upgrade-readable-mobile.png` and `output/playwright/p05-phase6-draft-upgrade-readable-desktop.png`;
    - countdown: `output/playwright/p05-phase6-countdown-mobile.png` and `output/playwright/p05-phase6-countdown-desktop.png`;
    - boss: `output/playwright/p05-phase6-boss-mobile.png` and `output/playwright/p05-phase6-boss-desktop.png`;
    - boss vulnerable / Reaction Break: `output/playwright/p05-phase6-boss-vulnerable-mobile.png` and `output/playwright/p05-phase6-boss-vulnerable-desktop.png`;
    - victory: `output/playwright/p05-phase6-victory-mobile.png` and `output/playwright/p05-phase6-victory-desktop.png`;
    - defeat: `output/playwright/p05-phase6-defeat-mobile.png` and `output/playwright/p05-phase6-defeat-desktop.png`.
  - Browser automation report: `output/playwright/p05-phase6-qa-report.json`; focused upgrade retest report: `output/playwright/p05-phase6-draft-upgrade-readable-report.json`.
  - Browser QA found no console errors, page errors, or failed asset requests.
  - Pointer targeting was checked by selecting reserve `Водомёт` through the DOM and clicking the real `slot-1-outer` logical coordinate; the tower placed on the expected field slot.
  - The post-Phase 5 lower tray correction held up: reserve tower buttons stay visible, disabled, and unselected during draft overlays.
  - Visual comparison against P0 baseline:
    - ready/wave/boss surfaces now use the layered cavern frame, dynamic board/path, tower sprites, reaction art, and the dynamic Куб instead of the earlier schematic grid and plain glyphs;
    - HUD, draft, pause, and result surfaces now share the iron/brass skin instead of the generic dark dashboard styling;
    - boss vulnerable/Reaction Break is visually obvious through field callouts and the vulnerable boss ring.
  - Tuning performed in this phase:
    - upgrade draft cards now use a single-column list on desktop as well as mobile;
    - this fixed desktop text wrapping where upgrade names/descriptions collapsed into near-vertical text and removed the panel overlap with the lower tray.
  - Remaining 0.5a approval caveat:
    - full "all three wow moments" review is accepted as QA-complete for this slice because the user explicitly waived the dedicated T3 `Огненный шторм` capture for now on 2026-06-22.
    - board/field readability was accepted by the user on 2026-06-22 as "more or less normal" for the current slice: road, tower slots, monster entrance, and monster exit no longer block 0.5a progress.
  - Known remaining visual gaps for 0.5b:
    - enemies and Бочкоед are still procedural shapes/text labels pending Phase 7-9 creature seed frames, animation strips, and runtime integration;
    - dense late-game tower overlap on the left rail is acceptable for 0.5a but should be re-evaluated once creature sprites replace procedural enemies.

### Phase completion summary

- Implemented:
  - Phase 6 browser QA coverage for mobile and desktop phone-frame.
  - One targeted readability fix for upgrade draft layout.
  - Phase 6A board/field readability rework accepted for the current slice: physical road art, socket markers, entrance, exit, and geometry-aligned dynamic field layers are good enough to proceed.
- Intentionally deferred:
  - Full 0.5a approval still depends on the remaining non-field polish decisions, especially top/bottom HUD finalization.
  - Dedicated T3 `Огненный шторм` wow capture is intentionally skipped for this slice and may be revisited in final polish if needed.
  - Creature/boss sprite production remains deferred to 0.5b.
- Accepted deviations/tradeoffs:
  - Boss, victory, and defeat screenshots were loaded from deterministic simulation states through the live app event bridge rather than waiting through a full manual browser run.
- Tests/checks run:
  - `npm run lint:fix` passed.
  - `npm run typecheck` passed.
  - `npm test` passed: 6 test files, 96 tests.
  - `npm run build` passed with Vite's existing large chunk warning for `PhaserCanvas-*.js`.
  - Phase 6 Playwright browser QA passed with no console errors, page errors, or failed asset requests.

## Phase 7 - Creature and Boss Seed Frames

Purpose: create approved source frames and validate the facing model on one creature before generating animation strips.

### Tasks

- [ ] Define final creature scale, anchor, shadow, and lane offset rules.
- [x] Generate or produce approved source frames for all seven P0 enemy archetypes: Заморыш, Кусака, Тролль, Нетопырь, Варг, Грязевик, Магмень.
- [ ] Generate or produce approved source frame for Бочкоед.
- [x] Ensure every enemy silhouette maps to its gameplay role: basic, swarm, tank, flying, runner, electric-resistant, fire-resistant.
- [ ] Ensure Бочкоед reads as a large deep-cave potion-drinking threat and works on the existing path.
- [x] Normalize all approved seed frames to consistent in-game scale and bottom-center anchors.
- [x] Build preview sheets for approved seed frames.
- [x] Build a facing spike with one representative creature, preferably Варг or Заморыш: source frame, minimal movement loop, in-engine playback on the real loop, and corner transitions.
- [ ] Compare facing models in the spike: `left/right + flip`, `4-direction`, and any cheap hybrid needed for Бочкоед.
- [ ] Choose and document the approved facing model before Phase 8 bulk animation begins.
- [ ] Default to `left/right + flip` for normal enemies unless the spike proves `4-direction` is worth the extra production and corner-switching cost.
- [ ] Decide Бочкоед separately if needed; because he is larger and slower, he may justify more bespoke direction frames than normal enemies.
- [ ] Record prompts/specs and approved source frame paths.

### Acceptance Criteria

- [ ] Each creature is readable at game scale before animation.
- [x] The seven enemy archetypes are visually distinct without needing labels.
- [ ] Бочкоед is visually larger and more important than normal enemies.
- [ ] Approved seed frames are stable enough to drive animation generation.
- [ ] Direction/facing changes look acceptable on the real rectangular loop before mass animation production starts.
- [ ] The selected facing model has a documented production cost and runtime mapping.

### Tests

- [x] Manifest/typecheck if seed frames are referenced by code.
- [x] Direction helper test if the facing spike introduces reusable path-segment-to-facing logic.

### Verification

- [x] In-game preview scene or fixture showing all seed frames on the board.
- [x] In-game spike capture or screenshot sequence showing the representative creature moving around the real loop.
- [x] `npm run typecheck` if code references are added.

### Exit gate

- [x] **Creature facing model approved before bulk animation production.**

### Phase notes

- Decisions/contradictions:
  - 2026-06-24: C1 naming gate narrowed normal enemy public names to one-word UI-safe labels: Заморыш, Кусака, Тролль, Нетопырь, Варг, Грязевик, Магмень. Бочкоед stays out of this C1 slice.
  - 2026-06-24: Заморыш seed direction approved, then regenerated as clean v2 without baked shadow for runtime-friendly Phaser shadow rendering. Approved source copied to `public/assets/enemies/grunt/source/grunt-seed-02-source.png`; normalized transparent seed frame saved as `public/assets/enemies/grunt/grunt-seed-side-02.png` with a 256x256 frame and bottom-center anchor. The earlier v1 seed is retained only as an audit trail, not the current approved candidate.
  - 2026-06-24: Кусака seed approved as a single compact biting creature, not a pack or multi-headed swarm. Approved source copied to `public/assets/enemies/swarm/source/swarm-seed-01-source.png`; normalized transparent seed frame saved as `public/assets/enemies/swarm/swarm-seed-side-01.png` with a 256x256 frame and no baked shadow.
  - 2026-06-24: Тролль seed approved as the sturdy tank silhouette. Approved source copied to `public/assets/enemies/tank/source/tank-seed-01-source.png`; normalized transparent seed frame saved as `public/assets/enemies/tank/tank-seed-side-01.png` with a 256x256 frame and no baked shadow.
  - 2026-06-24: Нетопырь seed approved from the second bat-like candidate, replacing the too-draconic first attempt. Approved source copied to `public/assets/enemies/flyer/source/flyer-seed-02-source.png`; normalized transparent seed frame saved as `public/assets/enemies/flyer/flyer-seed-side-02.png` with a 256x256 frame and no baked shadow.
  - 2026-06-24: Варг seed approved as the lean fast runner silhouette. Approved source copied to `public/assets/enemies/runner/source/runner-seed-01-source.png`; normalized transparent seed frame saved as `public/assets/enemies/runner/runner-seed-side-01.png` with a 256x256 frame and no baked shadow.
  - 2026-06-24: Грязевик seed approved as the clay/mud electric-resistant silhouette. Approved source copied to `public/assets/enemies/insulated/source/insulated-seed-01-source.png`; normalized transparent seed frame saved as `public/assets/enemies/insulated/insulated-seed-side-01.png` with a 256x256 frame and no baked shadow.
  - 2026-06-24: Магмень seed approved as a low basalt/magma crawler, using a tight normalization pass to remove alpha fringe from the raw chroma-key output. Approved source copied to `public/assets/enemies/flameproof/source/flameproof-seed-01-source.png`; normalized transparent seed frame saved as `public/assets/enemies/flameproof/flameproof-seed-side-01.png` with a 256x256 frame and no baked shadow.
  - 2026-06-24: All seven normal enemy seed frames are now approved as individual no-shadow 256x256 transparent seeds. Runtime size, height, and shadow remain deferred to the Phaser presenter/facing spike.
  - 2026-06-24: Gate 3 facing spike prepared with Варг on the real rectangular loop using `side + horizontal flip`. The source seed faces right, and `getEnemySideFacing` flips it left on the right/bottom segments by scanning for the next horizontal path segment. Runtime spike wires only `runner` through `assetGroups.enemies.runnerSeedSide`; other enemies stay procedural until the full animation integration gate. Browser QA capture: `output/playwright/gate3-runner-facing-fixture.png`. Gate 3 is awaiting user approval before Phase 8 animation-strip production.
  - 2026-06-24: Gate 4 runner animation candidate approved. `Варг` has 4-frame full-strip candidates for `move`, `hit`, and `death`, generated as whole strips from the approved seed and normalized to 256x256 bottom-center frames. Approval sheet: `output/enemy-animations/runner/runner-animation-approval-sheet.png`; normalized strips: `output/enemy-animations/runner/runner-move-strip.png`, `output/enemy-animations/runner/runner-hit-strip.png`, `output/enemy-animations/runner/runner-death-strip.png`. Runtime copy into `public/assets/enemies` remains deferred until the rest of Gate 4 is approved.
  - 2026-06-24: Gate 4 `Заморыш` animation candidate approved. The set includes 4-frame full-strip `move`, `hit`, and `death`, normalized to 256x256 bottom-center frames. Approval sheet: `output/enemy-animations/grunt/grunt-animation-approval-sheet.png`; normalized strips: `output/enemy-animations/grunt/grunt-move-strip.png`, `output/enemy-animations/grunt/grunt-hit-strip.png`, `output/enemy-animations/grunt/grunt-death-strip.png`.
  - 2026-06-24: First Gate 4 `Кусака` animation attempt rejected because the generated creature drifted into a варг/canine silhouette. Reworked rat-like candidate approved and saved separately under `output/enemy-animations/swarm-rat/`. Approval sheet: `output/enemy-animations/swarm-rat/swarm-rat-animation-approval-sheet.png`; normalized strips: `output/enemy-animations/swarm-rat/swarm-rat-move-strip.png`, `output/enemy-animations/swarm-rat/swarm-rat-hit-strip.png`, `output/enemy-animations/swarm-rat/swarm-rat-death-strip.png`.
  - 2026-06-24: Gate 4 `Тролль` animation candidate approved. The set includes 4-frame full-strip `move`, `hit`, and `death`, normalized to 256x256 bottom-center frames. The generated production version preserves the large stone tank role and remains one of the large-size trio with `Грязевик` and `Магмень`. Approval sheet: `output/enemy-animations/tank/tank-animation-approval-sheet.png`; normalized strips: `output/enemy-animations/tank/tank-move-strip.png`, `output/enemy-animations/tank/tank-hit-strip.png`, `output/enemy-animations/tank/tank-death-strip.png`.
  - 2026-06-24: Gate 4 `Нетопырь` animation candidate approved. The set includes 4-frame full-strip `move`, `hit`, and `death`, normalized to 256x256 bottom-center frames. The death strip needed a second generation and a small detached-alpha cleanup to avoid cropped wing fragments. Approval sheet: `output/enemy-animations/flyer/flyer-animation-approval-sheet.png`; normalized strips: `output/enemy-animations/flyer/flyer-move-strip.png`, `output/enemy-animations/flyer/flyer-hit-strip.png`, `output/enemy-animations/flyer/flyer-death-strip.png`.
  - 2026-06-24: Gate 4 `Грязевик` animation candidate approved. The set includes 4-frame full-strip `move`, `hit`, and `death`, normalized to 256x256 bottom-center frames. The production version keeps the large clay/mud electric-resistant role without adding baked lightning effects; the approved death reads especially well as a mud-body collapse. Approval sheet: `output/enemy-animations/insulated/insulated-animation-approval-sheet.png`; normalized strips: `output/enemy-animations/insulated/insulated-move-strip.png`, `output/enemy-animations/insulated/insulated-hit-strip.png`, `output/enemy-animations/insulated/insulated-death-strip.png`.
  - 2026-06-24: Gate 4 `Магмень` animation candidate approved. The set includes 4-frame full-strip `move`, `hit`, and `death`, normalized to 256x256 bottom-center frames after a small post-normalize scale/padding pass to avoid edge clipping on the wide crawler silhouette. The production version keeps the low basalt/magma fire-resistant role without external baked fire VFX. Approval sheet: `output/enemy-animations/flameproof/flameproof-animation-approval-sheet.png`; normalized strips: `output/enemy-animations/flameproof/flameproof-move-strip.png`, `output/enemy-animations/flameproof/flameproof-hit-strip.png`, `output/enemy-animations/flameproof/flameproof-death-strip.png`.
  - 2026-06-24: Gate 4 preview approval is complete for all seven normal enemy archetypes. Runtime integration can now copy the approved strips into `public/assets/enemies` and wire manifest-backed Phaser animations. Бочкоед/C2 remains explicitly out of this C1 slice.

### Phase completion summary

- Implemented:
  - All seven normal enemy seeds approved and normalized as no-shadow 256x256 transparent PNGs.
  - Варг facing spike added through manifest-backed Phaser image rendering and a tested side-facing helper.
  - Dedicated `/enemy-demo` route added for reviewing all normal enemies on horizontal and vertical road segments using the same combat tile size and runtime presentation scale.
- Intentionally deferred:
- Accepted deviations/tradeoffs:
- Tests/checks run:
  - `npm run lint:fix`
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`

## Phase 8 - Creature Animation Strip Production

Purpose: produce full movement, hit, and death/vulnerable animation coverage with stable identity and anchors.

### Tasks

- [x] For each normal enemy, create movement loops using the approved Phase 7 facing model.
- [x] For each normal enemy, create hit reaction animation.
- [x] For each normal enemy, create death animation.
- [ ] For Бочкоед, create crawl loops using the Phase 7 boss facing decision.
- [ ] For Бочкоед, create vulnerable animation or overlay-compatible frames.
- [ ] For Бочкоед, create death animation.
- [x] Use approved seed frames as the first or identity-locking reference for each animation set.
- [x] Generate animation strips as full strips, not independent frames.
- [x] Normalize each strip with shared scale and bottom-center anchor.
- [ ] Lock frame 01 back to the approved seed frame where continuity matters.
- [x] Render preview sheets for each animation set.
- [x] Reject and regenerate strips with identity drift, scale drift, bad transparency, bad direction, or unreadable motion.
- [ ] Optimize final PNG/WebP outputs and atlas packing.

### Acceptance Criteria

- [x] Every P0 enemy has move, hit, and death coverage using the approved facing model.
- [ ] Бочкоед has crawl, vulnerable, and death coverage.
- [x] Frame-to-frame scale and anchor are stable.
- [x] Sprites remain readable under reaction VFX.
- [ ] Asset size remains reasonable for a browser game.

### Tests

- [x] Add asset manifest coverage tests if animation keys are declarative.
- [x] Existing enemy/boss simulation tests remain unchanged and passing.

### Verification

- [x] Preview sheets inspected.
- [x] In-game animation fixture inspected.
- [x] `npm run typecheck`.
- [ ] `npm run build`.

### Phase notes

- Decisions/contradictions:
  - 2026-06-24: C1 normal enemy animation production is complete and approved for all seven archetypes. Бочкоед remains outside this slice, so boss crawl/vulnerable/death coverage stays deferred to C2.
  - 2026-06-24: Gate 5 approved after final user review on `/enemy-demo`, including horizontal and vertical road placement checks for health bars, labels, sprite scale, and role readability.

### Phase completion summary

- Implemented:
- Intentionally deferred:
- Accepted deviations/tradeoffs:
- Tests/checks run:

## Phase 9 - Creature Runtime Integration

Purpose: replace procedural enemy and boss shapes with sprite animations while preserving P0 behavior.

### Tasks

- [ ] Add Phaser animation key registration for all enemy and boss animations.
- [x] Select facing based on the approved Phase 7 model and current path segment.
- [x] Replace procedural enemy bodies with animated sprites.
- [x] Keep or restyle HP bars, resist telegraphs, flying cues, and danger cues.
- [x] Add hit feedback when enemies take damage without creating unreadable flicker.
- [x] Play death animation or dissolve without blocking simulation cleanup.
- [ ] Replace procedural Бочкоед body with animated boss sprite.
- [ ] Apply Бочкоед vulnerable visual state through animation or overlay.
- [ ] Ensure sprite depth sorting keeps air reactions, ground reactions, towers, enemies, and boss readable.
- [ ] Preserve object pooling or bounded creation to avoid runtime churn.
- [ ] Remove obsolete procedural enemy/boss drawing only after sprite replacement is verified.

### Acceptance Criteria

- [ ] Existing enemy and boss behavior is unchanged.
- [x] Runtime facing behavior matches the Phase 7 approved spike.
- [ ] Boss and normal enemies remain readable under dense T2/T3 VFX.
- [x] No animation state leaks into serializable run state.

### Tests

- [x] Existing enemy, wave, boss, and save/resume tests remain passing.
- [x] Add tests for direction helper if implemented outside Phaser scene code.

### Verification

- [x] `npm run lint:fix`.
- [x] `npm run typecheck`.
- [x] `npm test`.
- [ ] Manual browser check: waves with all enemy archetypes, boss vulnerable, victory, defeat.
- [ ] Screenshots or short captures for movement, hit, death, and boss vulnerable.

### Phase notes

- Decisions/contradictions:
  - 2026-06-24: C1 normal enemy runtime integration landed with manifest-backed spritesheets copied under `public/assets/enemies/<id>/<id>-<move|hit|death>-side.png`. `RunSceneEnemyPresenter` now registers `enemies.<id>.<anim>.side.anim`, renders pooled live enemy sprites, queues renderer-local hit/death playback from presentation events, keeps runtime shadows/HP bars/labels, adds a flyer cue, and uses the approved `side + horizontal flip` facing helper. Procedural normal enemy bodies were removed from normal play; boss remains procedural for the separate C2 slice.
  - 2026-06-24: Gate 5 browser QA capture prepared for approval: `output/playwright/gate5-c1-all-seven-archetypes-clean.png`. Additional smoke captures: `output/playwright/gate5-c1-all-enemy-sprites-eventbus.png`, `output/playwright/gate5-c1-enemy-sprites-vfx-eventbus.png`, and `output/playwright/gate5-c1-production-preview-smoke.png`.
  - 2026-06-24: Gate 5 approved after the user inspected all seven normal enemies on the dedicated `/enemy-demo` route. Follow-up tuning reduced late-wave spawn density, hid damage numbers behind `DAMAGE_LABELS_ENABLED`, limited labels to one per archetype, adjusted health-bar offsets by road direction, and retuned display scale for Заморыш, Тролль, Нетопырь, and Грязевик.

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
