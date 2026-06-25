/* eslint-disable max-lines */
import type { BossAbilityId, BossDefinition, BossState, DamageSourceId, GameConfig, RunState, WaveRuntimeState } from "./types";
import { gameConfig } from "./config";
import { getCellDamageEntries } from "./damage";
import { getCurrentPathCellIndex, getWaveSpawnedCount, getWaveTotalSpawnCount, spawnEnemiesForGroups, stepActiveEnemies } from "./enemyRuntime";
import { projectReagents, resolveReactions } from "./reactions";
import { ensureWaveStats } from "./stats";

const BOSS_SUMMON_WAVE_ID = "boss-summon";

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
    triggeredAbilityIds: [],
    activeAbility: null,
    suppressionRemainingMs: 0,
    summonRuntime: null,
    ...overrides,
  };
}

export function stepBoss(state: RunState, scaledDeltaMs: number, config: GameConfig = gameConfig): RunState {
  const definition = getBossDefinition(state.boss!.bossId, config);
  const baseReactions = resolveReactions(state.board, state.placedTowers, state.upgrades, config);
  const reactions = applyBossSuppressionToReactions(baseReactions, state.boss!, definition);
  const reagentProjection = projectReagents(state.board, state.placedTowers, state.upgrades, config);
  const enemySteppedState = stepBossSummonedEnemies(state, reactions, reagentProjection, scaledDeltaMs, definition, config);

  if (enemySteppedState.coreHp <= 0) {
    return finishBossStep(enemySteppedState, {
      phase: "defeat",
      reactions,
      coreHp: enemySteppedState.coreHp,
      boss: enemySteppedState.boss!,
      totalDamage: enemySteppedState.stats.totalDamage,
      damageBySource: enemySteppedState.stats.damageBySource,
      damageByReaction: enemySteppedState.stats.damageByReaction,
      bossBreaks: enemySteppedState.stats.bossBreaks,
      enemies: enemySteppedState.enemies,
      scaledDeltaMs,
    });
  }

  const hadActiveAbility = enemySteppedState.boss!.activeAbility !== null;
  const activeResult = stepActiveBossAbility(enemySteppedState, scaledDeltaMs, definition, config);
  const bossAfterAbility = activeResult.state.boss!;
  const damageResult = applyBossDamage(activeResult.state, reactions, reagentProjection, scaledDeltaMs, definition, config);

  if (damageResult.boss.hp <= 0) {
    return finishBossStep(activeResult.state, {
      phase: "victory",
      reactions,
      coreHp: activeResult.state.coreHp,
      boss: damageResult.boss,
      totalDamage: damageResult.totalDamage,
      damageBySource: damageResult.damageBySource,
      damageByReaction: damageResult.damageByReaction,
      bossBreaks: damageResult.bossBreaks,
      enemies: [],
      scaledDeltaMs,
    });
  }

  if (hadActiveAbility && bossAfterAbility.activeAbility === null) {
    return finishBossStep(activeResult.state, {
      phase: activeResult.state.coreHp <= 0 ? "defeat" : "boss",
      reactions,
      coreHp: activeResult.state.coreHp,
      boss: damageResult.boss,
      totalDamage: damageResult.totalDamage,
      damageBySource: damageResult.damageBySource,
      damageByReaction: damageResult.damageByReaction,
      bossBreaks: damageResult.bossBreaks,
      enemies: activeResult.enemies,
      scaledDeltaMs,
    });
  }

  const abilityStartedBoss = maybeStartBossAbility({
    ...damageResult.boss,
    suppressionRemainingMs: activeResult.suppressionRemainingMs,
    summonRuntime: activeResult.summonRuntime,
  }, definition, config);

  if (abilityStartedBoss.activeAbility) {
    return finishBossStep(activeResult.state, {
      phase: "boss",
      reactions,
      coreHp: activeResult.state.coreHp,
      boss: abilityStartedBoss,
      totalDamage: damageResult.totalDamage,
      damageBySource: damageResult.damageBySource,
      damageByReaction: damageResult.damageByReaction,
      bossBreaks: damageResult.bossBreaks,
      enemies: activeResult.enemies,
      scaledDeltaMs,
    });
  }

  const movedBoss = moveBoss(abilityStartedBoss, scaledDeltaMs, definition, activeResult.state.board.pathCells.length);
  const lapResult = applyLapProgress(movedBoss, activeResult.state.coreHp, definition, activeResult.state.board.pathCells.length);

  return finishBossStep(activeResult.state, {
    phase: lapResult.coreHp <= 0 ? "defeat" : "boss",
    reactions,
    coreHp: lapResult.coreHp,
    boss: lapResult.boss,
    totalDamage: damageResult.totalDamage,
    damageBySource: damageResult.damageBySource,
    damageByReaction: damageResult.damageByReaction,
    bossBreaks: damageResult.bossBreaks,
    enemies: activeResult.enemies,
    scaledDeltaMs,
  });
}

