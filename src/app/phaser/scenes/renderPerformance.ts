import type { ReactionId } from "@entities/game-session/model/types";

export const renderPerformanceBudget = {
  maxParticlesPerEffect: 15,
  phaserParticleSystems: 0,
  bitmapAtlasCount: 0,
  blurOrPostProcessing: false,
  pooledLabels: true,
  effectParticleMarks: {
    electroPuddle: 3,
    steam: 3,
    fire: 2,
    stormCloud: 4,
    fireVortex: 3,
    fireStorm: 5,
  } satisfies Record<ReactionId, number>,
} as const;
