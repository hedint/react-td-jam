import type {
  CellReactionState,
  CellReagentProjection,
  DamageFamily,
  EnemyDefinition,
  EnemyId,
  EnemyState,
  GameConfig,
  RunState,
  WaveRuntimeState,
  WaveSpawnGroup,
} from "./types";
import { getEnemyLeakPathProgress } from "./boardGeometry";
import { gameConfig } from "./config";
import { getCellDamageEntries } from "./damage";
import { getCellSpeedMultiplier } from "./reactions";
import { getDamageBySource, updateWaveStats } from "./stats";

const ENEMY_EFFECT_CONTACT_PROGRESS = 0.35;

export interface SpawnRuntimeResult {
  readonly waveId: string | null
  readonly runtime: WaveRuntimeState | null
  readonly enemies: readonly EnemyState[]
}

export interface EnemyStepResult {
  readonly enemies: readonly EnemyState[]
  readonly coreHp: number
  readonly stats: RunState["stats"]
}

export function createEnemy(id: string, enemyId: EnemyId, overrides: Partial<EnemyState> = {}, config: GameConfig = gameConfig): EnemyState {
  const definition = getEnemyDefinition(enemyId, config);
  const pathProgress = overrides.pathProgress ?? 0;

  return {
    id,
    enemyId,
    displayName: definition.displayName,
    hp: definition.hp,
    maxHp: definition.hp,
    pathProgress,
    currentCellIndex: getCurrentPathCellIndex(pathProgress, config.balance.pathCellCount),
    leaked: false,
    ...overrides,
  };
}

export function spawnEnemiesForGroups(
  runtime: WaveRuntimeState | null,
  spawnGroups: readonly WaveSpawnGroup[] | null,
  deltaMs: number,
  enemyIdPrefix: string,
  config: GameConfig,
): SpawnRuntimeResult {
  if (!runtime || !spawnGroups) {
    return {
      waveId: null,
      runtime: null,
      enemies: [],
    };
  }

  const elapsedMs = runtime.elapsedMs + deltaMs;
  const enemies: EnemyState[] = [];
  const groups = spawnGroups.map((group, groupIndex) => {
    const groupRuntime = runtime.groups.find(candidate => candidate.groupIndex === groupIndex) ?? {
      groupIndex,
      spawnedCount: 0,
      nextSpawnMs: group.startDelayMs ?? 0,
    };
    let spawnedCount = groupRuntime.spawnedCount;
    let nextSpawnMs = groupRuntime.nextSpawnMs;

    while (spawnedCount < group.count && elapsedMs >= nextSpawnMs) {
      enemies.push(createEnemy(`${enemyIdPrefix}-g${groupIndex}-enemy-${spawnedCount}`, group.enemyId, { pathProgress: 0 }, config));
      spawnedCount += 1;
      nextSpawnMs += group.spawnIntervalMs;
    }

    return {
      groupIndex,
      spawnedCount,
      nextSpawnMs,
    };
  });

  return {
    waveId: runtime.waveId,
    runtime: {
      ...runtime,
      elapsedMs,
      groups,
    },
    enemies,
  };
}

