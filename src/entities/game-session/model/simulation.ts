import type {
  EmitterId,
  EnemyState,
  GameAction,
  GameSessionState,
  GameSnapshot,
  RngState,
  RunState,
  TowerState,
} from "./types";
import { gameConfig } from "./config";
import { getCellSpeedMultiplier, getReactionDamageEntries, projectReagents, resolveReactions } from "./reactions";

const RNG_MODULUS = 0x100000000;
const RNG_MULTIPLIER = 1664525;
const RNG_INCREMENT = 1013904223;

const startingTowers: readonly TowerState[] = [
  {
    id: "tower-water-a",
    emitterId: "water",
    displayName: getEmitterTowerDisplayName("water"),
    slotId: null,
  },
  {
    id: "tower-water-b",
    emitterId: "water",
    displayName: getEmitterTowerDisplayName("water"),
    slotId: null,
  },
  {
    id: "tower-spark-a",
    emitterId: "spark",
    displayName: getEmitterTowerDisplayName("spark"),
    slotId: null,
  },
];

export interface SerializedRunPayload {
  readonly schemaVersion: number
  readonly state: RunState
}

export interface CreateRunOptions {
  readonly placedTowers?: readonly TowerState[]
  readonly enemies?: readonly EnemyState[]
}

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

export function createRun(seed = 1, options: CreateRunOptions = {}): RunState {
  const placedTowers = options.placedTowers ?? [];
  const placedTowerIds = new Set(placedTowers.map(tower => tower.id));
  const bench = startingTowers
    .filter(tower => !placedTowerIds.has(tower.id))
    .map(tower => ({ ...tower, slotId: null }));

  return {
    schemaVersion: gameConfig.balance.schemaVersion,
    phase: options.enemies ? "wave" : "ready",
    seed,
    rng: createRng(seed),
    tick: 0,
    elapsedMs: 0,
    waveIndex: 0,
    countdownMs: 0,
    paused: false,
    speed: 1,
    coreHp: gameConfig.balance.coreHp,
    board: gameConfig.board,
    bench,
    placedTowers,
    selectedTowerId: null,
    enemies: options.enemies ?? [],
    reactions: resolveReactions(gameConfig.board, placedTowers),
    draft: null,
    upgrades: [],
    boss: null,
    stats: {
      leaks: 0,
      totalDamage: 0,
      damageByReaction: {},
    },
    debugVisible: false,
    lastTap: null,
  };
}

export function createGameSession(): GameSessionState {
  return createRun();
}

export function stepRun(state: RunState, deltaMs: number): RunState {
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

    return countdownMs <= 0 ? startWave(nextState) : nextState;
  }

  if (state.phase !== "wave") {
    return state;
  }

  const reactions = resolveReactions(state.board, state.placedTowers);
  const reagentProjection = projectReagents(state.board, state.placedTowers);

  let coreHp = state.coreHp;
  let leaks = state.stats.leaks;
  let totalDamage = state.stats.totalDamage;
  const damageByReaction = { ...state.stats.damageByReaction };
  const enemies = state.enemies.flatMap((enemy) => {
    if (enemy.hp <= 0 || enemy.leaked) {
      return [];
    }

    const enemyDefinition = gameConfig.enemies.find(definition => definition.id === enemy.enemyId);
    const currentCellIndex = Math.floor(enemy.pathProgress) % state.board.pathCells.length;
    const speedMultiplier = getCellSpeedMultiplier(reagentProjection[currentCellIndex]);
    const pathProgress = enemy.pathProgress + (enemyDefinition?.speedCellsPerSecond ?? 1) * speedMultiplier * scaledDeltaMs / 1000;

    if (pathProgress >= state.board.pathCells.length) {
      coreHp = Math.max(0, coreHp - (enemyDefinition?.leakDamage ?? gameConfig.balance.leakDamage));
      leaks += 1;

      return [];
    }

    const cellIndex = Math.floor(pathProgress) % state.board.pathCells.length;
    const damageEntries = getReactionDamageEntries(reactions[cellIndex]!, scaledDeltaMs);
    let hp = enemy.hp;

    damageEntries.forEach((entry) => {
      if (hp <= 0) {
        return;
      }

      const appliedDamage = Math.min(hp, entry.amount);
      hp = Math.max(0, hp - appliedDamage);
      totalDamage += appliedDamage;
      damageByReaction[entry.reactionId] = (damageByReaction[entry.reactionId] ?? 0) + appliedDamage;
    });

    if (hp <= 0) {
      return [];
    }

    return [
      {
        ...enemy,
        hp,
        pathProgress,
      },
    ];
  });

  const nextPhase = coreHp <= 0
    ? "defeat"
    : enemies.length === 0
      ? "draft"
      : state.phase;

  return {
    ...state,
    phase: nextPhase,
    tick: state.tick + 1,
    elapsedMs: state.elapsedMs + scaledDeltaMs,
    draft: nextPhase === "draft" ? createDraftState() : state.draft,
    coreHp,
    enemies,
    reactions,
    stats: {
      ...state.stats,
      leaks,
      totalDamage,
      damageByReaction,
    },
  };
}

