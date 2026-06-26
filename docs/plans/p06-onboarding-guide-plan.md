# Phase 0.6D Onboarding Guide and Hints Plan

## Status

- Current phase: planning complete; implementation not started.
- Parent roadmap: `docs/plans/p06-finishing-and-ship-plan.md`, Phase D.
- Source docs: `docs/design.md`, `docs/setting.md`, `docs/plans/p06-finishing-and-ship-plan.md`.
- Goal: make the public demo understandable for a first-time player without external explanation by shipping a one-time Шмыг-led guided opening plus a lightweight field Шмыг companion.
- Product decision date: 2026-06-25.

## Agent Instructions

This document is both the implementation plan and the execution log for the onboarding guide and hints slice.

When working on this plan:

- Update checkboxes in this file as work is completed.
- Do not mark a checkbox complete until the behavior, asset, or test is implemented and verified at the level described.
- Keep core game rules in the existing serializable TypeScript simulation. Onboarding may observe `RunState`, but must not become part of `RunState` or alter balance rules.
- Store guide/hint UX progress separately from the run save. Do not mix it into `jam-td.run.v1`.
- Keep player-facing text in Russian Шмыг voice from `docs/setting.md`; add new UI strings to `src/shared/i18n/ru.ts`, not inline component literals.
- Use UTF-8 without BOM for all new or modified text files.
- Prefer `npm run lint:fix` over a plain lint run.
- Do not revert unrelated worktree changes. At planning time the worktree already has unrelated changes in simulation/test files.
- If implementation diverges from this plan, record it in the relevant phase's "Phase notes" before moving on.
- At the end of each phase, fill in "Phase completion summary": what was implemented, what was deferred, tradeoffs/deviations, and checks run.

Logging rule:

- Every implementation session should add a dated note under the active phase before marking that phase complete.
- Notes should mention concrete artifacts, not every touched file. Example: "2026-06-25: Added guide progress persistence under `jam-td.onboarding.v1`, action guard unit tests, and a debug reset hook. Checks: `npm run lint:fix`, `npm run test`."

## Context

The game already has:

- A Vue DOM HUD with blocking overlays for draft and results in `src/widgets/run-hud/ui/RunHud.vue`.
- Direct Phaser pointer handling in `src/app/phaser/scenes/RunScene.ts`; slot taps currently call `applyAction` directly, so a DOM-only tutorial overlay is not enough to freeze input safely.
- Serializable run persistence in `src/entities/game-session/model/persistence.ts` under `jam-td.run.v1`.
- Central RU strings in `src/shared/i18n/ru.ts`.
- Rare field callouts in `src/app/phaser/scenes/runSceneReactionPresenter.ts` for reaction reveals, boss Reaction Break, and core danger.
- Шмыг voice rules and sample lines in `docs/setting.md`.

## Key Decisions

- The full guide is shown only once per guide version.
- "Shown once" means: resume while incomplete on the same run; reset an unfinished guide when a new run starts; stop forever after final completion. The first-run guide is mandatory and has no visible skip control.
- The completion marker is persisted separately from the run save, so starting a new run does not re-open the full guide after completion.
- The guide freezes the interface by allowing only the current target action. Rendering and snapshots continue so target cursor, Шмыг animation, and combat feedback remain alive.
- Contextual hints are separate from the full guide. They may appear after the guide is completed, but they use their own dedupe and cooldown rules.
- Existing field callouts stay rare and event-driven. Do not turn them into long tutorial messages.
- Шмыг is a visible character asset, not just a text label. His seed and core animation set are implemented before the guide state machine so the first integration slice already shows the intended guide voice.

## Out of Scope

- New gameplay rules, balance changes, waves, upgrades, or reactions.
- A settings screen, codex, glossary, long help page, or replayable tutorial menu.
- Full accessibility redesign beyond preserving readable text, focus order, labels, and touch targets for the new guide UI.
- Multi-language support; ship RU-only through the existing locale structure.
- Complex branching narrative. The guide may branch only for mechanical recovery, such as if the player already performed a target action before the step is displayed.

## Architecture Contracts

- Add onboarding state and rules under `src/entities/onboarding/model`.
- Add visual guide UI under `src/widgets/onboarding-guide/ui`.
- Keep text-heavy guide UI in DOM. Use Phaser only for field highlights or small guide markers that must align to board coordinates.
- Add a single guided-action guard used by both Vue-dispatched actions and Phaser pointer actions.
- The guard should be pure and testable: given onboarding state, snapshot, and action, return `allow`, `block`, or `completeStepThenAllow`.
- Debug controls remain available only behind `?debug=1`; if they need to bypass the guide, that bypass must be explicit and tested.

## Phase O0 - Baseline and Parent Plan Link

Purpose: record the worktree baseline and make this subplan discoverable from p06 before implementation starts.

