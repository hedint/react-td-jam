import type {
  DamageFamily,
  EnemyDefinition,
  EnemyId,
  EnemyState,
  GameAction,
  GameConfig,
  GameSnapshot,
  ReactionId,
  RunState,
  TowerState,
  WaveRuntimeState,
} from "./types";
import { createBossState, stepBoss } from "./boss";
import { gameConfig } from "./config";
import { chooseDraftTower, chooseDraftUpgrade, createDraftState, rerollDraft } from "./draft";
import { getCellSpeedMultiplier, getReactionDamageEntries, projectReagents, resolveReactions } from "./reactions";
import { createRng } from "./rng";
import { createTower } from "./towerFactory";
import { placeSelectedTower, selectTower, tapSlot } from "./towerPlacement";

export { createRng, nextRandom } from "./rng";
export { createTower } from "./towerFactory";

export interface SerializedRunPayload {
  readonly schemaVersion: number
  readonly state: RunState
}

export interface CreateRunOptions {
  readonly placedTowers?: readonly TowerState[]
  readonly enemies?: readonly EnemyState[]
  readonly config?: GameConfig
}

export function createRun(seed = 1, options: CreateRunOptions = {}): RunState {
  const config = options.config ?? gameConfig;
  const placedTowers = options.placedTowers ?? [];
  const placedTowerIds = new Set(placedTowers.map(tower => tower.id));
  const bench = createStartingTowers(config)
    .filter(tower => !placedTowerIds.has(tower.id))
    .map(tower => ({ ...tower, slotId: null }));

  return {
    schemaVersion: config.balance.schemaVersion,
    phase: options.enemies ? "wave" : "ready",
    seed,
    rng: createRng(seed),
    tick: 0,
    elapsedMs: 0,
    waveIndex: 0,
    countdownMs: 0,
    paused: false,
    speed: 1,
    coreHp: config.balance.coreHp,
    waveRuntime: null,
    board: config.board,
    bench,
    placedTowers,
    selectedTowerId: null,
    enemies: options.enemies ?? [],
    reactions: resolveReactions(config.board, placedTowers, [], config),
    draft: null,
    upgrades: [],
    boss: null,
    stats: {
      leaks: 0,
      kills: 0,
      bossBreaks: 0,
      totalDamage: 0,
      damageByReaction: {},
      waveStats: [],
    },
    debugVisible: false,
    lastTap: null,
  };
}

