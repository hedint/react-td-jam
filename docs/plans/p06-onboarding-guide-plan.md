# Phase 0.6D Onboarding Guide and Hints Plan

## Status

- Current phase: planning complete; implementation not started.
- Parent roadmap: `docs/plans/p06-finishing-and-ship-plan.md`, Phase D.
- Source docs: `docs/design.md`, `docs/setting.md`, `docs/plans/p06-finishing-and-ship-plan.md`.
- Goal: make the public demo understandable for a first-time player without external explanation by shipping a one-time Шмыг-led guided opening plus lightweight contextual hints.
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
- "Shown once" means: resume while incomplete; stop forever after final completion or explicit skip.
- The completion/skip marker is persisted separately from the run save, so starting a new run does not re-open the full guide after completion.
- The guide freezes the interface by allowing only the current target action. Rendering and snapshots continue so highlights, Шмыг animation, and combat feedback remain alive.
- Contextual hints are separate from the full guide. They may appear after the guide is completed/skipped, but they use their own dedupe and cooldown rules.
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
- [x] Confirm the parent Phase D task wording still matches the split between full guide, hints, audio, deploy, and device QA.

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

- [ ] Add a pure `evaluateGuidedAction(...)` helper that receives onboarding progress, runtime snapshot, and a proposed action.
- [ ] Return an explicit result: allowed, blocked, or allowed with guide-step completion.
- [ ] Add guide-aware action dispatch for Vue HUD actions.
- [ ] Use the same guard in `RunScene` before direct `tap` / `tapSlot` handling.
- [ ] Keep mute usable during the guide.
- [ ] Decide and implement whether pause is blocked during scripted steps. Recommended default: block pause except on observation steps or after the first wave starts.
- [ ] Ensure debug-only actions are either blocked by default during the guide or bypassed only when `?debug=1` is active.
- [ ] Add tests for guard behavior across HUD actions and slot taps.

### Acceptance Criteria

- [ ] During a target-action step, non-target gameplay actions do not mutate run state.
- [ ] The target action still reaches the existing simulation reducer and remains authoritative.
- [ ] Phaser slot taps cannot bypass the guide.
- [ ] Existing headless simulation and balance scripts remain unaffected by onboarding code.

### Phase O3 notes

_(record guard edge cases and debug behavior here)_

### Phase O3 completion summary

_(fill on completion)_

---

## Phase O4 - Full Guide UI

Purpose: ship the visible Шмыг-led guide layer on top of the existing game page/HUD.

### Tasks

- [ ] Add `OnboardingGuide.vue` under `src/widgets/onboarding-guide/ui`.
- [ ] Mount the guide in `GamePage.vue` above `RunHud` only after a run has started.
- [ ] Add a compact Шмыг bubble layout that preserves the center playfield and lower-middle field.
- [ ] Add a short intro state with skip/continue.
- [ ] Add target highlighting for DOM controls, tower bench cards, draft cards, and field slots.
- [ ] Add a blocked-action nudge so forbidden taps give feedback without advancing the step.
- [ ] Add responsive CSS for the 360px mobile target and the 540px stage.
- [ ] Respect `prefers-reduced-motion` for non-essential Шмыг animation.
- [ ] Put all guide strings in `ru.onboarding`.

### Acceptance Criteria

- [ ] The guide visually matches the iron/brass UI skin and Шмыг voice.
- [ ] Text fits on 360px-wide mobile without overlapping controls.
- [ ] The guide never covers the current target in a way that prevents the required action.
- [ ] A player can skip the full guide from the intro or a clearly available guide control.

### Phase O4 notes

_(record UI layout decisions and screenshots here)_

### Phase O4 completion summary

_(fill on completion)_

---

## Phase O5 - Guide Script v1

Purpose: implement the concrete one-time guided opening.

The script should be short. Each step teaches one action or one discovery through Шмыг, not an abstract paragraph.

### Proposed Step Table

| Step id | Target | Completion signal | Notes |
|---|---|---|---|
| `intro` | Continue | Player continues or skips | Brief Шмыг intro; no mechanics dump. |
| `selectFirstWater` | Select a `water` bench tower | `selectedTowerId` is a water tower | Highlight matching bench card. |
| `placeFirstWater` | Place selected water tower on authored opening slot | Water tower placed on target slot | Target slot should be derived from an opening placement helper. |
| `selectFirstSpark` | Select a `spark` bench tower | `selectedTowerId` is a spark tower | Keep copy focused on mixing, not DPS. |
| `placeFirstSpark` | Place spark where it overlaps water coverage | First `electroPuddle` can form | Do not depend on brittle hardcoded geometry if a helper can derive it. |
| `startFirstWave` | Press Start | Phase changes from `ready` to `wave` | Other actions blocked. |
| `observeElectroPuddle` | No required action | First `electroPuddle` visible or first kill from it | Allow pause/mute if needed; advance automatically. |
| `draftTowerPick` | Choose any tower draft card | Draft tower step completed | Teach that the workshop sends more contraptions. |
| `draftUpgradePick` | Choose any upgrade draft card, preferably slot unlock if offered | Draft upgrade step completed | Mention upgrades/locked corners only if relevant to current offer. |
| `mixedThreatPreview` | Continue or start next wave | Player acknowledges next threat preview | Explain that icons preview different problems. |
| `complete` | None | Mark full guide complete | Persist completion immediately. |