### Tasks

- [x] Record current `git status --short` in Phase notes before touching implementation files.
- [x] Link this subplan from `docs/plans/p06-finishing-and-ship-plan.md` Phase D.
- [x] Confirm the parent Phase D task wording still matches the split between full guide, hints, deploy, and device QA. Audio is closed separately and is no longer onboarding-adjacent ship work.

### Acceptance Criteria

- [x] A future agent can find this plan from p06.
- [x] The implementation starts from an explicit dirty/clean worktree note.

### Phase O0 notes

- 2026-06-25 planning baseline: before creating this file, `git status --short` showed unrelated modified files in `src/entities/game-session/model/config.ts`, `src/entities/game-session/model/damage.ts`, `src/entities/game-session/model/reactions.ts`, and `tests/game-session.test.ts`.

### Phase O0 completion summary

Phase O0 completed during planning. The subplan now exists as a separate roadmap, p06 Phase D links to it, and the pre-existing dirty worktree baseline is recorded above.

---

## Phase O1 - Шмыг Asset First

Purpose: make Шмыг visible at the start of implementation so the guide has an approved character presence before UX wiring begins.

Stop gate: do not build the full guide UI around a placeholder portrait unless the user explicitly accepts a temporary visual. The seed frame should be approved before animation-strip generation.

### Tasks

- [x] Write the Шмыг seed prompt/spec from `docs/setting.md`: small soot-stained goblin зельевар-мастеровой, respectful/nervous expression, workshop clothing, readable face, transparent background, production sprite tone.
- [x] Generate 2-4 seed candidates and save approved sources under `public/assets/guides/shmyg/source/` or an agreed output approval folder before runtime copy.
- [x] Get user approval for one seed frame before animation work.
- [x] Normalize the approved seed to a fixed transparent frame size suitable for DOM sprite rendering.
- [x] Generate and normalize the minimum guide animation set: `idle`, `talk`, `excited`, `angry`.
- [ ] Optionally add `panic` and `pleased` if the first four states read well and budget permits.
- [x] Render an approval preview sheet and inspect it at mobile HUD scale.
- [x] Add manifest or CSS asset references for the approved sprite sheets.
- [x] Add a small Shmyg-only fixture or temporary component state so the asset can be viewed before the full guide flow exists.

### Acceptance Criteria

- [x] Шмыг has an approved seed frame and at least four normalized transparent sprite strips.
- [x] The character reads at phone scale without covering the playfield.
- [x] The approved asset paths and any generation notes are recorded in Phase notes.

### Phase O1 notes

_(record asset approvals, rejected directions, final paths, and preview checks here)_

- 2026-06-25: Added the seed prompt/spec at `public/assets/guides/shmyg/source/shmyg-seed-prompt.md`. Generated four built-in image candidates on chroma-key backgrounds, copied sources to `public/assets/guides/shmyg/source/shmyg-seed-candidate-0{1..4}-source.png`, and cleaned alpha previews to `public/assets/guides/shmyg/source/shmyg-seed-candidate-0{1..4}-alpha.png`. Preview sheet for approval and phone-scale read check: `public/assets/guides/shmyg/preview/shmyg-seed-candidates-preview.png`. Alpha validation: all candidate PNGs are RGBA with transparent corners. Stopped at the planned user-approval gate before animation-strip generation.
- 2026-06-25: First seed direction rejected: candidates read too beaten-down/frightened and should be waist-up. Added revised prompt `public/assets/guides/shmyg/source/shmyg-seed-prompt-v2.md` for a confident half-body goblin workshop master with broad folktale house-gnome energy, without copying a specific published design. Generated v2 sources at `public/assets/guides/shmyg/source/shmyg-seed-v2-candidate-0{1..4}-source.png`, cleaned alpha files at `public/assets/guides/shmyg/source/shmyg-seed-v2-candidate-0{1..4}-alpha.png`, and previewed them at `public/assets/guides/shmyg/preview/shmyg-seed-v2-candidates-preview.png`. Alpha validation: all v2 candidate PNGs are RGBA with transparent corners.
- 2026-06-26: Approved `V2 Candidate 1` as the Шмыг seed. Normalized the approved half-body seed to `public/assets/guides/shmyg/shmyg-seed-approved-384.png` and generated four 4-frame transparent 384x384 DOM sprite strips: `shmyg-idle-strip.png`, `shmyg-talk-strip.png`, `shmyg-excited-strip.png`, and `shmyg-worried-strip.png`. Added `guides` entries to the asset manifest, `ShmygSprite.vue` for CSS strip playback with reduced-motion fallback, and `/onboarding-guide-demo` as the pre-guide fixture. Preview sheet: `public/assets/guides/shmyg/preview/shmyg-approved-strips-preview.png`. Browser QA screenshots: `output/playwright/shmyg-onboarding-demo-390.png` and `output/playwright/shmyg-onboarding-demo-360.png`. Checks: `npm run lint:fix`, `npm run typecheck`, `npm run build`.
- 2026-06-26: Post-approval asset correction after review: kept the calm/idle Шмыг as the identity anchor, reduced the talk mouth so it no longer reads as a broken open face, removed the face halo from `excited`, and replaced `excited` with a clearer generated raised-hands / broad-smile pose strip. Updated preview sheet and refreshed `output/playwright/shmyg-onboarding-demo-360.png`.
- 2026-06-26: Reworked the state contract after review: `worried` was removed because an anxious Шмыг is unlikely to be used, and `angry` was added instead. Regenerated runtime strips as 12-frame 384x384 sequences: `shmyg-idle-strip.png`, `shmyg-talk-strip.png`, `shmyg-excited-strip.png`, and `shmyg-angry-strip.png`. `talk` now uses a speaking-head mouth cycle, `excited` uses one clear raised-hands grin pose with smooth bounce, and `angry` uses a generated scolding pose with contained shake/heat marks. Updated preview sheet: `public/assets/guides/shmyg/preview/shmyg-12-frame-strips-preview.png`.
- 2026-06-26: Updated runtime CSS and demo labels for the 12-frame contract: `ShmygSprite` now plays 12-frame strips with `steps(11)`, and `/onboarding-guide-demo` shows `idle`, `talk`, `excited`, and `angry`. Refreshed QA screenshots: `output/playwright/shmyg-onboarding-demo-360.png` and `output/playwright/shmyg-onboarding-demo-360-tall.png`. Checks: `npm run lint:fix`, `npm run typecheck`.
- 2026-06-26: User approved the final 12-frame Шмыг set (`idle`, `talk`, `excited`, `angry`) for O1.

