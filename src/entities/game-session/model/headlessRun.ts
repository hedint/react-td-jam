import type { GameAction, RunState } from "./types";
import { applyAction, stepRun } from "./simulation";

export interface HeadlessRunOptions {
  readonly maxSteps: number
  readonly stepMs?: number
  readonly autoStartWaves?: boolean
  readonly autoCompleteDrafts?: boolean
  readonly draftActions?: (state: RunState) => readonly GameAction[]
  readonly stopWhen?: (state: RunState) => boolean
}

export interface HeadlessRunResult {
  readonly state: RunState
  readonly steps: number
  readonly stoppedByPredicate: boolean
}

export function runHeadlessRun(initialState: RunState, options: HeadlessRunOptions): HeadlessRunResult {
  const stepMs = options.stepMs ?? 1000 / 30;
  let state = initialState;

  for (let steps = 0; steps < options.maxSteps; steps += 1) {
    if (options.stopWhen?.(state)) {
      return {
        state,
        steps,
        stoppedByPredicate: true,
      };
    }

    if (options.autoStartWaves && state.phase === "ready") {
      state = applyAction(state, { type: "startWave" });
    }

    if (state.phase === "draft") {
      options.draftActions?.(state).forEach((action) => {
        state = applyAction(state, action);
      });

      if (options.autoCompleteDrafts) {
        if (state.draft?.step === "tower") {
          const offer = state.draft.towerOffers[0];

          if (offer) {
            state = applyAction(state, { type: "chooseDraftTower", emitterId: offer.emitterId });
          }
        }

        if (state.draft?.step === "upgrade") {
          const upgradeId = state.draft.upgradeOffers[0];

          if (upgradeId) {
            state = applyAction(state, { type: "chooseDraftUpgrade", upgradeId });
          }
        }
      }
    }

    state = stepRun(state, stepMs);
  }

  return {
    state,
    steps: options.maxSteps,
    stoppedByPredicate: options.stopWhen?.(state) ?? false,
  };
}