export function stepGameSession(state: GameSessionState, deltaMs: number): GameSessionState {
  return stepRun(state, deltaMs);
}

export function createSnapshot(state: RunState): GameSnapshot {
  return {
    ...state,
    livingEnemies: state.enemies.filter(enemy => enemy.hp > 0 && !enemy.leaked),
    activeReactions: state.reactions.filter(reaction => reaction.ground !== null || reaction.air !== null),
  };
}

export function applyAction(state: RunState, action: GameAction): RunState {
  switch (action.type) {
    case "pause":
      return { ...state, paused: true };
    case "resume":
      return { ...state, paused: false };
    case "startWave":
      return state.phase === "ready" ? startWave(state) : state;
    case "completeDraft":
      return state.phase === "draft"
        ? {
            ...state,
            phase: "countdown",
            waveIndex: Math.min(state.waveIndex + 1, gameConfig.waves.length - 1),
            countdownMs: 3000,
            draft: null,
          }
        : state;
    case "rerollDraft":
      return rerollDraft(state);
    case "chooseDraftTower":
      return chooseDraftTower(state, action.emitterId);
    case "chooseDraftUpgrade":
      return chooseDraftUpgrade(state, action.upgradeId);
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
      return createRun(action.seed ?? state.seed);
    default:
      return action satisfies never;
  }
}

export function serializeRun(state: RunState): string {
  const payload: SerializedRunPayload = {
    schemaVersion: gameConfig.balance.schemaVersion,
    state,
  };

  return JSON.stringify(payload);
}

export function deserializeRun(payload: string | SerializedRunPayload): RunState {
  const parsed = typeof payload === "string" ? JSON.parse(payload) as SerializedRunPayload : payload;

  if (parsed.schemaVersion !== gameConfig.balance.schemaVersion) {
    throw new Error(`Unsupported run schema version: ${parsed.schemaVersion}`);
  }

  return {
    ...parsed.state,
    reactions: resolveReactions(parsed.state.board, parsed.state.placedTowers),
  };
}

export function createTower(id: string, emitterId: EmitterId, slotId: string | null): TowerState {
  return {
    id,
    emitterId,
    displayName: getEmitterTowerDisplayName(emitterId),
    slotId,
  };
}

export function createGrunt(overrides: Partial<EnemyState> = {}): EnemyState {
  return createEnemy("enemy-grunt-a", "grunt", overrides);
}

function createEnemy(id: string, enemyId: EnemyState["enemyId"], overrides: Partial<EnemyState> = {}): EnemyState {
  const definition = gameConfig.enemies.find(enemy => enemy.id === enemyId);

  return {
    id,
    enemyId,
    displayName: definition?.displayName ?? enemyId,
    hp: definition?.hp ?? 30,
    maxHp: definition?.hp ?? 30,
    pathProgress: 0,
    leaked: false,
    ...overrides,
  };
}

function startWave(state: RunState): RunState {
  const wave = gameConfig.waves[state.waveIndex] ?? gameConfig.waves[0]!;

  return {
    ...state,
    phase: "wave",
    countdownMs: 0,
    draft: null,
    enemies: Array.from({ length: wave.count }, (_, index) => createEnemy(
      `${wave.id}-enemy-${index}`,
      wave.enemyId,
      { pathProgress: 0 },
    )),
  };
}

function createDraftState(): RunState["draft"] {
  return {
    step: "tower",
    rerollsRemaining: gameConfig.balance.rerollsPerDraft,
    towerOffers: ["water", "spark", "heat"],
    upgradeOffers: ["waterCapacity", "sparkCapacity", "heatReach"],
  };
}

function rerollDraft(state: RunState): RunState {
  if (!state.draft || state.draft.rerollsRemaining <= 0) {
    return state;
  }

  const [rng, roll] = nextRandom(state.rng);
  const emitters = gameConfig.emitters.map(emitter => emitter.id);
  const offset = Math.floor(roll * emitters.length);
  const towerOffers = [0, 1, 2].map(index => emitters[(offset + index) % emitters.length]!);

  return {
    ...state,
    rng,
    draft: {
      ...state.draft,
      rerollsRemaining: state.draft.rerollsRemaining - 1,
      towerOffers,
    },
  };
}