### Phase O1 completion summary

Phase O1 completed with `V2 Candidate 1` as the approved confident waist-up Шмыг direction. Runtime assets now include the approved 384x384 seed and 12-frame `idle`, `talk`, `excited`, and `angry` strips; `worried` was intentionally replaced by `angry` after review, and `panic`/`pleased` remain deferred. A standalone `/onboarding-guide-demo` fixture verifies the character at DOM and phone HUD scale before the full onboarding flow exists. The first generated direction was intentionally rejected for reading too frightened, and that deviation is recorded above.

---

## Phase O2 - Onboarding State, Persistence, and Script Data

Purpose: create the guide/hint state model without coupling it to the game simulation save.

### Tasks

- [x] Add onboarding model types: `GuideStatus`, `GuideStepId`, `GuideStep`, `GuideProgress`, `HintId`, `HintProgress`.
- [x] Add `ONBOARDING_STORAGE_KEY`, starting with `jam-td.onboarding.v1`.
- [x] Add load/save helpers with malformed-payload fallback.
- [x] Add version handling: if guide version changes, full-guide progress can reset while old malformed state is ignored safely.
- [x] Add pure script data for the first guide version.
- [x] Add pure completion predicates that inspect the latest runtime snapshot.
- [x] Add pure target-action predicates for action-locked steps.
- [x] Add a debug-only reset entrypoint so QA can replay the guide without clearing all localStorage manually.

### Acceptance Criteria

- [x] Full guide progress resumes after refresh while incomplete.
- [x] Completion and explicit skip persist and prevent future full-guide auto-open for the same guide version.
- [x] Corrupt onboarding storage does not break app boot.
- [x] Unit tests cover load/save, version reset, completion, skip, and corrupt payload handling.

### Phase O2 notes

- 2026-06-26: Added the pure onboarding model under `src/entities/onboarding/model`: typed guide/hint progress, `jam-td.onboarding.v1` persistence with malformed-payload fallback, guide-version reset, guide progress helpers, first `guide-v1` script data, snapshot completion predicates, target-action predicates, and a debug-gated reset entrypoint. Added RU guide copy under `ru.onboarding.guide.steps`. Added `tests/onboarding.test.ts` for load/save/clear, corrupt storage, version reset, complete/skip auto-open suppression, debug reset, guide completion predicates, and target-action predicates. Updated the asset manifest category test to include the existing `guides` asset group from O1. Checks: `npm run lint:fix`, `npm run typecheck`, `npm run test`, `npm run build`.

### Phase O2 completion summary

Phase O2 completed as a serializable, renderer-independent onboarding model. The full guide progress now lives outside `jam-td.run.v1`, resumes while incomplete, and stops auto-opening after completion or explicit skip for `guide-v1`. Version changes reset only the full-guide progress while preserving valid hint dedupe data, and corrupt storage falls back to initial progress without breaking boot. The script and predicates are pure data/functions so O3 can wire the action guard into Vue and Phaser without moving state into the simulation save.

---

## Phase O3 - Guided Action Guard and Integration

