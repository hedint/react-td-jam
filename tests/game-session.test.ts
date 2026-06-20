import type { GameConfig } from "@entities/game-session/model/types";
import { createStadiumLoopBoard, defaultBoardGeometryConfig } from "@entities/game-session/model/boardGeometry";
import { gameConfig, validateGameConfig } from "@entities/game-session/model/config";
import { createFixedStepDriver } from "@entities/game-session/model/fixedStepDriver";
import { runHeadlessRun } from "@entities/game-session/model/headlessRun";
import { clearSavedRun, hasSavedRun, loadSavedRun, saveRun } from "@entities/game-session/model/persistence";
import { collectConnectedPools, projectReagents, resolveReactions } from "@entities/game-session/model/reactions";
import {
  applyAction,
  createEnemy,
  createGrunt,
  createRun,
  createSnapshot,
  createTower,
  deserializeRun,
  getCurrentPathCellIndex,
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

  it("keeps Жар offered before the first flying wave until the player takes it", () => {
    const draftBeforeFlyers = advanceToDraftAfterWave2(createRun(22));
    const rerolled = applyAction(draftBeforeFlyers, { type: "rerollDraft" });
    const withHeat = applyAction(draftBeforeFlyers, { type: "chooseDraftTower", emitterId: "heat" });

    expect(draftBeforeFlyers).toMatchObject({
      phase: "draft",
      waveIndex: 1,
    });
    expect(draftBeforeFlyers.draft?.towerOffers).toContain("heat");
    expect(rerolled.draft?.towerOffers).toContain("heat");
    expect(withHeat.bench.some(tower => tower.emitterId === "heat")).toBe(true);
  });

  it("does not gate the first flying wave when Жар is refused", () => {
    const draftBeforeFlyers = advanceToDraftAfterWave2(createRun(22));
    const refusedHeat = applyAction(draftBeforeFlyers, { type: "chooseDraftTower", emitterId: "water" });
    const countdown = applyAction(refusedHeat, { type: "completeDraft" });
    const wave = stepMany(countdown, 90);

    expect(wave.phase).toBe("wave");
    expect(wave.waveRuntime?.waveId).toBe("wave-3");
    expect(wave.enemies[0]?.enemyId).toBe("flyer");
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
      { cellIndex: 0, ground: "electroPuddle", air: null },
      { cellIndex: 1, ground: "electroPuddle", air: null },
      { cellIndex: 2, ground: null, air: null },
      { cellIndex: 3, ground: null, air: null },
      { cellIndex: 4, ground: null, air: null },
      { cellIndex: 5, ground: null, air: null },
      { cellIndex: 6, ground: null, air: null },
      { cellIndex: 7, ground: null, air: null },
      { cellIndex: 8, ground: null, air: null },
      { cellIndex: 9, ground: null, air: null },
      { cellIndex: 10, ground: null, air: null },
      { cellIndex: 11, ground: null, air: null },
      { cellIndex: 12, ground: null, air: null },
      { cellIndex: 13, ground: null, air: null },
      { cellIndex: 14, ground: null, air: null },
      { cellIndex: 15, ground: null, air: null },
    ]);
  });

  it("creates a renderer-facing snapshot without mutating run state", () => {
    const state = startFirstWave(createPlacedStartingRun(1));
    const snapshot = createSnapshot(state);

    expect(snapshot.livingEnemies).toHaveLength(1);
    expect(snapshot.activeReactions).toEqual([
      { cellIndex: 0, ground: "electroPuddle", air: null },
      { cellIndex: 1, ground: "electroPuddle", air: null },
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

    expect(next.reactions.every(reaction => reaction.ground === null && reaction.air === null)).toBe(true);
    expect(next.enemies[0]?.hp).toBe(30);
  });

  it("projects live reagents from currently placed towers", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-0-outer"),
        createTower("tower-heat-a", "heat", "slot-0-inner"),
      ],
    });

    expect(projectReagents(state.board, state.placedTowers)[0]).toEqual({
      cellIndex: 0,
      substances: ["water"],
      energy: ["heat"],
      directEnergy: ["heat"],
      energyClaims: [
        {
          emitterId: "heat",
          slotId: "slot-0-inner",
          towerId: "tower-heat-a",
        },
      ],
    });
    expect(state.reactions[0]).toEqual({ cellIndex: 0, ground: null, air: "steam" });
  });

  it("keeps water and oil pools connected only along the ring", () => {
    expect(collectConnectedPools(16, new Set([0, 1, 3, 15]))).toEqual([[0, 1, 15], [3]]);
  });

  it("applies source capacity over connected pools by nearest cells", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-0-outer"),
        createTower("tower-water-b", "water", "slot-1-outer"),
        createTower("tower-water-c", "water", "slot-2-outer"),
        createTower("tower-spark-a", "spark", "slot-0-inner"),
        createTower("tower-spark-b", "spark", "slot-2-inner"),
      ],
    });
    const projection = projectReagents(state.board, state.placedTowers);
    const energizedCells = projection.filter(cell => cell.energy.includes("spark")).map(cell => cell.cellIndex);

    expect(energizedCells).toEqual([0, 1, 2]);
    expect(projection[1]?.energyClaims).toEqual([
      {
        emitterId: "spark",
        slotId: "slot-0-inner",
        towerId: "tower-spark-a",
      },
    ]);
  });

  it("resolves the P0 T1/T2/T3 reaction graph", () => {
    const t1 = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-0-outer"),
        createTower("tower-heat-a", "heat", "slot-0-inner"),
        createTower("tower-oil-a", "oil", "slot-8-outer"),
        createTower("tower-heat-b", "heat", "slot-8-inner"),
      ],
    });
    const stormCloud = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-0-outer"),
        createTower("tower-heat-a", "heat", "slot-0-inner"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
      ],
    });
    const fireVortex = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-0-outer"),
        createTower("tower-heat-a", "heat", "slot-0-inner"),
        createTower("tower-oil-a", "oil", "slot-1-outer"),
        createTower("tower-heat-b", "heat", "slot-1-inner"),
      ],
    });
    const fireStorm = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-0-outer"),
        createTower("tower-heat-a", "heat", "slot-0-inner"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
        createTower("tower-water-b", "water", "slot-2-outer"),
        createTower("tower-oil-b", "oil", "slot-2-inner"),
        createTower("tower-heat-b", "heat", "slot-2-outer"),
      ],
    });

    expect(t1.reactions.some(reaction => reaction.air === "steam")).toBe(true);
    expect(t1.reactions.some(reaction => reaction.ground === "fire")).toBe(true);
    expect(stormCloud.reactions.some(reaction => reaction.air === "stormCloud")).toBe(true);
    expect(fireVortex.reactions.some(reaction => reaction.air === "fireVortex")).toBe(true);
    expect(fireStorm.reactions.some(reaction => reaction.air === "fireStorm")).toBe(true);
  });

  it("resolves reactions independently from placed tower iteration order", () => {
    const towers = [
      createTower("tower-water-a", "water", "slot-0-outer"),
      createTower("tower-heat-a", "heat", "slot-0-inner"),
      createTower("tower-spark-a", "spark", "slot-1-outer"),
      createTower("tower-oil-a", "oil", "slot-1-inner"),
    ];
    const state = createRun(1);

    expect(resolveReactions(state.board, towers)).toEqual(resolveReactions(state.board, [...towers].reverse()));
  });

  it("enforces tier damage ordering in config", () => {
    const maxT1 = Math.max(...gameConfig.reactions.filter(reaction => reaction.tier === 1).map(reaction => reaction.dps));
    const minT2 = Math.min(...gameConfig.reactions.filter(reaction => reaction.tier === 2).map(reaction => reaction.dps));
    const maxT2 = Math.max(...gameConfig.reactions.filter(reaction => reaction.tier === 2).map(reaction => reaction.dps));
    const minT3 = Math.min(...gameConfig.reactions.filter(reaction => reaction.tier === 3).map(reaction => reaction.dps));

    expect(maxT1).toBeLessThan(minT2);
    expect(maxT2).toBeLessThan(minT3);
  });

  it("allows one ground and one air reaction to coexist on a cell", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-0-outer"),
        createTower("tower-oil-a", "oil", "slot-15-outer"),
        createTower("tower-heat-a", "heat", "slot-0-inner"),
        createTower("tower-spark-a", "spark", "slot-15-inner"),
      ],
    });

    expect(state.reactions[0]?.ground).not.toBeNull();
    expect(state.reactions[0]?.air).not.toBeNull();
  });

  it("keeps raw water and oil as zero-damage control/setup", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-only", "water", "slot-0-outer"),
        createTower("tower-oil-only", "oil", "slot-1-outer"),
      ],
      enemies: [
        createGrunt(),
      ],
    });
    const next = stepRun(state, 1000 / 30);

    expect(next.stats.totalDamage).toBe(0);
    expect(next.enemies[0]?.hp).toBe(30);
    expect(next.enemies[0]?.pathProgress).toBeLessThan(1 / 30);
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

  it("derives current path cell from continuous path progress", () => {
    const state = createRun(1, {
      placedTowers: [],
      enemies: [
        createGrunt({ pathProgress: 1.9 }),
      ],
    });
    const next = stepRun(state, 100);

    expect(getCurrentPathCellIndex(0, 16)).toBe(0);
    expect(getCurrentPathCellIndex(15.99, 16)).toBe(15);
    expect(next.enemies[0]?.pathProgress).toBeGreaterThan(1.9);
    expect(next.enemies[0]?.currentCellIndex).toBe(2);
  });

  it("damages flying enemies only with air reactions", () => {
    const groundReaction = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-0-outer"),
        createTower("tower-spark-a", "spark", "slot-0-inner"),
      ],
      enemies: [
        createEnemy("enemy-flyer-a", "flyer"),
      ],
    });
    const airReaction = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-0-outer"),
        createTower("tower-heat-a", "heat", "slot-0-inner"),
      ],
      enemies: [
        createEnemy("enemy-flyer-a", "flyer"),
      ],
    });

    expect(stepRun(groundReaction, 100).enemies[0]?.hp).toBe(24);
    expect(stepRun(airReaction, 100).enemies[0]?.hp).toBeLessThan(24);
  });

  it("lets the Вода to Пар to Грозовое облако chain mow down Сварм and Летун", () => {
    const state = stepMany(createRun(1, {
      placedTowers: createStormCloudTowers(),
      enemies: [
        createEnemy("enemy-swarm-a", "swarm"),
        createEnemy("enemy-flyer-a", "flyer"),
      ],
    }), 45);

    expect(state.enemies).toEqual([]);
    expect(state.stats.kills).toBe(2);
    expect(state.stats.damageByReaction.stormCloud).toBeGreaterThan(0);
  });

  it("applies strong resistance without making enemies immune", () => {
    const towers = [
      createTower("tower-water-a", "water", "slot-0-outer"),
      createTower("tower-spark-a", "spark", "slot-0-inner"),
    ];
    const grunt = stepRun(createRun(1, {
      placedTowers: towers,
      enemies: [
        createEnemy("enemy-grunt-a", "grunt", { hp: 100, maxHp: 100 }),
      ],
    }), 100);
    const insulated = stepRun(createRun(1, {
      placedTowers: towers,
      enemies: [
        createEnemy("enemy-insulated-a", "insulated", { hp: 100, maxHp: 100 }),
      ],
    }), 100);

    const gruntDamage = 100 - (grunt.enemies[0]?.hp ?? 100);
    const insulatedDamage = 100 - (insulated.enemies[0]?.hp ?? 100);

    expect(insulatedDamage).toBeGreaterThan(0);
    expect(insulatedDamage).toBeLessThan(gruntDamage);
  });

  it("waits for spawned enemies before clearing a wave", () => {
    const state = startFirstWave(createRun(1));

    expect(state.enemies).toHaveLength(1);
    expect(state.waveRuntime).toMatchObject({
      waveId: "wave-1",
      spawnedCount: 1,
    });

    const cleared = stepMany(state, 520);

    expect(cleared.phase).toBe("draft");
    expect(cleared.waveRuntime).toBeNull();
    expect(cleared.stats.waveStats.find(wave => wave.waveId === "wave-1")).toMatchObject({
      kills: 0,
      leaks: 1,
    });
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
    expect(wave.waveRuntime).toMatchObject({
      waveId: "wave-2",
      spawnedCount: 1,
    });
    expect(wave.enemies).toHaveLength(1);

    const withMoreSpawns = stepMany(wave, 18);

    expect(withMoreSpawns.waveRuntime?.spawnedCount).toBeGreaterThan(1);
  });

  it("drives a minimal headless smoke-run through wave 10", () => {
    const result = runHeadlessRun(createRun(1, {
      placedTowers: createSteamRingTowers(),
    }), {
      maxSteps: 20000,
      autoStartWaves: true,
      autoCompleteDrafts: true,
      stopWhen: state =>
        state.phase === "draft"
        && state.waveIndex === 9
        && state.stats.waveStats.some(wave => wave.waveId === "wave-10" && wave.kills + wave.leaks >= gameConfig.waves[9]!.count),
    });

    expect(result.stoppedByPredicate).toBe(true);
    expect(result.state.coreHp).toBeGreaterThan(0);
    expect(result.state.stats.waveStats.map(wave => wave.waveId)).toContain("wave-10");
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

    expect(withFirstWater.reactions.every(reaction => reaction.ground === null && reaction.air === null)).toBe(true);
    expect(withSpark.reactions.filter(reaction => reaction.ground === "electroPuddle").map(reaction => reaction.cellIndex)).toEqual([0, 1]);
    expect(removedSpark.reactions.every(reaction => reaction.ground === null && reaction.air === null)).toBe(true);
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
    expect(store.waveThreatEnemyId).toBe("grunt");
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

function advanceToDraftAfterWave2(state: ReturnType<typeof createRun>): ReturnType<typeof createRun> {
  const afterWave1 = stepMany(startFirstWave(state), 520);
  const wave2Countdown = applyAction(afterWave1, { type: "completeDraft" });
  const wave2 = stepMany(wave2Countdown, 90);

  return stepMany(wave2, 600);
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

function createSteamRingTowers() {
  return Array.from({ length: gameConfig.balance.pathCellCount }, (_, index) => [
    createTower(`tower-water-ring-${index}`, "water", `slot-${index}-outer`),
    createTower(`tower-heat-ring-${index}`, "heat", `slot-${index}-inner`),
  ]).flat();
}

function createStormCloudTowers() {
  return [
    createTower("tower-water-a", "water", "slot-0-outer"),
    createTower("tower-water-b", "water", "slot-1-outer"),
    createTower("tower-heat-a", "heat", "slot-0-inner"),
    createTower("tower-spark-a", "spark", "slot-1-inner"),
  ];
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
