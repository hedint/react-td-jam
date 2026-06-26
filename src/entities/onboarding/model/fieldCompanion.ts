import type { BoardSlot, ReactionId, RuntimeSnapshot, StagePoint, TowerState } from "@entities/game-session/model/types";
import type { OnboardingProgress } from "./types";

export const FIELD_SHMYG_FALLBACK_TARGET: FieldShmygRouteTarget = {
  id: "fallback-upper-left",
  x: 76,
  y: 176,
  side: "left",
  slotIds: [],
};

export const FIELD_SHMYG_GLOBAL_SPEECH_COOLDOWN_MS = 20000;
export const FIELD_SHMYG_FILLER_SILENCE_MS = 35000;
export const FIELD_SHMYG_IMPORTANT_REPEAT_COOLDOWN_MS = 90000;
export const FIELD_SHMYG_IMPORTANT_MAX_REPEAT = 2;
const FIELD_SHMYG_OUTER_EDGE_OFFSET = 28;

export type FieldShmygRouteSide = "left" | "top" | "right" | "bottom";
export type FieldShmygSpeechKind = "important" | "filler" | "comboFiller";
export type FieldShmygImportantSpeechId
  = | "noTowers"
    | "wave3Flyers"
    | "firstStormCloudReaction"
    | "firstFireVortexReaction"
    | "firstTier3Reaction"
    | "bossArrival"
    | "bossAbility"
    | "coreDanger";
export type FieldShmygComboFillerId
  = | "stormCloudCombo"
    | "fireVortexCombo"
    | "fireStormCombo";

export interface FieldShmygSpawnContext {
  readonly guideWasActiveThisRun?: boolean
}

export interface FieldShmygRouteTarget extends StagePoint {
  readonly id: string
  readonly side: FieldShmygRouteSide
  readonly slotIds: readonly string[]
}

export interface FieldShmygImportantSpeechState {
  readonly shownCount: number
  readonly lastShownAt: number
}

export interface FieldShmygSpeechMemory {
  readonly lastSpeechAt: number | null
  readonly importantById: Partial<Record<FieldShmygImportantSpeechId, FieldShmygImportantSpeechState>>
  readonly importantWaveIndex: number | null
  readonly comboFillerIds: readonly FieldShmygComboFillerId[]
}

export interface FieldShmygSpeechRequest {
  readonly kind: FieldShmygSpeechKind
  readonly id?: FieldShmygImportantSpeechId
  readonly comboId?: FieldShmygComboFillerId
  readonly nowMs: number
  readonly waveIndex: number
}

interface OuterSlotGroup {
  readonly side: FieldShmygRouteSide
  readonly slots: readonly BoardSlot[]
}

export function shouldShowFieldShmyg(
  snapshot: RuntimeSnapshot,
  progress: OnboardingProgress,
  context: FieldShmygSpawnContext = {},
): boolean {
  if (snapshot.phase === "victory" || snapshot.phase === "defeat") {
    return false;
  }

  if (progress.guide.status === "inProgress") {
    return false;
  }

  if (context.guideWasActiveThisRun) {
    return snapshot.waveIndex >= 3;
  }

  return getClearedWaveCount(snapshot) >= 1;
}

export function getFieldShmygRouteTargets(snapshot: RuntimeSnapshot): readonly FieldShmygRouteTarget[] {
  if (snapshot.placedTowers.length === 0) {
    return [FIELD_SHMYG_FALLBACK_TARGET];
  }

  const outerSlots = snapshot.board.slots.filter(slot => slot.lane === "outer" && !slot.locked);
  const towerOuterSlots = snapshot.placedTowers
    .map(tower => findNearestOuterSlot(tower, snapshot.board.slots, outerSlots))
    .filter((slot): slot is BoardSlot => slot !== null);

  if (towerOuterSlots.length === 0) {
    return [FIELD_SHMYG_FALLBACK_TARGET];
  }

  const bounds = getSlotBounds(outerSlots);
  const groups = groupOuterSlotsBySide(towerOuterSlots, bounds);

  return groups.map(group => createRouteTarget(group));
}

