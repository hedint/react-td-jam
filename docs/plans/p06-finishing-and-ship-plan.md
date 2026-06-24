<!-- eslint-disable markdown/heading-increment -->

# Phase 0.6 Finishing and Ship Plan

## Status

- Current phase: Phase A - Lock the gameplay (implementation in progress)
- Overall status: P0 complete; Phase 0.5 visual overhaul phases 0-6 complete (phases 7-10 pending in `p05-visual-overhaul-plan.md`); this is the main ship roadmap for everything still needed to reach a shippable demo.
- Source docs: `docs/design.md`, `docs/setting.md`, `docs/plans/p0-implementation-plan.md`, `docs/plans/p05-visual-overhaul-plan.md`.
- Goal: take the feature-complete-but-unpolished P0 to a finished, self-hosted, mobile-first web demo. Includes re-enabling the disabled upgrade economy, a new slot-unlock progression, a wave pacing / mixed-wave balance pass, a game-feel pass, UI finalization, a meta shell, and onboarding/audio.

## Agent Instructions

This document is both the implementation plan and the execution log for Phase 0.6.

When working on this plan:

- Update checkboxes as work is completed. Do not mark a checkbox complete until the behavior is implemented and verified at the level described.
- Keep core rules in serializable TypeScript simulation code; keep Phaser scenes thin (rendering, tweens, VFX only).
- Keep player-facing text in Russian fiction naming from `docs/setting.md`; internal ids stay English. New UI strings go through the central locale file (see Phase B2), not inline literals.
- Use UTF-8 without BOM for all new or modified text files.
- Prefer `npm run lint:fix` over a plain lint run on changed files.
- Do not revert unrelated worktree changes.
- If an implementation detail diverges from this plan, record it in the relevant phase's "Phase notes" before moving on.
- At the end of each phase, fill in "Phase completion summary": what was implemented, what was deferred, tradeoffs/deviations, and checks run.

Sequencing principle: **lock gameplay first, polish last.** Phases run A → B → C → D. Within a phase, the balance-affecting work (Phase A) should settle before art and juice are layered on top.

Preflight principle: before turning this plan into implementation work, stabilize the current planning/worktree baseline. Do not start A1 from a floating state where p06, p05, or already-working support files are untracked or partially recorded.

## Context

The game is mechanically and feature-complete for P0 (10 waves + boss, the full reaction graph, two-step draft, save/resume, 137 automated tests after the first Phase A implementation pass) and visually polished through visual-overhaul phase 6. A finishing review surfaced gaps beyond the obvious remaining work (hints, tutorial, final monster/boss assets, HUD finalization, audio). The largest: **the entire upgrade economy was disabled** by a temporary feature flag; Phase A re-enabled it behind milestone cadence and now needs balance/playtest tuning. This plan captures those gaps and the decisions made about each.

## Key Decisions

