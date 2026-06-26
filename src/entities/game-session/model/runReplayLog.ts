import type {
  DraftStep,
  EmitterId,
  GameAction,
  RunPhase,
  RunState,
  TowerState,
  UpgradeId,
} from "./types";
import { gameConfig } from "./config";
import { getBrowserStorage } from "./persistence";

export const RUN_REPLAY_LOG_KEY = "jam-td.run-log.v1";
export const RUN_REPLAY_LOG_SCHEMA_VERSION = 1;

export type RunReplayAction
  = | Extract<GameAction, { readonly type: "startWave" }>
    | Extract<GameAction, { readonly type: "rerollDraft" }>
    | Extract<GameAction, { readonly type: "chooseDraftTower" }>
    | Extract<GameAction, { readonly type: "chooseDraftUpgrade" }>
    | Extract<GameAction, { readonly type: "selectTower" }>
    | Extract<GameAction, { readonly type: "placeSelectedTower" }>
    | Extract<GameAction, { readonly type: "tapSlot" }>;

export interface RunReplayLog {
  readonly schemaVersion: typeof RUN_REPLAY_LOG_SCHEMA_VERSION
  readonly runSchemaVersion: number
  readonly seed: number
  readonly actions: readonly RunReplayActionEntry[]
}

export interface RunReplayActionEntry {
  readonly index: number
  readonly waveIndex: number
  readonly phase: RunPhase
  readonly tick: number
  readonly elapsedMs: number
  readonly action: RunReplayAction
  readonly results: readonly RunReplayResult[]
}

export type RunReplayResult
  = | {
    readonly type: "waveStarted"
    readonly waveId: string | null
  }
  | {
    readonly type: "draftRerolled"
    readonly draftStep: DraftStep | null
    readonly towerOffers: readonly EmitterId[]
    readonly upgradeOffers: readonly UpgradeId[]
  }
  | {
    readonly type: "draftTowerPicked"
    readonly emitterId: EmitterId
    readonly towerId: string
  }
  | {
    readonly type: "draftUpgradePicked"
    readonly upgradeId: UpgradeId
    readonly stacks: number
  }
  | {
    readonly type: "towerSelected"
    readonly towerId: string | null
    readonly emitterId: EmitterId | null
    readonly source: "bench" | "field" | null
  }
  | {
    readonly type: "towerPlaced" | "towerMoved" | "towerRemoved"
    readonly towerId: string
    readonly emitterId: EmitterId
    readonly fromSlotId: string | null
    readonly toSlotId: string | null
  };

export function createRunReplayLog(state: Pick<RunState, "schemaVersion" | "seed">): RunReplayLog {
  return {
    schemaVersion: RUN_REPLAY_LOG_SCHEMA_VERSION,
    runSchemaVersion: state.schemaVersion,
    seed: state.seed,
    actions: [],
  };
}

export function recordRunReplayAction(
  previous: RunState,
  action: GameAction,
  next: RunState,
  storage = getBrowserStorage(),
): void {
  if (!storage) {
    return;
  }

  if (action.type === "restart") {
    saveRunReplayLog(createRunReplayLog(next), storage);
    return;
  }

  const replayAction = toReplayAction(action);

  if (!replayAction) {
    return;
  }

  const results = getReplayResults(previous, action, next);

  if (results.length === 0) {
    return;
  }

  const currentLog = loadRunReplayLog(storage);
  const baseLog = currentLog && currentLog.seed === previous.seed && currentLog.runSchemaVersion === previous.schemaVersion
    ? currentLog
    : createRunReplayLog(previous);
  const entry: RunReplayActionEntry = {
    index: baseLog.actions.length,
    waveIndex: previous.waveIndex,
    phase: previous.phase,
    tick: previous.tick,
    elapsedMs: previous.elapsedMs,
    action: replayAction,
    results,
  };

  saveRunReplayLog({
    ...baseLog,
    actions: [...baseLog.actions, entry],
  }, storage);
}

export function saveRunReplayLog(log: RunReplayLog, storage = getBrowserStorage()): void {
  storage?.setItem(RUN_REPLAY_LOG_KEY, serializeRunReplayLog(log));
}

export function loadRunReplayLog(storage = getBrowserStorage()): RunReplayLog | null {
  const payload = storage?.getItem(RUN_REPLAY_LOG_KEY);

  if (!payload) {
    return null;
  }

  try {
    return deserializeRunReplayLog(payload);
  } catch {
    return null;
  }
}

export function clearRunReplayLog(storage = getBrowserStorage()): void {
  storage?.removeItem(RUN_REPLAY_LOG_KEY);
}

export function serializeRunReplayLog(log: RunReplayLog): string {
  return JSON.stringify(log);
}