Purpose: implement the actual "freeze" behavior as a shared action gate, not just as pointer-events on an overlay.

### Tasks

- [x] Add a pure `evaluateGuidedAction(...)` helper that receives onboarding progress, runtime snapshot, and a proposed action.
- [x] Return an explicit result: allowed, blocked, or allowed with guide-step completion.
- [x] Add guide-aware action dispatch for Vue HUD actions.
- [x] Use the same guard in `RunScene` before direct `tap` / `tapSlot` handling.
- [x] Keep mute usable during the guide.
- [x] Decide and implement whether pause is blocked during scripted steps. Recommended default: block pause except on observation steps or after the first wave starts.
- [x] Ensure debug-only actions are either blocked by default during the guide or bypassed only when `?debug=1` is active.
- [x] Add tests for guard behavior across HUD actions and slot taps.

### Acceptance Criteria

- [x] During a target-action step, non-target gameplay actions do not mutate run state.
- [x] The target action still reaches the existing simulation reducer and remains authoritative.
- [x] Phaser slot taps cannot bypass the guide.
- [x] Existing headless simulation and balance scripts remain unaffected by onboarding code.

### Phase O3 notes

- 2026-06-26: Added the pure `evaluateGuidedAction` guard under `src/entities/onboarding/model/guard.ts`, returning `allow`, `block`, or `completeStepThenAllow`. Integrated it in `RunScene` for both DOM-dispatched `run:action` events and direct Phaser `tap` / `tapSlot` pointer actions; blocked actions emit `onboarding:action-blocked` for the O4 nudge UI. Target actions still pass through the existing `applyAction` reducer, and guide steps are persisted only after the post-action snapshot satisfies the completion predicate. Mute remains outside the guarded `GameAction` path. Pause is blocked during pre-wave blocking steps, `resume` is always allowed, and pause is allowed once runtime is in `wave` or `boss`; non-blocking observation steps allow normal actions. Debug-only actions are blocked during the guide unless the URL has `?debug=1`. Auto-opening the guide is intentionally deferred until O4 adds the visible guide controls, so O3 cannot strand the player behind an invisible intro step. Checks: `npm run lint:fix`, `npm run typecheck`, `npm run test`, `npm run build`.

### Phase O3 completion summary

Phase O3 completed with a shared guided-action gate at the runtime input boundary. Vue HUD actions, Debug HUD actions, and Phaser slot taps now share the same onboarding decision logic, while the serializable simulation reducer and headless tests remain independent of onboarding state. The guard supports recovery when a step is already complete before the next action, blocks non-target gameplay mutations during scripted target steps, permits explicit debug bypass only in `?debug=1`, and leaves audio mute usable because it is not a `GameAction`.

---

## Phase O4 - Full Guide UI

Purpose: ship the visible Шмыг-led guide layer on top of the existing game page/HUD.

### Tasks

- [x] Add `OnboardingGuide.vue` under `src/widgets/onboarding-guide/ui`.
- [x] Mount the guide in `GamePage.vue` above `RunHud` only after a run has started.
- [x] Add a compact Шмыг bubble layout that preserves the center playfield and lower-middle field.
- [x] Add a short intro state with continue.
- [x] Add target cursor indicators for DOM controls, tower bench cards, draft cards, and field slots.
- [x] Add a blocked-action nudge so forbidden taps give feedback without advancing the step.
- [x] Add responsive CSS for the 360px mobile target and the 540px stage.
- [x] Respect `prefers-reduced-motion` for non-essential Шмыг animation.
- [x] Put all guide strings in `ru.onboarding`.

### Acceptance Criteria

- [x] The guide visually matches the iron/brass UI skin and Шмыг voice.
- [x] Text fits on 360px-wide mobile without overlapping controls.
- [x] The guide never covers the current target in a way that prevents the required action.
- [x] The first-run guide has no visible skip control, per product decision.

### Phase O4 notes