export function shouldOfferFieldShmygFlyerHint(
  snapshot: RuntimeSnapshot,
  progress: OnboardingProgress,
  context: FieldShmygSpawnContext = {},
): boolean {
  if (progress.guide.status === "inProgress" || context.guideWasActiveThisRun) {
    return false;
  }

  return snapshot.waveIndex === 2 && (snapshot.phase === "ready" || snapshot.phase === "countdown" || snapshot.phase === "draft");
}

export function createInitialFieldShmygSpeechMemory(): FieldShmygSpeechMemory {
  return {
    lastSpeechAt: null,
    importantById: {},
    importantWaveIndex: null,
    comboFillerIds: [],
  };
}

export function canShowFieldShmygSpeech(memory: FieldShmygSpeechMemory, request: FieldShmygSpeechRequest): boolean {
  const lastSpeechAt = memory.lastSpeechAt;

  if (lastSpeechAt !== null && request.nowMs - lastSpeechAt < FIELD_SHMYG_GLOBAL_SPEECH_COOLDOWN_MS) {
    return false;
  }

  if (request.kind === "filler") {
    return lastSpeechAt === null || request.nowMs - lastSpeechAt >= FIELD_SHMYG_FILLER_SILENCE_MS;
  }

  if (request.kind === "comboFiller") {
    const comboId = request.comboId;

    return comboId !== undefined
      && !memory.comboFillerIds.includes(comboId)
      && (lastSpeechAt === null || request.nowMs - lastSpeechAt >= FIELD_SHMYG_FILLER_SILENCE_MS);
  }

  if (!request.id) {
    return false;
  }

  if (memory.importantWaveIndex === request.waveIndex) {
    return false;
  }

  const shown = memory.importantById[request.id];

  if (!shown) {
    return true;
  }

  return shown.shownCount < FIELD_SHMYG_IMPORTANT_MAX_REPEAT
    && request.nowMs - shown.lastShownAt >= FIELD_SHMYG_IMPORTANT_REPEAT_COOLDOWN_MS;
}

export function recordFieldShmygSpeech(memory: FieldShmygSpeechMemory, request: FieldShmygSpeechRequest): FieldShmygSpeechMemory {
  if (request.kind === "filler") {
    return {
      ...memory,
      lastSpeechAt: request.nowMs,
    };
  }

  if (request.kind === "comboFiller") {
    return {
      ...memory,
      lastSpeechAt: request.nowMs,
      comboFillerIds: request.comboId && !memory.comboFillerIds.includes(request.comboId)
        ? [...memory.comboFillerIds, request.comboId]
        : memory.comboFillerIds,
    };
  }

  if (!request.id) {
    return memory;
  }

  const previous = memory.importantById[request.id];

  return {
    lastSpeechAt: request.nowMs,
    importantWaveIndex: request.waveIndex,
    comboFillerIds: memory.comboFillerIds,
    importantById: {
      ...memory.importantById,
      [request.id]: {
        shownCount: (previous?.shownCount ?? 0) + 1,
        lastShownAt: request.nowMs,
      },
    },
  };
}

export function getFieldShmygComboFillerReactionId(comboId: FieldShmygComboFillerId): ReactionId {
  switch (comboId) {
    case "stormCloudCombo":
      return "stormCloud";
    case "fireVortexCombo":
      return "fireVortex";
    case "fireStormCombo":
      return "fireStorm";
    default:
      return comboId satisfies never;
  }
}

export function getFieldShmygComboFillerMinWaveIndex(comboId: FieldShmygComboFillerId): number {
  switch (comboId) {
    case "stormCloudCombo":
    case "fireVortexCombo":
      return 4;
    case "fireStormCombo":
      return 6;
    default:
      return comboId satisfies never;
  }
}

