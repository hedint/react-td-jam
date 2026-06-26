import type { EmitterId, GameAction, RuntimeSnapshot, TowerState } from "@entities/game-session/model/types";
import type { GuideStep } from "./types";

export function isGuideStepComplete(step: GuideStep, snapshot: RuntimeSnapshot): boolean {
  switch (step.completion) {
    case "manualContinue":
    case "mixedThreatAcknowledged":
      return false;
    case "selectedWaterTower":
      return hasSelectedTower(snapshot, "water");
    case "placedWaterTower":
      return hasPlacedTower(snapshot, "water");
    case "selectedSparkTower":
      return hasSelectedTower(snapshot, "spark");
    case "placedSparkTower":
      return hasPlacedTower(snapshot, "spark") && hasElectroPuddle(snapshot);
    case "firstWaveStarted":
      return snapshot.phase === "wave" || snapshot.phase === "draft" || snapshot.phase === "boss" || snapshot.phase === "victory" || snapshot.phase === "defeat";
    case "electroPuddleObserved":
      return hasElectroPuddle(snapshot) || (snapshot.stats.damageByReaction.electroPuddle ?? 0) > 0;
    case "draftTowerChosen":
      return snapshot.waveIndex > 0 && snapshot.draft?.step !== "tower";
    case "draftUpgradeChosen":
      return snapshot.waveIndex > 0 && snapshot.draft?.step !== "upgrade";
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
        && (target.slotId === undefined || action.slotId === target.slotId);
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

function hasSelectedTower(snapshot: RuntimeSnapshot, emitterId: EmitterId): boolean {
  return getTowerById(snapshot, snapshot.selectedTowerId)?.emitterId === emitterId;
}

function hasPlacedTower(snapshot: RuntimeSnapshot, emitterId: EmitterId): boolean {
  return snapshot.placedTowers.some(tower => tower.emitterId === emitterId);
}

function hasElectroPuddle(snapshot: RuntimeSnapshot): boolean {
  return snapshot.activeReactions.some(reaction => reaction.ground === "electroPuddle");
}

function getTowerById(snapshot: RuntimeSnapshot, towerId: string | null): TowerState | null {
  if (!towerId) {
    return null;
  }

  return [...snapshot.bench, ...snapshot.placedTowers].find(tower => tower.id === towerId) ?? null;
}
