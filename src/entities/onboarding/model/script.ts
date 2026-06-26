import type { GuideStep } from "./types";

export const ONBOARDING_GUIDE_STEPS = [
  {
    id: "intro",
    pose: "talk",
    textKey: "intro",
    target: { type: "continue" },
    completion: "manualContinue",
    blocksGameplay: true,
  },
  {
    id: "selectFirstWater",
    pose: "talk",
    textKey: "selectFirstWater",
    target: { type: "selectTower", emitterId: "water" },
    completion: "selectedWaterTower",
    blocksGameplay: true,
  },
  {
    id: "placeFirstWater",
    pose: "talk",
    textKey: "placeFirstWater",
    target: { type: "placeSelectedTower", selectedEmitterId: "water" },
    completion: "placedWaterTower",
    blocksGameplay: true,
  },
  {
    id: "selectFirstSpark",
    pose: "excited",
    textKey: "selectFirstSpark",
    target: { type: "selectTower", emitterId: "spark" },
    completion: "selectedSparkTower",
    blocksGameplay: true,
  },
  {
    id: "placeFirstSpark",
    pose: "excited",
    textKey: "placeFirstSpark",
    target: { type: "placeSelectedTower", selectedEmitterId: "spark" },
    completion: "placedSparkTower",
    blocksGameplay: true,
  },
  {
    id: "startFirstWave",
    pose: "talk",
    textKey: "startFirstWave",
    target: { type: "startWave" },
    completion: "firstWaveStarted",
    blocksGameplay: true,
  },
  {
    id: "observeElectroPuddle",
    pose: "excited",
    textKey: "observeElectroPuddle",
    target: null,
    completion: "electroPuddleObserved",
    blocksGameplay: false,
  },
  {
    id: "draftTowerPick",
    pose: "talk",
    textKey: "draftTowerPick",
    target: { type: "chooseDraftTower" },
    completion: "draftTowerChosen",
    blocksGameplay: true,
  },
  {
    id: "draftUpgradePick",
    pose: "talk",
    textKey: "draftUpgradePick",
    target: { type: "chooseDraftUpgrade" },
    completion: "draftUpgradeChosen",
    blocksGameplay: true,
  },
  {
    id: "mixedThreatPreview",
    pose: "angry",
    textKey: "mixedThreatPreview",
    target: { type: "continue" },
    completion: "mixedThreatAcknowledged",
    blocksGameplay: true,
  },
  {
    id: "complete",
    pose: "excited",
    textKey: "complete",
    target: null,
    completion: "always",
    blocksGameplay: false,
  },
] as const satisfies readonly GuideStep[];

export const ONBOARDING_GUIDE_STEP_IDS = ONBOARDING_GUIDE_STEPS.map(step => step.id);
export const FIRST_GUIDE_STEP_ID = ONBOARDING_GUIDE_STEPS[0].id;

export function getGuideStep(stepId: GuideStep["id"]): GuideStep {
  return ONBOARDING_GUIDE_STEPS.find(step => step.id === stepId) ?? ONBOARDING_GUIDE_STEPS[0];
}

export function getNextGuideStepId(stepId: GuideStep["id"]): GuideStep["id"] {
  const index = ONBOARDING_GUIDE_STEPS.findIndex(step => step.id === stepId);

  return ONBOARDING_GUIDE_STEPS[Math.min(index + 1, ONBOARDING_GUIDE_STEPS.length - 1)]?.id ?? FIRST_GUIDE_STEP_ID;
}
