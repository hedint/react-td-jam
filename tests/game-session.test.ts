import type { GameConfig } from "@entities/game-session/model/types";
import { createStadiumLoopBoard, defaultBoardGeometryConfig } from "@entities/game-session/model/boardGeometry";
import { gameConfig, validateGameConfig } from "@entities/game-session/model/config";
import { createFixedStepDriver } from "@entities/game-session/model/fixedStepDriver";
import { clearSavedRun, hasSavedRun, loadSavedRun, saveRun } from "@entities/game-session/model/persistence";
import {
  applyAction,
  createGrunt,
  createRun,
  createSnapshot,
  createTower,
  deserializeRun,
  nextRandom,
  serializeRun,
  stepRun,
} from "@entities/game-session/model/simulation";
import { useGameSessionStore } from "@entities/game-session/model/store";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

describe("run simulation", () => {
  it("creates a serializable deterministic initial run state", () => {
    const state = createRun(42);

    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(state).toMatchObject({
      seed: 42,
      tick: 0,
      elapsedMs: 0,
      phase: "ready",
      paused: false,
      coreHp: 15,
      lastTap: null,
    });
    expect(state.board.pathCells).toHaveLength(16);
    expect(state.board.slots).toHaveLength(32);
    expect(state.board.slots.every(slot => !slot.locked)).toBe(true);
    expect(state.bench.map(tower => tower.displayName)).toEqual(["Водомёт", "Водомёт", "Разрядник"]);
    expect(state.bench.every(tower => tower.slotId === null)).toBe(true);
    expect(state.placedTowers).toEqual([]);
    expect(state.enemies).toEqual([]);
  });

  it("advances seeded RNG deterministically", () => {
    const first = createRun(7).rng;
    const second = createRun(7).rng;

    expect(nextRandom(first)).toEqual(nextRandom(second));
  });

  it("rerolls draft offers deterministically by seed", () => {
    const draftA = stepMany(startFirstWave(createPlacedStartingRun(31)), 90);
    const draftB = stepMany(startFirstWave(createPlacedStartingRun(31)), 90);

    expect(applyAction(draftA, { type: "rerollDraft" }).draft).toEqual(applyAction(draftB, { type: "rerollDraft" }).draft);
  });

  it("steps deterministically for the slice scenario", () => {
    const runA = stepMany(startFirstWave(createPlacedStartingRun(11)), 90);
    const runB = stepMany(startFirstWave(createPlacedStartingRun(11)), 90);

    expect(runA).toEqual(runB);
    expect(runA.phase).toBe("draft");
    expect(runA.tick).toBeGreaterThan(0);
    expect(runA.elapsedMs).toBeGreaterThan(0);
  });

  it("uses the shared fixed-step driver for headless stepping", () => {
    const driver = createFixedStepDriver({
      initialState: startFirstWave(createPlacedStartingRun(11)),
      stepMs: 1000 / 30,
      step: stepRun,
    });

    driver.stepFrame(16);
    expect(driver.state.tick).toBe(0);

    driver.stepFrame(18);
    expect(driver.state.tick).toBe(1);
    expect(driver.state.elapsedMs).toBeCloseTo(1000 / 30);
  });

  it("forms a two-cell Электролужа from the starting Вода + Искра setup", () => {
    const state = createPlacedStartingRun(1);

    expect(state.reactions).toEqual([
      { cellIndex: 0, ground: "electroPuddle" },
      { cellIndex: 1, ground: "electroPuddle" },
      { cellIndex: 2, ground: null },
      { cellIndex: 3, ground: null },
      { cellIndex: 4, ground: null },
      { cellIndex: 5, ground: null },
      { cellIndex: 6, ground: null },
      { cellIndex: 7, ground: null },
      { cellIndex: 8, ground: null },
      { cellIndex: 9, ground: null },
      { cellIndex: 10, ground: null },
      { cellIndex: 11, ground: null },
      { cellIndex: 12, ground: null },
      { cellIndex: 13, ground: null },
      { cellIndex: 14, ground: null },
      { cellIndex: 15, ground: null },
    ]);
  });

  it("creates a renderer-facing snapshot without mutating run state", () => {
    const state = startFirstWave(createPlacedStartingRun(1));
    const snapshot = createSnapshot(state);

    expect(snapshot.livingEnemies).toHaveLength(1);
    expect(snapshot.activeReactions).toEqual([
      { cellIndex: 0, ground: "electroPuddle" },
      { cellIndex: 1, ground: "electroPuddle" },
    ]);
    expect("fps" in snapshot).toBe(false);
  });

  it("does not form a damaging reaction from a lone tower", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-only", "water", "slot-0-outer"),
      ],
      enemies: [
        createGrunt(),
      ],
    });
    const next = stepRun(state, 1000 / 30);

    expect(next.reactions.every(reaction => reaction.ground === null)).toBe(true);
    expect(next.enemies[0]?.hp).toBe(30);
  });

  it("damages and kills a Грунт that crosses the Электролужа", () => {
    const state = stepMany(startFirstWave(createPlacedStartingRun(1)), 90);

    expect(state.enemies).toEqual([]);
    expect(state.coreHp).toBe(15);
    expect(state.phase).toBe("draft");
  });

  it("leaks a surviving Грунт and reduces core HP", () => {
    const state = createRun(1, {
      placedTowers: [],
      enemies: [
        createGrunt({ hp: 100 }),
      ],
    });
    const next = stepMany(state, 490);

    expect(next.enemies).toEqual([]);
    expect(next.coreHp).toBe(14);
    expect(next.stats.leaks).toBe(1);
  });

  it("applies run-control actions without touching renderer state", () => {
    const state = createRun(1);

    expect(applyAction(state, { type: "pause" }).paused).toBe(true);
    expect(applyAction(state, { type: "setSpeed", speed: 2 }).speed).toBe(2);
    expect(applyAction(state, { type: "startWave" }).phase).toBe("wave");
    expect(applyAction(state, { type: "toggleDebug" }).debugVisible).toBe(true);
    expect(applyAction(state, { type: "selectTower", towerId: "tower-water-a" }).selectedTowerId).toBe("tower-water-a");
    expect(applyAction(state, { type: "tap", point: { x: 12, y: 34 } }).lastTap).toEqual({ x: 12, y: 34 });
    expect(applyAction(state, { type: "restart", seed: 99 }).seed).toBe(99);
  });

  it("supports draft picks and selected bench placement as reducer contracts", () => {
    const draft = stepMany(startFirstWave(createPlacedStartingRun(5)), 90);
    const withTower = applyAction(draft, { type: "chooseDraftTower", emitterId: draft.draft!.towerOffers[0]! });
    const selected = applyAction(withTower, { type: "selectTower", towerId: withTower.bench[0]!.id });
    const placed = applyAction(selected, { type: "placeSelectedTower", slotId: "slot-2-outer" });
    const upgraded = applyAction(draft, { type: "chooseDraftUpgrade", upgradeId: draft.draft!.upgradeOffers[0]! });

    expect(withTower.draft?.step).toBe("upgrade");
    expect(placed.bench).toHaveLength(0);
    expect(placed.placedTowers.some(tower => tower.slotId === "slot-2-outer")).toBe(true);
    expect(upgraded.upgrades).toEqual([{ upgradeId: draft.draft!.upgradeOffers[0]!, stacks: 1 }]);
  });

  it("keeps paused runs frozen and applies speed through simulation stepping", () => {
    const paused = applyAction(startFirstWave(createRun(1)), { type: "pause" });
    const fast = applyAction(startFirstWave(createRun(1)), { type: "setSpeed", speed: 2 });

    expect(stepRun(paused, 1000 / 30)).toBe(paused);
    expect(stepRun(fast, 1000 / 30).elapsedMs).toBeCloseTo(2000 / 30);
  });

  it("starts later waves through a countdown after draft completion", () => {
    const draft = {
      ...createRun(1),
      phase: "draft" as const,
      draft: {
        step: "tower" as const,
        rerollsRemaining: 1,
        towerOffers: ["water", "spark", "heat"] as const,
        upgradeOffers: ["waterCapacity", "sparkCapacity", "heatReach"] as const,
      },
    };
    const countdown = applyAction(draft, { type: "completeDraft" });

    expect(countdown).toMatchObject({
      phase: "countdown",
      waveIndex: 1,
      countdownMs: 3000,
      draft: null,
    });

    const wave = stepMany(countdown, 90);

    expect(wave.phase).toBe("wave");
    expect(wave.enemies).toHaveLength(gameConfig.waves[1]!.count);
  });

  it("generates a parameterized stadium loop with corner slot influence", () => {
    const board = createStadiumLoopBoard(defaultBoardGeometryConfig);
    const twelveCellBoard = createStadiumLoopBoard({
      ...defaultBoardGeometryConfig,
      pathCellCount: 12,
    });

    expect(board.pathCells.map(cell => cell.index)).toEqual(Array.from({ length: 16 }, (_, index) => index));
    expect(board.pathCells.map(cell => cell.isCorner ? cell.index : null).filter(index => index !== null)).toEqual([3, 7, 11, 15]);
    expect(board.slots).toHaveLength(32);
    expect(board.slots.filter(slot => slot.id.endsWith("-inner"))).toHaveLength(16);
    expect(board.slots.filter(slot => slot.id.endsWith("-outer"))).toHaveLength(16);
    expect(board.slots.find(slot => slot.id === "slot-0-inner")?.cellIndexes).toEqual([0]);
    expect(board.slots.find(slot => slot.id === "slot-3-inner")).toMatchObject({
      isCorner: true,
      cellIndexes: [3, 4],
    });
    expect(board.slots.find(slot => slot.id === "slot-15-outer")?.cellIndexes).toEqual([15, 0]);
    expect(twelveCellBoard.pathCells).toHaveLength(12);
    expect(twelveCellBoard.pathCells.map(cell => cell.isCorner ? cell.index : null).filter(index => index !== null)).toEqual([2, 5, 8, 11]);
  });

  it("places physical bench tower instances before the first wave", () => {
    const selected = applyAction(createRun(1), { type: "selectTower", towerId: "tower-water-a" });
    const placed = applyAction(selected, { type: "placeSelectedTower", slotId: "slot-0-outer" });

    expect(placed.bench.map(tower => tower.id)).toEqual(["tower-water-b", "tower-spark-a"]);
    expect(placed.placedTowers).toEqual([
      {
        id: "tower-water-a",
        emitterId: "water",
        displayName: "Водомёт",
        slotId: "slot-0-outer",
      },
    ]);
    expect(placed.selectedTowerId).toBeNull();
  });

  it("allows additive bench placement during a running wave", () => {
    const running = startFirstWave(createRun(1));
    const selected = applyAction(running, { type: "selectTower", towerId: "tower-water-a" });
    const placed = applyAction(selected, { type: "tapSlot", slotId: "slot-0-outer" });

    expect(placed.phase).toBe("wave");
    expect(placed.placedTowers.find(tower => tower.id === "tower-water-a")?.slotId).toBe("slot-0-outer");
    expect(placed.bench.some(tower => tower.id === "tower-water-a")).toBe(false);
  });

  it("keeps occupied slots non-destructive while a wave is running", () => {
    const running = startFirstWave(createPlacedStartingRun(1));
    const selectedPlacedTower = applyAction(running, { type: "selectTower", towerId: "tower-water-a" });
    const moveAttempt = applyAction(selectedPlacedTower, { type: "placeSelectedTower", slotId: "slot-2-outer" });
    const tapAttempt = applyAction({ ...running, selectedTowerId: null }, { type: "tapSlot", slotId: "slot-0-outer" });
    const selectedBenchTower = applyAction(running, { type: "selectTower", towerId: "tower-heat-test" });

    expect(moveAttempt.placedTowers.find(tower => tower.id === "tower-water-a")?.slotId).toBe("slot-0-outer");
    expect(tapAttempt.selectedTowerId).toBeNull();
    expect(selectedBenchTower).toBe(running);
  });

  it("moves, removes, and swaps placed towers only while paused", () => {
    const paused = applyAction(createPlacedStartingRun(1), { type: "pause" });
    const moved = applyAction(
      applyAction(paused, { type: "selectTower", towerId: "tower-water-a" }),
      { type: "placeSelectedTower", slotId: "slot-2-outer" },
    );
    const removed = applyAction(
      applyAction(moved, { type: "selectTower", towerId: "tower-water-a" }),
      { type: "tapSlot", slotId: "slot-2-outer" },
    );
    const swapped = applyAction(
      applyAction(paused, { type: "selectTower", towerId: "tower-water-a" }),
      { type: "placeSelectedTower", slotId: "slot-1-outer" },
    );

    expect(moved.placedTowers.find(tower => tower.id === "tower-water-a")?.slotId).toBe("slot-2-outer");
    expect(removed.placedTowers.some(tower => tower.id === "tower-water-a")).toBe(false);
    expect(removed.bench.find(tower => tower.id === "tower-water-a")?.slotId).toBeNull();
    expect(swapped.placedTowers.find(tower => tower.id === "tower-water-a")?.slotId).toBe("slot-1-outer");
    expect(swapped.placedTowers.find(tower => tower.id === "tower-water-b")?.slotId).toBe("slot-0-outer");
  });

  it("recomputes tower projection after placement changes", () => {
    const withFirstWater = placeBenchTower(createRun(1), "tower-water-a", "slot-0-outer");
    const withSecondWater = placeBenchTower(withFirstWater, "tower-water-b", "slot-1-outer");
    const withSpark = placeBenchTower(withSecondWater, "tower-spark-a", "slot-0-inner");
    const removedSpark = applyAction(
      applyAction(applyAction(withSpark, { type: "pause" }), { type: "selectTower", towerId: "tower-spark-a" }),
      { type: "tapSlot", slotId: "slot-0-inner" },
    );

    expect(withFirstWater.reactions.every(reaction => reaction.ground === null)).toBe(true);
    expect(withSpark.reactions.filter(reaction => reaction.ground === "electroPuddle").map(reaction => reaction.cellIndex)).toEqual([0, 1]);
    expect(removedSpark.reactions.every(reaction => reaction.ground === null)).toBe(true);
  });

  it("serializes, deserializes, and continues the same run state", () => {
    const state = stepMany(startFirstWave(createPlacedStartingRun(13)), 12);
    const restored = deserializeRun(serializeRun(state));

    expect(restored).toEqual(state);
    expect(stepRun(restored, 1000 / 30)).toEqual(stepRun(state, 1000 / 30));
  });
});