function stepBossSummonedEnemies(
  state: RunState,
  reactions: ReturnType<typeof resolveReactions>,
  reagentProjection: ReturnType<typeof projectReagents>,
  scaledDeltaMs: number,
  definition: BossDefinition,
  config: GameConfig,
): RunState {
  const runtime = state.boss!.summonRuntime;
  const spawned = spawnEnemiesForGroups(
    runtime,
    runtime ? definition.abilities.summonWave.spawnGroups : null,
    scaledDeltaMs,
    BOSS_SUMMON_WAVE_ID,
    config,
  );
  const suppressedCellIndexes = getSuppressedCellIndexes(state.boss!, definition);
  const stepped = stepActiveEnemies({
    ...state,
    stats: runtime ? ensureWaveStats(state.stats, BOSS_SUMMON_WAVE_ID) : state.stats,
  }, {
    activeEnemies: [...state.enemies, ...spawned.enemies],
    reactions,
    reagentProjection,
    scaledDeltaMs,
    statsWaveId: runtime ? BOSS_SUMMON_WAVE_ID : null,
    suppressedReactionCellIndexes: suppressedCellIndexes,
    config,
  });
  const summonComplete = spawned.runtime
    && stepped.enemies.length === 0
    && getWaveSpawnedCount(spawned.runtime) >= getWaveTotalSpawnCount(definition.abilities.summonWave.spawnGroups);

  return {
    ...state,
    coreHp: stepped.coreHp,
    enemies: stepped.enemies,
    stats: stepped.stats,
    boss: {
      ...state.boss!,
      summonRuntime: summonComplete ? null : spawned.runtime,
    },
  };
}

function stepActiveBossAbility(
  state: RunState,
  scaledDeltaMs: number,
  definition: BossDefinition,
  config: GameConfig,
): {
  readonly state: RunState
  readonly enemies: readonly RunState["enemies"][number][]
  readonly suppressionRemainingMs: number
  readonly summonRuntime: WaveRuntimeState | null
} {
  const boss = state.boss!;
  const suppressionRemainingMs = Math.max(0, boss.suppressionRemainingMs - scaledDeltaMs);

  if (!boss.activeAbility) {
    return {
      state: {
        ...state,
        boss: {
          ...boss,
          suppressionRemainingMs,
        },
      },
      enemies: state.enemies,
      suppressionRemainingMs,
      summonRuntime: boss.summonRuntime,
    };
  }

  const elapsedMs = boss.activeAbility.elapsedMs + scaledDeltaMs;

  if (boss.activeAbility.id === "exitSmash") {
    return stepExitSmashAbility(state, elapsedMs, suppressionRemainingMs, definition, config);
  }

  if (boss.activeAbility.id === "rightSideSuppression") {
    return stepSuppressionAbility(state, elapsedMs, suppressionRemainingMs, definition);
  }

  return stepSummonAbility(state, elapsedMs, suppressionRemainingMs, definition);
}