- **Upgrades**: re-enable and tune (not cut). Combat effects are already consumed in `reactions.ts` / `damage.ts` / `boss.ts` / `towerPlacement.ts`; only the draft step is off.
- **Draft cadence**: upgrade pick should not be reintroduced as an isolated "every wave" reward. Its cadence must be decided together with wave pacing, mixed enemy pressure, run length, and slot-unlock value during Phase A4.
- **Wave pacing**: current suspicion is that the run is too fast and too easy once upgrades are enabled; later waves should move away from single-archetype packs toward 2-3 monster roles per wave.
- **Slot unlocks (new)**: the 3 inner-corner 2-cell slots (the lower-left corner is the exit and has none) start locked; each is opened by its own optional upgrade pick. Slot unlocks start as normal upgrade-pool options that compete with power upgrades. A player may leave them locked the whole game. If A4 playtests show random offers hide unlocks too often and hurt pacing, A4 may move unlocks to milestone offers and must record that decision.
- **Boss**: at least 1 scripted set-piece and at least 1 real telegraphed combat ability are required. A5 decides the concrete ability brief from balance/playtest needs; C2 implements it with bespoke event-tied animation (e.g. smashing the exit after completing a lap) - something spectacular, not just final art.
- **T3 climax**: A5 now takes `Огненный Шторм` as the intended final climax. It forms when a `Грозовое облако` pool touches a neighboring `Огненный вихрь` pool; all cells from both touching T2 pools become `Огненный Шторм`. Boss Reaction Break remains a secondary boss wow, not the primary answer to the T3 question.
- **Enemy/boss art gate**: final creature and boss sprites are a public-demo ship blocker, but not a blocker for Phase A/B balance and UI work. Boss abilities may be prototyped before final art through simulation/events and temporary telegraph overlays.
- **Game feel**: a dedicated lightweight juice pass (separate from asset work).
- **UI finalization**: covers everything - top/bottom in-run bars, draft cards, pause overlay, and victory/defeat result screens.
- **Meta shell**: minimal title screen (New run / Continue) plus a credits panel.
- **Audio**: required for ship, but scoped small: music/ambience, key SFX, UI feedback, and a persistent mute button in the top HUD. No dedicated settings screen, mixer, complex dynamic music, or large variant library.
- **Localization**: Russian-only ships, but strings are extracted into a central locale file.
- **Onboarding**: a small first-run tutorial is required, but it is implemented near the end after gameplay, UI, and visuals are stable. Hints support the tutorial; they do not replace it.
- **Delivery**: self-hosted static web build; real-device touch QA is required. Run an early static-build smoke after core B/C integrations, then final deploy and device QA in Phase D.
- **Playtest tooling**: build debug tooling (wave-skip, seed pin, core-HP lock, force-spawn, fast-forward) on the existing `?debug=1` path.
- **Prod build**: `/tower-demo` and `?debug=1` are intentionally left in the public build.
- **Plan ownership**: this Phase 0.6 document is the primary ship roadmap. `p05-visual-overhaul-plan.md` remains the subordinate creature/boss asset-production reference for phases 7-9; p06 owns priorities, integration gates, and ship acceptance.
- **Roadmap format**: the detailed roadmap should be embedded directly in this p06 document under the relevant phases. Keep it concrete enough to guide execution, but not a per-file implementation checklist: use ordered phase/block-level steps, key decisions, dependencies, gates, expected artifacts, and phase-level checks. Do not require touched-file lists or verification notes on every step. Do not create a separate detailed-roadmap document unless p06 becomes impractically large.

## Out of Scope

- New P1 mechanics (Холод emitter, global diversity multiplier, adaptive boss resistance, relics, endless mode) - tracked in `docs/design.md`.
- Visual-overhaul phases 7-9 creature/boss art pipeline mechanics already owned by `p05-visual-overhaul-plan.md`; this plan references p05 as a subplan and owns the integration gates, priorities, boss abilities, and ship acceptance.
- Prod hardening / stripping dev routes (explicitly declined).

---

## Phase 0.6 Preflight - Baseline and housekeeping

Purpose: make the current plan and support-file state explicit before implementation roadmap work starts.

#### Tasks
- [ ] Reconcile current worktree status and identify pre-existing unrelated changes.
- [x] Ensure `docs/plans/p06-finishing-and-ship-plan.md` is tracked as the primary ship roadmap.
- [ ] Ensure relevant `p05-visual-overhaul-plan.md` changes are either committed or explicitly recorded as pending p05 edits.
- [ ] Ensure `src/app/phaser/scenes/runSceneReactionPoolUnderlay.ts` is tracked/committed or explicitly staged with the current visual-overhaul work, so later C3/T3 decisions have a stable baseline.
- [x] Update stale factual metadata in p06 before roadmap generation, including the current test count if it still says an older number.
- [x] Add the detailed roadmap directly to this p06 document under each phase instead of creating a separate roadmap file, using phase/block-level steps rather than per-file implementation tasks.
- [ ] Capture the clean/dirty baseline in the first roadmap note before starting A1.

#### Acceptance Criteria
- [ ] The detailed roadmap starts from an explicit git/worktree baseline.
- [ ] No implementation phase begins while core plan/support files are accidentally untracked.

---

## Phase A - Lock the gameplay

Purpose: restore and tune the progression systems, redesign wave pressure, and freeze balance before any art or juice is layered on top.

