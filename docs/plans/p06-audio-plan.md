# Phase 0.6D Audio Plan

## Status

- Current phase: closed; no further audio work before jam ship.
- Parent roadmap: `docs/plans/p06-finishing-and-ship-plan.md`, Phase D.
- Source docs: `docs/design.md`, `docs/setting.md`, `docs/plans/p06-finishing-and-ship-plan.md`.
- Goal: record the closed jam audio scope. Keep the existing `main-theme.mp3` background loop and persistent mute plumbing if stable; do not add SFX, mix work, sourcing, or audio-specific QA before ship.
- Product decision date: 2026-06-26.

## Agent Instructions

This document is both the implementation plan and the execution log for the audio slice. As of 2026-06-26, it is also the closure record: audio has no remaining ship-blocking work for the jam.

When working on this plan:

- Update checkboxes in this file as work is completed.
- Do not mark a checkbox complete until the behavior, asset, or test is implemented and verified at the level described.
- Keep audio runtime state outside the serializable game simulation. Audio may observe run events and snapshots, but must not change balance rules.
- Keep the closed scope: no settings screen, no mixer UI, no dynamic music system, no large variant library, no SFX pass, and no separate audio QA pass.
- Respect browser/mobile autoplay rules for the existing background loop, but do not treat audio-specific verification as a remaining ship gate.
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

Phase D audio was originally planned as a final polish layer, but it is now closed for the jam slice. The game already has:

- A top-HUD mute button in `src/widgets/run-hud/ui/RunHud.vue` that emits `audio:mute-changed` as a no-op integration point.
- Presentation events emitted through `gameEvents`, including major reaction, kill, boss, and core-damage feedback.
- A finished iron/brass UI skin, final enemy sprites, boss sprites, and Шмыг-led onboarding assets.
- A fiction tone from `docs/setting.md`: dirty industrial cave comedy, copper machinery, magma heat, steam, sparks, soot, and the Great Distillation Cube.

No additional audio layer should be built before jam ship. If this project continues after the jam, the old direction below can be reused as a starting point for a proper SFX/mix pass.

## Key Decisions

- Post-jam only: use a **hybrid source strategy**:
  - curate CC0/free-source SFX first;
  - lightly edit/process them for consistency;
  - use generated or custom-built audio only for sounds that need strong identity, especially `Огненный Шторм`, boss set pieces, and ambience if library loops feel generic.
- Post-jam only: prefer **CC0** for SFX. If a non-CC0 asset is used, it must have an explicit written reason and complete attribution metadata.
- Post-jam only: keep music as **low, industrial ambience** rather than melodic fantasy music. The default direction is a seamless cave/workshop loop: boiler hum, steam, chain/metal creaks, magma rumble, and occasional electrical crackle.
- Post-jam only: avoid chiptune, heroic orchestral fantasy, tavern music, clean sci-fi lasers, and bright arcade UI bleeps.
- Post-jam only: audio assets must be selected in context. Do not approve a sound only by filename or library preview; verify it against real game events and mobile speaker volume.
- Post-jam only: every imported external asset gets local provenance metadata: source URL, author, license, download date, original filename, local filename, and any edits.
- Muted state must apply before any playback starts, persist across refresh, and remain controllable from the existing top-HUD button.
- 2026-06-26 jam-scope update: do **not** add extra SFX for this jam slice. Manual SFX search and mix is more expensive than the value it adds right now. Keep only the user-provided background music and mute/unmute plumbing; revisit SFX after the jam if the demo continues.

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

- `main-theme.mp3`: the current background music loop under `public/assets/sounds/main-theme.mp3`.

### UI

- Out of scope for this ship. Do not add UI SFX in this slice.

### Core Gameplay

- Out of scope for this ship. Do not add gameplay SFX in this slice.

### Reactions

- Out of scope for this ship. Do not add reaction SFX in this slice.

### Boss

- Out of scope for this ship. Do not add boss SFX in this slice.

## Runtime Architecture Contract

- Do not add a new audio service/module before this jam ship. The existing background music controller is enough for the closed scope.
- Keep Phaser scenes and Vue components from directly constructing many audio objects. They should emit events or call a narrow helper.
- Do not add audio manifest/preload work before this jam ship.
- Support a single persistent mute flag.
- Start/unlock audio on the first valid player gesture after entering a run or interacting with the title screen.
- Handle page visibility changes conservatively: pause or lower ambience when hidden; resume only if unmuted and unlocked.
- Post-jam only: cap overlapping one-shot playback if SFX are ever added.
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
- 2026-06-26: Created this audio subplan and linked it from p06 Phase D. Parent scope later narrowed to background music plus persistent mute only for the jam ship.

