import type { BoardSlot, EmitterId, RuntimeSnapshot, TowerState } from "@entities/game-session/model/types";
import type { GuideStepId } from "./types";
import { resolveReactions } from "@entities/game-session/model/reactions";

export type GuidePlacementStepId = Extract<GuideStepId, | "placeFirstWater"
  | "placeFirstSpark"
  | "placeSecondWater"
  | "placeHeatForSteam">;

export interface OpeningPlacementPlan {
  readonly firstWaterSlotId: string
  readonly sparkSlotId: string
  readonly secondWaterSlotId: string
}

export function getOpeningPlacementPlan(snapshot: RuntimeSnapshot): OpeningPlacementPlan | null {
  const selectedWater = getSelectedTower(snapshot);

  if (selectedWater?.emitterId !== "water") {
    return null;
  }

  const sparkTower = getAvailableTower(snapshot, "spark");
  const secondWaterTower = getAvailableTower(snapshot, "water", selectedWater.id);

  if (!sparkTower || !secondWaterTower) {
    return null;
  }

  const candidates = getOpenSlots(snapshot)
    .flatMap((firstWaterSlot) => {
      const afterFirstWater = placeTower(snapshot.placedTowers, selectedWater, firstWaterSlot.id);
      const sparkSlot = getSparkSlot(snapshot, sparkTower, afterFirstWater);

      if (!sparkSlot) {
        return [];
      }

      const afterSpark = placeTower(afterFirstWater, sparkTower, sparkSlot.id);
      const secondWaterSlot = getSecondWaterSlot(snapshot, secondWaterTower, afterSpark);

      if (!secondWaterSlot) {
        return [];
      }

      return [{
        firstWaterSlotId: firstWaterSlot.id,
        sparkSlotId: sparkSlot.id,
        secondWaterSlotId: secondWaterSlot.id,
        rank: getBoardSlotRank(snapshot, firstWaterSlot) + getBoardSlotRank(snapshot, sparkSlot) + getBoardSlotRank(snapshot, secondWaterSlot),
      }];
    });

  return candidates.sort((left, right) => left.rank - right.rank || left.firstWaterSlotId.localeCompare(right.firstWaterSlotId))[0] ?? null;
}

export function getGuidePlacementTargetSlot(snapshot: RuntimeSnapshot, stepId: GuidePlacementStepId): BoardSlot | null {
  const selectedTower = getSelectedTower(snapshot);

  if (!selectedTower) {
    return null;
  }

  switch (stepId) {
    case "placeFirstWater":
      return selectedTower.emitterId === "water"
        ? getSlotById(snapshot, getOpeningPlacementPlan(snapshot)?.firstWaterSlotId) ?? getOpenSlots(snapshot)[0] ?? null
        : null;
    case "placeFirstSpark":
      return selectedTower.emitterId === "spark"
        ? getSparkSlot(snapshot, selectedTower, snapshot.placedTowers)
        : null;
    case "placeSecondWater":
      return selectedTower.emitterId === "water"
        ? getSecondWaterSlot(snapshot, selectedTower, snapshot.placedTowers)
        : null;
    case "placeHeatForSteam":
      return selectedTower.emitterId === "heat"
        ? getSteamReplacementSlot(snapshot, selectedTower)
        : null;
    default:
      return stepId satisfies never;
  }
}

export function isGuidePlacementTargetSlot(snapshot: RuntimeSnapshot, stepId: GuidePlacementStepId, slotId: string): boolean {
  return getGuidePlacementTargetSlot(snapshot, stepId)?.id === slotId;
}

export function isGuidePlacementStepId(stepId: GuideStepId): stepId is GuidePlacementStepId {
  return stepId === "placeFirstWater"
    || stepId === "placeFirstSpark"
    || stepId === "placeSecondWater"
    || stepId === "placeHeatForSteam";
}

function getSparkSlot(snapshot: RuntimeSnapshot, sparkTower: TowerState, placedTowers: readonly TowerState[]): BoardSlot | null {
  const slots = getOpenSlots(snapshot, placedTowers)
    .filter(slot => createsElectroPuddle(snapshot, placedTowers, sparkTower, slot.id))
    .sort((left, right) => getSparkSlotRank(snapshot, placedTowers, left) - getSparkSlotRank(snapshot, placedTowers, right));

  return slots[0] ?? null;
}

function getSecondWaterSlot(snapshot: RuntimeSnapshot, waterTower: TowerState, placedTowers: readonly TowerState[]): BoardSlot | null {
  const slots = getOpenSlots(snapshot, placedTowers)
    .filter(slot => extendsElectroPuddle(snapshot, placedTowers, waterTower, slot.id))
    .sort((left, right) => getBoardSlotRank(snapshot, left) - getBoardSlotRank(snapshot, right));

  return slots[0] ?? null;
}

