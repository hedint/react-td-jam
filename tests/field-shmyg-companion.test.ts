import type { OnboardingProgress } from "@entities/onboarding/model";
import { gameConfig } from "@entities/game-session/model/config";
import { createSnapshot, createTower } from "@entities/game-session/model/simulation";
import {
  canShowFieldShmygSpeech,
  completeGuide,
  createInitialFieldShmygSpeechMemory,
  createInitialOnboardingProgress,
  FIELD_SHMYG_FALLBACK_TARGET,
  getFieldShmygComboFillerMinWaveIndex,
  getFieldShmygComboFillerReactionId,
  getFieldShmygRouteTargets,
  recordFieldShmygSpeech,
  shouldOfferFieldShmygFlyerHint,
  shouldShowFieldShmyg,
  startGuide,
} from "@entities/onboarding/model";
import { describe, expect, it } from "vitest";

describe("field Шмыг companion decision logic", () => {
  it("spawns after wave 1 when the full guide is already inactive", () => {
    const progress = createCompletedGuideProgress();
    const beforeFirstWave = createRuntimeSnapshot({ phase: "ready", waveIndex: 0 });
    const afterFirstWave = createRuntimeSnapshot({ phase: "draft", waveIndex: 0 });

    expect(shouldShowFieldShmyg(beforeFirstWave, progress)).toBe(false);
    expect(shouldShowFieldShmyg(afterFirstWave, progress)).toBe(true);
  });

  it("does not spawn during the active guide and waits until wave 4 after that guide run", () => {
    const activeProgress = startGuide(createInitialOnboardingProgress(100), 120);
    const completedProgress = completeGuide(activeProgress, 140);
    const waveThreeCountdown = createRuntimeSnapshot({ phase: "countdown", waveIndex: 2 });
    const waveFourCountdown = createRuntimeSnapshot({ phase: "countdown", waveIndex: 3 });

    expect(shouldShowFieldShmyg(waveFourCountdown, activeProgress, { guideWasActiveThisRun: true })).toBe(false);
    expect(shouldShowFieldShmyg(waveThreeCountdown, completedProgress, { guideWasActiveThisRun: true })).toBe(false);
    expect(shouldShowFieldShmyg(waveFourCountdown, completedProgress, { guideWasActiveThisRun: true })).toBe(true);
  });

  it("uses the upper-left fallback when no towers are placed", () => {
    expect(getFieldShmygRouteTargets(createRuntimeSnapshot()).at(0)).toEqual(FIELD_SHMYG_FALLBACK_TARGET);
    expect(FIELD_SHMYG_FALLBACK_TARGET).toMatchObject({
      x: 76,
      y: 176,
    });
  });

  it("selects only outer route targets and groups nearby towers by side", () => {
    const snapshot = createRuntimeSnapshot({
      placedTowers: [
        createTower("tower-water-a", "water", "slot-2-inner"),
        createTower("tower-spark-a", "spark", "slot-3-inner"),
        createTower("tower-heat-a", "heat", "slot-7-inner"),
      ],
    });
    const targets = getFieldShmygRouteTargets(snapshot);
    const slotById = new Map(snapshot.board.slots.map(slot => [slot.id, slot]));

    expect(targets).toHaveLength(2);
    expect(targets.map(target => target.side)).toEqual(["left", "top"]);
    expect(targets[0]?.x).toBeLessThan(Math.min(...snapshot.board.slots.filter(slot => slot.lane === "outer" && slot.x < 100).map(slot => slot.x)));
    expect(targets[1]?.y).toBeLessThan(Math.min(...snapshot.board.slots.filter(slot => slot.lane === "outer" && slot.y < 250).map(slot => slot.y)));
    targets.flatMap(target => target.slotIds).forEach((slotId) => {
      expect(slotById.get(slotId)?.lane).toBe("outer");
    });
  });

  it("offers the wave-3 flyer hint only when the full guide is inactive", () => {
    const inactiveProgress = createCompletedGuideProgress();
    const activeProgress = startGuide(createInitialOnboardingProgress(100), 120);
    const beforeFlyers = createRuntimeSnapshot({ phase: "countdown", waveIndex: 2 });

    expect(shouldOfferFieldShmygFlyerHint(beforeFlyers, inactiveProgress)).toBe(true);
    expect(shouldOfferFieldShmygFlyerHint(beforeFlyers, activeProgress)).toBe(false);
    expect(shouldOfferFieldShmygFlyerHint(beforeFlyers, inactiveProgress, { guideWasActiveThisRun: true })).toBe(false);
    expect(shouldOfferFieldShmygFlyerHint(createRuntimeSnapshot({ phase: "wave", waveIndex: 2 }), inactiveProgress)).toBe(false);
  });

  it("applies global cooldown, per-wave important cap, repeat cooldown, and max repeats", () => {
    const firstRequest = {
      kind: "important" as const,
      id: "wave3Flyers" as const,
      nowMs: 100000,
      waveIndex: 2,
    };

    let memory = createInitialFieldShmygSpeechMemory();

    expect(canShowFieldShmygSpeech(memory, firstRequest)).toBe(true);
    memory = recordFieldShmygSpeech(memory, firstRequest);

    expect(canShowFieldShmygSpeech(memory, { ...firstRequest, nowMs: 110000 })).toBe(false);
    expect(canShowFieldShmygSpeech(memory, { ...firstRequest, nowMs: 125000 })).toBe(false);
    expect(canShowFieldShmygSpeech(memory, { ...firstRequest, nowMs: 125000, waveIndex: 3 })).toBe(false);

    const secondRequest = { ...firstRequest, nowMs: 190000, waveIndex: 3 };

    expect(canShowFieldShmygSpeech(memory, secondRequest)).toBe(true);
    memory = recordFieldShmygSpeech(memory, secondRequest);

    expect(canShowFieldShmygSpeech(memory, { ...firstRequest, nowMs: 280000, waveIndex: 4 })).toBe(false);
  });

  it("allows filler only after a longer silence window", () => {
    const memory = recordFieldShmygSpeech(createInitialFieldShmygSpeechMemory(), {
      kind: "important",
      id: "coreDanger",
      nowMs: 50000,
      waveIndex: 4,
    });

    expect(canShowFieldShmygSpeech(memory, { kind: "filler", nowMs: 80000, waveIndex: 4 })).toBe(false);
    expect(canShowFieldShmygSpeech(memory, { kind: "filler", nowMs: 85000, waveIndex: 4 })).toBe(true);
  });

  it("treats combo tips as one-shot filler tied to reaction ids", () => {
    let memory = recordFieldShmygSpeech(createInitialFieldShmygSpeechMemory(), {
      kind: "filler",
      nowMs: 50000,
      waveIndex: 3,
    });
    const request = {
      kind: "comboFiller" as const,
      comboId: "stormCloudCombo" as const,
      nowMs: 85000,
      waveIndex: 4,
    };

    expect(getFieldShmygComboFillerReactionId("stormCloudCombo")).toBe("stormCloud");
    expect(getFieldShmygComboFillerReactionId("fireVortexCombo")).toBe("fireVortex");
    expect(getFieldShmygComboFillerReactionId("fireStormCombo")).toBe("fireStorm");
    expect(canShowFieldShmygSpeech(memory, { ...request, nowMs: 84000 })).toBe(false);
    expect(canShowFieldShmygSpeech(memory, request)).toBe(true);

    memory = recordFieldShmygSpeech(memory, request);

    expect(canShowFieldShmygSpeech(memory, { ...request, nowMs: 200000, waveIndex: 5 })).toBe(false);
  });

  it("gates combo tips by user-facing wave number", () => {
    expect(getFieldShmygComboFillerMinWaveIndex("stormCloudCombo")).toBe(4);
    expect(getFieldShmygComboFillerMinWaveIndex("fireVortexCombo")).toBe(4);
    expect(getFieldShmygComboFillerMinWaveIndex("fireStormCombo")).toBe(6);
  });
});

