import type { GuideStepId, OnboardingProgress, OnboardingStorage } from "@entities/onboarding/model";
import { applyAction, createRun, createSnapshot, createTower } from "@entities/game-session/model/simulation";
import {
  clearOnboardingProgress,
  completeGuide,
  completeGuideStep,
  createInitialOnboardingProgress,
  evaluateGuidedAction,
  getGuidePlacementTargetSlot,
  getGuideStep,
  getOpeningPlacementPlan,
  isGuideStepComplete,
  isGuideTargetAction,
  isGuideTargetAvailable,
  loadOnboardingProgress,
  ONBOARDING_GUIDE_VERSION,
  ONBOARDING_STORAGE_KEY,
  resetGuideForNewRun,
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
    const progress = completeGuideStep(startGuide(createInitialOnboardingProgress(100), 120), "shmygIntroduction", 140);

    saveOnboardingProgress(progress, storage);

    expect(storage.getItem(ONBOARDING_STORAGE_KEY)).toContain("siegeProblem");
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

  it("starts the visible guide with the panic intro before Шмыг explains the siege", () => {
    const progress = startGuide(createInitialOnboardingProgress(100), 120);
    const afterPanic = completeGuideStep(progress, "panicIntro", 140);
    const afterIntroduction = completeGuideStep(afterPanic, "shmygIntroduction", 160);
    const afterSiegeProblem = completeGuideStep(afterIntroduction, "siegeProblem", 180);

    expect(progress.guide.stepId).toBe("panicIntro");
    expect(afterPanic.guide.stepId).toBe("shmygIntroduction");
    expect(afterIntroduction.guide.stepId).toBe("siegeProblem");
    expect(afterSiegeProblem.guide.stepId).toBe("surfacePlan");
  });

  it("finishes only after the post-flyer final continue step", () => {
    const progress = createProgressAtGuideStep("flyerSteamPreview");
    const waiting = completeGuideStep(progress, "flyerSteamPreview", 160);
    const final = completeGuideStep(waiting, "waitFlyerWaveClear", 180);
    const completed = completeGuideStep(final, "finalAfterFlyers", 200);

    expect(waiting.guide).toMatchObject({
      status: "inProgress",
      stepId: "waitFlyerWaveClear",
    });
    expect(final.guide).toMatchObject({
      status: "inProgress",
      stepId: "finalAfterFlyers",
    });
    expect(completed.guide).toMatchObject({
      status: "completed",
      stepId: "complete",
    });
  });

  it("resets full-guide progress on guide version changes while keeping valid hints", () => {
    const storage = createMemoryStorage();

    storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      guide: {
        version: "old-guide",
        status: "completed",
        stepId: "complete",
        completedStepIds: ["shmygIntroduction", "complete"],
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

  it("resets unfinished and legacy skipped guide progress when a new run starts", () => {
    const inProgress = completeGuideStep(startGuide(createInitialOnboardingProgress(100), 110), "shmygIntroduction", 120);
    const skipped = skipGuide(startGuide(createInitialOnboardingProgress(200), 210), 220);
    const completed = completeGuide(startGuide(createInitialOnboardingProgress(300), 310), 320);

    expect(resetGuideForNewRun(inProgress, 400)).toEqual({
      ...inProgress,
      guide: createInitialOnboardingProgress(400).guide,
    });
    expect(resetGuideForNewRun(skipped, 500)).toEqual({
      ...skipped,
      guide: createInitialOnboardingProgress(500).guide,
    });
    expect(resetGuideForNewRun(completed, 600)).toBe(completed);
  });
});

describe("onboarding guide predicates", () => {
  it("derives one opening water/spark/water placement line from the current board", () => {
    const selectedWater = applyAction(createRun(1), { type: "selectTower", towerId: "tower-water-a" });
    const selectedWaterSnapshot = createRuntimeSnapshot(selectedWater);
    const plan = getOpeningPlacementPlan(selectedWaterSnapshot);

    expect(plan).not.toBeNull();
    if (plan === null) {
      throw new Error("Expected opening placement plan");
    }
    expect(plan).toMatchObject({
      firstWaterSlotId: "slot-2-inner",
      sparkSlotId: "slot-2-outer",
      secondWaterSlotId: "slot-3-inner",
    });

    expect(getGuidePlacementTargetSlot(selectedWaterSnapshot, "placeFirstWater")?.id).toBe(plan.firstWaterSlotId);

    const placedWater = applyAction(selectedWater, { type: "placeSelectedTower", slotId: plan.firstWaterSlotId });
    const selectedSpark = applyAction(placedWater, { type: "selectTower", towerId: "tower-spark-a" });

    expect(getGuidePlacementTargetSlot(createRuntimeSnapshot(selectedSpark), "placeFirstSpark")?.id).toBe(plan.sparkSlotId);

    const placedSpark = applyAction(selectedSpark, { type: "placeSelectedTower", slotId: plan.sparkSlotId });
    const selectedSecondWater = applyAction(placedSpark, { type: "selectTower", towerId: "tower-water-b" });
    const secondWaterTarget = getGuidePlacementTargetSlot(createRuntimeSnapshot(selectedSecondWater), "placeSecondWater");

    expect(secondWaterTarget?.id).toBe(plan.secondWaterSlotId);
    expect(isGuideTargetAction(getGuideStep("placeSecondWater"), createRuntimeSnapshot(selectedSecondWater), {
      type: "tapSlot",
      slotId: plan.secondWaterSlotId,
    })).toBe(true);
  });

  it("detects selected and placed opening towers from runtime snapshots", () => {
    const selectedWater = applyAction(createRun(1), { type: "selectTower", towerId: "tower-water-a" });
    const placedWater = applyAction(selectedWater, { type: "placeSelectedTower", slotId: "slot-2-outer" });
    const selectedSpark = applyAction(placedWater, { type: "selectTower", towerId: "tower-spark-a" });
    const placedSpark = applyAction(selectedSpark, { type: "placeSelectedTower", slotId: "slot-2-inner" });
    const selectedSecondWater = applyAction(placedSpark, { type: "selectTower", towerId: "tower-water-b" });
    const placedSecondWater = applyAction(selectedSecondWater, { type: "placeSelectedTower", slotId: "slot-3-inner" });

    expect(isGuideStepComplete(getGuideStep("selectFirstWater"), createRuntimeSnapshot(selectedWater))).toBe(true);
    expect(isGuideStepComplete(getGuideStep("placeFirstWater"), createRuntimeSnapshot(placedWater))).toBe(true);
    expect(isGuideStepComplete(getGuideStep("selectFirstSpark"), createRuntimeSnapshot(selectedSpark))).toBe(true);
    expect(isGuideStepComplete(getGuideStep("placeFirstSpark"), createRuntimeSnapshot(placedSpark))).toBe(true);
    expect(isGuideStepComplete(getGuideStep("selectSecondWater"), createRuntimeSnapshot(selectedSecondWater))).toBe(true);
    expect(isGuideStepComplete(getGuideStep("placeSecondWater"), createRuntimeSnapshot(placedSecondWater))).toBe(true);
  });

  it("matches only the current target gameplay action", () => {
    const selectedWater = applyAction(createRun(1), { type: "selectTower", towerId: "tower-water-a" });
    const selectWaterStep = getGuideStep("selectFirstWater");
    const placeWaterStep = getGuideStep("placeFirstWater");
    const waterTargetSlot = getGuidePlacementTargetSlot(createRuntimeSnapshot(selectedWater), "placeFirstWater");

    expect(isGuideTargetAction(selectWaterStep, createRuntimeSnapshot(createRun(1)), { type: "selectTower", towerId: "tower-water-a" })).toBe(true);
    expect(isGuideTargetAction(selectWaterStep, createRuntimeSnapshot(createRun(1)), { type: "selectTower", towerId: "tower-spark-a" })).toBe(false);
    expect(waterTargetSlot).not.toBeNull();
    expect(isGuideTargetAction(placeWaterStep, createRuntimeSnapshot(selectedWater), { type: "tapSlot", slotId: waterTargetSlot!.id })).toBe(true);
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
        towerOffers: [{ emitterId: "heat" as const, role: "support" as const }],
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
    const damagedTowerDraft = {
      ...towerDraft,
      stats: {
        ...towerDraft.stats,
        damageByReaction: { electroPuddle: 12 },
      },
    };

    expect(isGuideStepComplete(getGuideStep("startFirstWave"), createRuntimeSnapshot(wave))).toBe(true);
    expect(isGuideStepComplete(getGuideStep("observeElectroPuddle"), createRuntimeSnapshot(placedReaction))).toBe(false);
    expect(isGuideStepComplete(getGuideStep("observeElectroPuddle"), { ...createRuntimeSnapshot(wave), stats: damagedTowerDraft.stats })).toBe(false);
    expect(isGuideStepComplete(getGuideStep("observeElectroPuddle"), damagedTowerDraft)).toBe(true);
    expect(isGuideStepComplete(getGuideStep("observeElectroPuddle"), { ...upgradeDraft, stats: damagedTowerDraft.stats })).toBe(true);
    expect(isGuideStepComplete(getGuideStep("draftTowerPick"), towerDraft)).toBe(false);
    expect(isGuideStepComplete(getGuideStep("draftTowerPick"), {
      ...upgradeDraft,
      bench: [...upgradeDraft.bench, createTower("tower-heat-a", "heat", null)],
    })).toBe(true);
    expect(isGuideStepComplete(getGuideStep("draftUpgradePick"), upgradeDraft)).toBe(false);
    expect(isGuideStepComplete(getGuideStep("draftUpgradePick"), {
      ...upgradeDraft,
      waveIndex: 2,
      draft: null,
      bench: [...upgradeDraft.bench, createTower("tower-heat-a", "heat", null)],
    })).toBe(true);
    expect(isGuideStepComplete(getGuideStep("waitFlyerWaveClear"), {
      ...towerDraft,
      phase: "wave" as const,
      waveIndex: 2,
      draft: null,
    })).toBe(false);
    expect(isGuideStepComplete(getGuideStep("waitFlyerWaveClear"), {
      ...towerDraft,
      phase: "draft" as const,
      waveIndex: 2,
    })).toBe(true);
  });

  it("detects selecting and placing heat for steam before the flyer wave", () => {
    const withHeat = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-2-inner"),
        createTower("tower-water-b", "water", "slot-3-inner"),
        createTower("tower-spark-a", "spark", "slot-2-outer"),
      ],
    });
    const selectedHeat = applyAction({
      ...withHeat,
      phase: "countdown",
      waveIndex: 2,
      bench: [...withHeat.bench, createTower("tower-heat-a", "heat", null)],
    }, { type: "selectTower", towerId: "tower-heat-a" });
    const placedHeat = applyAction(selectedHeat, { type: "placeSelectedTower", slotId: "slot-2-outer" });

    expect(isGuideStepComplete(getGuideStep("selectHeatForSteam"), createRuntimeSnapshot(selectedHeat))).toBe(true);
    expect(isGuideStepComplete(getGuideStep("placeHeatForSteam"), createRuntimeSnapshot(placedHeat))).toBe(true);
    expect(placedHeat.reactions.some(reaction => reaction.air === "steam")).toBe(true);
  });
});