function getSteamReplacementSlot(snapshot: RuntimeSnapshot, heatTower: TowerState): BoardSlot | null {
  const slots = snapshot.placedTowers
    .filter(tower => tower.emitterId === "spark" && tower.slotId)
    .map(tower => getSlotById(snapshot, tower.slotId))
    .filter((slot): slot is BoardSlot => slot !== null)
    .filter(slot => createsSteamByReplacingTower(snapshot, heatTower, slot.id))
    .sort((left, right) => getBoardSlotRank(snapshot, left) - getBoardSlotRank(snapshot, right));

  return slots[0] ?? null;
}

function createsElectroPuddle(
  snapshot: RuntimeSnapshot,
  placedTowers: readonly TowerState[],
  tower: TowerState,
  slotId: string,
): boolean {
  return countGroundReaction(snapshot, placeTower(placedTowers, tower, slotId), "electroPuddle") > 0;
}

function extendsElectroPuddle(
  snapshot: RuntimeSnapshot,
  placedTowers: readonly TowerState[],
  tower: TowerState,
  slotId: string,
): boolean {
  const currentCount = countGroundReaction(snapshot, placedTowers, "electroPuddle");
  const nextCount = countGroundReaction(snapshot, placeTower(placedTowers, tower, slotId), "electroPuddle");

  return currentCount > 0 && nextCount >= 2 && nextCount > currentCount;
}

function createsSteamByReplacingTower(snapshot: RuntimeSnapshot, heatTower: TowerState, slotId: string): boolean {
  const replacedTower = snapshot.placedTowers.find(tower => tower.slotId === slotId);

  if (replacedTower?.emitterId !== "spark") {
    return false;
  }

  const placedTowers = [
    ...snapshot.placedTowers.filter(tower => tower.id !== heatTower.id && tower.id !== replacedTower.id),
    { ...heatTower, slotId },
  ];

  return resolveReactions(snapshot.board, placedTowers, snapshot.upgrades)
    .some(reaction => reaction.air === "steam");
}

function countGroundReaction(snapshot: RuntimeSnapshot, placedTowers: readonly TowerState[], reactionId: "electroPuddle"): number {
  return resolveReactions(snapshot.board, placedTowers, snapshot.upgrades)
    .filter(reaction => reaction.ground === reactionId)
    .length;
}

function placeTower(placedTowers: readonly TowerState[], tower: TowerState, slotId: string): readonly TowerState[] {
  return [
    ...placedTowers.filter(placedTower => placedTower.id !== tower.id),
    { ...tower, slotId },
  ];
}

function getOpenSlots(snapshot: RuntimeSnapshot, placedTowers = snapshot.placedTowers): readonly BoardSlot[] {
  return snapshot.board.slots
    .filter(slot => !slot.locked && !placedTowers.some(tower => tower.slotId === slot.id))
    .sort((left, right) => getBoardSlotRank(snapshot, left) - getBoardSlotRank(snapshot, right));
}

function getSelectedTower(snapshot: RuntimeSnapshot): TowerState | null {
  return snapshot.selectedTowerId
    ? [...snapshot.bench, ...snapshot.placedTowers].find(tower => tower.id === snapshot.selectedTowerId) ?? null
    : null;
}

function getAvailableTower(snapshot: RuntimeSnapshot, emitterId: EmitterId, exceptTowerId?: string): TowerState | null {
  return [...snapshot.bench, ...snapshot.placedTowers]
    .find(tower => tower.emitterId === emitterId && tower.id !== exceptTowerId && tower.slotId === null) ?? null;
}

function getSlotById(snapshot: RuntimeSnapshot, slotId: string | null | undefined): BoardSlot | null {
  return slotId ? snapshot.board.slots.find(slot => slot.id === slotId) ?? null : null;
}

function getSparkSlotRank(snapshot: RuntimeSnapshot, placedTowers: readonly TowerState[], slot: BoardSlot): number {
  const pairedWaterSlot = placedTowers
    .filter(tower => tower.emitterId === "water" && tower.slotId)
    .map(tower => getSlotById(snapshot, tower.slotId))
    .find((waterSlot): waterSlot is BoardSlot =>
      waterSlot !== null && waterSlot.cellIndexes.some(cellIndex => slot.cellIndexes.includes(cellIndex)));

  if (!pairedWaterSlot) {
    return 10 + getBoardSlotRank(snapshot, slot);
  }

  return (slot.lane === pairedWaterSlot.lane ? 4 : 0)
    + (slot.lane === "outer" ? 0 : 1)
    + getBoardSlotRank(snapshot, slot) * 0.01;
}

function getBoardSlotRank(snapshot: RuntimeSnapshot, slot: BoardSlot): number {
  const centerX = snapshot.board.slots.reduce((sum, candidate) => sum + candidate.x, 0) / snapshot.board.slots.length;
  const centerY = snapshot.board.slots.reduce((sum, candidate) => sum + candidate.y, 0) / snapshot.board.slots.length;

  return Math.abs(slot.x - centerX) + Math.abs(slot.y - centerY) + (slot.lane === "outer" ? 0 : 0.25);
}