export function stepActiveEnemies(
  state: RunState,
  options: {
    readonly activeEnemies: readonly EnemyState[]
    readonly reactions: readonly CellReactionState[]
    readonly reagentProjection: readonly CellReagentProjection[]
    readonly scaledDeltaMs: number
    readonly statsWaveId: string | null
    readonly suppressedReactionCellIndexes?: ReadonlySet<number>
    readonly config: GameConfig
  },
): EnemyStepResult {
  const leakPathProgress = getEnemyLeakPathProgress(state.board.pathCells);
  let coreHp = state.coreHp;
  let leaks = state.stats.leaks;
  let kills = state.stats.kills;
  let totalDamage = state.stats.totalDamage;
  const damageBySource = { ...getDamageBySource(state.stats) };
  const damageByReaction = { ...state.stats.damageByReaction };
  let waveStats: RunState["stats"]["waveStats"] = [...state.stats.waveStats];
  const enemies = options.activeEnemies.flatMap((enemy) => {
    if (enemy.hp <= 0 || enemy.leaked) {
      return [];
    }

    const enemyDefinition = getEnemyDefinition(enemy.enemyId, options.config);
    const currentCellIndex = getEnemyEffectCellIndex(enemy.pathProgress, state.board.pathCells.length);
    const speedMultiplier = getEnemySpeedMultiplier(
      enemyDefinition,
      options.reagentProjection[currentCellIndex],
      state.upgrades,
      options.config,
      options.reactions[currentCellIndex],
    );
    const pathProgress = enemy.pathProgress + enemyDefinition.speedCellsPerSecond * speedMultiplier * options.scaledDeltaMs / 1000;

    if (pathProgress >= leakPathProgress) {
      coreHp = state.debugCoreHpLocked
        ? coreHp
        : Math.max(0, coreHp - enemyDefinition.leakDamage);
      leaks += 1;
      waveStats = updateWaveStats(waveStats, options.statsWaveId, { leaks: 1 });

      return [];
    }

    const cellIndex = getEnemyEffectCellIndex(pathProgress, state.board.pathCells.length);
    const damageEntries = getCellDamageEntries(
      options.reactions[cellIndex]!,
      options.reagentProjection[cellIndex],
      options.scaledDeltaMs,
      state.upgrades,
      options.config,
    );
    const suppressed = options.suppressedReactionCellIndexes?.has(cellIndex) === true;
    let hp = enemy.hp;

    damageEntries.forEach((entry) => {
      if (hp <= 0 || (suppressed && entry.reactionId)) {
        return;
      }

      const rawDamage = isEnemyAffectedByReaction(enemyDefinition, entry.layer)
        ? entry.amount * getEnemyResistanceMultiplier(enemyDefinition, entry.damageFamily)
        : 0;
      const appliedDamage = Math.min(hp, rawDamage);

      if (appliedDamage <= 0) {
        return;
      }

      hp = Math.max(0, hp - appliedDamage);
      totalDamage += appliedDamage;
      damageBySource[entry.sourceId] = (damageBySource[entry.sourceId] ?? 0) + appliedDamage;

      if (entry.reactionId) {
        damageByReaction[entry.reactionId] = (damageByReaction[entry.reactionId] ?? 0) + appliedDamage;
      }

      waveStats = updateWaveStats(waveStats, options.statsWaveId, {
        damage: appliedDamage,
        damageBySource: {
          [entry.sourceId]: appliedDamage,
        },
        damageByReaction: entry.reactionId
          ? {
              [entry.reactionId]: appliedDamage,
            }
          : undefined,
      });
    });

    if (hp <= 0) {
      kills += 1;
      waveStats = updateWaveStats(waveStats, options.statsWaveId, { kills: 1 });

      return [];
    }

    return [
      {
        ...enemy,
        hp,
        pathProgress,
        currentCellIndex: cellIndex,
      },
    ];
  });

  return {
    enemies,
    coreHp,
    stats: {
      ...state.stats,
      leaks,
      kills,
      totalDamage,
      damageBySource,
      damageByReaction,
      waveStats,
    },
  };
}

export function getWaveTotalSpawnCount(spawnGroups: readonly WaveSpawnGroup[]): number {
  return spawnGroups.reduce((total, group) => total + group.count, 0);
}

export function getWaveSpawnedCount(waveRuntime: WaveRuntimeState | null): number {
  return waveRuntime?.groups.reduce((total, group) => total + group.spawnedCount, 0) ?? 0;
}

export function getCurrentPathCellIndex(pathProgress: number, pathCellCount: number): number {
  return Math.max(0, Math.min(pathCellCount - 1, Math.floor(pathProgress)));
}

export function getEnemyEffectCellIndex(pathProgress: number, pathCellCount: number): number {
  return getCurrentPathCellIndex(pathProgress + ENEMY_EFFECT_CONTACT_PROGRESS, pathCellCount);
}

function getEnemyDefinition(enemyId: EnemyId, config: GameConfig): EnemyDefinition {
  const definition = config.enemies.find(enemy => enemy.id === enemyId);

  if (!definition) {
    throw new Error(`Unknown enemy ${enemyId}`);
  }

  return definition;
}

function isEnemyAffectedByReaction(enemy: EnemyDefinition, layer: "ground" | "air"): boolean {
  return !enemy.traits?.includes("flying") || layer === "air";
}

function getEnemySpeedMultiplier(
  enemy: EnemyDefinition,
  projection: Parameters<typeof getCellSpeedMultiplier>[0],
  upgrades: Parameters<typeof getCellSpeedMultiplier>[1],
  config: GameConfig,
  reaction: Parameters<typeof getCellSpeedMultiplier>[3],
): number {
  return enemy.traits?.includes("flying")
    ? 1
    : getCellSpeedMultiplier(projection, upgrades, config, reaction);
}

function getEnemyResistanceMultiplier(enemy: EnemyDefinition, damageFamily: DamageFamily): number {
  return enemy.resistances?.[damageFamily] ?? 1;
}