export function stepRun(state: RunState, deltaMs: number, config: GameConfig = gameConfig): RunState {
  if (state.paused) {
    return state;
  }

  const stepScale = state.speed;
  const scaledDeltaMs = deltaMs * stepScale;

  if (state.phase === "countdown") {
    const countdownMs = Math.max(0, state.countdownMs - scaledDeltaMs);
    const nextState = {
      ...state,
      tick: state.tick + 1,
      elapsedMs: state.elapsedMs + scaledDeltaMs,
      countdownMs,
    };

    return countdownMs <= 0 ? startWave(nextState, config) : nextState;
  }

  if (state.phase === "boss" && state.boss) {
    return stepBoss(state, scaledDeltaMs, config);
  }

  if (state.phase !== "wave") {
    return state;
  }

  const reactions = resolveReactions(state.board, state.placedTowers, state.upgrades, config);
  const reagentProjection = projectReagents(state.board, state.placedTowers, state.upgrades, config);
  const spawned = spawnWaveEnemies(state.waveRuntime, scaledDeltaMs, config);
  const activeEnemies = [...state.enemies, ...spawned.enemies];

  let coreHp = state.coreHp;
  let leaks = state.stats.leaks;
  let kills = state.stats.kills;
  let totalDamage = state.stats.totalDamage;
  const damageByReaction = { ...state.stats.damageByReaction };
  let waveStats: RunState["stats"]["waveStats"] = [...state.stats.waveStats];
  const enemies = activeEnemies.flatMap((enemy) => {
    if (enemy.hp <= 0 || enemy.leaked) {
      return [];
    }

    const enemyDefinition = getEnemyDefinition(enemy.enemyId, config);
    const currentCellIndex = getCurrentPathCellIndex(enemy.pathProgress, state.board.pathCells.length);
    const speedMultiplier = getCellSpeedMultiplier(reagentProjection[currentCellIndex], state.upgrades, config);
    const pathProgress = enemy.pathProgress + (enemyDefinition?.speedCellsPerSecond ?? 1) * speedMultiplier * scaledDeltaMs / 1000;

    if (pathProgress >= state.board.pathCells.length) {
      coreHp = Math.max(0, coreHp - (enemyDefinition?.leakDamage ?? config.balance.leakDamage));
      leaks += 1;
      waveStats = updateWaveStats(waveStats, spawned.waveId, { leaks: 1 });

      return [];
    }

    const cellIndex = getCurrentPathCellIndex(pathProgress, state.board.pathCells.length);
    const damageEntries = getReactionDamageEntries(reactions[cellIndex]!, scaledDeltaMs, state.upgrades, config);
    let hp = enemy.hp;

    damageEntries.forEach((entry) => {
      if (hp <= 0) {
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
      damageByReaction[entry.reactionId] = (damageByReaction[entry.reactionId] ?? 0) + appliedDamage;
      waveStats = updateWaveStats(waveStats, spawned.waveId, {
        damage: appliedDamage,
        damageByReaction: {
          [entry.reactionId]: appliedDamage,
        },
      });
    });

    if (hp <= 0) {
      kills += 1;
      waveStats = updateWaveStats(waveStats, spawned.waveId, { kills: 1 });

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

  const waveComplete = isWaveComplete(spawned.waveRuntime, enemies.length, config);
  const nextPhase = coreHp <= 0
    ? "defeat"
    : waveComplete
      ? state.waveIndex >= config.waves.length - 1
        ? "boss"
        : "draft"
      : state.phase;
  const generatedDraft = nextPhase === "draft"
    ? createDraftState(state, config)
    : null;
  const boss = nextPhase === "boss"
    ? createBossState({}, config)
    : state.boss;

  return {
    ...state,
    phase: nextPhase,
    rng: generatedDraft?.rng ?? state.rng,
    tick: state.tick + 1,
    elapsedMs: state.elapsedMs + scaledDeltaMs,
    draft: generatedDraft?.draft ?? state.draft,
    waveRuntime: nextPhase === "draft" || nextPhase === "boss" || nextPhase === "defeat" ? null : spawned.waveRuntime,
    boss,
    coreHp,
    enemies,
    reactions,
    stats: {
      ...state.stats,
      leaks,
      kills,
      totalDamage,
      damageByReaction,
      waveStats,
    },
  };
}

export function createSnapshot(state: RunState): GameSnapshot {
  return {
    ...state,
    livingEnemies: state.enemies.filter(enemy => enemy.hp > 0 && !enemy.leaked),
    activeReactions: state.reactions.filter(reaction => reaction.ground !== null || reaction.air !== null),
  };
}

export function applyAction(state: RunState, action: GameAction, config: GameConfig = gameConfig): RunState {
  switch (action.type) {
    case "pause":
      return { ...state, paused: true };
    case "resume":
      return { ...state, paused: false };
    case "startWave":
      return state.phase === "ready" ? startWave(state, config) : state;
    case "rerollDraft":
      return rerollDraft(state, config);
    case "chooseDraftTower":
      return chooseDraftTower(state, action.emitterId, config);
    case "chooseDraftUpgrade":
      return chooseDraftUpgrade(state, action.upgradeId, config);
    case "setSpeed":
      return { ...state, speed: action.speed };
    case "selectTower":
      return selectTower(state, action.towerId);
    case "placeSelectedTower":
      return placeSelectedTower(state, action.slotId);
    case "tapSlot":
      return tapSlot(state, action.slotId);
    case "toggleDebug":
      return { ...state, debugVisible: !state.debugVisible };
    case "tap":
      return { ...state, lastTap: action.point };
    case "restart":
      return createRun(action.seed ?? state.seed, { config });
    default:
      return action satisfies never;
  }
}

export function serializeRun(state: RunState, config: GameConfig = gameConfig): string {
  const payload: SerializedRunPayload = {
    schemaVersion: config.balance.schemaVersion,
    state,
  };

  return JSON.stringify(payload);
}

export function deserializeRun(payload: string | SerializedRunPayload, config: GameConfig = gameConfig): RunState {
  const parsed = typeof payload === "string" ? JSON.parse(payload) as SerializedRunPayload : payload;

  if (parsed.schemaVersion !== config.balance.schemaVersion) {
    throw new Error(`Unsupported run schema version: ${parsed.schemaVersion}`);
  }

  return {
    ...parsed.state,
    reactions: resolveReactions(parsed.state.board, parsed.state.placedTowers, parsed.state.upgrades, config),
  };
}

export function createGrunt(overrides: Partial<EnemyState> = {}, config: GameConfig = gameConfig): EnemyState {
  return createEnemy("enemy-grunt-a", "grunt", overrides, config);
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

function startWave(state: RunState, config: GameConfig): RunState {
  const wave = config.waves[state.waveIndex] ?? config.waves[0]!;
  const waveRuntime: WaveRuntimeState = {
    waveId: wave.id,
    spawnedCount: Math.min(1, wave.count),
    elapsedMs: 0,
    nextSpawnMs: wave.spawnIntervalMs,
  };

  return {
    ...state,
    phase: "wave",
    countdownMs: 0,
    draft: null,
    waveRuntime,
    enemies: wave.count > 0
      ? [createEnemy(`${wave.id}-enemy-0`, wave.enemyId, { pathProgress: 0 }, config)]
      : [],
    stats: ensureWaveStats(state.stats, wave.id),
  };
}

function spawnWaveEnemies(
  waveRuntime: WaveRuntimeState | null,
  deltaMs: number,
  config: GameConfig,
): {
  readonly waveId: string | null
  readonly waveRuntime: WaveRuntimeState | null
  readonly enemies: readonly EnemyState[]
} {
  if (!waveRuntime) {
    return {
      waveId: null,
      waveRuntime: null,
      enemies: [],
    };
  }

  const wave = config.waves.find(candidate => candidate.id === waveRuntime.waveId);
  if (!wave) {
    return {
      waveId: waveRuntime.waveId,
      waveRuntime,
      enemies: [],
    };
  }

  let spawnedCount = waveRuntime.spawnedCount;
  let nextSpawnMs = waveRuntime.nextSpawnMs;
  const elapsedMs = waveRuntime.elapsedMs + deltaMs;
  const enemies: EnemyState[] = [];

  while (spawnedCount < wave.count && elapsedMs >= nextSpawnMs) {
    enemies.push(createEnemy(`${wave.id}-enemy-${spawnedCount}`, wave.enemyId, { pathProgress: 0 }, config));
    spawnedCount += 1;
    nextSpawnMs += wave.spawnIntervalMs;
  }

  return {
    waveId: wave.id,
    waveRuntime: {
      ...waveRuntime,
      spawnedCount,
      elapsedMs,
      nextSpawnMs,
    },
    enemies,
  };
}

function isWaveComplete(waveRuntime: WaveRuntimeState | null, livingEnemyCount: number, config: GameConfig): boolean {
  if (!waveRuntime) {
    return livingEnemyCount === 0;
  }

  const wave = config.waves.find(candidate => candidate.id === waveRuntime.waveId);

  return livingEnemyCount === 0 && waveRuntime.spawnedCount >= (wave?.count ?? 0);
}

export function getCurrentPathCellIndex(pathProgress: number, pathCellCount: number): number {
  return Math.max(0, Math.min(pathCellCount - 1, Math.floor(pathProgress)));
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

function getEnemyResistanceMultiplier(enemy: EnemyDefinition, damageFamily: DamageFamily): number {
  return enemy.resistances?.[damageFamily] ?? 1;
}

function createStartingTowers(config: GameConfig): readonly TowerState[] {
  return [
    createTower("tower-water-a", "water", null, config),
    createTower("tower-water-b", "water", null, config),
    createTower("tower-spark-a", "spark", null, config),
  ];
}

function ensureWaveStats(stats: RunState["stats"], waveId: string): RunState["stats"] {
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
        damageByReaction: {},
      },
    ],
  };
}

function updateWaveStats(
  waveStats: RunState["stats"]["waveStats"],
  waveId: string | null,
  delta: Partial<Pick<RunState["stats"]["waveStats"][number], "damage" | "leaks" | "kills">> & {
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
      damageByReaction: {},
      waveStats,
    }, waveId).waveStats;

  return stats.map((wave) => {
    if (wave.waveId !== waveId) {
      return wave;
    }

    const damageByReaction = { ...wave.damageByReaction };

    Object.entries(delta.damageByReaction ?? {}).forEach(([reactionId, amount]) => {
      damageByReaction[reactionId as ReactionId] = (damageByReaction[reactionId as ReactionId] ?? 0) + (amount ?? 0);
    });

    return {
      ...wave,
      damage: wave.damage + (delta.damage ?? 0),
      leaks: wave.leaks + (delta.leaks ?? 0),
      kills: wave.kills + (delta.kills ?? 0),
      damageByReaction,
    };
  });
}