function createCompletedGuideProgress(): OnboardingProgress {
  return completeGuide(startGuide(createInitialOnboardingProgress(100), 120), 140);
}

function createRuntimeSnapshot(overrides: Partial<ReturnType<typeof createSnapshot>> = {}) {
  const state = {
    schemaVersion: gameConfig.balance.schemaVersion,
    phase: "ready" as const,
    seed: 1,
    rng: { seed: 1, state: 1 },
    tick: 0,
    elapsedMs: 0,
    waveIndex: 0,
    countdownMs: 0,
    paused: false,
    speed: 1 as const,
    coreHp: gameConfig.balance.coreHp,
    waveRuntime: null,
    board: gameConfig.board,
    bench: [],
    placedTowers: [],
    selectedTowerId: null,
    enemies: [],
    reactions: [],
    draft: null,
    upgrades: [],
    boss: null,
    stats: {
      leaks: 0,
      kills: 0,
      bossBreaks: 0,
      totalDamage: 0,
      damageBySource: {},
      damageByReaction: {},
      waveStats: [],
    },
    debugVisible: false,
    debugCoreHpLocked: false,
    debugReactionOverrides: [],
    lastTap: null,
  };

  return {
    ...createSnapshot(state),
    ...overrides,
    fps: 60,
    viewport: {
      width: 390,
      height: 844,
    },
  };
}