describe("run persistence", () => {
  it("saves, loads, and clears a serialized run", () => {
    const storage = createMemoryStorage();
    const state = stepMany(startFirstWave(createRun(21)), 6);

    expect(hasSavedRun(storage)).toBe(false);

    saveRun(state, storage);
    expect(hasSavedRun(storage)).toBe(true);
    expect(loadSavedRun(storage)).toEqual(state);

    clearSavedRun(storage);
    expect(hasSavedRun(storage)).toBe(false);
    expect(loadSavedRun(storage)).toBeNull();
  });
});

describe("game config", () => {
  it("passes validation for the authored P0 config", () => {
    expect(validateGameConfig(gameConfig)).toEqual([]);
  });

  it("reports malformed ids and display names", () => {
    const malformed = cloneConfig(gameConfig);
    const emitters = malformed.emitters as Mutable<typeof malformed.emitters>;
    const reactions = malformed.reactions as Mutable<typeof malformed.reactions>;
    const waves = malformed.waves as Mutable<typeof malformed.waves>;
    const upgrades = malformed.upgrades as Mutable<typeof malformed.upgrades>;

    emitters[0] = {
      ...emitters[0]!,
      displayName: "",
    };
    reactions[0] = {
      ...reactions[0]!,
      inputs: ["missing-input"],
    };
    waves[0] = {
      ...waves[0]!,
      enemyId: "missing-enemy" as never,
    };
    upgrades[0] = {
      ...upgrades[0]!,
      emitterId: "missing-emitter" as never,
    };

    expect(validateGameConfig(malformed)).toEqual([
      "emitter water is missing display names",
      "reaction electroPuddle references unknown input missing-input",
      "wave wave-1 references unknown enemy missing-enemy",
      "upgrade waterCapacity references unknown emitter missing-emitter",
    ]);
  });
});