Exit gate: Phase A is not complete just because implementation tests pass. It is complete only when upgrades are enabled, slot unlocks work, waves 4-10 use the approved mixed-wave pressure model, upgrade cadence is chosen against that pacing, expected-win and weak headless strategies clearly diverge, and at least 1-2 manual full-run playtests no longer show the old failure mode where random upgrades plus no meaningful tower placement after wave 3 can still win comfortably. After this gate, later phases may tune numbers with a recorded Phase A note, but should not add new rules or restructure the wave table.

### A1 - Re-enable and rework the upgrade economy

#### Tasks
- [x] Remove / flip `SKIP_UPGRADE_SELECTION_DRAFT_STEP` in `src/entities/game-session/model/draft.ts` so the upgrade draft step runs again.
- [x] Add a configurable upgrade-draft eligibility hook in `draft.ts` (`createDraftState` / `advanceAfterDraft`); final cadence is decided in A4, not hardcoded during the technical re-enable.
- [x] Reverify the upgrade draft UI in `src/widgets/run-hud/ui/RunHud.vue` (step has been dark): reroll, stack counts, descriptions render correctly.
- [x] Add / update headless scenarios in `headlessRun.ts` so upgrade application is covered again.

#### Acceptance Criteria
- [x] Picking a tower no longer auto-skips; upgrades apply and visibly affect reactions (coverage / slow / capacity / fire DPS).
- [x] Upgrade screens can be enabled on a tunable cadence, with the shipping cadence deferred to the A4 wave-pacing decision.
- [x] `npm run test` green.

### A2 - Slot-unlock upgrades (new feature)

The model already supports this: `slot.locked` (`types.ts`), 2-cell inner-corner slots, `lockInnerCornerSlots` (`boardGeometry.ts`, currently `false`), and placement already rejects locked slots (`towerPlacement.ts`).

#### Tasks
- [x] Lock the 3 inner-corner junction slots at start (via `lockInnerCornerSlots` / `getInnerCornerCellIndexes` in `boardGeometry.ts`); the entrance/exit corner has no inner slot.
- [x] Add an "unlock corner slot" upgrade kind to `config.upgrades` and `UpgradeId` (`types.ts`); each pick opens one specific corner; stop offering once all 3 are open.
- [x] Offer slot unlocks through the normal upgrade pool first; do not make them guaranteed milestone rewards unless A4 proves the pool behavior hurts pacing.
- [x] Add an `unlockSlot` transition in the `simulation.ts` action processor that flips `slot.locked`.
- [ ] Render locked slots distinctly and signal they are unlockable (`RunScene.ts` slot rendering / `runSceneTowerRender.ts`).

#### Acceptance Criteria
- [x] All 3 corner slots start locked and reject placement.
- [x] Choosing the unlock upgrade opens exactly one corner; the opened slot accepts a tower and projects into 2 cells.
- [x] The option is skippable for an entire run with no errors; serialized save/resume preserves locked/unlocked state.

### A3 - Playtest / debug tooling (gated behind `?debug=1`)

A3 is a blocker for A4. The mixed-wave balance pass should not start in earnest until the minimum tooling is available: pinned seed, skip/jump to wave, jump to boss, core-HP lock, and fast-forward beyond 2x. Force-spawn enemy/reaction controls are useful for focused QA, but may follow after the minimum tooling if the balance loop is already fast enough.

#### Tasks
- [x] Build on the existing `?debug=1` HUD (`src/widgets/debug-hud/ui/DebugHud.vue`) and the unused `debugVisible` toggle (`simulation.ts`, `types.ts`).
- [x] Add minimum A4-blocking controls: pin seed, skip to wave, jump to boss, lock core HP (god mode), and extra fast-forward beyond 2x.
- [x] Add focused QA controls if still needed after the minimum loop: force-spawn enemy and force-spawn reaction.
- [x] Route all controls through the action processor + `gameEvents` bus (`src/shared/lib/event-bus/gameEvents.ts`) so the sim stays authoritative.

#### Acceptance Criteria
- [x] A full run can be exercised wave-by-wave (or jumped to boss) in seconds with a pinned seed.
- [x] A4 mixed-wave balance work does not begin until the minimum A3 controls are implemented and verified behind `?debug=1`.
- [x] Tooling has no effect when `?debug=1` is absent.