- 2026-06-26: Added `OnboardingGuide.vue` as the visible DOM guide layer with Шмыг sprite, compact iron/brass speech bubble, intro continue, storage-backed auto-start, snapshot-driven step sync, DOM target cursor, one concrete field-slot cursor, and `onboarding:action-blocked` nudge feedback. Mounted it in `GamePage.vue` after `RunHud` only while a run is active, and added `data-onboarding-*` target attributes to primary HUD action, bench cards, tower draft cards, and upgrade draft cards. Added RU guide controls/nudge strings under `ru.onboarding.guide`. Field placement cursor intentionally chooses one visible central valid slot until O5 provides the exact opening placement helper. Browser QA screenshots: `output/playwright/onboarding-o4-360-intro.png`, `output/playwright/onboarding-o4-360-select-water.png`, `output/playwright/onboarding-o4-360-nudge.png`, `output/playwright/onboarding-o4-360-field-targets.png`, and `output/playwright/onboarding-o4-540-intro.png`. Checks: `npm run lint:fix`, `npm run typecheck`, `npm run test`, `npm run build`; Playwright smoke on `http://127.0.0.1:5197` covered clean first open, continue, no visible skip button, DOM cursor, blocked nudge, field cursor, and 540px intro.
- 2026-06-26: Product correction after UI review: removed the visible skip button because the initial guide should not be skippable, and replaced outline/ring highlighting on cards and field slots with a single animated cursor-and-tap-ring target indicator that points at the exact current click target. Split guide styles to `OnboardingGuide.css` to keep the Vue component under lint limits.
- 2026-06-26: Fixed stale guide progress on new runs: `restart` actions now reset unfinished or legacy-skipped guide progress back to the first step while preserving completed guide markers. This prevents an old localStorage `stepId` from freezing input in a fresh run.
- 2026-06-26: UI correction after screenshot review: moved Шмыг to the right side of the guide text and increased the DOM sprite size from 76/88px to 96/112px so the avatar reads better at phone scale.
- 2026-06-26: UI correction after follow-up review: expanded the guide bubble backing to include both the text and Шмыг, so the character now sits on the same iron/brass substrate instead of floating outside the panel.
- 2026-06-26: UI correction after follow-up screenshot review: aligned the guide speaker label and message to the top of the shared bubble while keeping Шмыг anchored independently in the right column.
- 2026-06-26: Fixed the field cursor after first tower placement: placement targets now exclude occupied slots, and the spark step prefers a free slot that produces `electroPuddle`, with a tie-break toward the opposite outer slot paired with the placed water tower.
- 2026-06-26: Fixed a premature draft-step freeze: `observeElectroPuddle` now waits until electro-puddle damage has happened and the tower draft UI is actually available before advancing to `draftTowerPick`. Added a guard fallback so stale `draftTowerPick` / `draftUpgradePick` progress cannot block combat before the corresponding draft screen exists. Browser QA screenshot: `output/playwright/onboarding-o4-observe-during-wave-fixed.png`.

### Phase O4 completion summary

Phase O4 completed with the first visible Шмыг-led guide surface. The guide starts once through the existing onboarding storage, is mandatory for first-time players, advances manual continue steps, reflects reducer-driven step completion through snapshots, and provides target cursor feedback without moving guide state into `RunState`. The layout is compact and responsive on 360px and 540px captures; exact authored water/spark placement is deferred to O5, but O4 now avoids occupied slots and prefers a reaction-producing spark placement instead of a purely central field target.

---

## Phase O5 - Guide Script v1

Purpose: implement the concrete one-time guided opening.

The script should be short. Each step teaches one action or one discovery through Шмыг, not an abstract paragraph.

### Proposed Step Table

| Step id | Target | Completion signal | Notes |
|---|---|---|---|
| `panicIntro` | Continue | Player continues | Angry Шмыг panic beat: "НА НАААС НАПААААЛИИИИИ!!!" |
| `shmygIntroduction` | Continue | Player continues | Шмыг introduces himself and the siege. |
| `siegeProblem` | Continue | Player continues | Explains that existing mechanisms do not attack directly. |
| `surfacePlan` | Continue | Player continues | Explains the surface/reaction defense plan. |
| `selectFirstWater` | Select a `water` bench tower | `selectedTowerId` is a water tower | Highlight matching bench card. |
| `placeFirstWater` | Place selected water tower on authored opening slot | Water tower placed on target slot | Target slot should be derived from an opening placement helper. |
| `selectFirstSpark` | Select a `spark` bench tower | `selectedTowerId` is a spark tower | Keep copy focused on mixing, not DPS. |
| `placeFirstSpark` | Place spark where it overlaps water coverage | First `electroPuddle` can form | Do not depend on brittle hardcoded geometry if a helper can derive it. |
| `selectSecondWater` | Select the remaining `water` bench tower | `selectedTowerId` is a water tower | Teach extending a reaction before the first wave starts. |
| `placeSecondWater` | Place water on a neighboring slot that extends the puddle | At least two `electroPuddle` cells exist | Target should be derived from reaction extension, not just proximity. |
| `startFirstWave` | Press Start | Phase changes from `ready` to `wave` | Other actions blocked. |
| `observeElectroPuddle` | No required action | First `electroPuddle` visible or first kill from it | Allow pause/mute if needed; advance automatically. |
| `draftTowerPick` | Choose `heat` / Магмовый кран from the tower draft before wave 3 | Heat draft tower chosen | Draft before wave 2 explicitly excludes `heat`; draft before flyers guarantees it. |
| `draftUpgradePick` | Choose any upgrade draft card, preferably slot unlock if offered | Draft upgrade step completed | Mention upgrades/locked corners only if relevant to current offer. |
| `selectHeatForSteam` | Select the new `heat` bench tower | `selectedTowerId` is a heat tower | This happens during frozen countdown before wave 3. |
| `placeHeatForSteam` | Place heat on the current spark slot | Heat replaces spark and creates `steam` | Teaches water+heat as the flying answer. |
| `flyerSteamPreview` | Continue | Player acknowledges flyer prep | Move enemy-icon guidance here: the flyer telegraph motivates steam. |
| `waitFlyerWaveClear` | Hidden wait | Wave 3 ends and the next draft opens | Guide stays invisible while the player fights flyers. |
| `finalAfterFlyers` | Continue | Player continues | Final excited handoff after the flyer wave; completion happens after this click. |
| `complete` | None | Mark full guide complete | Persist completion immediately. |

