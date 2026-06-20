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
- [ ] Extract the fixed-step accumulator/driver out of the Phaser scene so the scene's `update()` and a headless test both call `stepRun(state, deltaMs)` at the same step.
- [x] Add a hardcoded small loop board (subset of the full board; may be fewer than 16 cells for the slice) with the cells/slots needed for a 2-cell Электролужа.
- [x] Add the starting bench (2 Водомёта + 1 Разрядник) and place them to form Вода + Вода + Искра.
- [x] Implement T1 Электролужа only: a water pool plus Искра energy reacts on the cell(s).
- [x] Spawn one Грунт that walks the loop, takes electro damage on the puddle cell, and dies; if it survives a lap it leaks and reduces core HP.
- [ ] Replace `SmokeScene` as the primary scene with a 540x960 portrait scene that renders board/tower/enemy/puddle from `GameSnapshot`.
- [ ] Ship a readable Электролужа VFX (ground layer); duplicate color meaning with simple shape/pattern.
- [ ] Keep player-facing names in Russian fiction naming while internal ids remain stable English identifiers.

### Acceptance Criteria

- [ ] On load, the slice shows 2 Водомёта + Разрядник -> 2-cell Электролужа -> a Грунт melts (or leaks for core HP), readable without explanation (wow #1, design §12).
- [ ] A single tower alone deals no damage; only the Вода + Искра combination does.
- [ ] `stepRun` is deterministic for a fixed seed; the same driver steps the slice in-scene and headless.
- [x] No Phaser or DOM objects exist in `RunState`.

### Tests

- [x] Seeded RNG determinism (smoke level).
- [x] `stepRun` determinism for the slice scenario.
- [x] Электролужа forms only from Вода + Искра; a lone tower deals 0.
- [x] Enemy damage/death/leak in the slice.

### Verification

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Manual browser check: wow #1 reads on a portrait viewport; `SmokeScene` no longer primary.

### Exit gate

- [ ] **Wow #1 verified on screen.**

### Phase notes

- Decisions/contradictions:
  - Added Phase 1 simulation as a headless TypeScript slice first. `SmokeScene` still owns the accumulator for now; extraction and primary portrait rendering remain open.
  - Full typed content configs are still deferred to Phase 2. Current slice constants live in `simulation.ts`.

### Phase completion summary

TBD

## Phase 2 - Foundation Hardening, Content Data, and Run Shell

Purpose: turn the slice's ad-hoc state into the full deterministic, serializable foundation with typed content configs, and build the run-lifecycle shell around the playfield.

### Tasks

Data and state:

- [ ] Formalize serializable `RunState` with phase, seed/RNG state, elapsed time, wave index, core HP, board, bench, enemies, draft state, upgrades, boss state, and stats.
- [ ] Formalize `GameSnapshot` (renderer/UI read model), `GameAction`, and `RunPhase`.
- [ ] Add typed TS configs for board, emitters, reactions, enemies, waves, boss, upgrades, display names, and balance constants (`pathCellCount` default 16).
- [ ] Add config validation tests so malformed ids, missing display names, missing reactions, invalid wave references, and impossible upgrade references fail fast.
- [ ] Implement `createRun(seed)` with full P0 starting state: 16-cell board, all slots unlocked, starting bench with 2 Водомёта and 1 Разрядник, core HP from config.
- [ ] Expand `applyAction(state, action)` for run control, placement, draft, reroll, pause/speed, save/resume, restart, and debug toggles.
- [ ] Add `serializeRun` and `deserializeRun` with schema versioning. Note: save/resume is beyond the design doc's P0 ask and is the first thing to cut if time slips.

Run shell and lifecycle:

- [ ] Finalize the 540x960 portrait logical scene and center it in a desktop phone-frame layout; preserve mobile safe-area handling.
- [ ] Game scene shell renders from `GameSnapshot`; keep the debug HUD behind a dev toggle or URL flag.
- [ ] Add boot resume prompt when a saved run exists: Resume / New Run; add full-save persistence to `localStorage`.
- [ ] Add pause overlay with Resume, Restart, speed x1/x2, seed, and basic run stats.
- [ ] Add top HUD for core HP, wave, phase/countdown, pause, and speed.
- [ ] Add bottom bench area for tower selection and placement state.
- [ ] Implement manual first-wave start and automatic 3-second countdown after later drafts unless paused.
- [ ] Ensure speed x1/x2 affects simulation stepping (via the shared driver), not renderer-only animation.

### Acceptance Criteria

- [ ] A new run can be created from a seed; the same seed produces deterministic draft/RNG behavior.
- [ ] A run can be serialized, deserialized, and stepped without losing relevant state; balance is tunable in configs without editing simulation logic; no Phaser/DOM objects in state.
- [ ] Game opens portrait on a mobile-sized viewport; desktop shows the same game in a centered phone-frame; the smoke placeholder is no longer primary.
- [ ] Player can start a new run, pause/resume, change speed, restart, save, reload, and resume; first wave waits for manual start; later waves auto-start after countdown; debug HUD is hidden in normal UI.

### Tests

- [ ] Seeded RNG determinism tests.
- [ ] Config validity tests.
- [ ] Run creation tests.
- [ ] Serialization/deserialization round-trip tests.
- [ ] Snapshot shape tests.
- [ ] Run-lifecycle store/action tests.
- [ ] Save/resume round-trip tests.
- [ ] Pause and speed behavior tests.
- [ ] Countdown transition tests.

### Verification

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Manual browser check: mobile portrait and desktop phone-frame, full run lifecycle.

### Phase notes

- Decisions/contradictions:
  - TBD

### Phase completion summary

TBD

## Phase 3 - Board and Placement

Purpose: full board geometry, slots, bench, and the placement rule.

### Tasks

- [ ] Implement a parameterized stadium-loop geometry generator: given `pathCellCount` (default 16), produce ordered cell centers around a rounded-rectangle path in 540x960, classify corner cells, and compute inner/outer slot positions plus each slot's affected path cell(s).
- [ ] Add two slots per path cell: inner and outer.
- [ ] Support slot `locked/unlocked` state in model/config while keeping all slots unlocked for P0 balance.
- [ ] Mark corner slots; make corner slots affect two adjacent path cells and non-corner slots affect one target path cell.
- [ ] Implement bench inventory as physical tower instances, not type unlocks.
- [ ] Implement tap-select from bench and tap slot to place the selected tower.
- [ ] Enforce the placement rule: placing from the bench is allowed any time (running or paused); picking up, moving, or swapping an existing tower is allowed only while paused. During a running wave, tapping an occupied slot is non-destructive (no pickup).
- [ ] Recompute tower projection after every placement change: a bench placement triggers a live recompute on the next tick; removal happens while paused (frozen) and recomputes on resume.
- [ ] Render slots, selected state, occupied state, and valid placement feedback without text tutorial.

### Acceptance Criteria

- [ ] The player can place, move, remove, and swap towers under the rule (add anytime; destructive ops only in pause).
- [ ] Placement works before wave 1 and additively during waves; tower instances retain identity when moved (in pause).
- [ ] Board model does not depend on Phaser objects; corner influence is testable from board data; the generator produces a valid 16-cell loop with correct corner and slot-to-cell mapping.
- [ ] No ghost hints or tutorial text are required for placement.

### Tests

- [ ] Geometry generator tests (cell count, ordering, corner classification, slot-to-cell mapping).
- [ ] Slot influence tests.
- [ ] Bench inventory tests.
- [ ] Placement action reducer tests, including the paused-only-removal rule.
- [ ] Live projection invalidation tests.

### Verification

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Manual browser check: tap-select placement on desktop/mobile viewport.

### Phase notes

- Decisions/contradictions:
  - TBD

### Phase completion summary

TBD

## Phase 4 - Reaction Simulation

Purpose: implement the core mechanic with per-phase VFX. Towers create reactions on path cells, and reactions deal damage/control by exposure.

### Tasks

- [ ] Model reagents as live projection from currently placed towers.
- [ ] Add P0 emitters: Вода / Водомёт, Нефть / Маслонасос, Искра / Разрядник, Жар / Магмовый кран.
- [ ] Exclude Холод from P0 configs and drafts.
- [ ] Implement connected water/oil pools along the ring.
- [ ] Implement per-source energy capacity over connected pools, using nearest-cell claim, with stable slot id as tie-break for equal-distance conflicts.
- [ ] Resolve reactions with deterministic tier passes T1, then T2, then T3; avoid fixpoint/order-dependent resolution.
- [ ] Support one ground reaction and one air reaction per cell.
- [ ] Implement T1 reactions: Электролужа, Пар, Пожар.
- [ ] Implement T2 reactions: Грозовое облако, Огненный вихрь.
- [ ] Implement T3 reaction: Огненный Шторм.
- [ ] Implement water/oil slow as control/setup with zero direct damage.
- [ ] Apply reaction damage at 30Hz fixed-step using DPS constants; keep visual pulse timing separate from damage math.
- [ ] Enforce tier-damage ordering: per-tick damage T1 < T2 < T3 in config (design §10 — the core 2+2=5).
- [ ] Ship renderer-facing VFX for every reaction in this phase: ground effects on the floor, air effects above cells; duplicate color meaning with shape/pattern where practical.

### Acceptance Criteria

- [ ] Single towers do not deal damage by themselves; reactions appear only from valid combinations and adjacency.
- [ ] Tower removal removes reaction effects on the next simulation tick (on resume).
- [ ] Reaction results are independent of cell iteration order; air and ground reactions can coexist on a cell.
- [ ] The P0 reaction graph can produce T1, T2, and T3 effects, with T1 < T2 < T3 per-tick damage.
- [ ] Reaction VFX is readable in portrait layout.

### Tests

- [ ] Live projection tests.
- [ ] Pool connectivity tests.
- [ ] Capacity and conflict tie-break tests.
- [ ] T1/T2/T3 recipe tests.
- [ ] Order-independence tests.
- [ ] Tier-damage ordering tests (T1 < T2 < T3).
- [ ] Ground/air coexistence tests.
- [ ] Tower removal clearing tests.

### Verification

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Manual browser check: visible P0 reaction VFX.

### Phase notes

- Decisions/contradictions:
  - TBD

### Phase completion summary

TBD

## Phase 5 - Enemies, Waves, and Combat

Purpose: turn the reaction board into a playable tower defense run with enemy movement, leaks, resistances, and wave progression. Stand up continuous balance tuning. Delivers wow #2.

### Tasks

- [ ] Implement continuous waypoint movement around the ring; derive current path cell from path progress; avoid A* and physics-dependent collision rules.
- [ ] Implement core HP and leak handling; remove normal enemies on leak and apply configured core damage.
- [ ] Implement P0 enemy archetypes: Грунт, Сварм, Танк, Летун, Бегун, Insulated, Flameproof.
- [ ] Implement flying rule: летуны are damaged only by air reactions; ground enemies can be damaged by ground and air reactions.
- [ ] Implement strong resistance for Insulated and Flameproof, not full immunity.
- [ ] Add 10 typed wave configs based on the design doc pressure curve; keep full wave preview out of P0 UI.
- [ ] Flyer/Жар safeguard (design §6.1 invariant): ensure Пар is reachable before the first flying wave — re-offer Жар until taken (ties to Phase 6) and add a light enemy-type icon telegraph at wave start. Do not gate the wave if the player still refuses.
- [ ] Track per-wave and per-run damage/leak stats; add wave clear detection and transition into draft.
- [ ] Keep core baseline tunable: HP 15, regular leak -1; boss lap damage handled in boss phase.
- [ ] Bring up a minimal headless run harness here (drive `stepRun` with scripted actions) so waves are tuned as they are added, not all in Phase 8.

### Acceptance Criteria

- [ ] Enemies spawn, move around the loop, take reaction damage, die, or leak; flying enemies ignore ground reactions and respond to air reactions.
- [ ] Resist enemies are clearly tougher against their resisted family without becoming impossible by immunity.
- [ ] Wave progression reaches draft after clearing each wave; the run can reach wave 10 without manual debug intervention.
- [ ] Core HP loss and defeat state are deterministic and testable.
- [ ] Wow #2 reads: a Вода -> Пар -> Грозовое облако chain mows down Сварм and Летун (design §12).

### Tests

- [ ] Movement/path progress tests.
- [ ] Current-cell derivation tests.
- [ ] Damage application tests.
- [ ] Flying targeting tests.
- [ ] Resist math tests.
- [ ] Leak/core HP tests.
- [ ] Wave spawn and wave clear tests.
- [ ] Minimal headless smoke-run test.

### Verification

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Manual browser check: waves 1-3 playable with visible enemy movement and leaks/deaths, plus the wow #2 chain.

### Exit gate

- [ ] **Wow #2 verified.**

### Phase notes

- Decisions/contradictions:
  - TBD

### Phase completion summary

TBD

## Phase 6 - Draft, Unlocks, and Upgrades

Purpose: add the between-wave roguelite growth loop and make runs branch without breaking required P0 unlock timing or leaving dead builds.

### Tasks

- [ ] Add full-screen draft overlay; implement two-step draft: tower choice first, upgrade choice second.
- [ ] Add `rerollsPerDraft` config; default 1 per draft.
- [ ] Implement draft roles: support, generic, pivot.
- [ ] Enforce the synergy guarantee invariant: at least one offered option synergizes with the current board (design §8.2 critical idle risk).
- [ ] Guarantee Жар appears as an offer after wave 2 and Нефть after wave 4, and re-offer each key unlock every subsequent draft until taken; do not force the player to pick key unlocks.
- [ ] Add the selected tower pick to the bench as one physical placeable instance; apply upgrade picks immediately.
- [ ] Scope upgrades globally by emitter type; add capped upgrade stacks; implement a mixed upgrade pool: capacity, radius, control/coverage, and limited emitter-linked reaction buffs.
- [ ] Exclude relic/joker-style P1 multiplier upgrades.
- [ ] Ensure drafts and rerolls use seeded RNG; persist draft state and upgrade stacks in full save.

### Acceptance Criteria

- [ ] After each cleared wave, the player gets a tower draft and an upgrade draft.
- [ ] Reroll is available per `rerollsPerDraft` and updates offers deterministically.
- [ ] At least one offered option always synergizes with the current board.
- [ ] Key unlock offers appear at the required wave milestones and re-appear until taken; refusing a key unlock is allowed and does not crash or block progression.
- [ ] Upgrade stack limits are enforced; draft choices alter future board/combat outcomes.

### Tests

- [ ] Draft role generation tests.
- [ ] Synergy guarantee invariant tests.
- [ ] Guaranteed and re-offer milestone tests.
- [ ] Reroll budget tests.
- [ ] Tower pick bench insertion tests.
- [ ] Upgrade application tests.
- [ ] Upgrade max stack tests.
- [ ] Save/resume draft-state tests.

### Verification

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Manual browser check: post-wave full-screen two-step draft.

### Phase notes

- Decisions/contradictions:
  - TBD

### Phase completion summary

TBD

## Phase 7 - Boss, End States, and Stats

Purpose: complete the finite P0 run with a boss climax, win/loss states, and detailed result screens. Delivers wow #3.

### Tasks

- [ ] Add the Бочкоед boss encounter after wave 10; implement boss movement over multiple laps; set the boss baseline to 3 laps, tunable in boss config.
- [ ] Apply configured core damage per boss lap; increase boss speed per lap using config values.
- [ ] Implement Reaction Break tracking per lap: count distinct reaction ids that damage the boss during the current lap; trigger Vulnerable for 5 seconds at 3 distinct reaction ids; apply x2 damage while Vulnerable.
- [ ] Do not add adaptive boss resistance in P0.
- [ ] Add a victory state when the boss dies and a defeat state when core HP reaches 0.
- [ ] Add a detailed win/loss stats overlay including seed, waves cleared, leaks, total damage, damage by reaction, top reaction, boss breaks, runtime, and restart/new run actions.
- [ ] Persist and restore boss/end-state data in full save.

### Acceptance Criteria

- [ ] A full run can progress from wave 1 through the boss.
- [ ] Boss laps, lap damage, speed increases, and Reaction Break are visible and deterministic.
- [ ] Victory and defeat both lead to a stats screen useful for tuning and manual playtest notes; restart/new run works from end screens.
- [ ] Wow #3 reads: Грозовое облако + Огненный вихрь -> Огненный Шторм screen-clear, or Reaction Break -> Vulnerable burst (design §12).

### Tests

- [ ] Boss lap progression tests.
- [ ] Boss core damage tests.
- [ ] Reaction Break trigger tests.
- [ ] Vulnerable duration/damage multiplier tests.
- [ ] Victory/defeat transition tests.
- [ ] Stats aggregation tests.

### Verification

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Manual browser check: full run reaches boss and end screen.

### Exit gate

- [ ] **Wow #3 verified.**

### Phase notes

- Decisions/contradictions:
  - TBD

### Phase completion summary

TBD

## Phase 8 - Headless Balance Runs, Polish, and Final P0 Hardening

Purpose: tune the game into a coherent playable P0 and remove rough edges that block demo use.

### Tasks

- [ ] Expand the headless run runner for scripted strategies (build on the minimal harness from Phase 5).
- [ ] Add at least one coherent expected-win strategy and at least one weak/poor strategy that is allowed to leak or lose.
- [ ] Assert expected leak bounds, wave reach, boss outcome, and damage distribution for scripted strategies.
- [ ] Keep all tuning constants in typed configs; tune wave HP, enemy speed, spawn counts, reaction DPS, slow strength, capacity, and boss numbers through config edits.
- [ ] VFX polish pass: build on the per-phase reaction VFX; prioritize reaction VFX over general decorative polish; confirm color meanings are not color-only where shape/pattern can cheaply help.
- [ ] Respect the performance budget (design §13): <= ~15 particles per effect, object pooling for enemies and particles, a single texture atlas; avoid blur/post-processing.
- [ ] Improve procedural tower, enemy, cell, reaction, and boss readability.
- [ ] Add optional audio only if the full playable run is already stable.
- [ ] Update the README if it still contradicts the implemented portrait P0 game.
- [ ] Run final checks.

### Acceptance Criteria

- [ ] A coherent strategy usually wins the full run; poor placement or poor draft choices can produce meaningful leaks or defeat.
- [ ] Headless strategies are deterministic by seed; manual playthrough is readable in portrait layout.
- [ ] P0 remains free of excluded P1 systems and respects the performance budget.
- [ ] README no longer misleads future agents about the implemented game shape.
- [ ] All three wow moments (design §12) reproduce in a single run.

### Tests

- [ ] Headless full-run expected-win tests.
- [ ] Headless weak-strategy tests.
- [ ] Regression tests for any bugs found during manual play.

### Final Verification

- [ ] `npm run lint:fix`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Manual browser check: new run, wave 1, live bench placement, pause-to-edit removal/move, draft, save/reload/resume, pause/speed, boss, victory/defeat stats, and all three wow moments.

### Phase notes

- Decisions/contradictions:
  - TBD

### Phase completion summary

TBD

## Global Test Matrix

Use this as the minimum regression checklist while implementing P0.

- [ ] Seeded RNG produces reproducible drafts and headless runs.
- [ ] Config validation catches invalid ids and missing references.
- [ ] The stadium geometry generator yields a valid loop with correct corner and slot-to-cell mapping.
- [ ] Full save round-trips current phase, board, bench, enemies, draft, upgrades, boss, and stats.
- [ ] Live bench placement during waves updates reactions without pausing; pick-up/move/swap requires pause.
- [ ] Single towers never deal direct damage.
- [ ] Removing a tower (in pause) removes its projected state on the next tick after resume.
- [ ] T1, T2, and T3 reactions are reachable, with T1 < T2 < T3 per-tick damage.
- [ ] Ground and air reaction layers coexist correctly.
- [ ] Flying enemies are only damaged by air reactions.
- [ ] Insulated and Flameproof use strong resistance, not immunity.
- [ ] Every draft offers at least one option that synergizes with the current board.
- [ ] Draft key offers appear at correct wave milestones and re-offer until taken.
- [ ] Upgrade stacks are capped.
- [ ] Boss Reaction Break uses distinct reaction ids per lap.
- [ ] Victory, defeat, restart, new run, save, and resume all work.

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
