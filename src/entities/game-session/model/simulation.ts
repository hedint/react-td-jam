import type {
  DamageFamily,
  DraftTowerOffer,
  EmitterId,
  EnemyDefinition,
  EnemyId,
  EnemyState,
  GameAction,
  GameSessionState,
  GameSnapshot,
  ReactionId,
  RngState,
  RunState,
  TowerState,
  UpgradeId,
  WaveRuntimeState,
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
    waveRuntime: null,
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
      kills: 0,
      totalDamage: 0,
      damageByReaction: {},
      waveStats: [],
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

  const reactions = resolveReactions(state.board, state.placedTowers, state.upgrades);
  const reagentProjection = projectReagents(state.board, state.placedTowers, state.upgrades);
  const spawned = spawnWaveEnemies(state.waveRuntime, scaledDeltaMs);
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

    const enemyDefinition = getEnemyDefinition(enemy.enemyId);
    const currentCellIndex = getCurrentPathCellIndex(enemy.pathProgress, state.board.pathCells.length);
    const speedMultiplier = getCellSpeedMultiplier(reagentProjection[currentCellIndex], state.upgrades);
    const pathProgress = enemy.pathProgress + (enemyDefinition?.speedCellsPerSecond ?? 1) * speedMultiplier * scaledDeltaMs / 1000;

    if (pathProgress >= state.board.pathCells.length) {
      coreHp = Math.max(0, coreHp - (enemyDefinition?.leakDamage ?? gameConfig.balance.leakDamage));
      leaks += 1;
      waveStats = updateWaveStats(waveStats, spawned.waveId, { leaks: 1 });

      return [];
    }

    const cellIndex = getCurrentPathCellIndex(pathProgress, state.board.pathCells.length);
    const damageEntries = getReactionDamageEntries(reactions[cellIndex]!, scaledDeltaMs, state.upgrades);
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

  const waveComplete = isWaveComplete(spawned.waveRuntime, enemies.length);
  const nextPhase = coreHp <= 0
    ? "defeat"
    : waveComplete
      ? "draft"
      : state.phase;
  const generatedDraft = nextPhase === "draft"
    ? createDraftState(state)
    : null;

  return {
    ...state,
    phase: nextPhase,
    rng: generatedDraft?.rng ?? state.rng,
    tick: state.tick + 1,
    elapsedMs: state.elapsedMs + scaledDeltaMs,
    draft: generatedDraft?.draft ?? state.draft,
    waveRuntime: nextPhase === "draft" || nextPhase === "defeat" ? null : spawned.waveRuntime,
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
      return state.phase === "draft" && state.draft?.step === "upgrade" ? advanceAfterDraft(state) : state;
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
    reactions: resolveReactions(parsed.state.board, parsed.state.placedTowers, parsed.state.upgrades),
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

export function createEnemy(id: string, enemyId: EnemyId, overrides: Partial<EnemyState> = {}): EnemyState {
  const definition = getEnemyDefinition(enemyId);
  const pathProgress = overrides.pathProgress ?? 0;

  return {
    id,
    enemyId,
    displayName: definition.displayName,
    hp: definition.hp,
    maxHp: definition.hp,
    pathProgress,
    currentCellIndex: getCurrentPathCellIndex(pathProgress, gameConfig.balance.pathCellCount),
    leaked: false,
    ...overrides,
  };
}

function startWave(state: RunState): RunState {
  const wave = gameConfig.waves[state.waveIndex] ?? gameConfig.waves[0]!;
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
      ? [createEnemy(`${wave.id}-enemy-0`, wave.enemyId, { pathProgress: 0 })]
      : [],
    stats: ensureWaveStats(state.stats, wave.id),
  };
}

function spawnWaveEnemies(waveRuntime: WaveRuntimeState | null, deltaMs: number): {
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

  const wave = gameConfig.waves.find(candidate => candidate.id === waveRuntime.waveId);
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
    enemies.push(createEnemy(`${wave.id}-enemy-${spawnedCount}`, wave.enemyId, { pathProgress: 0 }));
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

function isWaveComplete(waveRuntime: WaveRuntimeState | null, livingEnemyCount: number): boolean {
  if (!waveRuntime) {
    return livingEnemyCount === 0;
  }

  const wave = gameConfig.waves.find(candidate => candidate.id === waveRuntime.waveId);

  return livingEnemyCount === 0 && waveRuntime.spawnedCount >= (wave?.count ?? 0);
}

export function getCurrentPathCellIndex(pathProgress: number, pathCellCount: number): number {
  return Math.max(0, Math.min(pathCellCount - 1, Math.floor(pathProgress)));
}

function getEnemyDefinition(enemyId: EnemyId): EnemyDefinition {
  const definition = gameConfig.enemies.find(enemy => enemy.id === enemyId);

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

function createDraftState(state: RunState): { readonly draft: NonNullable<RunState["draft"]>, readonly rng: RngState } {
  const towerOffers = generateTowerOffers(state, state.rng);
  const upgradeOffers = generateUpgradeOffers(state, towerOffers.rng);

  return {
    rng: upgradeOffers.rng,
    draft: {
      step: "tower",
      rerollsRemaining: gameConfig.balance.rerollsPerDraft,
      towerOffers: towerOffers.offers,
      upgradeOffers: upgradeOffers.offers,
    },
  };
}

function rerollDraft(state: RunState): RunState {
  if (!state.draft || state.draft.rerollsRemaining <= 0) {
    return state;
  }

  const generated = state.draft.step === "tower"
    ? generateTowerOffers(state, state.rng)
    : generateUpgradeOffers(state, state.rng);

  return {
    ...state,
    rng: generated.rng,
    draft: {
      ...state.draft,
      rerollsRemaining: state.draft.rerollsRemaining - 1,
      towerOffers: state.draft.step === "tower" ? generated.offers as readonly DraftTowerOffer[] : state.draft.towerOffers,
      upgradeOffers: state.draft.step === "upgrade" ? generated.offers as readonly UpgradeId[] : state.draft.upgradeOffers,
    },
  };
}

function generateTowerOffers(
  state: RunState,
  initialRng: RngState,
): { readonly offers: readonly DraftTowerOffer[], readonly rng: RngState } {
  let rng = initialRng;
  const synergies = getSynergyEmitterIds(state);
  const requiredOffers = getRequiredTowerOffers(state);
  const allEmitters = gameConfig.emitters.map(emitter => emitter.id);
  const offers: DraftTowerOffer[] = [];
  const support = pickEmitter(rng, synergies.length > 0 ? synergies : allEmitters, offers);

  rng = support.rng;
  offers.push({ emitterId: support.emitterId, role: "support" });

  requiredOffers.forEach((emitterId) => {
    addOrReplaceOffer(offers, { emitterId, role: "pivot" }, synergies);
  });

  while (offers.length < 3) {
    const role = offers.some(offer => offer.role === "generic") ? "pivot" : "generic";
    const picked = pickEmitter(rng, role === "pivot" ? getPivotEmitterIds(state) : allEmitters, offers);

    rng = picked.rng;
    offers.push({ emitterId: picked.emitterId, role });
  }

  if (!offers.some(offer => synergies.includes(offer.emitterId))) {
    const picked = pickEmitter(
      rng,
      synergies.length > 0 ? synergies : allEmitters,
      offers.filter(offer => offer.role !== "support"),
    );

    rng = picked.rng;
    addOrReplaceOffer(offers, { emitterId: picked.emitterId, role: "support" }, synergies);
  }

  return {
    rng,
    offers: offers.slice(0, 3),
  };
}

function generateUpgradeOffers(
  state: RunState,
  initialRng: RngState,
): { readonly offers: readonly UpgradeId[], readonly rng: RngState } {
  let rng = initialRng;
  const available = gameConfig.upgrades
    .filter(upgrade => getUpgradeStacks(state, upgrade.id) < upgrade.maxStacks)
    .map(upgrade => upgrade.id);
  const fallback = gameConfig.upgrades.map(upgrade => upgrade.id);
  const pool = available.length > 0 ? available : fallback;
  const offers: UpgradeId[] = [];

  while (offers.length < Math.min(3, pool.length)) {
    const picked = pickUpgrade(rng, pool, offers);

    rng = picked.rng;
    offers.push(picked.upgradeId);
  }

  return { rng, offers };
}

function addOrReplaceOffer(
  offers: DraftTowerOffer[],
  nextOffer: DraftTowerOffer,
  synergyEmitterIds: readonly EmitterId[],
): void {
  const existingIndex = offers.findIndex(offer => offer.emitterId === nextOffer.emitterId);

  if (existingIndex >= 0) {
    offers[existingIndex] = {
      ...offers[existingIndex]!,
      role: offers[existingIndex]!.role === "support" ? "support" : nextOffer.role,
    };
    return;
  }

  if (offers.length < 3) {
    offers.push(nextOffer);
    return;
  }

  const replacementIndex = offers.findIndex(offer => offer.role !== "support" || synergyEmitterIds.includes(nextOffer.emitterId));

  offers[replacementIndex >= 0 ? replacementIndex : offers.length - 1] = nextOffer;
}

function pickEmitter(
  rng: RngState,
  candidates: readonly EmitterId[],
  existingOffers: readonly Pick<DraftTowerOffer, "emitterId">[],
): { readonly emitterId: EmitterId, readonly rng: RngState } {
  const existing = new Set(existingOffers.map(offer => offer.emitterId));
  const available = candidates.filter(emitterId => !existing.has(emitterId));
  const pool = available.length > 0 ? available : gameConfig.emitters.map(emitter => emitter.id);
  const [nextRng, roll] = nextRandom(rng);

  return {
    rng: nextRng,
    emitterId: pool[Math.floor(roll * pool.length) % pool.length]!,
  };
}

function pickUpgrade(
  rng: RngState,
  candidates: readonly UpgradeId[],
  existingOffers: readonly UpgradeId[],
): { readonly upgradeId: UpgradeId, readonly rng: RngState } {
  const existing = new Set(existingOffers);
  const available = candidates.filter(upgradeId => !existing.has(upgradeId));
  const pool = available.length > 0 ? available : candidates;
  const [nextRng, roll] = nextRandom(rng);

  return {
    rng: nextRng,
    upgradeId: pool[Math.floor(roll * pool.length) % pool.length]!,
  };
}

function getRequiredTowerOffers(state: RunState): readonly EmitterId[] {
  const clearedWaveNumber = state.waveIndex + 1;
  const offers: EmitterId[] = [];

  if (clearedWaveNumber >= 2 && !hasEmitterTower(state, "heat")) {
    offers.push("heat");
  }

  if (clearedWaveNumber >= 4 && !hasEmitterTower(state, "oil")) {
    offers.push("oil");
  }

  return offers;
}

function getSynergyEmitterIds(state: RunState): readonly EmitterId[] {
  const placedEmitterIds = new Set(state.placedTowers.map(tower => tower.emitterId));
  const synergies = new Set<EmitterId>();

  if (placedEmitterIds.has("water")) {
    synergies.add("spark");
    synergies.add("heat");
  }

  if (placedEmitterIds.has("oil")) {
    synergies.add("heat");
  }

  if (placedEmitterIds.has("spark")) {
    synergies.add("water");
  }

  if (placedEmitterIds.has("heat")) {
    synergies.add("water");
    synergies.add("oil");
  }

  if (synergies.size === 0) {
    synergies.add("water");
    synergies.add("spark");
  }

  return [...synergies].sort();
}

function getPivotEmitterIds(state: RunState): readonly EmitterId[] {
  const owned = new Set([...state.bench, ...state.placedTowers].map(tower => tower.emitterId));
  const unowned = gameConfig.emitters.map(emitter => emitter.id).filter(emitterId => !owned.has(emitterId));

  return unowned.length > 0 ? unowned : gameConfig.emitters.map(emitter => emitter.id);
}

function hasEmitterTower(state: RunState, emitterId: EmitterId): boolean {
  return [...state.bench, ...state.placedTowers].some(tower => tower.emitterId === emitterId);
}

function chooseDraftTower(state: RunState, emitterId: EmitterId): RunState {
  if (state.draft?.step !== "tower" || !state.draft.towerOffers.some(offer => offer.emitterId === emitterId)) {
    return state;
  }

  const tower = createTower(`tower-${emitterId}-${state.waveIndex}-${state.tick}`, emitterId, null);

  return {
    ...state,
    bench: [...state.bench, tower],
    draft: {
      ...state.draft,
      step: "upgrade",
    },
  };
}

function chooseDraftUpgrade(state: RunState, upgradeId: UpgradeId): RunState {
  if (state.draft?.step !== "upgrade" || !state.draft.upgradeOffers.includes(upgradeId)) {
    return state;
  }

  const current = state.upgrades.find(upgrade => upgrade.upgradeId === upgradeId);
  const definition = gameConfig.upgrades.find(upgrade => upgrade.id === upgradeId);
  const nextStacks = Math.min((current?.stacks ?? 0) + 1, definition?.maxStacks ?? 1);
  const upgrades = current
    ? state.upgrades.map(upgrade => upgrade.upgradeId === upgradeId ? { ...upgrade, stacks: nextStacks } : upgrade)
    : [...state.upgrades, { upgradeId, stacks: nextStacks }];

  return advanceAfterDraft({
    ...state,
    upgrades,
  });
}

function advanceAfterDraft(state: RunState): RunState {
  return {
    ...state,
    phase: "countdown",
    waveIndex: Math.min(state.waveIndex + 1, gameConfig.waves.length - 1),
    countdownMs: 3000,
    draft: null,
    waveRuntime: null,
  };
}

function getUpgradeStacks(state: RunState, upgradeId: UpgradeId): number {
  return state.upgrades.find(upgrade => upgrade.upgradeId === upgradeId)?.stacks ?? 0;
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
    reactions: resolveReactions(state.board, placedTowers, state.upgrades),
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
      reactions: resolveReactions(state.board, placedTowers, state.upgrades),
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
    reactions: resolveReactions(state.board, placedTowers, state.upgrades),
  };
}

function findSelectedTower(state: RunState): TowerState | undefined {
  return [...state.bench, ...state.placedTowers].find(tower => tower.id === state.selectedTowerId);
}

function getEmitterTowerDisplayName(emitterId: EmitterId): string {
  return gameConfig.emitters.find(emitter => emitter.id === emitterId)?.towerDisplayName ?? emitterId;
}
