export interface FixedStepDriverOptions<State> {
  readonly initialState: State
  readonly stepMs: number
  readonly step: (state: State, deltaMs: number) => State
}

export interface FixedStepDriver<State> {
  readonly state: State
  stepFrame: (deltaMs: number) => State
  replaceState: (state: State) => void
}

export function createFixedStepDriver<State>(options: FixedStepDriverOptions<State>): FixedStepDriver<State> {
  let state = options.initialState;
  let accumulatorMs = 0;

  return {
    get state() {
      return state;
    },
    stepFrame(deltaMs) {
      accumulatorMs += deltaMs;

      while (accumulatorMs >= options.stepMs) {
        state = options.step(state, options.stepMs);
        accumulatorMs -= options.stepMs;
      }

      return state;
    },
    replaceState(nextState) {
      state = nextState;
      accumulatorMs = 0;
    },
  };
}