function getClearedWaveCount(snapshot: RuntimeSnapshot): number {
  if (snapshot.phase === "draft" || snapshot.phase === "boss" || snapshot.phase === "victory") {
    return snapshot.waveIndex + 1;
  }

  return snapshot.waveIndex;
}

function findNearestOuterSlot(
  tower: TowerState,
  slots: readonly BoardSlot[],
  outerSlots: readonly BoardSlot[],
): BoardSlot | null {
  const towerSlot = slots.find(slot => slot.id === tower.slotId);

  if (!towerSlot || outerSlots.length === 0) {
    return null;
  }

  return outerSlots.reduce((nearest, candidate) => {
    const candidateDistance = getDistanceSquared(towerSlot, candidate);
    const nearestDistance = getDistanceSquared(towerSlot, nearest);

    return candidateDistance < nearestDistance ? candidate : nearest;
  }, outerSlots[0]!);
}

function getDistanceSquared(a: StagePoint, b: StagePoint): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function getSlotBounds(slots: readonly BoardSlot[]): {
  readonly minX: number
  readonly maxX: number
  readonly minY: number
  readonly maxY: number
} {
  return {
    minX: Math.min(...slots.map(slot => slot.x)),
    maxX: Math.max(...slots.map(slot => slot.x)),
    minY: Math.min(...slots.map(slot => slot.y)),
    maxY: Math.max(...slots.map(slot => slot.y)),
  };
}

function groupOuterSlotsBySide(
  slots: readonly BoardSlot[],
  bounds: ReturnType<typeof getSlotBounds>,
): readonly OuterSlotGroup[] {
  const groups = new Map<FieldShmygRouteSide, BoardSlot[]>();

  slots.forEach((slot) => {
    const side = getOuterSlotSide(slot, bounds);
    const group = groups.get(side) ?? [];

    groups.set(side, [...group, slot]);
  });

  return (["left", "top", "right", "bottom"] as const)
    .map(side => ({ side, slots: groups.get(side) ?? [] }))
    .filter(group => group.slots.length > 0);
}

function getOuterSlotSide(slot: BoardSlot, bounds: ReturnType<typeof getSlotBounds>): FieldShmygRouteSide {
  const distances = {
    left: Math.abs(slot.x - bounds.minX),
    top: Math.abs(slot.y - bounds.minY),
    right: Math.abs(slot.x - bounds.maxX),
    bottom: Math.abs(slot.y - bounds.maxY),
  } satisfies Record<FieldShmygRouteSide, number>;

  return (Object.keys(distances) as FieldShmygRouteSide[])
    .reduce((best, side) => distances[side] < distances[best] ? side : best, "left");
}

function createRouteTarget(group: OuterSlotGroup): FieldShmygRouteTarget {
  const centerX = Math.round(group.slots.reduce((sum, slot) => sum + slot.x, 0) / group.slots.length);
  const centerY = Math.round(group.slots.reduce((sum, slot) => sum + slot.y, 0) / group.slots.length);
  const edgeOffset = getOuterEdgeOffset(group.side);

  return {
    id: `outer-${group.side}-${group.slots.map(slot => slot.id).join("-")}`,
    x: centerX + edgeOffset.x,
    y: centerY + edgeOffset.y,
    side: group.side,
    slotIds: group.slots.map(slot => slot.id),
  };
}

function getOuterEdgeOffset(side: FieldShmygRouteSide): StagePoint {
  switch (side) {
    case "left":
      return { x: -FIELD_SHMYG_OUTER_EDGE_OFFSET, y: 0 };
    case "top":
      return { x: 0, y: -FIELD_SHMYG_OUTER_EDGE_OFFSET };
    case "right":
      return { x: FIELD_SHMYG_OUTER_EDGE_OFFSET, y: 0 };
    case "bottom":
      return { x: 0, y: FIELD_SHMYG_OUTER_EDGE_OFFSET };
    default:
      return side satisfies never;
  }
}
