import type { GuideStep } from "./types";

export const ONBOARDING_GUIDE_STEPS = [
  {
    id: "panicIntro",
    pose: "angry",
    textKey: "panicIntro",
    target: { type: "continue" },
    completion: "manualContinue",
    blocksGameplay: true,
  },
  {
    id: "shmygIntroduction",
    pose: "talk",
    textKey: "shmygIntroduction",
    target: { type: "continue" },
    completion: "manualContinue",
    blocksGameplay: true,
  },
  {
    id: "siegeProblem",
    pose: "talk",
    textKey: "siegeProblem",
    target: { type: "continue" },
    completion: "manualContinue",
    blocksGameplay: true,
  },
  {
    id: "surfacePlan",
    pose: "excited",
    textKey: "surfacePlan",
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
    id: "selectSecondWater",
    pose: "talk",
    textKey: "selectSecondWater",
    target: { type: "selectTower", emitterId: "water" },
    completion: "selectedWaterTower",
    blocksGameplay: true,
  },
  {
    id: "placeSecondWater",
    pose: "talk",
    textKey: "placeSecondWater",
    target: { type: "placeSelectedTower", selectedEmitterId: "water" },
    completion: "placedSecondWaterTower",
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
    target: { type: "chooseDraftTower", emitterId: "heat" },
    completion: "heatDraftTowerChosen",
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
    id: "selectHeatForSteam",
    pose: "talk",
    textKey: "selectHeatForSteam",
    target: { type: "selectTower", emitterId: "heat" },
    completion: "selectedHeatTower",
    blocksGameplay: true,
  },
  {
    id: "placeHeatForSteam",
    pose: "excited",
    textKey: "placeHeatForSteam",
    target: { type: "placeSelectedTower", selectedEmitterId: "heat" },
    completion: "placedHeatSteam",
    blocksGameplay: true,
  },
  {
    id: "flyerSteamPreview",
    pose: "angry",
    textKey: "flyerSteamPreview",
    target: { type: "continue" },
    completion: "manualContinue",
    blocksGameplay: true,
  },
  {
    id: "waitFlyerWaveClear",
    pose: "idle",
    textKey: "waitFlyerWaveClear",
    target: { type: "chooseDraftTower" },
    completion: "flyerWaveCleared",
    blocksGameplay: false,
  },
  {
    id: "finalAfterFlyers",
    pose: "excited",
    textKey: "finalAfterFlyers",
    target: { type: "continue" },
    completion: "manualContinue",
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