### Phase AU0 completion summary

Phase AU0 completed during planning. The subplan now exists as a separate roadmap, p06 Phase D links to it, and the pre-existing dirty worktree baseline is recorded above.

---

## Phase AU1 - Audio Brief and Candidate Curation

Purpose: create a small candidate pool before any runtime work, so implementation is driven by approved sounds rather than placeholders.

Jam-scope decision: skipped and closed. Extra SFX are not part of the current ship slice because they need manual search, license review, and mix work.

### Tasks

- [x] Skip writing a new audio brief for this jam ship.
- [x] Skip creating a provenance ledger because no new external audio assets are being imported.
- [x] Skip curating candidate sounds for the current ship slice:
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
- [x] Skip license filtering because no candidates are being imported.
- [x] Skip candidate filename normalization because no candidates are being imported.
- [x] Record the product decision to close audio scope instead of rejected directions.

### Acceptance Criteria

- [x] No candidate/source metadata is required for this jam ship because no new audio assets are imported.
- [x] Candidate-pool coverage is not a ship requirement.
- [x] Listening approval is not a ship requirement.

### Phase AU1 notes

- 2026-06-26: Closed by product decision. Do not do audio brief/candidate work before the jam ship.

### Phase AU1 completion summary

AU1 skipped and closed by product decision. No new audio assets are being sourced for the jam ship.

---

## Phase AU2 - Editing, Normalization, and Asset Packaging

Purpose: turn approved candidates into a consistent game-ready asset set.

Jam-scope decision: skipped and closed for the current ship slice beyond the already provided `main-theme.mp3`.

### Tasks

- [x] Skip trimming/editing new sounds; no new audio assets are being imported.
- [x] Skip SFX loudness normalization; SFX are out of scope.
- [x] Skip audio processing; no new audio assets are being imported.
- [x] Do not create a new `ambience_loop`; keep the existing `main-theme.mp3`.
- [x] Skip new export formats; keep the existing runtime file.
- [x] Do not add source/original audio material to the runtime bundle.
- [x] Skip provenance-ledger updates because no new external audio assets are imported.

### Acceptance Criteria

- [x] No new final audio files are required.
- [x] New ambience-loop verification is not a ship requirement.
- [x] SFX/category loudness comparison is not a ship requirement.
- [x] Runtime bundle should not gain unnecessary source material from audio work.

### Phase AU2 notes

- 2026-06-26: Closed by product decision. Keep `public/assets/sounds/main-theme.mp3`; do not add a packaging/editing pass before ship.

### Phase AU2 completion summary

AU2 skipped and closed by product decision. No new audio packaging work remains.

---

## Phase AU3 - Runtime Audio System

Purpose: wire the existing HUD mute button and event stream to a small browser-safe audio runtime.

### Tasks

- [x] Do not add an audio asset manifest for this jam ship; the single existing `main-theme.mp3` path is enough for the current background loop.
- [x] Add a background music service/module with:
  - first-gesture unlock;
  - persistent mute;
  - ambience loop control.
- [x] Do not extend the audio service/module before this jam ship:
  - one-shot SFX playback;
  - overlap caps or cooldowns for noisy events.
- [x] Wire the B3 top-HUD mute button to the audio service instead of the current no-op event only.
- [x] Do not subscribe to UI or `gameEvents` events for SFX before this jam ship.
- [x] Ensure audio is silent before unlock and when muted.
- [x] Handle page visibility changes.
- [x] Keep simulation tests and headless balance scripts independent from the audio runtime.

### Acceptance Criteria

- [x] Existing background music controller starts only after a valid browser/mobile gesture by design.
- [x] Existing mute state persists across refresh and prevents background music by design.
- [x] Existing background music starts after a valid gesture when unmuted by design.
- [x] SFX overlap checks are not required because SFX are out of scope for this jam ship.
- [x] Headless tests do not require browser audio APIs.

### Phase AU3 notes

_(record runtime architecture decisions, event mappings, and browser quirks here)_