function chooseDraftTower(state: RunState, emitterId: EmitterId): RunState {
  if (!state.draft?.towerOffers.includes(emitterId)) {
    return state;
  }

  const tower = createTower(`tower-${emitterId}-${state.tick}`, emitterId, null);

  return {
    ...state,
    bench: [...state.bench, tower],
    draft: {
      ...state.draft,
      step: "upgrade",
    },
  };
}

function chooseDraftUpgrade(state: RunState, upgradeId: RunState["upgrades"][number]["upgradeId"]): RunState {
  if (!state.draft?.upgradeOffers.includes(upgradeId)) {
    return state;
  }

  const current = state.upgrades.find(upgrade => upgrade.upgradeId === upgradeId);
  const definition = gameConfig.upgrades.find(upgrade => upgrade.id === upgradeId);
  const nextStacks = Math.min((current?.stacks ?? 0) + 1, definition?.maxStacks ?? 1);
  const upgrades = current
    ? state.upgrades.map(upgrade => upgrade.upgradeId === upgradeId ? { ...upgrade, stacks: nextStacks } : upgrade)
    : [...state.upgrades, { upgradeId, stacks: nextStacks }];

  return {
    ...state,
    upgrades,
  };
}

function placeSelectedTower(state: RunState, slotId: string): RunState {
  const slot = state.board.slots.find(candidate => candidate.id === slotId);
  const selectedTower = findSelectedTower(state);

  if (!selectedTower || !slot || slot.locked) {
    return state;
  }

  if (state.bench.some(tower => tower.id === selectedTower.id)) {
    return placeBenchTower(state, selectedTower, slotId);
  }

  if (!state.paused) {
    return state;
  }

  return movePlacedTower(state, selectedTower, slotId);
}

function selectTower(state: RunState, towerId: string | null): RunState {
  if (towerId === null) {
    return { ...state, selectedTowerId: null };
  }

  return [...state.bench, ...state.placedTowers].some(tower => tower.id === towerId)
    ? { ...state, selectedTowerId: towerId }
    : state;
}

function tapSlot(state: RunState, slotId: string): RunState {
  const slot = state.board.slots.find(candidate => candidate.id === slotId);

  if (!slot || slot.locked) {
    return state;
  }

  const occupiedTower = state.placedTowers.find(tower => tower.slotId === slotId);

  if (!state.selectedTowerId) {
    return occupiedTower && state.paused
      ? { ...state, selectedTowerId: occupiedTower.id }
      : state;
  }

  return placeSelectedTower(state, slotId);
}

function placeBenchTower(state: RunState, selectedTower: TowerState, slotId: string): RunState {
  const occupiedTower = state.placedTowers.find(tower => tower.slotId === slotId);

  if (occupiedTower && !state.paused) {
    return state;
  }

  const placedTower = {
    ...selectedTower,
    slotId,
  };
  const placedTowers = occupiedTower
    ? [
        ...state.placedTowers
          .filter(tower => tower.id !== occupiedTower.id)
          .map(tower => tower.id === selectedTower.id ? placedTower : tower),
        placedTower,
      ]
    : [...state.placedTowers, placedTower];
  const bench = occupiedTower
    ? [
        ...state.bench.filter(tower => tower.id !== selectedTower.id),
        { ...occupiedTower, slotId: null },
      ]
    : state.bench.filter(tower => tower.id !== selectedTower.id);

  return {
    ...state,
    bench,
    placedTowers,
    selectedTowerId: null,
    reactions: resolveReactions(state.board, placedTowers),
  };
}

function movePlacedTower(state: RunState, selectedTower: TowerState, slotId: string): RunState {
  const occupiedTower = state.placedTowers.find(tower => tower.slotId === slotId);

  if (occupiedTower?.id === selectedTower.id) {
    const placedTowers = state.placedTowers.filter(tower => tower.id !== selectedTower.id);

    return {
      ...state,
      bench: [...state.bench, { ...selectedTower, slotId: null }],
      placedTowers,
      selectedTowerId: null,
      reactions: resolveReactions(state.board, placedTowers),
    };
  }

  const placedTowers = state.placedTowers.map((tower) => {
    if (tower.id === selectedTower.id) {
      return { ...tower, slotId };
    }

    if (tower.id === occupiedTower?.id) {
      return { ...tower, slotId: selectedTower.slotId };
    }

    return tower;
  });

  return {
    ...state,
    placedTowers,
    selectedTowerId: null,
    reactions: resolveReactions(state.board, placedTowers),
  };
}

function findSelectedTower(state: RunState): TowerState | undefined {
  return [...state.bench, ...state.placedTowers].find(tower => tower.id === state.selectedTowerId);
}

function getEmitterTowerDisplayName(emitterId: EmitterId): string {
  return gameConfig.emitters.find(emitter => emitter.id === emitterId)?.towerDisplayName ?? emitterId;
}
