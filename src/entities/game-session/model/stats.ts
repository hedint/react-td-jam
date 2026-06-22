import type { DamageSourceId, ReactionId, RunState } from "./types";

export function ensureWaveStats(stats: RunState["stats"], waveId: string): RunState["stats"] {
  if (stats.waveStats.some(wave => wave.waveId === waveId)) {
    return stats;
  }

  return {
    ...stats,
    waveStats: [
      ...stats.waveStats,
      {
        waveId,
        damage: 0,
        leaks: 0,
        kills: 0,
        damageBySource: {},
        damageByReaction: {},
      },
    ],
  };
}

export function updateWaveStats(
  waveStats: RunState["stats"]["waveStats"],
  waveId: string | null,
  delta: Partial<Pick<RunState["stats"]["waveStats"][number], "damage" | "leaks" | "kills">> & {
    readonly damageBySource?: Partial<Record<DamageSourceId, number>>
    readonly damageByReaction?: Partial<Record<ReactionId, number>>
  },
): RunState["stats"]["waveStats"] {
  if (!waveId) {
    return waveStats;
  }

  const stats = waveStats.some(wave => wave.waveId === waveId)
    ? waveStats
    : ensureWaveStats({
      leaks: 0,
      kills: 0,
      bossBreaks: 0,
      totalDamage: 0,
      damageBySource: {},
      damageByReaction: {},
      waveStats,
    }, waveId).waveStats;

  return stats.map((wave) => {
    if (wave.waveId !== waveId) {
      return wave;
    }

    const damageBySource = { ...getWaveDamageBySource(wave) };
    const damageByReaction = { ...wave.damageByReaction };

    Object.entries(delta.damageBySource ?? {}).forEach(([sourceId, amount]) => {
      damageBySource[sourceId as DamageSourceId] = (damageBySource[sourceId as DamageSourceId] ?? 0) + (amount ?? 0);
    });

    Object.entries(delta.damageByReaction ?? {}).forEach(([reactionId, amount]) => {
      damageByReaction[reactionId as ReactionId] = (damageByReaction[reactionId as ReactionId] ?? 0) + (amount ?? 0);
    });

    return {
      ...wave,
      damage: wave.damage + (delta.damage ?? 0),
      leaks: wave.leaks + (delta.leaks ?? 0),
      kills: wave.kills + (delta.kills ?? 0),
      damageBySource,
      damageByReaction,
    };
  });
}

export function normalizeRunStateStats(state: RunState): RunState {
  const stats = state.stats;

  return {
    ...state,
    stats: {
      ...stats,
      damageBySource: getDamageBySource(stats),
      waveStats: stats.waveStats.map(wave => ({
        ...wave,
        damageBySource: getWaveDamageBySource(wave),
      })),
    },
  };
}

export function getDamageBySource(stats: RunState["stats"]): Partial<Record<DamageSourceId, number>> {
  return stats.damageBySource ?? stats.damageByReaction;
}

function getWaveDamageBySource(wave: RunState["stats"]["waveStats"][number]): Partial<Record<DamageSourceId, number>> {
  return wave.damageBySource ?? wave.damageByReaction;
}
