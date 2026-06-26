import type { EmitterId, GameAction, RuntimeSnapshot, TowerState } from "@entities/game-session/model/types";
import type { GuideStep } from "./types";
import { getGuidePlacementTargetSlot, isGuidePlacementStepId, isGuidePlacementTargetSlot } from "./openingPlacement";

export function isGuideStepComplete(step: GuideStep, snapshot: RuntimeSnapshot): boolean {
  switch (step.completion) {
    case "manualContinue":
      return false;
    case "selectedWaterTower":
      return hasSelectedTower(snapshot, "water");
    case "placedWaterTower":
      return hasPlacedTower(snapshot, "water");
    case "selectedSparkTower":
      return hasSelectedTower(snapshot, "spark");
    case "placedSparkTower":
      return hasPlacedTower(snapshot, "spark") && hasElectroPuddle(snapshot);
    case "placedSecondWaterTower":
      return countPlacedTowers(snapshot, "water") >= 2 && getElectroPuddleCount(snapshot) >= 2;
    case "firstWaveStarted":
      return snapshot.phase === "wave" || snapshot.phase === "draft" || snapshot.phase === "boss" || snapshot.phase === "victory" || snapshot.phase === "defeat";
    case "electroPuddleObserved":
      return (snapshot.stats.damageByReaction.electroPuddle ?? 0) > 0 && (snapshot.phase === "draft" || snapshot.waveIndex > 0);
    case "heatDraftTowerChosen":
      return hasOwnedTower(snapshot, "heat") && snapshot.waveIndex >= 1 && snapshot.draft?.step !== "tower";
    case "draftUpgradeChosen":
      return hasOwnedTower(snapshot, "heat") && snapshot.waveIndex >= 2 && snapshot.draft?.step !== "upgrade";
    case "selectedHeatTower":
      return hasSelectedTower(snapshot, "heat");
    case "placedHeatSteam":
      return hasPlacedTower(snapshot, "heat") && hasSteam(snapshot);
    case "flyerWaveCleared":
      return snapshot.phase === "draft" && snapshot.waveIndex >= 2;
    case "always":
      return true;
    default:
      return step.completion satisfies never;
  }
}

export function isGuideTargetAction(step: GuideStep, snapshot: RuntimeSnapshot, action: GameAction): boolean {
  const { target } = step;

  if (!target) {
    return false;
  }

  switch (target.type) {
    case "continue":
      return false;
    case "selectTower":
      return action.type === "selectTower" && getTowerById(snapshot, action.towerId)?.emitterId === target.emitterId;
    case "placeSelectedTower":
      return (action.type === "placeSelectedTower" || action.type === "tapSlot")
        && hasSelectedTower(snapshot, target.selectedEmitterId)
        && (target.slotId === undefined || action.slotId === target.slotId)
        && (!isGuidePlacementStepId(step.id) || isGuidePlacementTargetSlot(snapshot, step.id, action.slotId));
    case "startWave":
      return action.type === "startWave";
    case "chooseDraftTower":
      return action.type === "chooseDraftTower" && (target.emitterId === undefined || action.emitterId === target.emitterId);
    case "chooseDraftUpgrade":
      return action.type === "chooseDraftUpgrade" && (target.upgradeId === undefined || action.upgradeId === target.upgradeId);
    default:
      return target satisfies never;
  }
}

export function isGuideTargetAvailable(step: GuideStep, snapshot: RuntimeSnapshot): boolean {
  const { target } = step;

  if (!target) {
    return true;
  }

  switch (target.type) {
    case "continue":
      return true;
    case "selectTower":
      return hasOwnedTower(snapshot, target.emitterId);
    case "placeSelectedTower":
      return hasSelectedTower(snapshot, target.selectedEmitterId)
        && (!isGuidePlacementStepId(step.id) || getGuidePlacementTargetSlot(snapshot, step.id) !== null);
    case "startWave":
      return true;
    case "chooseDraftTower":
      return snapshot.draft?.step === "tower"
        && (target.emitterId === undefined || snapshot.draft.towerOffers.some(offer => offer.emitterId === target.emitterId));
    case "chooseDraftUpgrade":
      return snapshot.draft?.step === "upgrade"
        && (target.upgradeId === undefined || snapshot.draft.upgradeOffers.includes(target.upgradeId));
    default:
      return target satisfies never;
  }
}

function hasSelectedTower(snapshot: RuntimeSnapshot, emitterId: EmitterId): boolean {
  return getTowerById(snapshot, snapshot.selectedTowerId)?.emitterId === emitterId;
}

function hasPlacedTower(snapshot: RuntimeSnapshot, emitterId: EmitterId): boolean {
  return snapshot.placedTowers.some(tower => tower.emitterId === emitterId);
}

function hasOwnedTower(snapshot: RuntimeSnapshot, emitterId: EmitterId): boolean {
  return [...snapshot.bench, ...snapshot.placedTowers].some(tower => tower.emitterId === emitterId);
}

function countPlacedTowers(snapshot: RuntimeSnapshot, emitterId: EmitterId): number {
  return snapshot.placedTowers.filter(tower => tower.emitterId === emitterId).length;
}

function hasElectroPuddle(snapshot: RuntimeSnapshot): boolean {
  return getElectroPuddleCount(snapshot) > 0;
}

function getElectroPuddleCount(snapshot: RuntimeSnapshot): number {
  return snapshot.activeReactions.filter(reaction => reaction.ground === "electroPuddle").length;
}

function hasSteam(snapshot: RuntimeSnapshot): boolean {
  return snapshot.activeReactions.some(reaction => reaction.air === "steam");
}

function getTowerById(snapshot: RuntimeSnapshot, towerId: string | null): TowerState | null {
  if (!towerId) {
    return null;
  }

  return [...snapshot.bench, ...snapshot.placedTowers].find(tower => tower.id === towerId) ?? null;
}