### Tasks

- [x] Implement an opening placement helper that chooses a valid water/spark placement pair for the current board/config.
- [x] Add fallback logic if the player somehow creates the required reaction before the current step.
- [x] Implement the proposed step table or record deviations in Phase notes.
- [x] Tune copy so each line is short, in Шмыг voice, and action-specific.
- [x] Ensure guide completion is written immediately after `complete`.

### Acceptance Criteria

- [x] Clean first run walks through tower selection, placement, reaction creation, wave start, first draft, first upgrade, and mixed threat preview.
- [x] Refreshing mid-guide resumes at the correct step.
- [x] The mandatory guide has no visible skip path and never leaves input frozen.
- [x] Completing the guide prevents it from appearing on later new runs for the same version.

### Phase O5 notes

- 2026-06-26: Initial O5 draft pass targeted `heat` / Магмовый кран in the first tower draft, but that timing was later revised so the heat lesson happens before wave 3 instead.
- 2026-06-26: Added the second-water opening beat before the first wave: after forming the first `electroPuddle`, the guide selects the remaining water tower and targets only a neighboring placement that increases `electroPuddle` coverage to at least two cells.
- 2026-06-26: Added an angry first `panicIntro` continue step with the line "НА НАААС НАПААААЛИИИИИ!!!" before the calmer intro.
- 2026-06-26: Replaced the old single `intro` step with three opening continue beats: `shmygIntroduction`, `siegeProblem`, and `surfacePlan`, so Шмыг introduces himself, explains the siege, and frames the surface-based defense plan before tower selection starts.
- 2026-06-26: Revised the heat timing: the draft before wave 2 now guarantees no `heat`, so the player can choose any non-heat tower there. The guide waits silently through that draft and wave 2, then resumes on the draft before wave 3 where `heat` is guaranteed. Added `selectHeatForSteam`, `placeHeatForSteam`, and `flyerSteamPreview`; the final flyer line now carries the enemy-icon reminder and explains that heated steam is the answer to flying enemies. Countdown is held during blocking guide steps so the player can place the crane before wave 3 starts.
- 2026-06-26: Added the post-flyer ending: after `flyerSteamPreview`, the guide moves to a hidden `waitFlyerWaveClear` step and stays invisible through wave 3. When the next draft opens after the flying enemies are beaten, `finalAfterFlyers` appears with `pose=excited`; pressing "Дальше" on that final line completes the full guide.
- 2026-06-26: Finalized O5 technical debt without changing the guide's story beats. Added a pure opening placement helper under `src/entities/onboarding/model/openingPlacement.ts` that derives the water/spark/second-water line, reuses the same target for the guide cursor and guided-action guard, and handles the heat-on-spark steam replacement. Removed duplicated reaction-slot heuristics from `OnboardingGuide.vue`. Added tests for the derived opening line and exact guarded slot acceptance, and lightly cleaned RU copy punctuation/spacing without changing the scenario. Browser smoke on `http://127.0.0.1:5206` completed a clean first guide through post-flyer completion and captured `output/playwright/onboarding-o5-completed-390.png`; a separate smoke verified refresh resume at `selectFirstSpark`, no visible skip control, and completed-guide no-reopen. Checks: `npm run lint:fix`, `npm run typecheck`, `npm run test`, `npm run build`.
- 2026-06-26: Corrected the opening placement helper ranking after review: the helper now preserves the intended left entrance path `slot-2-inner` -> `slot-2-outer` -> `slot-3-inner` instead of drifting to the symmetric right-side slots. Added an exact regression assertion for that line. Checks: `npm run test -- tests/onboarding.test.ts`, `npm run lint:fix`, `npm run typecheck`, `npm run test`, `npm run build`.

### Phase O5 completion summary

Phase O5 completed with the guide script locked to the intended opening: panic intro, Шмыг setup, water/spark/second-water electro-puddle setup, first wave, silent non-heat draft before wave 2, guaranteed heat draft before wave 3, heat-for-steam placement, flyer preview, hidden flyer-wave wait, and final handoff. The main implementation correction was moving slot selection into a pure shared helper so the visual cursor and input guard agree on the exact allowed placement. The guide still has no visible skip path, resumes mid-guide after reload, completes only after the post-flyer final line, and stays completed for later new runs of `guide-v1`. O6 is now the field Шмыг companion, replacing the older contextual hints chip idea.

