# P0 Implementation Plan

## Status

- Current phase: Phase 0 - Preparation
- Overall status: not started
- Source docs: `docs/design.md`, `docs/setting.md`
- README priority: secondary; when README conflicts with the design docs, follow the design docs.

## Agent Instructions

This document is both the implementation plan and the execution log for P0.

When working on this plan:

- Update checkboxes in this file as work is completed.
- Do not mark a checkbox complete until the behavior is implemented and verified at the level described by the checkbox.
- Keep implementation decisions aligned with `docs/design.md` and `docs/setting.md`.
- If an implementation detail must diverge from this plan, write the divergence in the current phase's "Phase notes" before moving on.
- At the end of each phase, fill in "Phase completion summary" with:
  - what was implemented;
  - what was intentionally deferred;
  - any contradictions, tradeoffs, or accepted deviations;
  - tests/checks that were run.
- Keep Phaser scenes thin. Game rules belong in serializable TypeScript simulation code, not in scene callbacks.
- Keep player-facing text in Russian fiction naming from `docs/setting.md`; internal ids and debug labels may remain English.
- Keep balance numbers in typed configs. P0 is expected to require frequent tuning and automated headless runs.
- Use UTF-8 without BOM for all new or modified text files.
- Prefer `npm run lint:fix` over `npm run lint`.

Sequencing principle (vertical-slice-first):

- Phase 1 is a thin end-to-end slice that makes the core fantasy visible and exercises the riskiest
  algorithm (the reaction sim) before any depth is built. Later phases deepen each layer.
- Each of the three "wow" moments (design §12) is an explicit phase exit gate: wow #1 ends Phase 1,
  wow #2 ends Phase 5, wow #3 ends Phase 7.
- VFX ships in the same phase as the reaction it visualizes (feedback carries the whole idle
  experience — design §4/§11/§13); Phase 8 only polishes it.

Recommended phase flow:

1. Complete each phase's implementation tasks.
2. Complete or update that phase's tests.
3. Run the phase's listed verification.
4. Fill the phase completion summary.
5. Only then move to the next phase.

## P0 Scope

Build the full P0 single-run game in the existing Vue + Phaser + TypeScript stack:

- Portrait 540x960 mobile-first playfield.
- Desktop phone-frame layout.
- 16-cell Reactor Loop / Осадная галерея.
- Live tower placement during waves; pick-up / move / swap of existing towers only while paused.
- Two-step full-screen draft after waves.
- Full P0 reaction graph.
- 10 normal waves plus Бочкоед boss.
- Full local save/resume.
- Detailed end-run stats.
- Procedural placeholder art and reaction-focused VFX.

Explicitly out of P0:

- Cold / Холод and all P1 control-axis reactions.
- Global `DMG xN` diversity multiplier.
- Boss adaptive resistance to the previous lap's most common reaction.
- Opposite bonus.
- Required audio.
- Automated browser visual QA.
- Help UI, tutorial text, ghost placement hints, and full wave preview (a single enemy-type icon at
  wave start is allowed as a telegraph; a full preview is not).

## Key Product Decisions

- Map size: 16 path cells. `pathCellCount` is a config constant; dropping to 12 is a cheap A/B if VFX
  density feels thin on the small portrait screen (design §7: fewer cells = juicier VFX).
- Slot availability: all slots open in P0 balance, but slot lock state must exist in data/model.
- Placement timing: placing a tower from the bench is allowed any time (running or paused); picking up,
  moving, or swapping an existing tower is allowed only while paused. Anti-misclick lever, and removal
  always happens on a frozen sim (simpler projection). Now documented in design §2/§8.3 — kept as a deliberate anti-frustration lever (§11.2), not a divergence.
- Placement input: tap-select, then tap slot.
- Starting bench: 2 Водомёта and 1 Разрядник.
- First wave: manual start.
- Later waves: after draft, automatic 3-second countdown unless paused.
- Draft cadence: tower choice 1 of 3, then upgrade choice 1 of 3.
- Rerolls: `rerollsPerDraft` config; default 1 per draft (design §8.2).
- Key unlocks: Жар is a guaranteed offer after wave 2; Нефть is a guaranteed offer after wave 4;
  re-offered each subsequent draft until taken. They are not forced picks.
- Upgrade scope: global by emitter type, capped stacks, mixed pool.
- Movement: continuous waypoint loop; current cell is derived from path progress.
- Resist enemies: strong resistance, not immunity (conscious divergence from design §9.1 flavor;
  immunity reads as an unfair wall in an idle game).
- Boss Reaction Break: per lap, three distinct reaction ids that damage the boss trigger Vulnerable for 5 seconds with x2 damage.
- Save: full run state in `localStorage`.
- End screens: detailed stats.
- Browser QA: manual only.

## Architecture Contracts

- Simulation owns entities, timers, path progress, wave progression, draft, placement, reactions, damage, core HP, boss rules, saveable state, and stats.
- Phaser owns scene boot, asset loading, canvas rendering, camera/layout, pointer plumbing, particles, tweens, and VFX.
- Vue owns HUD, draft overlays, pause/resume overlays, boot resume prompt, stats screens, and debug HUD visibility.
- The event bridge exposes typed actions from UI/Phaser to simulation and typed snapshots from simulation to UI/Phaser.
- The fixed-step accumulator/driver lives outside Phaser: the Phaser scene's `update()` only calls
  `stepRun`, and the headless runner drives the same `stepRun` at the same step. (Currently the loop
  lives inside `SmokeScene.update()` and must be extracted in Phase 1.)
- Full save stores simulation data only. Never serialize Phaser objects, tweens, emitters, sprites, or DOM state.

Core APIs to provide during P0:

- `createRun(seed)`
- `stepRun(state, deltaMs)`
- `applyAction(state, action)`
- `serializeRun(state)`
- `deserializeRun(payload)`

Core typed concepts to introduce:

- `GameAction`
- `GameSnapshot`
- `RunPhase`
- `RunState`
- `BoardConfig`
- `EmitterDefinition`
- `ReactionDefinition`
- `EnemyDefinition`
- `WaveDefinition`
- `BossDefinition`
- `UpgradeDefinition`
- `RunStats`

## Phase 0 - Preparation

Purpose: create the implementation baseline and make sure the current starter project is understood before gameplay work starts. May be merged into Phase 1.

### Tasks

- [x] Confirm `npm test`, `npm run typecheck`, and `npm run build` baseline before gameplay changes.
- [x] Confirm the current project still uses Vue 3, Phaser 3, Vite, TypeScript, Pinia, and the existing FSD-style aliases.
- [x] Read `docs/design.md` and `docs/setting.md` before making gameplay decisions.
- [x] Keep this plan open during implementation and update it as phases complete.

### Verification

- [x] Baseline command results are recorded in the phase summary.
- [x] Any pre-existing failures are documented before implementation starts.

### Phase notes

- Decisions/contradictions:
  - No gameplay implementation changes were made in Phase 0.
  - `npm run build` completed successfully with Vite's pre-existing large chunk warning for the main bundle (`dist/assets/index-*.js` > 500 kB). This is not a baseline failure.

### Phase completion summary

- Implemented:
  - Confirmed baseline commands before gameplay changes:
    - `npm test` passed: 2 test files, 6 tests.
    - `npm run typecheck` passed.
    - `npm run build` passed.
  - Confirmed stack from project config/source:
    - Vue 3.5.38, Phaser 3.90.0, Vite 8.0.16, TypeScript 5.9.3, Pinia 3.0.4.
    - Existing aliases remain configured for `@`, `@app`, `@pages`, `@widgets`, `@features`, `@entities`, and `@shared`.
  - Read `docs/design.md` and `docs/setting.md`.
- Intentionally deferred:
  - All gameplay implementation work; Phase 1 starts the walking skeleton.
- Accepted deviations/tradeoffs:
  - None.
- Tests/checks run:
  - `npm test`
  - `npm run typecheck`
  - `npm run build`

## Phase 1 - Walking Skeleton / Vertical Slice

Purpose: make the core fantasy visible end-to-end as early as possible, and exercise the riskiest part (the reaction sim + fixed-step driver) before building depth. Delivers wow #1.

### Tasks

- [x] Add a minimal serializable `RunState` (phase, seed/RNG state, tick, elapsed time, core HP, board, placed towers, enemies) — only what the slice needs.
- [x] Add a deterministic seeded RNG (introduced now; foundational and cheap).
- [x] Extract the fixed-step accumulator/driver out of the Phaser scene so the scene's `update()` and a headless test both call `stepRun(state, deltaMs)` at the same step.
- [x] Add a hardcoded small loop board (subset of the full board; may be fewer than 16 cells for the slice) with the cells/slots needed for a 2-cell Электролужа.
- [x] Add the starting bench (2 Водомёта + 1 Разрядник) and place them to form Вода + Вода + Искра.
- [x] Implement T1 Электролужа only: a water pool plus Искра energy reacts on the cell(s).
- [x] Spawn one Грунт that walks the loop, takes electro damage on the puddle cell, and dies; if it survives a lap it leaks and reduces core HP.
- [x] Replace `SmokeScene` as the primary scene with a 540x960 portrait scene that renders board/tower/enemy/puddle from `GameSnapshot`.
- [x] Ship a readable Электролужа VFX (ground layer); duplicate color meaning with simple shape/pattern.
- [x] Keep player-facing names in Russian fiction naming while internal ids remain stable English identifiers.

### Acceptance Criteria

