# Phase 0.6D Audio Plan

## Status

- Current phase: planning complete; implementation not started.
- Parent roadmap: `docs/plans/p06-finishing-and-ship-plan.md`, Phase D.
- Source docs: `docs/design.md`, `docs/setting.md`, `docs/plans/p06-finishing-and-ship-plan.md`.
- Goal: ship a small, legally clean audio layer for the public web demo: ambience/music, key SFX, UI feedback, and persistent mute.
- Product decision date: 2026-06-26.

## Agent Instructions

This document is both the implementation plan and the execution log for the audio slice.

When working on this plan:

- Update checkboxes in this file as work is completed.
- Do not mark a checkbox complete until the behavior, asset, or test is implemented and verified at the level described.
- Keep audio runtime state outside the serializable game simulation. Audio may observe run events and snapshots, but must not change balance rules.
- Keep the scope small: no settings screen, no mixer UI, no dynamic music system, and no large variant library.
- Respect browser/mobile autoplay rules. Audio must start only after a valid player gesture and must recover gracefully if the first unlock attempt fails.
- Keep the B3 top-HUD mute button as the single player-facing audio control.
- Persist mute separately from the run save. Do not mix it into `jam-td.run.v1`.
- Use UTF-8 without BOM for all new or modified text files.
- Prefer `npm run lint:fix` over a plain lint run.
- Do not revert unrelated worktree changes. At planning time the worktree already has unrelated changes in HUD and sound asset paths.
- If implementation diverges from this plan, record it in the relevant phase's "Phase notes" before moving on.
- At the end of each phase, fill in "Phase completion summary": what was implemented, what was deferred, tradeoffs/deviations, and checks run.

Logging rule:

- Every implementation session should add a dated note under the active phase before marking that phase complete.
- Notes should mention concrete artifacts, not every touched file. Example: "2026-06-27: Added `audioManager`, imported 14 CC0 SFX, and verified first-gesture unlock on Android Chrome. Checks: `npm run lint:fix`, `npm run build`."

## Context

Phase D audio is intentionally the final polish layer. The game already has:

- A top-HUD mute button in `src/widgets/run-hud/ui/RunHud.vue` that emits `audio:mute-changed` as a no-op integration point.
- Presentation events emitted through `gameEvents`, including major reaction, kill, boss, and core-damage feedback.
- A finished iron/brass UI skin, final enemy sprites, boss sprites, and Шмыг-led onboarding assets.
- A fiction tone from `docs/setting.md`: dirty industrial cave comedy, copper machinery, magma heat, steam, sparks, soot, and the Great Distillation Cube.

The audio layer should reinforce that fiction without competing with readability. The target is not a memorable soundtrack; the target is clear, restrained feedback that makes placement, reactions, danger, and boss beats feel finished.

## Key Decisions

- Use a **hybrid source strategy**:
  - curate CC0/free-source SFX first;
  - lightly edit/process them for consistency;
  - use generated or custom-built audio only for sounds that need strong identity, especially `Огненный Шторм`, boss set pieces, and ambience if library loops feel generic.
- Prefer **CC0** for SFX. If a non-CC0 asset is used, it must have an explicit written reason and complete attribution metadata.
- Keep music as **low, industrial ambience** rather than melodic fantasy music. The default direction is a seamless cave/workshop loop: boiler hum, steam, chain/metal creaks, magma rumble, and occasional electrical crackle.
- Avoid chiptune, heroic orchestral fantasy, tavern music, clean sci-fi lasers, and bright arcade UI bleeps.
- Audio assets must be selected in context. Do not approve a sound only by filename or library preview; verify it against real game events and mobile speaker volume.
- Every imported external asset gets local provenance metadata: source URL, author, license, download date, original filename, local filename, and any edits.
- Muted state must apply before any playback starts, persist across refresh, and remain controllable from the existing top-HUD button.

## Out of Scope

- A settings screen, sliders, output device controls, or separate music/SFX volume UI.
- Adaptive/dynamic music, stems, combat intensity layers, or synchronized beat logic.
- Voice acting, Шмыг barks, spoken narration, or localized audio.
- A large random variant library.
- Audio-reactive gameplay, timing-sensitive rhythm mechanics, or any simulation changes.
- Licensing risky assets: unclear license, "free for YouTube only", noncommercial, AI asset with unclear commercial terms, or assets that cannot be redistributed inside the web build.