describe("onboarding guided action guard", () => {
  it("allows normal actions when the full guide is inactive", () => {
    const progress = createInitialOnboardingProgress(100);

    expect(evaluateGuidedAction(progress, createRuntimeSnapshot(createRun(1)), { type: "startWave" })).toEqual({ type: "allow" });
  });

  it("allows only the current HUD target action during blocking steps", () => {
    const progress = createProgressAtGuideStep("selectFirstWater");
    const snapshot = createRuntimeSnapshot(createRun(1));

    expect(evaluateGuidedAction(progress, snapshot, { type: "selectTower", towerId: "tower-water-a" })).toEqual({
      type: "completeStepThenAllow",
      stepId: "selectFirstWater",
    });
    expect(evaluateGuidedAction(progress, snapshot, { type: "selectTower", towerId: "tower-spark-a" })).toEqual({
      type: "block",
      stepId: "selectFirstWater",
      reason: "nonTargetAction",
    });
    expect(evaluateGuidedAction(progress, snapshot, { type: "startWave" })).toEqual({
      type: "block",
      stepId: "selectFirstWater",
      reason: "nonTargetAction",
    });
  });

  it("uses the same target rule for Phaser slot taps", () => {
    const progress = createProgressAtGuideStep("placeFirstWater");
    const selectedWater = applyAction(createRun(1), { type: "selectTower", towerId: "tower-water-a" });
    const snapshot = createRuntimeSnapshot(selectedWater);
    const targetSlot = getGuidePlacementTargetSlot(snapshot, "placeFirstWater");
    const nonTargetSlot = snapshot.board.slots.find(slot => !slot.locked && slot.id !== targetSlot?.id);

    expect(targetSlot).not.toBeNull();
    expect(nonTargetSlot).toBeDefined();
    expect(evaluateGuidedAction(progress, snapshot, { type: "tapSlot", slotId: targetSlot!.id })).toEqual({
      type: "completeStepThenAllow",
      stepId: "placeFirstWater",
    });
    expect(evaluateGuidedAction(progress, snapshot, { type: "tapSlot", slotId: nonTargetSlot!.id })).toEqual({
      type: "block",
      stepId: "placeFirstWater",
      reason: "nonTargetAction",
    });
    expect(evaluateGuidedAction(progress, snapshot, { type: "tap", point: { x: 10, y: 20 } })).toEqual({
      type: "block",
      stepId: "placeFirstWater",
      reason: "nonTargetAction",
    });
  });

  it("allows the second water placement only when it extends electro puddle coverage", () => {
    const progress = createProgressAtGuideStep("placeSecondWater");
    const placedSpark = applyAction(
      applyAction(
        applyAction(
          applyAction(createRun(1), { type: "selectTower", towerId: "tower-water-a" }),
          { type: "placeSelectedTower", slotId: "slot-2-inner" },
        ),
        { type: "selectTower", towerId: "tower-spark-a" },
      ),
      { type: "placeSelectedTower", slotId: "slot-2-outer" },
    );
    const selectedSecondWater = applyAction(placedSpark, { type: "selectTower", towerId: "tower-water-b" });
    const snapshot = createRuntimeSnapshot(selectedSecondWater);
    const targetSlot = getGuidePlacementTargetSlot(snapshot, "placeSecondWater");

    expect(targetSlot).not.toBeNull();
    expect(evaluateGuidedAction(progress, snapshot, { type: "tapSlot", slotId: targetSlot!.id })).toEqual({
      type: "completeStepThenAllow",
      stepId: "placeSecondWater",
    });
    expect(evaluateGuidedAction(progress, snapshot, { type: "tapSlot", slotId: "slot-7-inner" })).toEqual({
      type: "block",
      stepId: "placeSecondWater",
      reason: "nonTargetAction",
    });
  });

  it("keeps pause blocked before the first wave while allowing resume and wave-time pause", () => {
    const progress = createProgressAtGuideStep("selectFirstWater");
    const readySnapshot = createRuntimeSnapshot(createRun(1));
    const waveSnapshot = createRuntimeSnapshot(applyAction(createRun(1), { type: "startWave" }));

    expect(evaluateGuidedAction(progress, readySnapshot, { type: "pause" })).toEqual({
      type: "block",
      stepId: "selectFirstWater",
      reason: "nonTargetAction",
    });
    expect(evaluateGuidedAction(progress, readySnapshot, { type: "resume" })).toEqual({ type: "allow" });
    expect(evaluateGuidedAction(progress, waveSnapshot, { type: "pause" })).toEqual({ type: "allow" });
  });

  it("allows system restart actions so the visible guide cannot block run boot", () => {
    const progress = createProgressAtGuideStep("shmygIntroduction");
    const snapshot = createRuntimeSnapshot(createRun(1));

    expect(evaluateGuidedAction(progress, snapshot, { type: "restart", seed: 42 })).toEqual({ type: "allow" });
  });

  it("does not freeze combat if a draft target step is reached before draft UI exists", () => {
    const progress = createProgressAtGuideStep("draftTowerPick");
    const waveSnapshot = createRuntimeSnapshot(applyAction(createRun(1), { type: "startWave" }));

    expect(evaluateGuidedAction(progress, waveSnapshot, { type: "selectTower", towerId: "tower-water-a" })).toEqual({ type: "allow" });
  });

  it("targets Магмовый кран only when it appears before the first flying wave", () => {
    const progress = createProgressAtGuideStep("draftTowerPick");
    const openingDraftSnapshot = {
      ...createRuntimeSnapshot(createRun(1)),
      phase: "draft" as const,
      waveIndex: 0,
      draft: {
        step: "tower" as const,
        rerollsRemaining: 1,
        towerOffers: [
          { emitterId: "spark" as const, role: "support" as const },
          { emitterId: "water" as const, role: "generic" as const },
          { emitterId: "oil" as const, role: "pivot" as const },
        ],
        upgradeOffers: [],
      },
    };
    const flyerDraftSnapshot = {
      ...openingDraftSnapshot,
      waveIndex: 1,
      draft: {
        step: "tower" as const,
        rerollsRemaining: 1,
        towerOffers: [
          { emitterId: "heat" as const, role: "support" as const },
          { emitterId: "spark" as const, role: "generic" as const },
          { emitterId: "water" as const, role: "pivot" as const },
        ],
        upgradeOffers: [],
      },
    };

    expect(isGuideTargetAvailable(getGuideStep("draftTowerPick"), openingDraftSnapshot)).toBe(false);
    expect(evaluateGuidedAction(progress, openingDraftSnapshot, { type: "chooseDraftTower", emitterId: "spark" })).toEqual({ type: "allow" });
    expect(isGuideTargetAvailable(getGuideStep("draftTowerPick"), flyerDraftSnapshot)).toBe(true);
    expect(evaluateGuidedAction(progress, flyerDraftSnapshot, { type: "chooseDraftTower", emitterId: "heat" })).toEqual({
      type: "completeStepThenAllow",
      stepId: "draftTowerPick",
    });
    expect(evaluateGuidedAction(progress, flyerDraftSnapshot, { type: "chooseDraftTower", emitterId: "spark" })).toEqual({
      type: "block",
      stepId: "draftTowerPick",
      reason: "nonTargetAction",
    });
  });

  it("allows placing heat only on the spark slot when it creates steam", () => {
    const progress = createProgressAtGuideStep("placeHeatForSteam");
    const withHeat = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-2-inner"),
        createTower("tower-water-b", "water", "slot-3-inner"),
        createTower("tower-spark-a", "spark", "slot-2-outer"),
      ],
    });
    const selectedHeat = applyAction({
      ...withHeat,
      phase: "countdown",
      waveIndex: 2,
      bench: [...withHeat.bench, createTower("tower-heat-a", "heat", null)],
    }, { type: "selectTower", towerId: "tower-heat-a" });
    const snapshot = createRuntimeSnapshot(selectedHeat);

    expect(evaluateGuidedAction(progress, snapshot, { type: "tapSlot", slotId: "slot-2-outer" })).toEqual({
      type: "completeStepThenAllow",
      stepId: "placeHeatForSteam",
    });
    expect(evaluateGuidedAction(progress, snapshot, { type: "tapSlot", slotId: "slot-3-inner" })).toEqual({
      type: "block",
      stepId: "placeHeatForSteam",
      reason: "nonTargetAction",
    });
  });

  it("blocks debug-only actions unless the debug bypass is explicit", () => {
    const progress = createProgressAtGuideStep("selectFirstWater");
    const snapshot = createRuntimeSnapshot(createRun(1));
    const action = { type: "debugJumpToWave", waveIndex: 3 } as const;

    expect(evaluateGuidedAction(progress, snapshot, action)).toEqual({
      type: "block",
      stepId: "selectFirstWater",
      reason: "debugAction",
    });
    expect(evaluateGuidedAction(progress, snapshot, action, { debugBypass: true })).toEqual({ type: "allow" });
  });

  it("advances stale completed steps before allowing a recovery action", () => {
    const progress = createProgressAtGuideStep("selectFirstWater");
    const selectedWater = applyAction(createRun(1), { type: "selectTower", towerId: "tower-water-a" });

    expect(evaluateGuidedAction(progress, createRuntimeSnapshot(selectedWater), { type: "startWave" })).toEqual({
      type: "completeStepThenAllow",
      stepId: "selectFirstWater",
    });
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

function createProgressAtGuideStep(stepId: GuideStepId): OnboardingProgress {
  const progress = startGuide(createInitialOnboardingProgress(100), 120);

  return {
    ...progress,
    guide: {
      ...progress.guide,
      status: "inProgress",
      stepId,
      updatedAt: 140,
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