---

## Phase O6 - Field Shmyg Companion v1

Purpose: replace the old non-blocking contextual hints chip with a small living field Шмыг companion. After the guide, he appears as a tiny Phaser-owned field sprite on the outer perimeter, runs between tower groups, occasionally comments on events, and rarely gives useful hints. He is presentation-only: no combat rules, save schema, wave config, or onboarding guide flow changes.

### Tasks

- [x] Add the asset approval gate before runtime implementation.
- [x] Generate the first simplified field Шмыг run/right reference and review it in a dedicated demo page.
- [x] Approve the field Шмыг direction as the V1 reference for size, silhouette, motion, and identity.
- [x] Run production cleanup for the approved `run/right` reference direction: remove stray edge fragments from neighboring limbs/frames before using it as a shipped strip.
- [x] Generate and normalize the separate field asset set, without reusing the DOM guide portrait strips:
  - `idle`, `run`, `joy`;
  - directions `up`, `down`, `left`, `right`;
  - 12 strips total, 8 frames each;
  - frame `128x128`, transparent background, bottom-center anchor;
  - Phaser manifest usage, not CSS-only.
- [x] Add manifest entries with `guides.shmyg.field.<state>.<direction>` keys and `usage: "phaser"`.
- [x] Add a Phaser presenter in `RunScene` with presentation-only state: position, target route point, animation state, facing, and hold timers.
- [x] Do not write field Шмыг state to `RunState`, run saves, or onboarding storage.
- [x] Keep his movement and animation running while the run is paused.
- [x] Route only through `BoardSlot.lane === "outer"` points; never cross the road.
- [x] Group tower destinations by outer side/segment instead of visiting every individual tower.
- [x] Use the default loop: run to a tower group, idle for 10-15 seconds, then run to the next group.
- [x] If there are no towers, route to the fallback point near the upper-left outer segment, approximately `x=76,y=225`.
- [x] Spawn rules:
  - if the full guide is active, do not show field Шмыг until the guide is complete and not before wave 4;
  - if the full guide is already complete or inactive, spawn after wave 1;
  - the flyer hint before wave 3 only works when the full guide is inactive.
- [x] Add DOM speech bubble anchored to field Шмыг screen position, with no bubbles over draft/result/title surfaces.
- [x] Add localized lines under `ru.onboarding` or `ru.companionShmyg`; do not write speech inline.
- [x] Speech rules:
  - 1-2 short lines;
  - global cooldown 20 seconds;
  - important hints max 1 per wave;
  - same important hint not more often than every 90 seconds and max 2 times per run;
  - filler only after 35+ seconds without speech;
  - no persistent dedupe in V1.
- [x] V1 line bank:
  - no towers after field Шмыг appears;
  - warning about flyers before wave 3;
  - first T2 and first T3 reaction moments;
  - boss arrival and first boss ability;
  - core danger after Куб damage;
  - rare semi-useful in-fiction or lightly meta filler.

### Acceptance Criteria

- [ ] Field Шмыг is non-interactive and never blocks tower placement or pointer input.
- [ ] He stays on outer route targets and does not cross the road.
- [ ] His animation continues on pause.
- [ ] He is hidden until the correct wave/guide state.
- [ ] Speech is readable but rare and never appears above draft/result/title.
- [ ] Flyer hint fires only when the full guide is inactive.
- [x] Unit tests cover spawn timing, no-towers fallback, outer-only route selection, flyer-hint gating, cooldowns, and repeat limits.
- [x] Asset/manifest tests confirm all 12 production strips exist and preload through Phaser usage.

### Phase O6 notes

