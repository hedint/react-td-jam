import type { OnboardingStorage } from "@entities/onboarding/model";
import { applyAction, createRun, createSnapshot, createTower } from "@entities/game-session/model/simulation";
import {
  clearOnboardingProgress,
  completeGuide,
  completeGuideStep,
  createInitialOnboardingProgress,
  getGuideStep,
  isGuideStepComplete,
  isGuideTargetAction,
  loadOnboardingProgress,
  ONBOARDING_GUIDE_VERSION,
  ONBOARDING_STORAGE_KEY,
  resetOnboardingProgressForDebug,
  saveOnboardingProgress,
  shouldAutoOpenGuide,
  skipGuide,
  startGuide,
} from "@entities/onboarding/model";
import { describe, expect, it } from "vitest";

describe("onboarding persistence", () => {
  it("saves, loads, and clears guide progress separately from the run save", () => {
    const storage = createMemoryStorage();
    const progress = completeGuideStep(startGuide(createInitialOnboardingProgress(100), 120), "intro", 140);

    saveOnboardingProgress(progress, storage);

    expect(storage.getItem(ONBOARDING_STORAGE_KEY)).toContain("selectFirstWater");
    expect(storage.getItem("jam-td.run.v1")).toBeNull();
    expect(loadOnboardingProgress(storage, 200)).toEqual(progress);

    clearOnboardingProgress(storage);
    expect(loadOnboardingProgress(storage, 220)).toEqual(createInitialOnboardingProgress(220));
  });

  it("falls back to initial progress for corrupt payloads", () => {
    const storage = createMemoryStorage();

    storage.setItem(ONBOARDING_STORAGE_KEY, "{bad json");

    expect(loadOnboardingProgress(storage, 300)).toEqual(createInitialOnboardingProgress(300));
  });

  it("resets full-guide progress on guide version changes while keeping valid hints", () => {
    const storage = createMemoryStorage();

    storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      guide: {
        version: "old-guide",
        status: "completed",
        stepId: "complete",
        completedStepIds: ["intro", "complete"],
        updatedAt: 10,
      },
      hints: {
        noTowersBeforeFirstStart: {
          shownCount: 2,
          lastShownAt: 50,
        },
      },
    }));

    expect(loadOnboardingProgress(storage, 400)).toEqual({
      ...createInitialOnboardingProgress(400),
      hints: {
        noTowersBeforeFirstStart: {
          shownCount: 2,
          lastShownAt: 50,
        },
      },
    });
  });

  it("persists complete and skip markers so the guide does not auto-open again", () => {
    const completed = completeGuide(startGuide(createInitialOnboardingProgress(100), 110), 120);
    const skipped = skipGuide(startGuide(createInitialOnboardingProgress(200), 210), 220);

    expect(completed.guide).toMatchObject({
      version: ONBOARDING_GUIDE_VERSION,
      status: "completed",
      stepId: "complete",
    });
    expect(skipped.guide.status).toBe("skipped");
    expect(shouldAutoOpenGuide(completed)).toBe(false);
    expect(shouldAutoOpenGuide(skipped)).toBe(false);
  });

  it("keeps debug reset behind an explicit debug flag", () => {
    const storage = createMemoryStorage();
    const completed = completeGuide(createInitialOnboardingProgress(100), 120);

    saveOnboardingProgress(completed, storage);

    expect(resetOnboardingProgressForDebug(false, storage)).toBe(false);
    expect(loadOnboardingProgress(storage, 200)).toEqual(completed);

    expect(resetOnboardingProgressForDebug(true, storage)).toBe(true);
    expect(loadOnboardingProgress(storage, 220)).toEqual(createInitialOnboardingProgress(220));
  });
});

describe("onboarding guide predicates", () => {
  it("detects selected and placed opening towers from runtime snapshots", () => {
    const selectedWater = applyAction(createRun(1), { type: "selectTower", towerId: "tower-water-a" });
    const placedWater = applyAction(selectedWater, { type: "placeSelectedTower", slotId: "slot-2-outer" });
    const selectedSpark = applyAction(placedWater, { type: "selectTower", towerId: "tower-spark-a" });
    const placedSpark = applyAction(selectedSpark, { type: "placeSelectedTower", slotId: "slot-2-inner" });

    expect(isGuideStepComplete(getGuideStep("selectFirstWater"), createRuntimeSnapshot(selectedWater))).toBe(true);
    expect(isGuideStepComplete(getGuideStep("placeFirstWater"), createRuntimeSnapshot(placedWater))).toBe(true);
    expect(isGuideStepComplete(getGuideStep("selectFirstSpark"), createRuntimeSnapshot(selectedSpark))).toBe(true);
    expect(isGuideStepComplete(getGuideStep("placeFirstSpark"), createRuntimeSnapshot(placedSpark))).toBe(true);
  });

  it("matches only the current target gameplay action", () => {
    const selectedWater = applyAction(createRun(1), { type: "selectTower", towerId: "tower-water-a" });
    const selectWaterStep = getGuideStep("selectFirstWater");
    const placeWaterStep = getGuideStep("placeFirstWater");

    expect(isGuideTargetAction(selectWaterStep, createRuntimeSnapshot(createRun(1)), { type: "selectTower", towerId: "tower-water-a" })).toBe(true);
    expect(isGuideTargetAction(selectWaterStep, createRuntimeSnapshot(createRun(1)), { type: "selectTower", towerId: "tower-spark-a" })).toBe(false);
    expect(isGuideTargetAction(placeWaterStep, createRuntimeSnapshot(selectedWater), { type: "tapSlot", slotId: "slot-1-outer" })).toBe(true);
    expect(isGuideTargetAction(placeWaterStep, createRuntimeSnapshot(createRun(1)), { type: "tapSlot", slotId: "slot-1-outer" })).toBe(false);
  });

  it("detects wave, reaction, and draft completion conditions", () => {
    const placedReaction = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
      ],
    });
    const wave = applyAction(placedReaction, { type: "startWave" });
    const towerDraft = {
      ...createRuntimeSnapshot(wave),
      phase: "draft" as const,
      waveIndex: 1,
      draft: {
        step: "tower" as const,
        rerollsRemaining: 1,
        towerOffers: [{ emitterId: "oil" as const, role: "support" as const }],
        upgradeOffers: [],
      },
    };
    const upgradeDraft = {
      ...towerDraft,
      draft: {
        ...towerDraft.draft,
        step: "upgrade" as const,
        upgradeOffers: ["waterCapacity" as const],
      },
    };

    expect(isGuideStepComplete(getGuideStep("startFirstWave"), createRuntimeSnapshot(wave))).toBe(true);
    expect(isGuideStepComplete(getGuideStep("observeElectroPuddle"), createRuntimeSnapshot(placedReaction))).toBe(true);
    expect(isGuideStepComplete(getGuideStep("draftTowerPick"), towerDraft)).toBe(false);
    expect(isGuideStepComplete(getGuideStep("draftTowerPick"), upgradeDraft)).toBe(true);
    expect(isGuideStepComplete(getGuideStep("draftUpgradePick"), upgradeDraft)).toBe(false);
    expect(isGuideStepComplete(getGuideStep("draftUpgradePick"), { ...upgradeDraft, draft: null })).toBe(true);
  });
});

function createRuntimeSnapshot(state: ReturnType<typeof createRun>) {
  return {
    ...createSnapshot(state),
    fps: 60,
    viewport: {
      width: 390,
      height: 844,
    },
  };
}

function createMemoryStorage(): OnboardingStorage {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}
