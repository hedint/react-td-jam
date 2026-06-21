import type { RngState } from "./types";

const RNG_MODULUS = 0x100000000;
const RNG_MULTIPLIER = 1664525;
const RNG_INCREMENT = 1013904223;

export function createRng(seed: number): RngState {
  return {
    seed,
    state: seed >>> 0,
  };
}

export function nextRandom(rng: RngState): [RngState, number] {
  const state = (Math.imul(rng.state, RNG_MULTIPLIER) + RNG_INCREMENT) >>> 0;

  return [
    {
      seed: rng.seed,
      state,
    },
    state / RNG_MODULUS,
  ];
}