export function deserializeRunReplayLog(payload: string | RunReplayLog): RunReplayLog {
  const parsed = typeof payload === "string" ? JSON.parse(payload) as RunReplayLog : payload;

  if (parsed.schemaVersion !== RUN_REPLAY_LOG_SCHEMA_VERSION) {
    throw new Error(`Unsupported run replay log schema version: ${parsed.schemaVersion}`);
  }

  return parsed;
}

function toReplayAction(action: GameAction): RunReplayAction | null {
  switch (action.type) {
    case "startWave":
    case "rerollDraft":
    case "chooseDraftTower":
    case "chooseDraftUpgrade":
    case "selectTower":
    case "placeSelectedTower":
    case "tapSlot":
      return action;
    default:
      return null;
  }
}

function getReplayResults(previous: RunState, action: GameAction, next: RunState): readonly RunReplayResult[] {
  switch (action.type) {
    case "startWave":
      return previous.phase !== next.phase && next.phase === "wave"
        ? [{ type: "waveStarted", waveId: next.waveRuntime?.waveId ?? gameConfig.waves[next.waveIndex]?.id ?? null }]
        : [];
    case "rerollDraft":
      return previous.draft !== next.draft && next.draft
        ? [{
            type: "draftRerolled",
            draftStep: next.draft.step,
            towerOffers: next.draft.towerOffers.map(offer => offer.emitterId),
            upgradeOffers: next.draft.upgradeOffers,
          }]
        : [];
    case "chooseDraftTower":
      return getDraftTowerPickResults(previous, action.emitterId, next);
    case "chooseDraftUpgrade":
      return getDraftUpgradePickResults(previous, action.upgradeId, next);
    case "selectTower":
      return previous.selectedTowerId !== next.selectedTowerId
        ? [getTowerSelectedResult(next, action.towerId)]
        : [];
    case "placeSelectedTower":
    case "tapSlot":
      return getTowerPlacementResults(previous, next);
    default:
      return [];
  }
}

function getDraftTowerPickResults(previous: RunState, emitterId: EmitterId, next: RunState): readonly RunReplayResult[] {
  const previousTowerIds = new Set(getAllTowers(previous).map(tower => tower.id));
  const pickedTower = getAllTowers(next).find(tower => !previousTowerIds.has(tower.id) && tower.emitterId === emitterId);

  return pickedTower
    ? [{ type: "draftTowerPicked", emitterId, towerId: pickedTower.id }]
    : [];
}

function getDraftUpgradePickResults(previous: RunState, upgradeId: UpgradeId, next: RunState): readonly RunReplayResult[] {
  const previousStacks = previous.upgrades.find(upgrade => upgrade.upgradeId === upgradeId)?.stacks ?? 0;
  const nextStacks = next.upgrades.find(upgrade => upgrade.upgradeId === upgradeId)?.stacks ?? 0;

  return nextStacks > previousStacks
    ? [{ type: "draftUpgradePicked", upgradeId, stacks: nextStacks }]
    : [];
}

function getTowerSelectedResult(state: RunState, towerId: string | null): RunReplayResult {
  const tower = towerId ? getAllTowers(state).find(candidate => candidate.id === towerId) : null;

  return {
    type: "towerSelected",
    towerId,
    emitterId: tower?.emitterId ?? null,
    source: tower ? tower.slotId === null ? "bench" : "field" : null,
  };
}

function getTowerPlacementResults(previous: RunState, next: RunState): readonly RunReplayResult[] {
  const previousTowers = new Map(getAllTowers(previous).map(tower => [tower.id, tower]));
  const nextTowers = new Map(getAllTowers(next).map(tower => [tower.id, tower]));
  const towerIds = [...new Set([...previousTowers.keys(), ...nextTowers.keys()])].sort();

  return towerIds.flatMap((towerId) => {
    const previousTower = previousTowers.get(towerId);
    const nextTower = nextTowers.get(towerId);
    const tower = nextTower ?? previousTower;

    if (!tower) {
      return [];
    }

    const fromSlotId = previousTower?.slotId ?? null;
    const toSlotId = nextTower?.slotId ?? null;

    if (fromSlotId === toSlotId) {
      return [];
    }

    return [{
      type: getTowerPlacementResultType(fromSlotId, toSlotId),
      towerId,
      emitterId: tower.emitterId,
      fromSlotId,
      toSlotId,
    }];
  });
}

function getTowerPlacementResultType(fromSlotId: string | null, toSlotId: string | null): "towerPlaced" | "towerMoved" | "towerRemoved" {
  if (fromSlotId && toSlotId) {
    return "towerMoved";
  }

  return toSlotId ? "towerPlaced" : "towerRemoved";
}

function getAllTowers(state: RunState): readonly TowerState[] {
  return [...state.placedTowers, ...state.bench];
}