### A4 - Wave pacing, mixed waves, and upgrade cadence

Do not solve the exact cadence or wave table casually while re-enabling upgrades. Start the full A4 balance loop only after the A3 minimum debug tooling is available. The current player read is that the run tempo is too fast, enemy packs are too small, and the disabled-upgrade state masked an easy dominant path: after early waves, a player could pick random upgrades and stop placing towers around wave 3 while still winning.

#### Tasks
- [x] Audit the current 10-wave curve against real playthroughs and headless strategies: time per wave, leaks/kills, required placements, and whether upgrades make later choices trivial.
- [x] Redesign the wave table so waves 1-3 remain onboarding waves with somewhat larger packs, while later waves use 2-3 monster roles per wave: flyers, one heavier or faster pressure unit, and scaling common "meat" for that wave.
- [x] Account for the combat-system nuance that adding more enemies mostly stretches wave duration rather than linearly increasing required DPS; use mixed roles, HP/speed pressure, resistances, and timing overlaps to create decisions.
- [x] Decide upgrade cadence only after the revised wave pressure is sketched: every N waves, milestone waves, alternating tower/upgrade, or another rule.
- [x] Tie upgrade offerings and slot-unlock opportunities to the revised pressure curve so progression choices answer real upcoming problems instead of becoming free power.
- [x] Check whether slot unlocks remain discoverable and timely as normal random upgrade-pool offers; if not, decide and document a milestone-offer fallback.
- [x] Update `config.ts` wave definitions and `headlessRun.ts` scripted strategies once the curve is chosen.

#### Acceptance Criteria
- [x] Waves 1-3 teach and stretch the run slightly without requiring deep optimization.
- [x] Later non-boss waves regularly combine 2-3 enemy roles and force at least small placement/upgrade decisions.
- [x] Upgrade cadence, upgrade strength, and slot-unlock timing are justified by the revised wave curve.
- [x] The game can no longer be comfortably cleared by random upgrades and no meaningful tower placement after wave 3.

### A5 - Balance and wow-moment pass

#### Tasks
- [x] Tune the chosen upgrade cadence, upgrade magnitudes, slot-unlock value, and revised wave difficulty in `config.ts`.
- [ ] Validate the three wow moments fire in real runs: (1) ~10s electro-puddle melt, (2) mid-run storm chain, (3) T3 Огненный Шторм or the boss Reaction-Break climax.
- [ ] Decide the remaining T3 tuning question: make `Огненный Шторм` reachable often enough through normal slot/upgrade economy, now that its collision rule is fixed.
- [ ] Produce the C2 boss ability brief from the tuned run: at least one mandatory scripted set-piece and at least one mandatory telegraphed combat ability, without adding P1 adaptive resistance or other new P1 systems.

#### Acceptance Criteria
- [x] A competent run is winnable-but-tense; an underbuilt run can lose (headless weak/expected-win strategies still meaningful).
- [ ] The early electro-puddle melt and mid-run storm chain are reproducible in normal play; the final climax is reliable through T3 `Огненный Шторм`.
- [ ] If T3 still does not appear in balance runs after the collision rule, adjust slot/upgrade economy or authored strategy until it is no longer dead content.

### Phase A notes

- 2026-06-23: First implementation pass landed the pure-simulation Phase A foundation:
  - upgrade draft skip removed; upgrade picks are now gated by config milestone cleared waves `[2, 4, 6, 8]`;
  - waves moved from single enemy definitions to explicit `spawnGroups` with overlapping mixed-wave pressure;
  - the 3 inner corner slots now start locked and can be opened through authored unlock upgrades;
  - `?debug=1` HUD now drives reducer-owned debug sandbox actions, with debug actions ignored unless debug mode is active;
  - added `npm run balance:quick` / `npm run balance:run` (`tsx scripts/balance-runner.ts`) for pure headless balance reports.