## Source and License Policy

Verified source candidates as of 2026-06-26:

- [Kenney Audio](https://kenney.nl/assets/category%3AAudio): good first source for UI, interface, impact, digital, and game SFX. Kenney's support page says asset-page game assets are Creative Commons CC0 and attribution is not required: [Kenney Support](https://kenney.nl/support).
- [Freesound](https://freesound.org/): useful for raw material, but filter strictly to **Creative Commons 0** unless there is a recorded reason to accept attribution. Freesound documents that different sounds use different licenses: [Freesound FAQ](https://freesound.org/help/faq/).
- [OpenGameArt](https://opengameart.org/): useful for game-oriented audio, but licenses are mixed. Use only assets with clearly acceptable license metadata and record attribution if required.
- [Pixabay Sound Effects](https://pixabay.com/sound-effects/) and [Pixabay Music](https://pixabay.com/music/): possible source for ambience/music, but review the current Pixabay Content License and restrictions before use: [license summary](https://pixabay.com/service/license-summary/) and [terms](https://pixabay.com/service/terms/).
- [Creative Commons CC0](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en): preferred legal target for external SFX because it minimizes attribution and redistribution friction.

Required provenance artifact:

- Add an audio asset ledger before runtime integration, for example `public/assets/sounds/README.md` or `public/assets/sounds/audio-credits.md`.
- The ledger must include every external asset, even CC0 assets.
- If generated audio is used, record the generator/tool, prompt or brief, date, terms reference, and any post-processing.

This plan is not legal advice. If a source's license terms change or are unclear at implementation time, re-check the source before importing the asset.

## Audio Direction

### Overall Palette

- Industrial cave workshop, not polished fantasy.
- Short, tactile, slightly dirty sounds: valves, metal ticks, wet pumps, steam pressure, crackling electricity, magma rumble.
- Sounds should be dry and readable. Long reverb tails are allowed only for boss/T3/result stingers.
- Keep the perceived volume conservative on mobile speakers; the game already has dense VFX and UI.

### Negative References

- Cheerful 8-bit/chiptune.
- Heroic orchestral loops.
- Tavern/lute fantasy music.
- Clean futuristic UI beeps.
- Comedy cartoon pops for core combat events.
- Horror ambience that makes the demo feel grim instead of dirty/workmanlike.

## Minimum Ship Asset List

### Ambience and Music

- `ambience_loop`: 60-90 second seamless loop, low intensity, industrial cave/workshop bed.
- Optional `boss_low_stinger`: short transition into boss if the normal ambience feels too flat.
- Optional `victory_stinger` and `defeat_stinger`: short, non-melodramatic result cues.

### UI

- `ui_confirm`
- `ui_cancel`
- `ui_invalid`
- `ui_draft_pick`
- `ui_pause`
- `ui_resume`
- `ui_mute`

### Core Gameplay

- `tower_pickup`
- `tower_place`
- `tower_relocate`
- `wave_start`
- `core_hit`
- Optional `core_low_warning`

### Reactions

- `reaction_electro_puddle`
- `reaction_steam`
- `reaction_fire`
- `reaction_storm_cloud`
- `reaction_fire_vortex`
- `reaction_fire_storm`

### Boss

- `boss_arrival`
- `boss_smash_telegraph`
- `boss_smash_impact`
- `boss_suppression_cast`
- `boss_summon`
- `boss_vulnerable_break`
- `boss_death`

Variants are optional. If variants are added, limit them to frequent events such as UI confirm, tower placement, and small reaction ticks.

## Runtime Architecture Contract

- Add a thin audio service/module that subscribes to existing UI events and `gameEvents`.
- Keep Phaser scenes and Vue components from directly constructing many audio objects. They should emit events or call a narrow helper.
- Preload or lazy-load audio assets through the existing asset manifest pattern if practical.
- Support a single persistent mute flag.
- Start/unlock audio on the first valid player gesture after entering a run or interacting with the title screen.
- Handle page visibility changes conservatively: pause or lower ambience when hidden; resume only if unmuted and unlocked.
- Cap overlapping one-shot playback so reaction spam does not become noise or degrade performance.
- Use web-friendly compressed formats. Prefer `.ogg` plus `.mp3` fallback if browser support or hosting behavior requires it.

## Phase AU0 - Baseline and Parent Plan Link

Purpose: record the worktree baseline and make this subplan discoverable from p06 before implementation starts.

### Tasks

- [x] Record current `git status --short` in Phase notes before touching implementation files.
- [x] Link this subplan from `docs/plans/p06-finishing-and-ship-plan.md` Phase D.
- [x] Confirm the parent Phase D task wording still matches the small audio scope.

### Acceptance Criteria

- [x] A future agent can find this plan from p06.
- [x] The implementation starts from an explicit dirty/clean worktree note.

### Phase AU0 notes

- 2026-06-26 planning baseline: before creating this file, `git status --short` showed pre-existing changes: `M src/widgets/run-hud/ui/RunHud.vue` and `?? public/assets/sounds/`.
- 2026-06-26: Created this audio subplan and linked it from p06 Phase D. Parent scope still matches: music/ambience, key SFX for placement/reactions/core damage/boss/UI, and persistent mute through the B3 mute button.

### Phase AU0 completion summary

Phase AU0 completed during planning. The subplan now exists as a separate roadmap, p06 Phase D links to it, and the pre-existing dirty worktree baseline is recorded above.

---

## Phase AU1 - Audio Brief and Candidate Curation

Purpose: create a small candidate pool before any runtime work, so implementation is driven by approved sounds rather than placeholders.

### Tasks

- [ ] Write a short audio brief under `public/assets/sounds/` or `docs/audio/`, based on the Audio Direction section above.
- [ ] Create the provenance ledger before importing external files.
- [ ] Curate 2-4 candidate sounds for each high-priority category:
  - ambience loop;
  - UI confirm/cancel/invalid;
  - tower placement;
  - electro puddle;
  - steam;
  - fire;
  - fire storm;
  - core hit;
  - boss smash;
  - boss vulnerable break;
  - victory/defeat.
- [ ] Filter candidates by license before listening approval. Do not keep rejected unclear-license files in `public/assets`.
- [ ] Normalize candidate filenames to stable kebab-case ids.
- [ ] Record rejected directions in Phase notes if they clarify the final style.

### Acceptance Criteria

- [ ] Every candidate has source/license metadata.
- [ ] Candidate pool covers all required ship categories or records a specific generation/custom-build gap.
- [ ] User can approve the style from a small listening set before runtime integration.

### Phase AU1 notes

_(record candidate sources, rejected directions, approved directions, and any custom-generation needs here)_

### Phase AU1 completion summary

_(fill on completion)_

---

## Phase AU2 - Editing, Normalization, and Asset Packaging

Purpose: turn approved candidates into a consistent game-ready asset set.

### Tasks

- [ ] Trim silence and long tails unless the sound is intentionally a stinger.
- [ ] Normalize loudness so UI, placement, reactions, boss, and result sounds sit in sensible relative ranges.
- [ ] EQ or lightly process sounds so they share the dirty industrial palette.
- [ ] Make `ambience_loop` seamless and verify the loop point.
- [ ] Export web-ready files in the chosen format(s).
- [ ] Keep source/original files out of the runtime bundle if they are not needed by the game.
- [ ] Update the provenance ledger with final local filenames and edits performed.

### Acceptance Criteria

- [ ] All final files are short, trimmed, named, and licensed.
- [ ] Ambience loops cleanly without a click or obvious reset.
- [ ] No final asset is much louder than its category peers.
- [ ] Runtime bundle does not include unnecessary source material.

### Phase AU2 notes

_(record editing toolchain, final asset paths, format decisions, and size notes here)_

### Phase AU2 completion summary

_(fill on completion)_

---

## Phase AU3 - Runtime Audio System

Purpose: wire the existing HUD mute button and event stream to a small browser-safe audio runtime.

### Tasks

- [ ] Add an audio asset manifest or manifest extension for the final sound ids.
- [x] Add a background music service/module with:
  - first-gesture unlock;
  - persistent mute;
  - ambience loop control.
- [ ] Extend the audio service/module with:
  - one-shot SFX playback;
  - overlap caps or cooldowns for noisy events.
- [x] Wire the B3 top-HUD mute button to the audio service instead of the current no-op event only.
- [ ] Subscribe to the relevant UI and `gameEvents` events for SFX.
- [x] Ensure audio is silent before unlock and when muted.
- [x] Handle page visibility changes.
- [x] Keep simulation tests and headless balance scripts independent from the audio runtime.

### Acceptance Criteria

- [ ] Audio starts only after a valid browser/mobile gesture.
- [ ] Mute persists across refresh and prevents ambience/SFX.
- [ ] Key UI and gameplay events have audible feedback.
- [ ] Reaction spam does not create uncontrolled overlapping noise.
- [ ] Headless tests do not require browser audio APIs.

### Phase AU3 notes

_(record runtime architecture decisions, event mappings, and browser quirks here)_

- 2026-06-26: Started with the user-provided `public/assets/sounds/main-theme.mp3` as the single background music loop. Added a small `HTMLAudioElement`-based background music controller with first-gesture unlock, persistent mute via `jam-td:muted`, page-visibility pause, and `audio:mute-changed` handling from the existing HUD mute button. This is intentionally narrower than the full AU3 ship gate: no SFX/event mapping yet.

### Phase AU3 completion summary

_(fill on completion)_

---

## Phase AU4 - Event Mapping and Mix Pass

Purpose: make the sound choices readable in actual play and remove anything that becomes annoying.

### Tasks

- [ ] Map each final sound id to the exact event or UI action that triggers it.
- [ ] Set conservative default gains per category.
- [ ] Make frequent events quieter and shorter than rare events.
- [ ] Prioritize rare/high-value events:
  - `Огненный Шторм`;
  - boss smash impact;
  - boss vulnerable break;
  - core hit;
  - victory/defeat.
- [ ] Play through waves 1-3 and boss to verify the sound hierarchy.
- [ ] Remove or lower any sound that competes with decision-making.

### Acceptance Criteria

- [ ] A player can distinguish UI, placement, reaction, core danger, and boss beats.
- [ ] The ambience supports the scene without masking SFX.
- [ ] Frequent sounds remain tolerable during a full run.
- [ ] Major events feel materially stronger than normal clicks and placements.

### Phase AU4 notes

_(record mix changes, removed sounds, final gain/cooldown values, and manual playtest observations here)_

### Phase AU4 completion summary

_(fill on completion)_

---

## Phase AU5 - Mobile, Static Preview, and Ship Gate

Purpose: verify audio on the real delivery surface before final deploy.

### Tasks

- [ ] Run `npm run build`.
- [ ] Run static preview smoke, not only dev-server smoke.
- [ ] Verify first-gesture audio unlock on desktop Chrome.
- [ ] Verify first-gesture audio unlock on a real mobile browser or the closest available device flow.
- [ ] Verify mute before unlock, mute after unlock, refresh persistence, and page visibility behavior.
- [ ] Verify no missing audio asset responses or 404s in static preview.
- [ ] Review bundle size and load timing after audio assets are included.
- [ ] Run final checks: `npm run lint:fix`, `npm run typecheck`, `npm run test`, `npm run build`.

### Acceptance Criteria

- [ ] Audio plays after valid mobile/browser user gestures.
- [ ] Key events have sound feedback.
- [ ] Mute persists.
- [ ] Static build loads all audio assets under the production base path.
- [ ] Live-device behavior is acceptable for the public demo.

### Phase AU5 notes

_(record device/browser results, static preview URL, network findings, and final checks here)_

### Phase AU5 completion summary

_(fill on completion)_

---

## Open Questions

- Exact audio API: plain `HTMLAudioElement`, Web Audio, Phaser sound manager, or a small wrapper around the existing Phaser audio support. Decide in AU3 after checking current runtime boundaries.
- Final file format: likely `.ogg` plus `.mp3` fallback if needed. Decide in AU2/AU3 based on browser support and build behavior.
- Whether `victory_stinger` and `defeat_stinger` are required for ship or can be deferred if ambience and core gameplay SFX already carry the experience.
- Whether `Огненный Шторм` and boss sounds can be sourced from libraries or need custom/generated treatment.
- Whether a subtle boss transition is useful or too much for the small-scope audio target.

## Verification

Baseline commands for this slice:

- `npm run lint:fix`
- `npm run typecheck`
- `npm run test`
- `npm run build`

Browser/manual checks:

- First gesture unlock on desktop.
- First gesture unlock on mobile.
- Mute before and after unlock.
- Refresh persistence.
- Static preview asset loading.
- Waves 1-3 audio read.
- Boss audio read.
- Full run tolerance check.