function stepExitSmashAbility(
  state: RunState,
  elapsedMs: number,
  suppressionRemainingMs: number,
  definition: BossDefinition,
  config: GameConfig,
): ReturnType<typeof stepActiveBossAbility> {
  const boss = state.boss!;
  const ability = definition.abilities.exitSmash;
  const impactMs = ability.prepareMs + ability.leapMs;
  const totalMs = impactMs + ability.smashMs;
  const impactApplied = boss.activeAbility?.impactApplied === true || elapsedMs >= impactMs;
  const pathCellCount = state.board.pathCells.length;
  const exitSmashPathProgress = pathCellCount - 1;
  const smashedBoss = impactApplied
    ? {
        ...boss,
        lap: 2,
        pathProgress: exitSmashPathProgress,
        currentCellIndex: exitSmashPathProgress,
        vulnerableMs: 0,
        reactionBreakIds: [],
      }
    : boss;
  const coreHp = impactApplied && boss.activeAbility?.impactApplied !== true
    ? Math.max(0, state.coreHp - ability.coreDamage)
    : state.coreHp;
  const activeAbility = elapsedMs >= totalMs
    ? null
    : {
        id: ability.id,
        elapsedMs,
        impactApplied,
      };

  return {
    state: {
      ...state,
      coreHp,
      phase: coreHp <= 0 ? "defeat" : state.phase,
      boss: {
        ...smashedBoss,
        activeAbility,
        suppressionRemainingMs,
      },
      reactions: resolveReactions(state.board, state.placedTowers, state.upgrades, config),
    },
    enemies: state.enemies,
    suppressionRemainingMs,
    summonRuntime: boss.summonRuntime,
  };
}

function stepSuppressionAbility(
  state: RunState,
  elapsedMs: number,
  suppressionRemainingMs: number,
  definition: BossDefinition,
): ReturnType<typeof stepActiveBossAbility> {
  const ability = definition.abilities.rightSideSuppression;
  const completed = elapsedMs >= ability.castMs;
  const nextSuppressionMs = completed ? ability.durationMs : suppressionRemainingMs;

  return {
    state: {
      ...state,
      boss: {
        ...state.boss!,
        activeAbility: completed
          ? null
          : {
              id: ability.id,
              elapsedMs,
              impactApplied: false,
            },
        suppressionRemainingMs: nextSuppressionMs,
      },
    },
    enemies: state.enemies,
    suppressionRemainingMs: nextSuppressionMs,
    summonRuntime: state.boss!.summonRuntime,
  };
}

function stepSummonAbility(
  state: RunState,
  elapsedMs: number,
  suppressionRemainingMs: number,
  definition: BossDefinition,
): ReturnType<typeof stepActiveBossAbility> {
  const ability = definition.abilities.summonWave;
  const summoned = elapsedMs >= ability.holdMs;
  const finished = elapsedMs >= ability.holdMs + ability.postSummonHoldMs;
  const summonRuntime = summoned && !state.boss!.summonRuntime
    ? createBossSummonRuntime(ability.spawnGroups)
    : state.boss!.summonRuntime;

  return {
    state: {
      ...state,
      stats: summoned ? ensureWaveStats(state.stats, BOSS_SUMMON_WAVE_ID) : state.stats,
      boss: {
        ...state.boss!,
        activeAbility: finished
          ? null
          : {
              id: ability.id,
              elapsedMs,
              impactApplied: summoned,
            },
        suppressionRemainingMs,
        summonRuntime,
      },
    },
    enemies: state.enemies,
    suppressionRemainingMs,
    summonRuntime,
  };
}