describe("game session store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("applies runtime snapshots for the debug HUD", () => {
    const store = useGameSessionStore();
    const run = {
      ...createSnapshot(createRun(1)),
      tick: 12,
      elapsedMs: 400,
      lastTap: { x: 120, y: 240 },
    };

    store.applySnapshot({
      ...run,
      fps: 59,
      viewport: { width: 1280, height: 720 },
    });

    expect(store.tick).toBe(12);
    expect(store.elapsedSeconds).toBe("0.4");
    expect(store.fps).toBe(59);
    expect(store.coreHp).toBe(15);
    expect(store.waveLabel).toBe("1");
    expect(store.speed).toBe(1);
    expect(store.phaseLabel).toBe("Ожидание");
    expect(store.canStartWave).toBe(true);
    expect(store.livingEnemyCount).toBe(0);
    expect(store.towerItems).toEqual([
      { id: "tower-water-a", label: "Водомёт", placed: false },
      { id: "tower-water-b", label: "Водомёт", placed: false },
      { id: "tower-spark-a", label: "Разрядник", placed: false },
    ]);
    expect(store.lastTapLabel).toBe("120, 240");
  });
});

function stepMany(state: ReturnType<typeof createRun>, times: number): ReturnType<typeof createRun> {
  let current = state;

  for (let index = 0; index < times; index += 1) {
    current = stepRun(current, 1000 / 30);
  }

  return current;
}

function startFirstWave(state: ReturnType<typeof createRun>): ReturnType<typeof createRun> {
  return applyAction(state, { type: "startWave" });
}

function createPlacedStartingRun(seed: number): ReturnType<typeof createRun> {
  return createRun(seed, {
    placedTowers: [
      createTower("tower-water-a", "water", "slot-0-outer"),
      createTower("tower-water-b", "water", "slot-1-outer"),
      createTower("tower-spark-a", "spark", "slot-0-inner"),
    ],
  });
}

function placeBenchTower(state: ReturnType<typeof createRun>, towerId: string, slotId: string): ReturnType<typeof createRun> {
  return applyAction(
    applyAction(state, { type: "selectTower", towerId }),
    { type: "placeSelectedTower", slotId },
  );
}

function cloneConfig(config: GameConfig): GameConfig {
  return JSON.parse(JSON.stringify(config)) as GameConfig;
}

type Mutable<T extends readonly unknown[]> = [...T];

function createMemoryStorage() {
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
