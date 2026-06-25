import type {
  CellReactionState,
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
import { applyUpgradeToState, chooseDraftTower, chooseDraftUpgrade, createDraftState, rerollDraft } from "./draft";
import {
  createEnemy,
  getWaveSpawnedCount as getSpawnedCount,
  getWaveTotalSpawnCount as getSpawnGroupTotalCount,
  spawnEnemiesForGroups,
  stepActiveEnemies,
} from "./enemyRuntime";
import { projectReagents, resolveReactions } from "./reactions";
import { createRng } from "./rng";
import { ensureWaveStats, normalizeRunStateStats } from "./stats";
import { createTower } from "./towerFactory";
import { placeSelectedTower, selectTower, tapSlot } from "./towerPlacement";

export { createEnemy, getCurrentPathCellIndex } from "./enemyRuntime";
export { getWaveSpawnedCount } from "./enemyRuntime";

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
      damageBySource: {},
      damageByReaction: {},
      waveStats: [],
    },
    debugVisible: false,
    debugCoreHpLocked: false,
    debugReactionOverrides: [],
    lastTap: null,
  };
}

export function stepRun(state: RunState, deltaMs: number, config: GameConfig = gameConfig): RunState {
  if (state.paused) {
    return state;
  }

  const stepScale = state.speed;
  const scaledDeltaMs = deltaMs * stepScale;
  const stateWithDebugTick = stepDebugReactionOverrides(state, scaledDeltaMs);

  if (stateWithDebugTick.phase === "countdown") {
    const countdownMs = Math.max(0, stateWithDebugTick.countdownMs - scaledDeltaMs);
    const nextState = {
      ...stateWithDebugTick,
      tick: stateWithDebugTick.tick + 1,
      elapsedMs: stateWithDebugTick.elapsedMs + scaledDeltaMs,
      countdownMs,
    };

    return countdownMs <= 0 ? startWave(nextState, config) : nextState;
  }

  if (stateWithDebugTick.phase === "boss" && stateWithDebugTick.boss) {
    const nextBossState = stepBoss(stateWithDebugTick, scaledDeltaMs, config);

    return stateWithDebugTick.debugCoreHpLocked
      ? { ...nextBossState, coreHp: stateWithDebugTick.coreHp, phase: nextBossState.phase === "defeat" ? "boss" : nextBossState.phase }
      : nextBossState;
  }

  if (stateWithDebugTick.phase !== "wave") {
    return stateWithDebugTick;
  }

  const baseReactions = resolveReactions(stateWithDebugTick.board, stateWithDebugTick.placedTowers, stateWithDebugTick.upgrades, config);
  const reactions = applyDebugReactionOverrides(baseReactions, stateWithDebugTick.debugReactionOverrides);
  const reagentProjection = projectReagents(stateWithDebugTick.board, stateWithDebugTick.placedTowers, stateWithDebugTick.upgrades, config);
  const spawned = spawnWaveEnemies(stateWithDebugTick.waveRuntime, scaledDeltaMs, config);
  const activeEnemies = [...stateWithDebugTick.enemies, ...spawned.enemies];
  const stepped = stepActiveEnemies(stateWithDebugTick, {
    activeEnemies,
    reactions,
    reagentProjection,
    scaledDeltaMs,
    statsWaveId: spawned.waveId,
    config,
  });
  const { enemies, coreHp } = stepped;

  const waveComplete = isWaveComplete(spawned.waveRuntime, enemies.length, config);
  const nextPhase = coreHp <= 0
    ? "defeat"
    : waveComplete
      ? stateWithDebugTick.waveIndex >= config.waves.length - 1
        ? "boss"
        : "draft"
      : stateWithDebugTick.phase;
  const generatedDraft = nextPhase === "draft"
    ? createDraftState(stateWithDebugTick, config)
    : null;
  const boss = nextPhase === "boss"
    ? createBossState({}, config)
    : state.boss;

  return {
    ...stateWithDebugTick,
    phase: nextPhase,
    rng: generatedDraft?.rng ?? state.rng,
    tick: stateWithDebugTick.tick + 1,
    elapsedMs: stateWithDebugTick.elapsedMs + scaledDeltaMs,
    draft: generatedDraft?.draft ?? stateWithDebugTick.draft,
    waveRuntime: nextPhase === "draft" || nextPhase === "boss" || nextPhase === "defeat" ? null : spawned.waveRuntime,
    boss,
    coreHp,
    enemies,
    reactions,
    stats: {
      ...stepped.stats,
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
    case "debugJumpToWave":
      return applyDebugAction(state, () => createDebugWaveState(state, action.waveIndex, config));
    case "debugJumpToBoss":
      return applyDebugAction(state, () => ({
        ...state,
        phase: "boss",
        waveIndex: config.waves.length - 1,
        countdownMs: 0,
        waveRuntime: null,
        enemies: [],
        draft: null,
        boss: createBossState({}, config),
      }));
    case "debugSetCoreHpLocked":
      return applyDebugAction(state, () => ({ ...state, debugCoreHpLocked: action.locked }));
    case "debugForceSpawnEnemy":
      return applyDebugAction(state, () => debugForceSpawnEnemy(state, action.enemyId, action.count ?? 1, config));
    case "debugForceAddTower":
      return applyDebugAction(state, () => ({
        ...state,
        bench: [...state.bench, createTower(`debug-tower-${action.emitterId}-${state.tick}-${state.bench.length}`, action.emitterId, null, config)],
      }));
    case "debugForceApplyUpgrade": {
      const definition = config.upgrades.find(upgrade => upgrade.id === action.upgradeId);

      return applyDebugAction(state, () => definition ? applyUpgradeToState(state, definition) : state);
    }
    case "debugUnlockSlot":
      return applyDebugAction(state, () => unlockSlotInState(state, action.slotId, config));
    case "debugAddReactionOverride":
      return applyDebugAction(state, () => addDebugReactionOverride(state, action.cellIndex, action.layer, action.reactionId, action.ttlMs ?? 10000));
    case "debugClearReactionOverrides":
      return applyDebugAction(state, () => ({ ...state, debugReactionOverrides: [] }));
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

  const state = normalizeRunStateStats(parsed.state);

  return {
    ...state,
    reactions: resolveReactions(state.board, state.placedTowers, state.upgrades, config),
  };
}

export function createGrunt(overrides: Partial<EnemyState> = {}, config: GameConfig = gameConfig): EnemyState {
  return createEnemy("enemy-grunt-a", "grunt", overrides, config);
}

export { createRng, nextRandom } from "./rng";

function startWave(state: RunState, config: GameConfig): RunState {
  const wave = config.waves[state.waveIndex] ?? config.waves[0]!;
  const groups = wave.spawnGroups.map((group, groupIndex) => ({
    groupIndex,
    spawnedCount: 0,
    nextSpawnMs: group.startDelayMs ?? 0,
  }));
  const initialSpawn = spawnWaveEnemies({
    waveId: wave.id,
    groups,
    elapsedMs: 0,
  }, 0, config);
  const waveRuntime: WaveRuntimeState = {
    waveId: wave.id,
    elapsedMs: 0,
    groups: initialSpawn.waveRuntime?.groups ?? groups,
  };

  return {
    ...state,
    phase: "wave",
    countdownMs: 0,
    draft: null,
    waveRuntime,
    enemies: initialSpawn.enemies,
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
  const wave = waveRuntime ? config.waves.find(candidate => candidate.id === waveRuntime.waveId) : null;
  if (!waveRuntime || !wave) {
    return {
      waveId: waveRuntime?.waveId ?? null,
      waveRuntime: waveRuntime ?? null,
      enemies: [],
    };
  }

  const spawned = spawnEnemiesForGroups(waveRuntime, wave.spawnGroups, deltaMs, wave.id, config);

  return {
    waveId: spawned.waveId,
    waveRuntime: spawned.runtime,
    enemies: spawned.enemies,
  };
}

function isWaveComplete(waveRuntime: WaveRuntimeState | null, livingEnemyCount: number, config: GameConfig): boolean {
  if (!waveRuntime) {
    return livingEnemyCount === 0;
  }

  const wave = config.waves.find(candidate => candidate.id === waveRuntime.waveId);

  return livingEnemyCount === 0 && getSpawnedCount(waveRuntime) >= (wave ? getSpawnGroupTotalCount(wave.spawnGroups) : 0);
}

export function getWaveTotalSpawnCount(wave: GameConfig["waves"][number]): number {
  return getSpawnGroupTotalCount(wave.spawnGroups);
}

export { createTower } from "./towerFactory";

function stepDebugReactionOverrides(state: RunState, scaledDeltaMs: number): RunState {
  if (state.debugReactionOverrides.length === 0) {
    return state;
  }

  return {
    ...state,
    debugReactionOverrides: state.debugReactionOverrides
      .map(override => ({ ...override, ttlMs: override.ttlMs - scaledDeltaMs }))
      .filter(override => override.ttlMs > 0),
  };
}

function applyDebugReactionOverrides(
  reactions: readonly CellReactionState[],
  overrides: RunState["debugReactionOverrides"],
): readonly CellReactionState[] {
  if (overrides.length === 0) {
    return reactions;
  }

  return reactions.map((reaction) => {
    const cellOverrides = overrides.filter(override => override.cellIndex === reaction.cellIndex);

    if (cellOverrides.length === 0) {
      return reaction;
    }

    return cellOverrides.reduce<CellReactionState>((nextReaction, override) => ({
      ...nextReaction,
      [override.layer]: override.reactionId,
    }), reaction);
  });
}

function applyDebugAction(state: RunState, getNextState: () => RunState): RunState {
  return state.debugVisible ? getNextState() : state;
}

function createDebugWaveState(state: RunState, waveIndex: number, config: GameConfig): RunState {
  const clampedWaveIndex = Math.max(0, Math.min(config.waves.length - 1, waveIndex));

  return startWave({
    ...state,
    phase: "ready",
    waveIndex: clampedWaveIndex,
    countdownMs: 0,
    waveRuntime: null,
    enemies: [],
    draft: null,
    boss: null,
  }, config);
}

function debugForceSpawnEnemy(state: RunState, enemyId: EnemyId, count: number, config: GameConfig): RunState {
  const nextEnemies = Array.from({ length: Math.max(1, count) }, (_, index) =>
    createEnemy(`debug-${enemyId}-${state.tick}-${state.enemies.length + index}`, enemyId, { pathProgress: 0 }, config));

  return {
    ...state,
    enemies: [...state.enemies, ...nextEnemies],
    phase: state.phase === "ready" ? "wave" : state.phase,
  };
}

function unlockSlotInState(state: RunState, slotId: string, config: GameConfig): RunState {
  const board = {
    ...state.board,
    slots: state.board.slots.map(slot => slot.id === slotId ? { ...slot, locked: false } : slot),
  };

  return {
    ...state,
    board,
    reactions: resolveReactions(board, state.placedTowers, state.upgrades, config),
  };
}

function addDebugReactionOverride(
  state: RunState,
  cellIndex: number,
  layer: "ground" | "air",
  reactionId: ReactionId,
  ttlMs: number,
): RunState {
  const safeCellIndex = Math.max(0, Math.min(state.board.pathCells.length - 1, cellIndex));
  const id = `debug-reaction-${safeCellIndex}-${layer}-${state.tick}`;

  return {
    ...state,
    debugReactionOverrides: [
      ...state.debugReactionOverrides.filter(override => !(override.cellIndex === safeCellIndex && override.layer === layer)),
      {
        id,
        cellIndex: safeCellIndex,
        layer,
        reactionId,
        ttlMs: Math.max(1000, ttlMs),
      },
    ],
    reactions: applyDebugReactionOverrides(state.reactions, [
      ...state.debugReactionOverrides,
      {
        id,
        cellIndex: safeCellIndex,
        layer,
        reactionId,
        ttlMs: Math.max(1000, ttlMs),
      },
    ]),
  };
}

function createStartingTowers(config: GameConfig): readonly TowerState[] {
  return [
    createTower("tower-water-a", "water", null, config),
    createTower("tower-water-b", "water", null, config),
    createTower("tower-spark-a", "spark", null, config),
  ];
}