function applyBossDamage(
  state: RunState,
  reactions: ReturnType<typeof resolveReactions>,
  reagentProjection: ReturnType<typeof projectReagents>,
  scaledDeltaMs: number,
  definition: BossDefinition,
  config: GameConfig,
): {
  readonly boss: BossState
  readonly totalDamage: number
  readonly damageBySource: Partial<Record<DamageSourceId, number>>
  readonly damageByReaction: RunState["stats"]["damageByReaction"]
  readonly bossBreaks: number
} {
  const currentCellIndex = getCurrentPathCellIndex(state.boss!.pathProgress % state.board.pathCells.length, state.board.pathCells.length);
  const suppressed = getSuppressedCellIndexes(state.boss!, definition)?.has(currentCellIndex) === true;
  const damageEntries = getCellDamageEntries(reactions[currentCellIndex]!, reagentProjection[currentCellIndex], scaledDeltaMs, state.upgrades, config)
    .filter(entry => !(suppressed && entry.reactionId));
  const reactionBreakIds = new Set(state.boss!.reactionBreakIds);
  const wasVulnerable = state.boss!.vulnerableMs > 0;
  const damageMultiplier = wasVulnerable ? definition.vulnerableDamageMultiplier : 1;
  const damageBySource = { ...(state.stats.damageBySource ?? state.stats.damageByReaction) };
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
    damageBySource[entry.sourceId] = (damageBySource[entry.sourceId] ?? 0) + appliedDamage;

    if (entry.reactionId) {
      damageByReaction[entry.reactionId] = (damageByReaction[entry.reactionId] ?? 0) + appliedDamage;
    }

    if (entry.countsForReactionBreak && entry.reactionId) {
      reactionBreakIds.add(entry.reactionId);
    }
  });

  const triggeredBreak = !wasVulnerable
    && reactionBreakIds.size >= definition.reactionBreakThreshold
    && state.boss!.reactionBreakIds.length < definition.reactionBreakThreshold;

  if (triggeredBreak) {
    bossBreaks += 1;
    vulnerableMs = definition.vulnerableDurationMs;
  }

  return {
    boss: {
      ...state.boss!,
      hp,
      vulnerableMs,
      reactionBreakIds: [...reactionBreakIds].sort(),
      currentCellIndex,
    },
    totalDamage,
    damageBySource,
    damageByReaction,
    bossBreaks,
  };
}

function maybeStartBossAbility(boss: BossState, definition: BossDefinition, config: GameConfig): BossState {
  if (boss.activeAbility || boss.hp <= 0) {
    return boss;
  }

  if (shouldStartProgressAbility(boss, definition.abilities.exitSmash.id, definition.abilities.exitSmash.triggerLap, definition.abilities.exitSmash.triggerPathProgress, config)) {
    return startAbilityAtTrigger(boss, definition.abilities.exitSmash.id, definition.abilities.exitSmash.triggerPathProgress, config);
  }

  if (
    shouldStartProgressAbility(
      boss,
      definition.abilities.rightSideSuppression.id,
      definition.abilities.rightSideSuppression.triggerLap,
      definition.abilities.rightSideSuppression.triggerPathProgress,
      config,
    )
  ) {
    return startAbilityAtTrigger(
      boss,
      definition.abilities.rightSideSuppression.id,
      definition.abilities.rightSideSuppression.triggerPathProgress,
      config,
    );
  }

  if (
    boss.lap === definition.abilities.summonWave.triggerLap
    && !boss.triggeredAbilityIds.includes(definition.abilities.summonWave.id)
    && Math.floor(boss.pathProgress / config.board.pathCells.length) === definition.abilities.summonWave.triggerLap - 1
    && getNormalizedPathProgress(boss.pathProgress, config.board.pathCells.length) <= 1
  ) {
    return {
      ...boss,
      triggeredAbilityIds: [...boss.triggeredAbilityIds, definition.abilities.summonWave.id],
      activeAbility: {
        id: definition.abilities.summonWave.id,
        elapsedMs: 0,
        impactApplied: false,
      },
    };
  }

  return boss;
}

function getNormalizedPathProgress(pathProgress: number, pathCellCount: number): number {
  return ((pathProgress % pathCellCount) + pathCellCount) % pathCellCount;
}

function shouldStartProgressAbility(
  boss: BossState,
  abilityId: BossAbilityId,
  triggerLap: number,
  triggerPathProgress: number,
  config: GameConfig,
): boolean {
  const lapOffset = (triggerLap - 1) * config.board.pathCells.length;

  return boss.lap === triggerLap
    && !boss.triggeredAbilityIds.includes(abilityId)
    && boss.pathProgress >= lapOffset + triggerPathProgress;
}

function startAbilityAtTrigger(
  boss: BossState,
  abilityId: BossAbilityId,
  triggerPathProgress: number,
  config: GameConfig,
): BossState {
  const pathProgress = (boss.lap - 1) * config.board.pathCells.length + triggerPathProgress;

  return {
    ...boss,
    pathProgress,
    currentCellIndex: getCurrentPathCellIndex(triggerPathProgress, config.board.pathCells.length),
    triggeredAbilityIds: [...boss.triggeredAbilityIds, abilityId],
    activeAbility: {
      id: abilityId,
      elapsedMs: 0,
      impactApplied: false,
    },
  };
}