### Tasks

- [ ] Implement an opening placement helper that chooses a valid water/spark placement pair for the current board/config.
- [ ] Add fallback logic if the player somehow creates the required reaction before the current step.
- [ ] Implement the proposed step table or record deviations in Phase notes.
- [ ] Tune copy so each line is short, in Шмыг voice, and action-specific.
- [ ] Ensure guide completion is written immediately after `complete`.

### Acceptance Criteria

- [ ] Clean first run walks through tower selection, placement, reaction creation, wave start, first draft, first upgrade, and mixed threat preview.
- [ ] Refreshing mid-guide resumes at the correct step.
- [ ] Skipping the guide never leaves input frozen.
- [ ] Completing the guide prevents it from appearing on later new runs for the same version.

### Phase O5 notes

_(record final step list and copy decisions here)_

### Phase O5 completion summary

_(fill on completion)_

---

## Phase O6 - Contextual Hints

Purpose: add non-blocking tips that support the tutorial without replacing it.

### Tasks

- [ ] Add data-driven hint definitions with `id`, priority, predicate, cooldown, max-shown count, and text key.
- [ ] Use the same Шмыг chip style as the guide, but smaller and non-blocking.
- [ ] Do not show hints while a blocking guide step, draft modal, result modal, or title screen is active.
- [ ] Add dedupe persistence through the onboarding storage key.
- [ ] Add hint rules for the first ship slice:
  - no towers placed before first start;
  - no air-capable answer before the first flyer wave;
  - locked corner slot appears as an upgrade offer;
  - repeated leaks/core danger;
  - overreliance on one damage family before resist enemies;
  - boss Reaction Break reminder before or during boss setup.
- [ ] Keep existing Phaser field callouts for reaction names and acute events; do not duplicate them as Шмыг hints unless playtest shows the callout is missed.

### Acceptance Criteria

- [ ] Hints are helpful but rare; they do not stack over combat or draft decisions.
- [ ] A completed/skipped full guide does not disable contextual hints.
- [ ] Seen hints respect max count and cooldown after reload.
- [ ] Unit tests cover hint predicates and dedupe behavior.

### Phase O6 notes

_(record final hint set and any removed noisy hints here)_

### Phase O6 completion summary

_(fill on completion)_

---

## Phase O7 - QA, Device Pass, and Ship Gate

Purpose: prove the guide and hints work on the actual mobile-first demo surface.

### Tasks

- [ ] Add unit tests for persistence, guide state transitions, action guard, opening placement helper, and hint rules.
- [ ] Add or update component tests if the project already has the tooling; otherwise record why manual/Playwright coverage is used instead.
- [ ] Run a clean-localStorage browser smoke: title -> new run -> full guide -> first draft -> completion marker.
- [ ] Run a refresh-mid-guide smoke and verify resume.
- [ ] Run a skip-guide smoke and verify input unfreezes.
- [ ] Run a completed-guide smoke and verify a new run does not reopen the full guide.
- [ ] Capture mobile screenshots at 360px and 540px widths.
- [ ] Run final checks: `npm run lint:fix`, `npm run typecheck`, `npm run test`, `npm run build`.

### Acceptance Criteria

- [ ] A first-time player can understand the opening loop without external help.
- [ ] The guide never deadlocks input.
- [ ] Contextual hints appear only when useful and do not obscure core combat reading.
- [ ] Mobile screenshots show no text overlap or target occlusion.
- [ ] Required checks are green or documented with a clear blocker.

### Phase O7 notes

_(record smoke results, screenshots, and final checks here)_

### Phase O7 completion summary

_(fill on completion)_

---

## Open Questions

- Exact Шмыг sprite frame size: decide during O1 after the seed reads at HUD scale.
- Whether the guide intro skip is a small text button or icon button: decide during O4 UI pass.
- Whether `pause` is allowed during `observeElectroPuddle`: recommended yes, but confirm through implementation QA.
- Whether mixed-threat explanation belongs at the end of the full guide or as the first contextual hint after guide completion: start in full guide, move to hints only if the flow feels too long.

## Verification

Baseline commands for this slice:

- `npm run lint:fix`
- `npm run typecheck`
- `npm run test`
- `npm run build`

Browser/manual checks:

- Clean first-run guide.
- Refresh mid-guide.
- Skip guide.
- Completed guide does not reopen.
- Hints after completed/skipped guide.
- Mobile 360px and 540px screenshot review.