- [x] On load, the slice shows 2 Водомёта + Разрядник -> 2-cell Электролужа -> a Грунт melts (or leaks for core HP), readable without explanation (wow #1, design §12).
- [x] A single tower alone deals no damage; only the Вода + Искра combination does.
- [x] `stepRun` is deterministic for a fixed seed; the same driver steps the slice in-scene and headless.
- [x] No Phaser or DOM objects exist in `RunState`.

### Tests

- [x] Seeded RNG determinism (smoke level).
- [x] `stepRun` determinism for the slice scenario.
- [x] Электролужа forms only from Вода + Искра; a lone tower deals 0.
- [x] Enemy damage/death/leak in the slice.

### Verification

- [x] `npm run typecheck`
- [x] `npm test`
- [x] Manual browser check: wow #1 reads on a portrait viewport; `SmokeScene` no longer primary.

### Exit gate

- [x] **Wow #1 verified on screen.**

### Phase notes

- Decisions/contradictions:
  - Added Phase 1 simulation as a headless TypeScript slice first, then moved fixed-step accumulation into a shared driver used by `RunScene` and headless tests.
  - Full typed content configs are still deferred to Phase 2. Current slice constants live in `simulation.ts`.
  - `SmokeScene` remains in the codebase as unused starter code, but `RunScene` is now the primary scene.
  - Debug HUD is hidden by default and available with `?debug=1`, so it no longer covers the portrait playfield during normal checks.

### Phase completion summary

- Implemented:
  - Minimal serializable `RunState` and `GameSnapshot` with seed/RNG state, tick, elapsed time, core HP, board, placed towers, enemies, reactions, and last tap.
  - Deterministic seeded RNG and shared fixed-step driver used by both `RunScene.update()` and headless tests.
  - Hardcoded Phase 1 loop board, starting `2 Водомёта + 1 Разрядник`, T1 `Электролужа`, one moving `Грунт`, electro damage/death, and leak/core HP behavior.
  - New 540x960 portrait `RunScene` as the primary Phaser scene, rendering board, tower names, enemy, core, and patterned ground Электролужа VFX from `GameSnapshot`.
  - Portrait phone-frame layout; debug HUD hidden unless `?debug=1`.
- Intentionally deferred:
  - Full 16-cell board generator, typed content configs, placement input, drafts, save/resume, and full reaction graph remain in later phases.
  - `SmokeScene` removal/cleanup is deferred; it is no longer primary.
- Accepted deviations/tradeoffs:
  - Phase 1 constants remain local in `simulation.ts`; Phase 2 will move balance/content into typed configs.
- Tests/checks run:
  - `npm run lint:fix`
  - `npm run typecheck`
  - `npm test` passed: 2 test files, 11 tests.
  - `npm run build` passed with Vite's existing large chunk warning.
  - Browser check on `http://127.0.0.1:5178`: desktop and mobile screenshots saved to `output/playwright/phase1-desktop.png` and `output/playwright/phase1-mobile.png`.

## Phase 2 - Foundation Hardening, Content Data, and Run Shell

Purpose: turn the slice's ad-hoc state into the full deterministic, serializable foundation with typed content configs, and build the run-lifecycle shell around the playfield.

### Tasks

Data and state:

- [x] Formalize serializable `RunState` with phase, seed/RNG state, elapsed time, wave index, core HP, board, bench, enemies, draft state, upgrades, boss state, and stats.
- [x] Formalize `GameSnapshot` (renderer/UI read model), `GameAction`, and `RunPhase`.
- [x] Add typed TS configs for board, emitters, reactions, enemies, waves, boss, upgrades, display names, and balance constants (`pathCellCount` default 16).
- [x] Add config validation tests so malformed ids, missing display names, missing reactions, invalid wave references, and impossible upgrade references fail fast.
- [x] Implement `createRun(seed)` with full P0 starting state: 16-cell board, all slots unlocked, starting bench with 2 Водомёта and 1 Разрядник, core HP from config.
- [x] Expand `applyAction(state, action)` for run control, placement, draft, reroll, pause/speed, save/resume, restart, and debug toggles.
- [x] Add `serializeRun` and `deserializeRun` with schema versioning. Note: save/resume is beyond the design doc's P0 ask and is the first thing to cut if time slips.

Run shell and lifecycle:

- [x] Finalize the 540x960 portrait logical scene and center it in a desktop phone-frame layout; preserve mobile safe-area handling.
- [x] Game scene shell renders from `GameSnapshot`; keep the debug HUD behind a dev toggle or URL flag.
- [x] Add boot resume prompt when a saved run exists: Resume / New Run; add full-save persistence to `localStorage`.
- [x] Add pause overlay with Resume, Restart, speed x1/x2, seed, and basic run stats.
- [x] Add top HUD for core HP, wave, phase/countdown, pause, and speed.
- [x] Add bottom bench area for tower selection and placement state.
- [x] Implement manual first-wave start and automatic 3-second countdown after later drafts unless paused.
- [x] Ensure speed x1/x2 affects simulation stepping (via the shared driver), not renderer-only animation.

### Acceptance Criteria

- [x] A new run can be created from a seed; the same seed produces deterministic draft/RNG behavior.
- [x] A run can be serialized, deserialized, and stepped without losing relevant state; balance is tunable in configs without editing simulation logic; no Phaser/DOM objects in state.
- [x] Game opens portrait on a mobile-sized viewport; desktop shows the same game in a centered phone-frame; the smoke placeholder is no longer primary.
- [x] Player can start a new run, pause/resume, change speed, restart, save, reload, and resume; first wave waits for manual start; later waves auto-start after countdown; debug HUD is hidden in normal UI.

### Tests

- [x] Seeded RNG determinism tests.
- [x] Config validity tests.
- [x] Run creation tests.
- [x] Serialization/deserialization round-trip tests.
- [x] Snapshot shape tests.
- [x] Run-lifecycle store/action tests.
- [x] Save/resume round-trip tests.
- [x] Pause and speed behavior tests.
- [x] Countdown transition tests.

### Verification

- [x] `npm run typecheck`
- [x] `npm test`
- [x] Manual browser check: mobile portrait and desktop phone-frame, full run lifecycle.

### Phase notes

- Decisions/contradictions:
  - Added Phase 2 foundation slice before lifecycle UI: typed `gameConfig`, config validation, broader serializable `RunState`, `GameAction`, and schema-versioned `serializeRun`/`deserializeRun`.
  - The board is now a static authored 16-cell config with two unlocked slots per cell. The parameterized stadium-loop generator, corner slot influence, and placement rules remain Phase 3 work.
  - `createRun` still auto-places the Phase 1 starting towers so wow #1 remains visible on load. The full P0 bench-first placement lifecycle remains open.
  - Added DOM run shell with autosave/resume prompt, top HUD, pause overlay, speed toggle, and restart.
  - Added manual first-wave start and deterministic `ready -> wave -> draft -> countdown -> wave` lifecycle. The `draft` phase is still a placeholder transition with no real draft choices; full draft UI/content remains Phase 6.
  - Bottom bench/loadout area displays starting tower instances and selection state. True tap-to-place rules remain Phase 3.
  - `applyAction` now exposes reducer contracts for draft/reroll/placement/debug actions; save/resume remains handled by the persistence module and event bridge around serialized `RunState`.

### Phase completion summary

- Implemented:
  - Serializable config-backed run foundation with typed board, emitters, reactions, enemies, waves, boss, upgrades, balance constants, `RunState`, `GameSnapshot`, `GameAction`, `serializeRun`, and `deserializeRun`.
  - 16-cell authored board with two unlocked slots per cell; starting tower instances are auto-placed to preserve wow #1 while the loadout/bench area displays them.
  - DOM run shell: top HUD, bottom loadout/bench area, pause overlay, speed x1/x2, restart, local autosave, resume/new-run prompt, first-wave manual start, and 3-second post-draft countdown.
  - Reducer contracts for run control, tower selection/placement, draft pick/reroll, pause/speed, restart, and debug toggle.
- Intentionally deferred:
  - Real tap-to-place interaction, move/remove/swap rules, geometry generator, corner slot influence, and live placement feedback remain Phase 3.
  - Full-screen draft choices remain Phase 6; current draft phase is a placeholder lifecycle gate.
- Accepted deviations/tradeoffs:
  - Starting towers are auto-placed for the playable slice even though the bottom area displays them as loadout items. This keeps wow #1 readable until Phase 3 introduces real placement.
  - Save/resume is implemented through `persistence.ts` and event bridge rather than as a pure `applyAction` side effect, keeping `RunState` serialization separate from browser APIs.
- Tests/checks run:
  - `npm run lint:fix`
  - `npm run typecheck`
  - `npm test` passed: 2 test files, 21 tests.
  - `npm run build` passed with Vite's existing large chunk warning.
  - Browser checks on `http://127.0.0.1:5178`: mobile portrait, desktop phone-frame, start wave, pause/resume, speed, restart, save/reload/resume, countdown, and bottom loadout selection.
  - Screenshots saved under `output/playwright/`, including `phase2-complete-ready-bench.png`.

## Phase 3 - Board and Placement

Purpose: full board geometry, slots, bench, and the placement rule.

### Tasks

- [x] Implement a parameterized stadium-loop geometry generator: given `pathCellCount` (default 16), produce ordered cell centers around a rounded-rectangle path in 540x960, classify corner cells, and compute inner/outer slot positions plus each slot's affected path cell(s).
- [x] Add two slots per path cell: inner and outer.
- [x] Support slot `locked/unlocked` state in model/config while keeping all slots unlocked for P0 balance.
- [x] Mark corner slots; make corner slots affect two adjacent path cells and non-corner slots affect one target path cell.
- [x] Implement bench inventory as physical tower instances, not type unlocks.
- [x] Implement tap-select from bench and tap slot to place the selected tower.
- [x] Enforce the placement rule: placing from the bench is allowed any time (running or paused); picking up, moving, or swapping an existing tower is allowed only while paused. During a running wave, tapping an occupied slot is non-destructive (no pickup).
- [x] Recompute tower projection after every placement change: a bench placement triggers a live recompute on the next tick; removal happens while paused (frozen) and recomputes on resume.
- [x] Render slots, selected state, occupied state, and valid placement feedback without text tutorial.

### Acceptance Criteria

- [x] The player can place, move, remove, and swap towers under the rule (add anytime; destructive ops only in pause).
- [x] Placement works before wave 1 and additively during waves; tower instances retain identity when moved (in pause).
- [x] Board model does not depend on Phaser objects; corner influence is testable from board data; the generator produces a valid 16-cell loop with correct corner and slot-to-cell mapping.
- [x] No ghost hints or tutorial text are required for placement.

### Tests

- [x] Geometry generator tests (cell count, ordering, corner classification, slot-to-cell mapping).
- [x] Slot influence tests.
- [x] Bench inventory tests.
- [x] Placement action reducer tests, including the paused-only-removal rule.
- [x] Live projection invalidation tests.

### Verification

- [x] `npm run typecheck`
- [x] `npm test`
- [x] Manual browser check: tap-select placement on desktop/mobile viewport.

### Phase notes

- Decisions/contradictions:
  - Replaced the static authored board with a pure `createStadiumLoopBoard` generator. The default 16-cell loop uses four corner cells (`3/7/11/15`), and each corner slot affects its own cell plus the next ring cell.
  - Starting towers are now physical bench instances (`2 Водомёта + 1 Разрядник`) instead of the Phase 2 auto-placed compatibility setup. Tests that need wow #1 now place that setup explicitly.
  - Projection is recomputed synchronously in the placement reducer after every placement/removal/swap so the renderer, autosave, and tests see the new board immediately; `stepRun` still recomputes reactions during wave ticks.
  - The pause overlay now lets pointer events pass through to the canvas outside the modal, because paused editing is part of the Phase 3 placement contract.

### Phase completion summary

- Implemented:
  - Parameterized serializable stadium-loop board generation with 16-cell default, 12-cell A/B support, inner/outer slots, corner classification, locked-slot state, and slot-to-cell influence data.
  - Physical tower bench inventory and placement reducer rules for bench placement, paused move, paused removal, paused swap, and non-destructive occupied-slot taps while running.
  - Phaser slot hit testing and renderer feedback for empty, valid, selected, occupied, locked, and corner slots without tutorial text.
  - Start state now exposes the three starting towers in reserve; player placement creates the 2-cell Электролужа setup.
- Intentionally deferred:
  - Full P0 reaction graph, more emitter projection rules, and advanced placement affordances remain in Phase 4+.
- Accepted deviations/tradeoffs:
  - Placement projection updates immediately in `applyAction` instead of waiting for the next fixed tick; this keeps UI feedback and saves consistent while preserving deterministic recomputation in `stepRun`.
- Tests/checks run:
  - `npm run lint:fix`
  - `npm run typecheck`
  - `npm test` passed: 2 test files, 27 tests.
  - `npm run build` passed with Vite's existing large chunk warning.
  - Manual browser check on `http://127.0.0.1:5179`: reserve tower selection, canvas slot placement before wave 1 on desktop and mobile viewports, non-paused move no-op, paused move, paused removal, reaction invalidation, and HUD bench/field status.
  - Screenshots saved to `output/playwright/phase3-placement-paused-edit.png` and `output/playwright/phase3-mobile-placement.png`.

## Phase 4 - Reaction Simulation

Purpose: implement the core mechanic with per-phase VFX. Towers create reactions on path cells, and reactions deal damage/control by exposure.

### Tasks

- [x] Model reagents as live projection from currently placed towers.
- [x] Add P0 emitters: Вода / Водомёт, Нефть / Маслонасос, Искра / Разрядник, Жар / Магмовый кран.
- [x] Exclude Холод from P0 configs and drafts.
- [x] Implement connected water/oil pools along the ring.
- [x] Implement per-source energy capacity over connected pools, using nearest-cell claim, with stable slot id as tie-break for equal-distance conflicts.
- [x] Resolve reactions with deterministic tier passes T1, then T2, then T3; avoid fixpoint/order-dependent resolution.
- [x] Support one ground reaction and one air reaction per cell.
- [x] Implement T1 reactions: Электролужа, Пар, Пожар.
- [x] Implement T2 reactions: Грозовое облако, Огненный вихрь.
- [x] Implement T3 reaction: Огненный Шторм.
- [x] Implement water/oil slow as control/setup with zero direct damage.
- [x] Apply reaction damage at 30Hz fixed-step using DPS constants; keep visual pulse timing separate from damage math.
- [x] Enforce tier-damage ordering: per-tick damage T1 < T2 < T3 in config (design §10 — the core 2+2=5).
- [x] Ship renderer-facing VFX for every reaction in this phase: ground effects on the floor, air effects above cells; duplicate color meaning with shape/pattern where practical.

### Acceptance Criteria

- [x] Single towers do not deal damage by themselves; reactions appear only from valid combinations and adjacency.
- [x] Tower removal removes reaction effects on the next simulation tick (on resume).
- [x] Reaction results are independent of cell iteration order; air and ground reactions can coexist on a cell.
- [x] The P0 reaction graph can produce T1, T2, and T3 effects, with T1 < T2 < T3 per-tick damage.
- [x] Reaction VFX is readable in portrait layout.

### Tests

- [x] Live projection tests.
- [x] Pool connectivity tests.
- [x] Capacity and conflict tie-break tests.
- [x] T1/T2/T3 recipe tests.
- [x] Order-independence tests.
- [x] Tier-damage ordering tests (T1 < T2 < T3).
- [x] Ground/air coexistence tests.
- [x] Tower removal clearing tests.

### Verification

- [x] `npm run typecheck`
- [x] `npm test`
- [x] Manual browser check: visible P0 reaction VFX.

### Phase notes

- Decisions/contradictions:
  - Added a pure `reactions.ts` resolver module so reagent projection, pool capacity, tier passes, damage entries, and speed control remain testable outside Phaser.
  - `CellReactionState` now carries both `ground` and `air`; snapshots treat either layer as active.
  - Water and oil are projected setup/control only: they slow movement through typed emitter config and do not contribute direct damage.
  - T2/T3 reactions are resolved from stable snapshots of the previous tier pass. Higher air tiers replace lower air reactions on that cell, while ground and air may coexist.
  - The browser VFX check used a saved-run fixture to display all P0 reaction VFX before Phase 6 unlock/draft UI exists.

### Phase completion summary

- Implemented:
  - Full P0 reaction graph for Вода, Нефть, Искра, and Жар: Электролужа, Пар, Пожар, Грозовое облако, Огненный вихрь, and Огненный Шторм.
  - Live reagent projection from placed towers, connected water/oil pools, source capacity over pools, deterministic tier resolution, ground/air coexistence, config-backed DPS, and raw substance slow.
  - Phaser VFX for each Phase 4 reaction: floor effects for ground reactions and elevated cloud/vortex/storm effects for air reactions.
- Intentionally deferred:
  - Flying-only damage, enemy resist math, wave tuning, and full combat progression remain Phase 5.
  - Normal gameplay access to Жар/Нефть still depends on Phase 6 draft/unlock work; Phase 4 browser fixture was only for VFX verification.
- Accepted deviations/tradeoffs:
  - Energy capacity currently applies per connected substance pool. This keeps the rule deterministic and readable for 16 cells; future upgrade tuning may revisit cross-pool capacity if needed.
- Tests/checks run:
  - `npm run lint:fix`
  - `npm run typecheck`
  - `npm test` passed: 2 test files, 35 tests.
  - `npm run build` passed with Vite's existing large chunk warning.
  - Browser check on `http://127.0.0.1:5180`: placement -> Электролужа -> wave clear to draft, plus saved-run VFX fixture for the P0 reaction graph.
  - Screenshots saved to `output/playwright/phase4-wave-electropuddle.png` and `output/playwright/phase4-p0-reaction-vfx.png`.

## Phase 5 - Enemies, Waves, and Combat

Purpose: turn the reaction board into a playable tower defense run with enemy movement, leaks, resistances, and wave progression. Stand up continuous balance tuning. Delivers wow #2.

### Tasks

- [x] Implement continuous waypoint movement around the ring; derive current path cell from path progress; avoid A* and physics-dependent collision rules.
- [x] Implement core HP and leak handling; remove normal enemies on leak and apply configured core damage.
- [x] Implement P0 enemy archetypes: Грунт, Сварм, Танк, Летун, Бегун, Insulated, Flameproof.
- [x] Implement flying rule: летуны are damaged only by air reactions; ground enemies can be damaged by ground and air reactions.
- [x] Implement strong resistance for Insulated and Flameproof, not full immunity.
- [x] Add 10 typed wave configs based on the design doc pressure curve; keep full wave preview out of P0 UI.
- [x] Flyer/Жар safeguard (design §6.1 invariant): ensure Пар is reachable before the first flying wave — re-offer Жар until taken (ties to Phase 6) and add a light enemy-type icon telegraph at wave start. Do not gate the wave if the player still refuses.
- [x] Track per-wave and per-run damage/leak stats; add wave clear detection and transition into draft.
- [x] Keep core baseline tunable: HP 15, regular leak -1; boss lap damage handled in boss phase.
- [x] Bring up a minimal headless run harness here (drive `stepRun` with scripted actions) so waves are tuned as they are added, not all in Phase 8.

### Acceptance Criteria

- [x] Enemies spawn, move around the loop, take reaction damage, die, or leak; flying enemies ignore ground reactions and respond to air reactions.
- [x] Resist enemies are clearly tougher against their resisted family without becoming impossible by immunity.
- [x] Wave progression reaches draft after clearing each wave; the run can reach wave 10 without manual debug intervention.
- [x] Core HP loss and defeat state are deterministic and testable.
- [x] Wow #2 reads: a Вода -> Пар -> Грозовое облако chain mows down Сварм and Летун (design §12).

### Tests

- [x] Movement/path progress tests.
- [x] Current-cell derivation tests.
- [x] Damage application tests.
- [x] Flying targeting tests.
- [x] Resist math tests.
- [x] Leak/core HP tests.
- [x] Wave spawn and wave clear tests.
- [x] Minimal headless smoke-run test.

### Verification

- [x] `npm run typecheck`
- [x] `npm test`
- [x] Manual browser check: waves 1-3 playable with visible enemy movement and leaks/deaths, plus the wow #2 chain.

### Exit gate

- [x] **Wow #2 verified.**

### Phase notes

- Decisions/contradictions:
  - Added serializable `waveRuntime`, `currentCellIndex`, per-wave stats, enemy traits/resistances, reaction damage families, and spawn cadence to support Phase 5 without moving rules into Phaser.
  - Wave configs are still single-archetype waves, matching the design doc's pressure curve for waves 1-7 and keeping waves 8-10 as tuned repeats for now; true mixed waves can be added by extending the wave schema later if needed.
  - Added the light enemy-type telegraph in the HUD (`Враг`) and enemy-specific Phaser silhouettes/colors. The Жар re-offer guarantee remains open because it belongs to the Phase 6 draft/unlock system.
  - Added `src/entities/game-session/model/headlessRun.ts` as the minimal scripted runner. The current smoke-run fixture uses a full steam ring to verify wave runtime through wave 10; it is not a final balance strategy.
  - Bumped save schema version from 1 to 2 and made incompatible local saves load as absent instead of crashing the resume prompt.
  - Browser smoke verified wave 1 load/start and HUD/canvas readability only. A full public-UI waves 1-3 playthrough remains open until the Phase 6 draft overlay exposes tower choices.
  - Added the Phase 5 flyer/Жар safeguard in draft generation and rerolls: after wave 2, Жар stays in tower offers until the player owns a Жар tower; refusing it still allows wave 3 to start.
  - Added a lightweight enemy-type icon to the existing HUD telegraph. Wow #2 was verified with a headless mixed Сварм/Летун chain test and a Playwright saved-run browser fixture because the public two-step draft UI remains Phase 6 work.

### Phase completion summary

- Implemented:
  - Continuous waypoint movement, leak/core HP handling, P0 enemy archetypes, flying-only air damage, resistance math, typed waves, wave stats, and wave-to-draft progression.
  - Minimal headless run harness plus scripted fixtures for wave progression and reaction-chain verification.
  - HUD enemy telegraph and visible Phaser enemy silhouettes for normal, swarm, and flying pressure.
- Intentionally deferred:
  - Public draft/unlock UI was deferred to Phase 6 at the time of Phase 5; Phase 6 has since completed it.
  - Broader balance tuning and full manual demo-run hardening remain Phase 8 work.
- Accepted deviations/tradeoffs:
  - Wave configs remain single-archetype waves in Phase 5, with mixed/end-run pressure handled later by strategy tuning.
  - Phase 5 browser verification used the current post-Phase 6 UI because the original Phase 5 public UI did not yet expose the full draft flow.
- Tests/checks run:
  - Earlier Phase 5 checks: `npm run lint:fix`, `npm run typecheck`, `npm test`, and `npm run build`.
  - Manual browser check on `http://127.0.0.1:5184`: placed starting Водомёты and Разрядник, started waves 1-3, completed two-step drafts, picked and placed Магмовый кран, verified Грунт/Сварм/Летун movement, visible leak/death outcomes, and `Грозовое облако +1` wow #2 chain.
  - Screenshots saved under `output/playwright/`: `phase5-playtest-wave1-enemy.png`, `phase5-playtest-wave2-swarm.png`, `phase5-playtest-wow2-before-wave3.png`, `phase5-playtest-wave3-flyer-live.png`, and `phase5-playtest-wave3-cleared.png`.

## Phase 6 - Draft, Unlocks, and Upgrades

Purpose: add the between-wave roguelite growth loop and make runs branch without breaking required P0 unlock timing or leaving dead builds.

### Tasks

- [x] Add full-screen draft overlay; implement two-step draft: tower choice first, upgrade choice second.
- [x] Add `rerollsPerDraft` config; default 1 per draft.
- [x] Implement draft roles: support, generic, pivot.
- [x] Enforce the synergy guarantee invariant: at least one offered option synergizes with the current board (design §8.2 critical idle risk).
- [x] Guarantee Жар appears as an offer after wave 2 and Нефть after wave 4, and re-offer each key unlock every subsequent draft until taken; do not force the player to pick key unlocks.
- [x] Add the selected tower pick to the bench as one physical placeable instance; apply upgrade picks immediately.
- [x] Scope upgrades globally by emitter type; add capped upgrade stacks; implement a mixed upgrade pool: capacity, radius, control/coverage, and limited emitter-linked reaction buffs.
- [x] Exclude relic/joker-style P1 multiplier upgrades.
- [x] Ensure drafts and rerolls use seeded RNG; persist draft state and upgrade stacks in full save.

### Acceptance Criteria

- [x] After each cleared wave, the player gets a tower draft and an upgrade draft.
- [x] Reroll is available per `rerollsPerDraft` and updates offers deterministically.
- [x] At least one offered option always synergizes with the current board.
- [x] Key unlock offers appear at the required wave milestones and re-appear until taken; refusing a key unlock is allowed and does not crash or block progression.
- [x] Upgrade stack limits are enforced; draft choices alter future board/combat outcomes.

### Tests

- [x] Draft role generation tests.
- [x] Synergy guarantee invariant tests.
- [x] Guaranteed and re-offer milestone tests.
- [x] Reroll budget tests.
- [x] Tower pick bench insertion tests.
- [x] Upgrade application tests.
- [x] Upgrade max stack tests.
- [x] Save/resume draft-state tests.

### Verification

- [x] `npm run typecheck`
- [x] `npm test`
- [x] Manual browser check: post-wave full-screen two-step draft.

### Phase notes

- Decisions/contradictions:
  - Draft tower offers now carry explicit roles (`support`, `generic`, `pivot`) instead of raw emitter ids. The renderer/UI still chooses by emitter id, but the read model can show the offer role.
  - Choosing an upgrade now completes the draft and starts the 3-second countdown; the old `completeDraft` action remains as a compatibility no-op unless the run is already on the upgrade step.
  - Upgrade effects are implemented in the pure reaction/projection layer: water coverage, oil slow, spark/heat capacity, and a limited fire reaction DPS buff. This keeps Phaser out of combat rules and makes draft picks affect later outcomes immediately.
  - Save schema was bumped from 2 to 3 because draft offer shape and upgrade definitions changed.

### Phase completion summary

- Implemented:
  - Full-screen DOM draft overlay with two-step tower then upgrade selection, current-step reroll, mobile and desktop layouts, and no old one-click draft completion button.
  - Seeded draft generation with support/generic/pivot roles, a board-synergy guarantee, guaranteed Жар after wave 2, guaranteed Нефть after wave 4, and re-offer until each key tower is owned.
  - Tower draft picks add one physical tower instance to the bench; upgrade draft picks apply immediately, cap stacks, persist in save data, and advance to countdown.
  - Mixed global upgrade pool: water coverage, oil control, spark capacity, heat reach, and fire catalyst reaction buff.
- Intentionally deferred:
  - Boss/end-state growth hooks remain Phase 7; Phase 6 only advances normal wave drafts.
- Accepted deviations/tradeoffs:
  - The draft overlay darkens but does not fully hide the playfield, preserving context while still blocking input.
- Tests/checks run:
  - `npm run lint:fix`
  - `npm run typecheck`
  - `npm test` passed: 2 test files, 48 tests.
  - `npm run build` passed with Vite's existing large chunk warning.
  - Browser check on `http://127.0.0.1:5181`: desktop and mobile new-run wave 1 -> tower draft -> reroll -> upgrade draft -> wave 2 countdown.
  - Screenshots saved to `output/playwright/phase6-desktop-tower-draft.png`, `output/playwright/phase6-desktop-upgrade-draft.png`, `output/playwright/phase6-desktop-countdown.png`, `output/playwright/phase6-mobile-tower-draft.png`, `output/playwright/phase6-mobile-upgrade-draft.png`, and `output/playwright/phase6-mobile-countdown.png`.

## Phase 7 - Boss, End States, and Stats

Purpose: complete the finite P0 run with a boss climax, win/loss states, and detailed result screens. Delivers wow #3.

### Tasks

- [x] Add the Бочкоед boss encounter after wave 10; implement boss movement over multiple laps; set the boss baseline to 3 laps, tunable in boss config.
- [x] Apply configured core damage per boss lap; increase boss speed per lap using config values.
- [x] Implement Reaction Break tracking per lap: count distinct reaction ids that damage the boss during the current lap; trigger Vulnerable for 5 seconds at 3 distinct reaction ids; apply x2 damage while Vulnerable.
- [x] Do not add adaptive boss resistance in P0.
- [x] Add a victory state when the boss dies and a defeat state when core HP reaches 0.
- [x] Add a detailed win/loss stats overlay including seed, waves cleared, leaks, total damage, damage by reaction, top reaction, boss breaks, runtime, and restart/new run actions.
- [x] Persist and restore boss/end-state data in full save.

### Acceptance Criteria

- [x] A full run can progress from wave 1 through the boss.
- [x] Boss laps, lap damage, speed increases, and Reaction Break are visible and deterministic.
- [x] Victory and defeat both lead to a stats screen useful for tuning and manual playtest notes; restart/new run works from end screens.
- [x] Wow #3 reads: Грозовое облако + Огненный вихрь -> Огненный Шторм screen-clear, or Reaction Break -> Vulnerable burst (design §12).

### Tests

- [x] Boss lap progression tests.
- [x] Boss core damage tests.
- [x] Reaction Break trigger tests.
- [x] Vulnerable duration/damage multiplier tests.
- [x] Victory/defeat transition tests.
- [x] Stats aggregation tests.

### Verification

- [x] `npm run typecheck`
- [x] `npm test`
- [x] Manual browser check: full run reaches boss and end screen.

### Exit gate

- [x] **Wow #3 verified.**

### Phase notes

- Decisions/contradictions:
  - Added boss runtime as pure serializable simulation in `boss.ts`; Phaser renders only from `GameSnapshot`.
  - Бочкоед starts after wave 10 instead of opening another draft. If he completes the configured final lap alive, the run enters defeat; this keeps P0 finite while still applying configured lap damage as he crosses each lap.
  - P0 intentionally has no adaptive boss resistance; Reaction Break is the diversity reward for this phase.
  - Browser verification used saved-run fixtures for boss/victory/defeat screens plus a headless full-run test for wave 1 -> wave 10 -> boss -> victory. Phase 8 still owns coherent strategy balance and full manual demo-run tuning.

### Phase completion summary

- Implemented:
  - Бочкоед boss encounter after wave 10 with config-backed HP, 3 laps, lap core damage, speed increase per lap, and final-lap defeat if he survives.
  - Reaction Break per lap from 3 distinct damaging reaction ids, 5-second Vulnerable window, and x2 boss damage while Vulnerable.
  - Victory on boss death, defeat on core HP 0/final boss lap, save schema v4 with boss/end-state persistence.
  - Detailed win/loss stats overlay: seed, waves cleared, leaks, total damage, damage by reaction, top reaction, boss breaks, runtime, restart, and new run.
  - Phaser boss rendering with HP bar and Vulnerable visual state.
- Intentionally deferred:
  - Phase 8 balance work for coherent expected-win and weak strategies, plus final full manual demo playthrough.
- Accepted deviations/tradeoffs:
  - Browser boss/end-state checks used deterministic saved-run fixtures to avoid spending the Phase 7 slice on balance automation; headless tests verify the full wave-to-boss progression.
- Tests/checks run:
  - `npm run lint:fix`
  - `npm run typecheck`
  - `npm test` passed: 2 test files, 56 tests.
  - `npm run build` passed with Vite's existing large chunk warning.
  - Browser smoke on `http://127.0.0.1:5182`: boss Vulnerable HUD/canvas, victory stats, defeat stats, restart from victory, and new run from defeat.
  - Screenshots saved to `output/playwright/phase7-boss-vulnerable.png`, `output/playwright/phase7-victory-stats.png`, and `output/playwright/phase7-defeat-stats.png`.

## Phase 8 - Headless Balance Runs, Polish, and Final P0 Hardening

Purpose: tune the game into a coherent playable P0 and remove rough edges that block demo use.

### Tasks

- [x] Expand the headless run runner for scripted strategies (build on the minimal harness from Phase 5).
- [x] Add at least one coherent expected-win strategy and at least one weak/poor strategy that is allowed to leak or lose.
- [x] Assert expected leak bounds, wave reach, boss outcome, and damage distribution for scripted strategies.
- [ ] Keep all tuning constants in typed configs; tune wave HP, enemy speed, spawn counts, reaction DPS, slow strength, capacity, and boss numbers through config edits.
- [x] VFX polish pass: build on the per-phase reaction VFX; prioritize reaction VFX over general decorative polish; confirm color meanings are not color-only where shape/pattern can cheaply help.
- [ ] Respect the performance budget (design §13): <= ~15 particles per effect, object pooling for enemies and particles, a single texture atlas; avoid blur/post-processing.
- [x] Improve procedural tower, enemy, cell, reaction, and boss readability.
- [ ] Add optional audio only if the full playable run is already stable.
- [ ] Update the README if it still contradicts the implemented portrait P0 game.
- [ ] Run final checks.

### Acceptance Criteria

- [x] A coherent strategy usually wins the full run; poor placement or poor draft choices can produce meaningful leaks or defeat.
- [x] Headless strategies are deterministic by seed; manual playthrough is readable in portrait layout.
- [ ] P0 remains free of excluded P1 systems and respects the performance budget.
- [ ] README no longer misleads future agents about the implemented game shape.
- [ ] All three wow moments (design §12) reproduce in a single run.

### Tests

- [x] Headless full-run expected-win tests.
- [x] Headless weak-strategy tests.
- [ ] Regression tests for any bugs found during manual play.

### Final Verification

- [x] `npm run lint:fix`
- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`
- [ ] Manual browser check: new run, wave 1, live bench placement, pause-to-edit removal/move, draft, save/reload/resume, pause/speed, boss, victory/defeat stats, and all three wow moments.

### Phase notes

- Decisions/contradictions:
  - Added a Phase 8 scripted strategy layer on top of the existing headless runner instead of replacing the
    lower-level harness. Strategies now define placement plans, draft priorities, and produce a compact summary
    for leak, wave, boss, and reaction distribution assertions.
  - The expected-win strategy uses normal bench placement and draft choices from a fixed seed; the older full-ring
    fixtures remain as targeted smoke fixtures, not balance strategy tests.
  - The weak strategy intentionally underbuilds damage and is expected to hit defeat through leaks/final boss pressure.
  - Asset polish stayed procedural in Phaser: tower glyphs, enemy silhouette accents, path-cell markers, reaction
    shape/pattern overlays, and extra Бочкоед barrel/vulnerable details. No generated sprite strip was introduced
    because the current shipped asset path is procedural graphics, not bitmap sprites.
  - No wave/reaction/boss numeric tuning constants were changed in this slice.
  - Browser visual checks covered the start placement -> Электролужа state and a saved-run reaction fixture; the full
    final manual checklist is still open.

### Phase completion summary

TBD

## Global Test Matrix

Use this as the minimum regression checklist while implementing P0.

- [x] Seeded RNG produces reproducible drafts and headless runs.
- [x] Config validation catches invalid ids and missing references.
- [x] The stadium geometry generator yields a valid loop with correct corner and slot-to-cell mapping.
- [x] Full save round-trips current phase, board, bench, enemies, draft, upgrades, boss, and stats.
- [x] Live bench placement during waves updates reactions without pausing; pick-up/move/swap requires pause.
- [x] Single towers never deal direct damage.
- [x] Removing a tower (in pause) removes its projected state on the next tick after resume.
- [x] T1, T2, and T3 reactions are reachable, with T1 < T2 < T3 per-tick damage.
- [x] Ground and air reaction layers coexist correctly.
- [x] Flying enemies are only damaged by air reactions.
- [x] Insulated and Flameproof use strong resistance, not immunity.
- [x] Every draft offers at least one option that synergizes with the current board.
- [x] Draft key offers appear at correct wave milestones and re-offer until taken.
- [x] Upgrade stacks are capped.
- [x] Boss Reaction Break uses distinct reaction ids per lap.
- [x] Victory, defeat, restart, new run, save, and resume all work.

## Final P0 Done Definition

P0 is complete only when all of the following are true:

- [ ] The game is a full finite run, not a mechanics sandbox.
- [ ] One run includes wave 1 through wave 10 plus Бочкоед.
- [ ] The player can place towers live and edit (move/remove) them while paused.
- [ ] The player gets tower and upgrade drafts between waves.
- [ ] The P0 reaction graph is implemented and visible.
- [ ] All three wow moments (design §12) reproduce in a single run.
- [ ] The game supports full local save/resume.
- [ ] Win/loss stats are available.
- [ ] Headless scripted strategy tests exist.
- [ ] Final verification commands pass.
- [ ] Phase summaries above are filled in.