function moveBoss(boss: BossState, scaledDeltaMs: number, definition: BossDefinition, pathCellCount: number): BossState {
  const bossSpeed = definition.speedCellsPerSecond + (boss.lap - 1) * definition.speedIncreasePerLap;
  const pathProgress = boss.pathProgress + bossSpeed * scaledDeltaMs / 1000;

  return {
    ...boss,
    pathProgress,
    currentCellIndex: getCurrentPathCellIndex(pathProgress % pathCellCount, pathCellCount),
  };
}

function applyLapProgress(boss: BossState, coreHp: number, definition: BossDefinition, pathCellCount: number): {
  readonly boss: BossState
  readonly coreHp: number
} {
  const previousCompletedLaps = boss.lap - 1;
  const completedLaps = Math.floor(boss.pathProgress / pathCellCount);
  const crossedLapCount = Math.max(0, completedLaps - previousCompletedLaps);
  let nextCoreHp = coreHp;
  let nextBoss = boss;

  if (crossedLapCount > 0) {
    nextCoreHp = Math.max(0, nextCoreHp - definition.lapCoreDamage * crossedLapCount);
    nextBoss = {
      ...nextBoss,
      lap: Math.min(definition.laps, completedLaps + 1),
      reactionBreakIds: [],
      vulnerableMs: 0,
    };
  }

  if (completedLaps >= definition.laps && nextCoreHp > 0) {
    nextCoreHp = 0;
  }

  return {
    boss: nextBoss,
    coreHp: nextCoreHp,
  };
}

function finishBossStep(
  state: RunState,
  result: Pick<RunState, "phase" | "reactions" | "coreHp" | "enemies"> & {
    readonly boss: BossState
    readonly totalDamage: number
    readonly damageBySource: Partial<Record<DamageSourceId, number>>
    readonly damageByReaction: RunState["stats"]["damageByReaction"]
    readonly bossBreaks: number
    readonly scaledDeltaMs: number
  },
): RunState {
  return {
    ...state,
    phase: result.phase,
    tick: state.tick + 1,
    elapsedMs: state.elapsedMs + result.scaledDeltaMs,
    coreHp: result.coreHp,
    enemies: result.enemies,
    reactions: result.reactions,
    boss: result.boss,
    stats: {
      ...state.stats,
      bossBreaks: result.bossBreaks,
      totalDamage: result.totalDamage,
      damageBySource: result.damageBySource,
      damageByReaction: result.damageByReaction,
    },
  };
}

function applyBossSuppressionToReactions(
  reactions: ReturnType<typeof resolveReactions>,
  boss: BossState,
  definition: BossDefinition,
): ReturnType<typeof resolveReactions> {
  const suppressedCellIndexes = getSuppressedCellIndexes(boss, definition);

  if (!suppressedCellIndexes) {
    return reactions;
  }

  return reactions.map(reaction => suppressedCellIndexes.has(reaction.cellIndex)
    ? {
        ...reaction,
        ground: null,
        air: null,
      }
    : reaction);
}

function getSuppressedCellIndexes(boss: BossState, definition: BossDefinition): ReadonlySet<number> | undefined {
  return boss.suppressionRemainingMs > 0
    ? new Set(definition.abilities.rightSideSuppression.cellIndexes)
    : undefined;
}

function createBossSummonRuntime(spawnGroups: BossDefinition["abilities"]["summonWave"]["spawnGroups"]): WaveRuntimeState {
  return {
    waveId: BOSS_SUMMON_WAVE_ID,
    elapsedMs: 0,
    groups: spawnGroups.map((group, groupIndex) => ({
      groupIndex,
      spawnedCount: 0,
      nextSpawnMs: group.startDelayMs ?? 0,
    })),
  };
}

function getBossDefinition(bossId: string, config: GameConfig): BossDefinition {
  if (config.boss.id !== bossId) {
    throw new Error(`Unknown boss ${bossId}`);
  }

  return config.boss;
}