- 2026-06-26: Started with the user-provided `public/assets/sounds/main-theme.mp3` as the single background music loop. Added a small `HTMLAudioElement`-based background music controller with first-gesture unlock, persistent mute via `jam-td:muted`, page-visibility pause, and `audio:mute-changed` handling from the existing HUD mute button. This is intentionally narrower than the original full AU3 ship gate: no SFX/event mapping.
- 2026-06-26: Jam-scope decision locked: do not add extra SFX before the jam ship. SFX are valuable only if manually chosen and mixed in context, and that work is not worth taking on for this slice.

### Phase AU3 completion summary

AU3 is closed for the jam ship. The existing background loop / persistent mute plumbing is sufficient; no SFX/event mapping remains.

---

## Phase AU4 - Event Mapping and Mix Pass

Purpose: make the sound choices readable in actual play and remove anything that becomes annoying.

Jam-scope decision: skipped and closed. No mix pass or event mapping remains before ship.

### Tasks

- [x] Do not map SFX ids before this jam ship.
- [x] Do not run a dedicated background-music volume pass before this jam ship.
- [x] Do not set SFX gains before this jam ship.
- [x] Do not tune frequent SFX before this jam ship.
- [x] Do not prioritize rare/high-value SFX before this jam ship:
  - `Огненный Шторм`;
  - boss smash impact;
  - boss vulnerable break;
  - core hit;
  - victory/defeat.
- [x] Do not run audio-specific waves 1-3/boss mix verification before this jam ship.
- [x] Do not do additional background-music mix changes before this jam ship.

### Acceptance Criteria

- [x] Background-music mix quality is not a remaining ship gate.
- [x] Full-run audio tolerance is not a remaining ship gate.
- [x] SFX hierarchy checks are out of scope for this jam ship.

### Phase AU4 notes

- 2026-06-26: Closed by product decision. No audio mix pass remains before ship.

### Phase AU4 completion summary

AU4 skipped and closed by product decision.

---

## Phase AU5 - Mobile, Static Preview, and Ship Gate

Purpose: originally verify audio on the real delivery surface before final deploy. This phase is now closed because audio-specific QA is no longer a ship gate.

### Tasks

- [x] Do not run audio-specific build checks in this subplan; final build checks stay in the ship plan.
- [x] Do not run audio-specific static preview smoke in this subplan; general static preview stays in the ship plan.
- [x] Do not run desktop Chrome audio-unlock QA as a ship blocker.
- [x] Do not run real-mobile audio-unlock QA as a ship blocker.
- [x] Do not run mute/page-visibility audio QA as a ship blocker.
- [x] Do not run audio-specific 404 checks as a ship blocker.
- [x] Do not run audio-specific bundle-size review as a ship blocker.
- [x] Do not run final command checks from this audio subplan; final checks stay in the ship plan.

### Acceptance Criteria

- [x] Audio playback after gestures is not a remaining ship gate.
- [x] Key-event sound feedback is out of scope.
- [x] Mute persistence is implemented but no longer a separate audio ship gate.
- [x] Static audio asset loading is not a separate audio ship gate.
- [x] Live-device audio behavior is not a separate audio ship gate.

### Phase AU5 notes

- 2026-06-26: Closed by product decision. Audio-specific mobile/static-preview QA is not required before ship.

### Phase AU5 completion summary

AU5 skipped and closed by product decision. General static preview, deploy, and real-device QA remain in the parent ship plan.

---

## Open Questions

- Exact audio API: resolved for the current shipped plumbing as plain `HTMLAudioElement`; no further API work before jam ship.
- Final file format: keep existing `main-theme.mp3`; no `.ogg` fallback work before jam ship.
- Victory/defeat stingers: out of scope for jam ship.
- `Огненный Шторм` and boss sounds: out of scope for jam ship.
- Boss transition audio: out of scope for jam ship.
- 2026-06-26 jam answer: all SFX/open stinger questions are closed for this ship slice, not deferred as active ship work.

## Verification

No audio-specific verification remains for the jam ship. General final checks are owned by `docs/plans/p06-finishing-and-ship-plan.md`.

Historical baseline commands for this slice:

- `npm run lint:fix`
- `npm run typecheck`
- `npm run test`
- `npm run build`

Historical browser/manual checks, no longer ship blockers:

- First gesture unlock on desktop.
- First gesture unlock on mobile.
- Mute before and after unlock.
- Refresh persistence.
- Static preview asset loading.
- Waves 1-3 audio read.
- Boss audio read.
- Full run tolerance check.