- Implementation deviations: unlock upgrades are applied through the draft upgrade reducer path (`applyUpgradeToState`) rather than a normal player-facing `simulation.ts` action; `simulation.ts` still owns the debug-only direct unlock action. The first authored unlock is guaranteed as a normal upgrade offer until any unlock is taken, so unlock discoverability is intentionally stronger than a purely random pool.
- Balance reports (`npm run balance:quick`, `npm run balance:run`) now use a shared 2-cell electro opener, T2-oriented build orders, reaction coverage counts, `--seed-start`, and the experienced final-target gate `fireVortex >= 3 && (stormCloud >= 6 || fireVortex >= 6)`. Full 11x100 run separates the weak baseline (0% win, no T2) from planned T2 strategies: `fire-vortex-rush` 78% win / 80% target T2, `fire-vortex-water-spread` 77% / 80%, `experienced-human-final` 75% / 81%, `fire-control-runners` 66% / 65%. This is acceptable as the current balance baseline: experienced fire-vortex play is winnable without being automatic, while weak/no-T2 play fails. Follow-up tuning remains useful for Storm Cloud underperformance, early wave-4 variance, and improving scripted policies so the strict final-target gate can reproduce mature manual boards like seed 87000.
- 2026-06-24: A5 rule decision: `Огненный Шторм` is back as the intended final climax. The resolver now promotes neighboring accepted `Грозовое облако` + `Огненный вихрь` T2 pools into `fireStorm`, and the `fireStorm` spritesheet now has cyan lightning over the fire ring so it no longer reads as only another fire vortex. `npm run balance:quick` after the rule still reports `t3=0%`; the new `fire-storm-rush` policy survives some runs (`win=30%` quick sample) and forms large `stormCloud` coverage, but does not yet form `fireVortex`/`fireStorm`. Current balance implication: the rule is implemented, but slot/upgrade economy or the authored strategy still needs tuning before A5 can mark the T3 climax reliable.
- Automated baseline after this pass: `npm run lint:fix` green; `npm run typecheck` green; `npm run test` green with 8 files / 137 tests.

### Phase A completion summary

_(fill on completion)_

---

## Phase B - Feel and UI polish

Purpose: make the now-frozen gameplay feel good and finish all player-facing surfaces.

### B1 - Game-feel / juice layer (new)

#### Tasks
- [ ] Add floating damage numbers, enemy hit-flash, kill puff, screen shake on T3 / boss-break / core damage, and core-hit feedback.
- [ ] Drive juice off the `gameEvents` bus; render in the Phaser presenters (`RunScene.ts`, `RunSceneReactionPresenter`, `runSceneTowerRender.ts`).
- [ ] Respect the perf budget defined in `renderPerformance.ts`.

#### Acceptance Criteria
- [ ] Big reactions, kills, boss break, and core damage each have clear, satisfying feedback without tanking frame rate.

### B2 - Locale extraction

#### Tasks
- [ ] Move hardcoded Russian UI strings into a central locale file (RU-only). Covers `RunHud.vue`, result/draft/pause text, and Phaser-drawn labels.

#### Acceptance Criteria
- [ ] No user-facing string literals remain scattered in components; swapping the locale file changes all UI text.

### B3 - Finalize all UI

#### Tasks
- [ ] One polish pass over top + bottom in-run bars, draft cards, pause overlay, and victory/defeat result screens in `RunHud.vue` (+ CSS) after B2 locale extraction.
- [ ] Add a small mute button to the top HUD, wired to the (future) audio system; safe no-op until audio lands.

#### Acceptance Criteria
- [ ] Every UI surface reads as finished and consistent with the iron/brass skin; mute toggle present and persistent.

### B4 - Meta shell

#### Tasks
- [ ] Add a title screen (New run / Continue, reusing the existing save check in `persistence.ts`) and a credits panel, alongside `src/pages/game` and the router.

#### Acceptance Criteria
- [ ] App boots to a title screen; Continue resumes a saved run; credits reachable.

### Phase B notes

_(record divergences here)_

### Phase B completion summary

_(fill on completion)_

---

## Phase C - Assets and integration

Purpose: replace procedural placeholders with final art and give the boss its kit. Use `p05-visual-overhaul-plan.md` phases 7-9 as the asset-production subplan; p06 owns runtime integration, priority, and ship-readiness gates.

Ship gate: C1/C2 final enemy and boss runtime integration must be complete before public demo delivery. Phase A/B may proceed with procedural placeholders, and boss abilities may be prototyped before final art if they remain simulation/event-driven and do not leak renderer state into the model.