- 2026-06-26: Replaced the old `Contextual Hints` chip plan with `Field Shmyg Companion v1`. Added `/field-shmyg-demo` as an approval fixture using the first simplified `run/right` strip at `public/assets/guides/shmyg/field/shmyg-field-run-right-demo-01.png`. User approved the direction for size, silhouette, motion, and identity. Known issue: the generated strip had minor edge fragments from neighboring limbs/frames. Approved visual reference copy: `public/assets/guides/shmyg/field/shmyg-field-run-right-approved-reference-01.png`.
- 2026-06-26: Cleaned the approved `run/right` strip by keeping only the main alpha-connected component per 128x128 frame, removing 95 stray alpha pixels across frames 2, 3, 6, and 7. Cleaned strip: `public/assets/guides/shmyg/field/shmyg-field-run-right-clean-01.png`. `/field-shmyg-demo` now previews the cleaned strip.
- 2026-06-26: Added pure field companion decision logic under `src/entities/onboarding/model/fieldCompanion.ts`, covering spawn gates, no-towers fallback, outer route target grouping, flyer hint gating, and renderer-local speech cooldown/repeat rules. Added `tests/field-shmyg-companion.test.ts`.
- 2026-06-26: Created the first full technical field asset set from the approved cleaned reference: 12 Phaser strips under `public/assets/guides/shmyg/field/shmyg-field-<state>-<direction>.png`, with `idle`, `run`, and `joy` across `up`, `down`, `left`, and `right`, 8 frames each at `128x128`. Added manifest keys `guides.shmyg.field.<state>.<direction>` with `usage: "phaser"` and asset-manifest coverage. This is a derived V1 set to unblock runtime integration; `up/down` are side-art-derived technical variants, not freshly redrawn camera angles. Preview sheet: `public/assets/guides/shmyg/field/shmyg-field-v1-derived-strips-preview.png`.
- 2026-06-26: Added `RunSceneFieldShmygPresenter` and registered field Шмыг Phaser animations. The presenter keeps only renderer-local state, uses the pure spawn/route helpers, idles 10-15 seconds per target, and renders the no-towers fallback at the upper-left outer area. Browser smoke on `/?debug=1` confirmed the sprite appears with completed guide progress and no console/page errors. Screenshot: `output/playwright/field-shmyg-runtime-smoke-collapsed-390.png`; crop: `output/playwright/field-shmyg-runtime-fallback-crop.png`.
- 2026-06-26: Added the DOM `FieldShmygCompanion` bubble anchored to Phaser-published field Шмыг position events. Added localized line banks under `ru.onboarding.fieldCompanion` for no towers, wave-3 flyers, first T2/T3 reactions, boss arrival/ability, core danger, and filler. The bubble uses renderer-local speech memory and hides on draft/victory/defeat surfaces. Browser smoke confirmed compact bubble placement and no console/page errors: `output/playwright/field-shmyg-bubble-smoke-390.png`.
- 2026-06-26: Split the generic first-T2 companion reaction line into separate triggers and line banks for `stormCloud` and `fireVortex`.
- 2026-06-26: Added rare combo-filler lines for newcomer discovery: `steam + spark -> stormCloud`, `fire + steam -> fireVortex`, and `stormCloud + fireVortex -> fireStorm`. These use filler timing, but each is one-shot per run and is suppressed once the corresponding reaction has appeared in the current run. `stormCloud`/`fireVortex` combo fillers are gated until wave 5, and `fireStorm` until wave 7.

### Phase O6 completion summary

_(fill on completion)_

---

## Phase O7 - QA, Device Pass, and Ship Gate

Purpose: prove the guide and field Шмыг companion work on the actual mobile-first demo surface.

### Tasks

- [ ] Add unit tests for persistence, guide state transitions, action guard, opening placement helper, and field companion rules.
- [ ] Add or update component tests if the project already has the tooling; otherwise record why manual/Playwright coverage is used instead.
- [ ] Run a clean-localStorage browser smoke: title -> new run -> full guide -> first draft -> completion marker.
- [ ] Run a refresh-mid-guide smoke and verify resume.
- [ ] Run a mandatory-guide smoke and verify no visible skip control.
- [ ] Run a completed-guide smoke and verify a new run does not reopen the full guide.
- [ ] Capture mobile screenshots at 360px and 540px widths.
- [ ] Run final checks: `npm run lint:fix`, `npm run typecheck`, `npm run test`, `npm run build`.

### Acceptance Criteria

- [ ] A first-time player can understand the opening loop without external help.
- [ ] The guide never deadlocks input.
- [ ] Field Шмыг speech appears only when useful and does not obscure core combat reading.
- [ ] Mobile screenshots show no text overlap or target occlusion.
- [ ] Required checks are green or documented with a clear blocker.

### Phase O7 notes

_(record smoke results, screenshots, and final checks here)_

### Phase O7 completion summary

_(fill on completion)_

---

## Open Questions

- Exact Шмыг sprite frame size: decide during O1 after the seed reads at HUD scale.
- Guide intro skip decision: no visible skip control; the first-run guide is mandatory as of 2026-06-26.
- Whether `pause` is allowed during `observeElectroPuddle`: recommended yes, but confirm through implementation QA.
- Whether mixed-threat explanation belongs at the end of the full guide or as the first field Шмыг hint after guide completion: start in full guide, move to companion speech only if the flow feels too long.

## Verification

Baseline commands for this slice:

- `npm run lint:fix`
- `npm run typecheck`
- `npm run test`
- `npm run build`

Browser/manual checks:

- Clean first-run guide.
- Refresh mid-guide.
- Mandatory guide has no visible skip control.
- Completed guide does not reopen.
- Field Шмыг after completed guide.
- Mobile 360px and 540px screenshot review.
