import type { BossDefinition, BossState, GameConfig, RunState } from "./types";
import { gameConfig } from "./config";
import { getReactionDamageEntries, resolveReactions } from "./reactions";

export function createBossState(overrides: Partial<BossState> = {}, config: GameConfig = gameConfig): BossState {
  const definition = config.boss;
  const pathProgress = overrides.pathProgress ?? 0;

  return {
    bossId: definition.id,
    lap: 1,
    hp: definition.hp,
    maxHp: definition.hp,
    pathProgress,
    currentCellIndex: getCurrentPathCellIndex(pathProgress, config.balance.pathCellCount),
    vulnerableMs: 0,
    reactionBreakIds: [],
    ...overrides,
  };
}

export function stepBoss(state: RunState, scaledDeltaMs: number, config: GameConfig = gameConfig): RunState {
  const definition = getBossDefinition(state.boss!.bossId, config);
  const reactions = resolveReactions(state.board, state.placedTowers, state.upgrades, config);
  const bossSpeed = definition.speedCellsPerSecond + (state.boss!.lap - 1) * definition.speedIncreasePerLap;
  const pathProgress = state.boss!.pathProgress + bossSpeed * scaledDeltaMs / 1000;
  const currentCellIndex = getCurrentPathCellIndex(pathProgress % state.board.pathCells.length, state.board.pathCells.length);
  const damageEntries = getReactionDamageEntries(reactions[currentCellIndex]!, scaledDeltaMs, state.upgrades, config);
  const reactionBreakIds = new Set(state.boss!.reactionBreakIds);
  const wasVulnerable = state.boss!.vulnerableMs > 0;
  const damageMultiplier = wasVulnerable ? definition.vulnerableDamageMultiplier : 1;
  const damageByReaction = { ...state.stats.damageByReaction };
  let hp = state.boss!.hp;
  let totalDamage = state.stats.totalDamage;
  let bossBreaks = state.stats.bossBreaks;
  let vulnerableMs = Math.max(0, state.boss!.vulnerableMs - scaledDeltaMs);

  damageEntries.forEach((entry) => {
    if (hp <= 0) {
      return;
    }

    const appliedDamage = Math.min(hp, entry.amount * damageMultiplier);

    if (appliedDamage <= 0) {
      return;
    }

    hp = Math.max(0, hp - appliedDamage);
    totalDamage += appliedDamage;
    damageByReaction[entry.reactionId] = (damageByReaction[entry.reactionId] ?? 0) + appliedDamage;
    reactionBreakIds.add(entry.reactionId);
  });

  const triggeredBreak = !wasVulnerable
    && reactionBreakIds.size >= definition.reactionBreakThreshold
    && state.boss!.reactionBreakIds.length < definition.reactionBreakThreshold;

  if (triggeredBreak) {
    bossBreaks += 1;
    vulnerableMs = definition.vulnerableDurationMs;
  }

  if (hp <= 0) {
    return finishBossStep(state, {
      phase: "victory",
      reactions,
      pathProgress,
      currentCellIndex,
      hp,
      vulnerableMs,
      reactionBreakIds: [...reactionBreakIds].sort(),
      totalDamage,
      damageByReaction,
      bossBreaks,
      coreHp: state.coreHp,
      scaledDeltaMs,
    });
  }

  const previousCompletedLaps = state.boss!.lap - 1;
  const completedLaps = Math.floor(pathProgress / state.board.pathCells.length);
  const crossedLapCount = Math.max(0, completedLaps - previousCompletedLaps);
  let coreHp = state.coreHp;
  let lap = state.boss!.lap;
  let nextReactionBreakIds = [...reactionBreakIds].sort();

  if (crossedLapCount > 0) {
    coreHp = Math.max(0, coreHp - definition.lapCoreDamage * crossedLapCount);
    lap = Math.min(definition.laps, completedLaps + 1);
    nextReactionBreakIds = [];
    vulnerableMs = 0;
  }

  if (completedLaps >= definition.laps && coreHp > 0) {
    coreHp = 0;
  }

  return finishBossStep(state, {
    phase: coreHp <= 0 ? "defeat" : "boss",
    reactions,
    pathProgress,
    currentCellIndex,
    hp,
    vulnerableMs,
    reactionBreakIds: nextReactionBreakIds,
    totalDamage,
    damageByReaction,
    bossBreaks,
    coreHp,
    lap,
    scaledDeltaMs,
  });
}

function finishBossStep(
  state: RunState,
  result: Pick<RunState, "phase" | "reactions" | "coreHp"> & {
    readonly pathProgress: number
    readonly currentCellIndex: number
    readonly hp: number
    readonly vulnerableMs: number
    readonly reactionBreakIds: readonly BossState["reactionBreakIds"][number][]
    readonly totalDamage: number
    readonly damageByReaction: RunState["stats"]["damageByReaction"]
    readonly bossBreaks: number
    readonly lap?: number
    readonly scaledDeltaMs: number
  },
): RunState {
  return {
    ...state,
    phase: result.phase,
    tick: state.tick + 1,
    elapsedMs: state.elapsedMs + result.scaledDeltaMs,
    coreHp: result.coreHp,
    enemies: [],
    reactions: result.reactions,
    boss: {
      ...state.boss!,
      lap: result.lap ?? state.boss!.lap,
      hp: result.hp,
      pathProgress: result.pathProgress,
      currentCellIndex: result.currentCellIndex,
      vulnerableMs: result.vulnerableMs,
      reactionBreakIds: result.reactionBreakIds,
    },
    stats: {
      ...state.stats,
      bossBreaks: result.bossBreaks,
      totalDamage: result.totalDamage,
      damageByReaction: result.damageByReaction,
    },
  };
}

function getBossDefinition(bossId: string, config: GameConfig): BossDefinition {
  if (config.boss.id !== bossId) {
    throw new Error(`Unknown boss ${bossId}`);
  }

  return config.boss;
}

function getCurrentPathCellIndex(pathProgress: number, pathCellCount: number): number {
  return Math.max(0, Math.min(pathCellCount - 1, Math.floor(pathProgress)));
}