### C1 - Final monster assets + integration

#### Tasks
- [ ] Approve seed frames + facing model, animate move/hit/death, and replace procedural enemy shapes in `RunScene.ts` (~270-298).
- [ ] Wire through `src/shared/assets/manifest.ts` (`enemies.<id>.<anim>.<dir>` keys).

#### Acceptance Criteria
- [ ] All 7 enemy archetypes render as animated sprites with correct facing; no procedural fallback shapes in normal play.

### C2 - Final boss assets + abilities + animations

#### Tasks
- [ ] Final boss art + crawl / vulnerable / death animations (replaces the procedural ellipse, `RunScene.ts:314-379`).
- [ ] Design and implement the A5-approved boss kit in `boss.ts` (+ balance tuning): at least 1 telegraphed combat ability plus at least 1 bespoke scripted animation event (e.g. post-lap exit smash).

#### Acceptance Criteria
- [ ] Boss is fully animated; at least 1 combat ability is readable, telegraphed, and balanced; at least 1 scripted set-piece fires on its event.

### C3 - VFX decisions and asset optimization

#### Tasks
- [ ] For T3 `fireStorm`, decide whether the neighboring-pool climax needs a multi-cell pool underlay beyond the existing sprite VFX; add it only if the playtest/readability pass proves the extra layer is needed.
- [ ] Asset-size / load optimization pass for the web build.
- [ ] Run an early `npm run build` + static preview smoke after the major B/C integrations to catch base path, asset loading, mobile viewport, and audio gesture issues before final Phase D polish.

#### Acceptance Criteria
- [ ] All in-scope reactions have complete VFX; build asset size is reasonable for web; the early static build loads and plays through a smoke flow.

### Phase C notes

_(record divergences here)_

### Phase C completion summary

_(fill on completion)_

---

## Phase D - Onboarding, ship, and audio (last)

Purpose: first-run guidance, audio, and getting it live on real devices.

#### Tasks
- [ ] Hints (near end): contextual tips, building on the existing rare field-callout system.
- [ ] Small first-run tutorial (last): guided opening flow that teaches start wave, tower placement, reactions, draft choice, and why mixed threats require adapting the build. This is required for ship, but should wait until gameplay/UI are stable.
- [ ] Audio (very last, before final device QA): music/ambience, key SFX for placement/reactions/core damage/boss/UI, and persistent mute through the B3 mute button. Keep scope small: no settings screen, mixer, complex dynamic music, or large variant library.
- [ ] Deploy: produce the final self-hosted static build (`npm run build`) and host it.
- [ ] Real-device touch QA: tap targets, drag-to-place, frame rate under load, fullscreen, address-bar resize. Run an early smoke test on device too, not only at the end.

#### Acceptance Criteria
- [ ] A first-time player can understand the game without external help.
- [ ] Audio plays after valid mobile/browser user gestures, key events have sound feedback, mute persists, and the live build runs correctly on real phones.

### Phase D notes

_(record divergences here)_

### Phase D completion summary

_(fill on completion)_

---

## Open Questions

- **Draft cadence / upgrade pacing**: how often the upgrade pick appears (every 2nd wave vs milestone waves vs alternating tower/upgrade vs another rule), and how it relates to mixed-wave pressure. Decide during A4.
- **Mixed-wave curve**: exact composition for waves 4-10, including flyer pressure, heavy/fast pressure, and scaling common meat. Decide during A4 before final tuning.
- **T3 climax economy**: Огненный Шторм is the intended final wow; decide the slot/upgrade/strategy tuning needed to make it reachable in normal play after the new neighboring-pool collision rule.
- **Boss ability set**: which mandatory telegraphed combat ability and which mandatory scripted animation set-piece(s). Draft the brief during A5; finalize before C2.

## Verification

- `npm run typecheck` (vue-tsc + tsc) and `npm run test` (vitest) stay green after each phase; current baseline is 8 files / 137 tests.
- `npm run dev` + `?debug=1` to exercise playtest tooling and run full balance playthroughs.
- `npm run build` succeeds and the static output loads; manual real-device touch QA before ship.

## Housekeeping

- Covered by Phase 0.6 Preflight.
