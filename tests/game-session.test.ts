import type { EmitterId, GameAction, GameConfig, ReactionDefinition, ReactionId, RunState, UpgradeStackState } from "@entities/game-session/model/types";
import { renderPerformanceBudget } from "@app/phaser/scenes/renderPerformance";
import { createStadiumLoopBoard, defaultBoardGeometryConfig } from "@entities/game-session/model/boardGeometry";
import { gameConfig, validateGameConfig } from "@entities/game-session/model/config";
import { getReactionDamageEntries } from "@entities/game-session/model/damage";
import { applyUpgradeToState, createDraftState } from "@entities/game-session/model/draft";
import { createFixedStepDriver } from "@entities/game-session/model/fixedStepDriver";
import { runHeadlessRun, runHeadlessStrategy } from "@entities/game-session/model/headlessRun";
import { clearSavedRun, hasSavedRun, loadSavedRun, saveRun } from "@entities/game-session/model/persistence";
import { collectConnectedPools, getCellSpeedMultiplier, projectReagents, resolveReactions } from "@entities/game-session/model/reactions";
import {
  loadRunReplayLog,
  recordRunReplayAction,
  RUN_REPLAY_LOG_KEY,
} from "@entities/game-session/model/runReplayLog";
import {
  applyAction,
  createEnemy,
  createGrunt,
  createRun,
  createSnapshot,
  createTower,
  deserializeRun,
  getCurrentPathCellIndex,
  getWaveSpawnedCount,
  getWaveTotalSpawnCount,
  nextRandom,
  serializeRun,
  stepRun,
} from "@entities/game-session/model/simulation";
import { useGameSessionStore } from "@entities/game-session/model/store";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

function getReactionDamage(reactionId: ReactionId, upgrades: readonly UpgradeStackState[] = []): number {
  return getReactionDamageEntries({ cellIndex: 0, ground: reactionId, air: null }, 1000, upgrades)[0]?.amount ?? 0;
}

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
    expect(state.board.pathCells).toHaveLength(18);
    expect(state.board.slots).toHaveLength(26);
    expect(state.board.slots.filter(slot => slot.locked).map(slot => slot.id)).toEqual([
      "slot-5-inner",
      "slot-9-inner",
      "slot-14-inner",
    ]);
    expect(state.bench.map(tower => tower.displayName)).toEqual([
      "Водомёт",
      "Водомёт",
      "Разрядник",
    ]);
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
    const draftA = advanceToNextDraft(startFirstWave(createPlacedStartingRun(31)));
    const draftB = advanceToNextDraft(startFirstWave(createPlacedStartingRun(31)));

    expect(applyAction(draftA, { type: "rerollDraft" }).draft).toEqual(applyAction(draftB, { type: "rerollDraft" }).draft);
  });

  it("keeps Жар offered before the first flying wave until the player takes it", () => {
    const draftBeforeFlyers = advanceToDraftAfterWave2(createPlacedStartingRun(22));
    const rerolled = applyAction(draftBeforeFlyers, { type: "rerollDraft" });
    const withHeat = applyAction(draftBeforeFlyers, { type: "chooseDraftTower", emitterId: "heat" });

    expect(draftBeforeFlyers).toMatchObject({
      phase: "draft",
      waveIndex: 1,
    });
    expect(getTowerOfferIds(draftBeforeFlyers)).toContain("heat");
    expect(getTowerOfferIds(rerolled)).toContain("heat");
    expect(withHeat.bench.some(tower => tower.emitterId === "heat")).toBe(true);
  });

  it("does not gate the first flying wave when Жар is refused", () => {
    const draftBeforeFlyers = advanceToDraftAfterWave2(createPlacedStartingRun(22));
    const refusedHeat = getDraftCompletionActionsAvoiding(draftBeforeFlyers, "heat")
      .reduce((state, action) => applyAction(state, action), draftBeforeFlyers);
    const wave = stepMany(refusedHeat, 90);

    expect(wave.phase).toBe("wave");
    expect(wave.waveRuntime?.waveId).toBe("wave-3");
    expect(wave.enemies[0]?.enemyId).toBe("flyer");
  });

  it("steps deterministically for the slice scenario", () => {
    const runA = advanceToNextDraft(startFirstWave(createPlacedStartingRun(11)));
    const runB = advanceToNextDraft(startFirstWave(createPlacedStartingRun(11)));

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
      { cellIndex: 0, ground: null, air: null },
      { cellIndex: 1, ground: "electroPuddle", air: null },
      { cellIndex: 2, ground: "electroPuddle", air: null },
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
      { cellIndex: 16, ground: null, air: null },
      { cellIndex: 17, ground: null, air: null },
    ]);
  });

  it("creates a renderer-facing snapshot without mutating run state", () => {
    const state = startFirstWave(createPlacedStartingRun(1));
    const snapshot = createSnapshot(state);

    expect(snapshot.livingEnemies).toHaveLength(1);
    expect(snapshot.activeReactions).toEqual([
      { cellIndex: 1, ground: "electroPuddle", air: null },
      { cellIndex: 2, ground: "electroPuddle", air: null },
    ]);
    expect("fps" in snapshot).toBe(false);
  });

  it("does not form a damaging reaction from a lone tower", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-only", "water", "slot-1-outer"),
      ],
      enemies: [
        createGrunt(),
      ],
    });
    const next = stepRun(state, 1000 / 30);

    expect(next.reactions.every(reaction => reaction.ground === null && reaction.air === null)).toBe(true);
    expect(next.enemies[0]?.hp).toBe(30);
  });

  it("projects live reagents and extends steam onto the next path cell", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
      ],
    });

    expect(projectReagents(state.board, state.placedTowers)[1]).toEqual({
      cellIndex: 1,
      substances: ["water"],
      energy: ["heat"],
      directEnergy: [],
      energyClaims: [
        {
          emitterId: "heat",
          slotId: "slot-1-outer",
          towerId: "tower-heat-a",
        },
      ],
    });
    expect(state.reactions[1]).toEqual({ cellIndex: 1, ground: null, air: "steam" });
    expect(state.reactions[2]).toEqual({ cellIndex: 2, ground: null, air: "steam" });
  });

  it("projects energy tower capacity as direct cells for damage, reactions, and rendering", () => {
    const base = projectReagents(gameConfig.board, [
      createTower("tower-spark-a", "spark", "slot-1-outer"),
    ]);
    const upgraded = projectReagents(
      gameConfig.board,
      [createTower("tower-spark-a", "spark", "slot-1-outer")],
      [{ upgradeId: "sparkCapacity", stacks: 1 }],
    );

    expect(base.filter(cell => cell.directEnergy.includes("spark")).map(cell => cell.cellIndex)).toEqual([1]);
    expect(upgraded.filter(cell => cell.directEnergy.includes("spark")).map(cell => cell.cellIndex)).toEqual([1, 2]);
  });

  it("projects substance coverage as count-based cells for reactions and rendering", () => {
    const baseWater = projectReagents(gameConfig.board, [
      createTower("tower-water-a", "water", "slot-1-outer"),
    ]);
    const upgradedWater = projectReagents(
      gameConfig.board,
      [createTower("tower-water-a", "water", "slot-1-outer")],
      [{ upgradeId: "waterCapacity", stacks: 1 }],
    );
    const upgradedOil = projectReagents(
      gameConfig.board,
      [createTower("tower-oil-a", "oil", "slot-1-outer")],
      [{ upgradeId: "oilControl", stacks: 1 }],
    );

    expect(baseWater.filter(cell => cell.substances.includes("water")).map(cell => cell.cellIndex)).toEqual([1]);
    expect(upgradedWater.filter(cell => cell.substances.includes("water")).map(cell => cell.cellIndex)).toEqual([1, 2]);
    expect(upgradedOil.filter(cell => cell.substances.includes("oil")).map(cell => cell.cellIndex)).toEqual([1, 2]);
  });

  it("lets one base energy cell feed two tier 1 reaction cells in a connected substance pool", () => {
    const electroPuddles = resolveReactions(
      gameConfig.board,
      [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
      ],
      [{ upgradeId: "waterCapacity", stacks: 1 }],
    );
    const fires = resolveReactions(
      gameConfig.board,
      [
        createTower("tower-oil-a", "oil", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
      ],
      [{ upgradeId: "oilControl", stacks: 1 }],
    );

    expect(electroPuddles.filter(reaction => reaction.ground === "electroPuddle").map(reaction => reaction.cellIndex)).toEqual([1, 2]);
    expect(fires.filter(reaction => reaction.ground === "fire").map(reaction => reaction.cellIndex)).toEqual([1, 2]);
  });

  it("connects the two-cell inner corner water with a side spark on the shared vertical cell", () => {
    const projection = projectReagents(gameConfig.board, [
      createTower("tower-water-a", "water", "slot-5-inner"),
      createTower("tower-spark-a", "spark", "slot-4-outer"),
    ]);
    const reactions = resolveReactions(gameConfig.board, [
      createTower("tower-water-a", "water", "slot-5-inner"),
      createTower("tower-spark-a", "spark", "slot-4-outer"),
    ]);

    expect(projection[4]).toMatchObject({
      cellIndex: 4,
      substances: ["water"],
      directEnergy: [],
      energy: ["spark"],
    });
    expect(projection[6]).toMatchObject({
      cellIndex: 6,
      substances: ["water"],
      directEnergy: [],
      energy: [],
    });
    expect(reactions[4]).toEqual({ cellIndex: 4, ground: "electroPuddle", air: null });
  });

  it("lets both anchors of a two-cell corner heat tower form steam in one water pool", () => {
    const reactions = resolveReactions(gameConfig.board, [
      createTower("tower-water-left", "water", "slot-8-outer"),
      createTower("tower-water-corner", "water", "slot-9-outer"),
      createTower("tower-water-right", "water", "slot-10-outer"),
      createTower("tower-heat-corner", "heat", "slot-9-inner"),
    ]);

    expect(reactions.filter(reaction => reaction.air === "steam").map(reaction => reaction.cellIndex)).toEqual([8, 9, 10, 11]);
  });

  it("scales tier 1 reaction limits by the number of upgraded energy cells", () => {
    const reactions = resolveReactions(
      gameConfig.board,
      [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-water-b", "water", "slot-3-outer"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
      ],
      [
        { upgradeId: "waterCapacity", stacks: 1 },
        { upgradeId: "sparkCapacity", stacks: 1 },
      ],
    );

    expect(reactions.filter(reaction => reaction.ground === "electroPuddle").map(reaction => reaction.cellIndex)).toEqual([1, 2, 3, 4]);
  });

  it("requires spark to meet steam on the same anchor cell before forming storm clouds", () => {
    const oneSparkCell = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-3-outer"),
      ],
    });
    const anchoredSpark = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
      ],
    });

    expect(oneSparkCell.reactions.filter(reaction => reaction.air === "steam").map(reaction => reaction.cellIndex)).toEqual([1, 2]);
    expect(oneSparkCell.reactions.some(reaction => reaction.air === "stormCloud")).toBe(false);
    expect(oneSparkCell.reactions[3]).toEqual({ cellIndex: 3, ground: null, air: null });
    expect(anchoredSpark.reactions.filter(reaction => reaction.air === "stormCloud").map(reaction => reaction.cellIndex)).toEqual([1, 2]);
  });

  it("keeps a two-cell base steam plume when off-anchor spark cannot trigger storm clouds", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-3-outer"),
      ],
    });

    expect(state.reactions.filter(reaction => reaction.air === "steam" || reaction.air === "stormCloud").map(reaction => reaction.cellIndex)).toEqual([1, 2]);
    expect(state.reactions.some(reaction => reaction.air === "stormCloud")).toBe(false);
    expect(state.reactions[3]).toEqual({ cellIndex: 3, ground: null, air: null });
  });

  it("lets base spark cover three existing steam cells as storm clouds from an anchor", () => {
    const reactions = resolveReactions(
      gameConfig.board,
      [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
      ],
      [{ upgradeId: "heatReach", stacks: 1 }],
    );

    expect(reactions.filter(reaction => reaction.air === "stormCloud").map(reaction => reaction.cellIndex)).toEqual([1, 2, 3]);
  });

  it("lets base fire cover three existing steam cells as a fire vortex from an anchor", () => {
    const reactions = resolveReactions(
      gameConfig.board,
      [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
        createTower("tower-oil-a", "oil", "slot-2-outer"),
        createTower("tower-heat-b", "heat", "slot-2-outer"),
      ],
      [{ upgradeId: "heatReach", stacks: 1 }],
    );

    expect(reactions[2]?.ground).toBeNull();
    expect(reactions.filter(reaction => reaction.air === "fireVortex").map(reaction => reaction.cellIndex)).toEqual([1, 2, 3]);
  });

  it("lets fire in the middle of three steam cells consume the backward cell after forward cells run out", () => {
    const reactions = resolveReactions(
      gameConfig.board,
      [
        createTower("tower-water-a", "water", "slot-2-outer"),
        createTower("tower-heat-a", "heat", "slot-2-outer"),
        createTower("tower-oil-a", "oil", "slot-3-outer"),
        createTower("tower-heat-b", "heat", "slot-3-outer"),
      ],
      [{ upgradeId: "heatReach", stacks: 1 }],
    );

    expect(reactions.filter(reaction => reaction.air === "fireVortex").map(reaction => reaction.cellIndex)).toEqual([2, 3, 4]);
    expect(reactions.some(reaction => reaction.air === "steam")).toBe(false);
  });

  it("lets upgrades extend steam and base spark storm clouds past the two-cell steam cap", () => {
    const steamTowers = [
      createTower("tower-water-a", "water", "slot-1-outer"),
      createTower("tower-water-b", "water", "slot-2-outer"),
      createTower("tower-heat-a", "heat", "slot-1-outer"),
    ];
    const upgradedSteam = resolveReactions(gameConfig.board, steamTowers, [{ upgradeId: "heatReach", stacks: 1 }]);
    const upgradedStorm = resolveReactions(
      gameConfig.board,
      [
        ...steamTowers,
        createTower("tower-spark-a", "spark", "slot-1-outer"),
      ],
      [{ upgradeId: "heatReach", stacks: 1 }],
    );

    expect(upgradedSteam.filter(reaction => reaction.air === "steam").map(reaction => reaction.cellIndex)).toEqual([1, 2, 3]);
    expect(upgradedStorm.filter(reaction => reaction.air === "stormCloud").map(reaction => reaction.cellIndex)).toEqual([1, 2, 3]);
  });

  it("keeps storm clouds on the accepted steam cells when a corner spark is added", () => {
    const steamTowers = [
      createTower("tower-water-a", "water", "slot-5-outer"),
      createTower("tower-heat-a", "heat", "slot-5-inner"),
    ];
    const upgrades = [
      { upgradeId: "waterCapacity" as const, stacks: 1 },
      { upgradeId: "heatReach" as const, stacks: 1 },
    ];
    const steam = resolveReactions(gameConfig.board, steamTowers, upgrades);
    const storm = resolveReactions(gameConfig.board, [
      ...steamTowers,
      createTower("tower-spark-a", "spark", "slot-5-inner"),
    ], upgrades);

    expect(steam.filter(reaction => reaction.air === "steam").map(reaction => reaction.cellIndex)).toEqual([5, 6, 7]);
    expect(storm.filter(reaction => reaction.air === "stormCloud").map(reaction => reaction.cellIndex)).toEqual([5, 6, 7]);
    expect(storm[8]).toEqual({ cellIndex: 8, ground: null, air: null });
  });

  it("does not let one energy tower directly feed both tier 1 and tier 2 reactions", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
      ],
    });

    expect(state.reactions[1]).toEqual({ cellIndex: 1, ground: null, air: "stormCloud" });
    expect(state.reactions.some(reaction => reaction.ground === "electroPuddle")).toBe(false);
  });

  it("keeps a storm cloud when new water appears under its spark source", () => {
    const reactions = resolveReactions(gameConfig.board, [
      createTower("tower-water-steam", "water", "slot-1-outer"),
      createTower("tower-heat-steam", "heat", "slot-1-outer"),
      createTower("tower-water-extra", "water", "slot-2-outer"),
      createTower("tower-spark-cloud", "spark", "slot-2-outer"),
    ]);

    expect(reactions[1]).toEqual({ cellIndex: 1, ground: null, air: "stormCloud" });
    expect(reactions[2]).toEqual({ cellIndex: 2, ground: null, air: "stormCloud" });
    expect(reactions.some(reaction => reaction.ground === "electroPuddle")).toBe(false);
  });

  it("keeps a storm cloud when late water appears under another upgraded heat cell", () => {
    const baseTowers = [
      createTower("tower-water-steam", "water", "slot-1-outer"),
      createTower("tower-heat-steam", "heat", "slot-1-outer"),
      createTower("tower-spark-cloud", "spark", "slot-1-outer"),
    ];
    const upgrades = [
      { upgradeId: "heatReach" as const, stacks: 1 },
      { upgradeId: "waterCapacity" as const, stacks: 2 },
    ];
    const before = resolveReactions(gameConfig.board, baseTowers, upgrades);
    const after = resolveReactions(gameConfig.board, [
      ...baseTowers,
      createTower("tower-water-extra", "water", "slot-2-inner"),
    ], upgrades);

    expect(before.filter(reaction => reaction.air === "stormCloud").map(reaction => reaction.cellIndex)).toEqual([1, 2, 3]);
    expect(after.filter(reaction => reaction.air === "stormCloud").map(reaction => reaction.cellIndex)).toEqual([1, 2, 3]);
  });

  it("keeps a fire vortex when new water appears under its fire source", () => {
    const reactions = resolveReactions(gameConfig.board, [
      createTower("tower-water-steam", "water", "slot-1-outer"),
      createTower("tower-heat-steam", "heat", "slot-1-outer"),
      createTower("tower-oil-fire", "oil", "slot-2-outer"),
      createTower("tower-heat-fire", "heat", "slot-2-outer"),
      createTower("tower-water-extra", "water", "slot-2-inner"),
    ]);

    expect(reactions[1]).toEqual({ cellIndex: 1, ground: null, air: "fireVortex" });
    expect(reactions[2]).toEqual({ cellIndex: 2, ground: null, air: "fireVortex" });
    expect(reactions[3]).toEqual({ cellIndex: 3, ground: null, air: null });
  });

  it("keeps the upgraded steam contact cell inside the fire vortex", () => {
    const reactions = resolveReactions(
      gameConfig.board,
      [
        createTower("tower-water-steam", "water", "slot-8-outer"),
        createTower("tower-heat-steam", "heat", "slot-8-outer"),
        createTower("tower-oil-fire", "oil", "slot-9-outer"),
        createTower("tower-heat-fire", "heat", "slot-9-outer"),
      ],
      [
        { upgradeId: "waterCapacity", stacks: 1 },
        { upgradeId: "heatReach", stacks: 1 },
      ],
    );

    expect(reactions[8]).toEqual({ cellIndex: 8, ground: null, air: "fireVortex" });
    expect(reactions[9]).toEqual({ cellIndex: 9, ground: null, air: "fireVortex" });
    expect(reactions[10]).toEqual({ cellIndex: 10, ground: null, air: "fireVortex" });
  });

  it("lets earlier same-tier fire vortex consume steam before a later storm cloud", () => {
    const reactions = resolveReactions(
      gameConfig.board,
      [
        createTower("tower-water-a", "water", "slot-4-outer"),
        createTower("tower-heat-steam", "heat", "slot-4-outer"),
        createTower("tower-oil-fire", "oil", "slot-4-outer"),
        createTower("tower-heat-fire", "heat", "slot-4-outer"),
        createTower("tower-spark-a", "spark", "slot-4-outer"),
      ],
      [{ upgradeId: "heatReach", stacks: 1 }],
    );

    expect(reactions[4]).toEqual({ cellIndex: 4, ground: null, air: "fireVortex" });
    expect(reactions[5]).toEqual({ cellIndex: 5, ground: null, air: "fireVortex" });
    expect(reactions[6]).toEqual({ cellIndex: 6, ground: null, air: "fireVortex" });
    expect(reactions.some(reaction => reaction.air === "stormCloud")).toBe(false);
  });

  it("does not let one heat tower directly feed both steam and fire", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-oil-a", "oil", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
      ],
    });

    expect(state.reactions[1]).toEqual({ cellIndex: 1, ground: "fire", air: null });
  });

  it("keeps water and oil pools connected only along the ring", () => {
    expect(collectConnectedPools(16, new Set([0, 1, 3, 15]))).toEqual([[0, 1, 15], [3]]);
  });

  it("applies source capacity over connected pools by nearest cells", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-water-b", "water", "slot-2-outer"),
        createTower("tower-water-c", "water", "slot-2-outer"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
        createTower("tower-spark-b", "spark", "slot-5-inner"),
      ],
    });
    const projection = projectReagents(state.board, state.placedTowers);
    const energizedCells = projection.filter(cell => cell.energy.includes("spark")).map(cell => cell.cellIndex);

    expect(energizedCells).toEqual([1, 2]);
    expect(projection[1]?.energyClaims).toEqual([
      {
        emitterId: "spark",
        slotId: "slot-1-outer",
        towerId: "tower-spark-a",
      },
    ]);
  });

  it("resolves the P0 T1/T2 graph without requiring T3 setup", () => {
    const t1 = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
        createTower("tower-oil-a", "oil", "slot-7-outer"),
        createTower("tower-heat-b", "heat", "slot-7-inner"),
      ],
    });
    const stormCloud = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
      ],
    });
    const fireVortex = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
        createTower("tower-oil-a", "oil", "slot-2-outer"),
        createTower("tower-heat-b", "heat", "slot-2-outer"),
      ],
    });
    const fireStorm = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
        createTower("tower-water-b", "water", "slot-3-outer"),
        createTower("tower-heat-b", "heat", "slot-3-inner"),
        createTower("tower-water-c", "water", "slot-5-outer"),
        createTower("tower-heat-c", "heat", "slot-5-outer"),
        createTower("tower-spark-a", "spark", "slot-2-outer"),
        createTower("tower-oil-a", "oil", "slot-7-outer"),
        createTower("tower-heat-d", "heat", "slot-7-outer"),
      ],
    });

    expect(t1.reactions.some(reaction => reaction.air === "steam")).toBe(true);
    expect(t1.reactions.some(reaction => reaction.ground === "fire")).toBe(true);
    expect(stormCloud.reactions.some(reaction => reaction.air === "stormCloud")).toBe(true);
    expect(fireVortex.reactions.some(reaction => reaction.air === "fireVortex")).toBe(true);
    expect(fireStorm.reactions.some(reaction => reaction.air === "fireStorm")).toBe(false);
  });

  it("turns adjacent storm cloud and fire vortex pools into fire storm", () => {
    const base = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
        createTower("tower-water-b", "water", "slot-3-outer"),
        createTower("tower-heat-b", "heat", "slot-3-outer"),
        createTower("tower-water-c", "water", "slot-4-outer"),
        createTower("tower-heat-c", "heat", "slot-4-outer"),
        createTower("tower-oil-a", "oil", "slot-1-outer"),
        createTower("tower-heat-d", "heat", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-4-outer"),
      ],
    });
    const upgrades = [
      { upgradeId: "waterCapacity" as const, stacks: 2 },
      { upgradeId: "heatReach" as const, stacks: 2 },
    ];
    const fireStormState = {
      ...base,
      upgrades,
      reactions: resolveReactions(base.board, base.placedTowers, upgrades),
    };

    expect(fireStormState.reactions.filter(reaction => reaction.air === "fireStorm").map(reaction => reaction.cellIndex)).toEqual([1, 2, 3, 4]);
    expect(fireStormState.reactions.some(reaction => reaction.air === "fireVortex")).toBe(false);
    expect(fireStormState.reactions.some(reaction => reaction.air === "stormCloud")).toBe(false);
  });

  it("clamps legacy cell upgrade stacks before reserving storm cloud pools", () => {
    const reactions = resolveReactions(
      gameConfig.board,
      [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-water-b", "water", "slot-2-outer"),
        createTower("tower-water-c", "water", "slot-3-outer"),
        createTower("tower-water-d", "water", "slot-4-outer"),
        createTower("tower-water-e", "water", "slot-5-outer"),
        createTower("tower-heat-steam", "heat", "slot-2-outer"),
        createTower("tower-oil-fire", "oil", "slot-1-outer"),
        createTower("tower-heat-fire", "heat", "slot-1-outer"),
        createTower("tower-spark-corner", "spark", "slot-5-outer"),
      ],
      [
        { upgradeId: "heatReach", stacks: 2 },
        { upgradeId: "waterCapacity", stacks: 2 },
      ],
    );

    expect(reactions.filter(reaction => reaction.air === "fireStorm").map(reaction => reaction.cellIndex)).toEqual([]);
    expect(reactions.filter(reaction => reaction.air === "stormCloud").map(reaction => reaction.cellIndex)).toEqual([3, 4, 5]);
    expect(reactions.some(reaction => reaction.air === "steam")).toBe(true);
    expect(reactions.some(reaction => reaction.air === "fireVortex")).toBe(false);
  });

  it("expands an existing fire storm when a new storm cloud touches it", () => {
    const reactions = resolveReactions(
      gameConfig.board,
      [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
        createTower("tower-water-b", "water", "slot-3-outer"),
        createTower("tower-heat-b", "heat", "slot-3-outer"),
        createTower("tower-water-c", "water", "slot-4-outer"),
        createTower("tower-heat-c", "heat", "slot-4-outer"),
        createTower("tower-oil-a", "oil", "slot-1-outer"),
        createTower("tower-heat-d", "heat", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-4-outer"),
        createTower("tower-water-d", "water", "slot-5-outer"),
        createTower("tower-heat-e", "heat", "slot-5-inner"),
        createTower("tower-spark-b", "spark", "slot-5-inner"),
        createTower("tower-spark-c", "spark", "slot-7-inner"),
      ],
      [
        { upgradeId: "waterCapacity", stacks: 2 },
        { upgradeId: "heatReach", stacks: 2 },
      ],
    );

    expect(reactions.filter(reaction => reaction.air === "fireStorm").map(reaction => reaction.cellIndex)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(reactions.some(reaction => reaction.air === "stormCloud")).toBe(false);
  });

  it("resolves reactions independently from placed tower iteration order", () => {
    const towers = [
      createTower("tower-water-a", "water", "slot-1-outer"),
      createTower("tower-heat-a", "heat", "slot-1-outer"),
      createTower("tower-spark-a", "spark", "slot-1-outer"),
      createTower("tower-oil-a", "oil", "slot-2-inner"),
    ];
    const state = createRun(1);

    expect(resolveReactions(state.board, towers)).toEqual(resolveReactions(state.board, [...towers].reverse()));
  });

  it("uses config-defined reaction inputs without resolver branches", () => {
    const reactions = gameConfig.reactions as unknown as ReactionDefinition[];
    const originalReactions = [...reactions];

    reactions.push({
      id: "testPuddle" as ReactionDefinition["id"],
      displayName: "Test Puddle",
      tier: 1,
      layer: "ground",
      damageFamily: "electric",
      dps: 16,
      inputs: ["water", "spark"],
    });

    try {
      const resolved = resolveReactions(gameConfig.board, [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
      ]);

      expect(resolved[1]?.ground).toBe("testPuddle");
    } finally {
      reactions.splice(0, reactions.length, ...originalReactions);
    }
  });

  it("enforces tier damage ordering in config", () => {
    const maxT1 = Math.max(...gameConfig.reactions.filter(reaction => reaction.tier === 1).map(reaction => reaction.dps));
    const minT2 = Math.min(...gameConfig.reactions.filter(reaction => reaction.tier === 2).map(reaction => reaction.dps));
    const maxT2 = Math.max(...gameConfig.reactions.filter(reaction => reaction.tier === 2).map(reaction => reaction.dps));
    const minT3 = Math.min(...gameConfig.reactions.filter(reaction => reaction.tier === 3).map(reaction => reaction.dps));

    expect(maxT1).toBeLessThan(minT2);
    expect(maxT2).toBeLessThan(minT3);
  });

  it("boosts tier 1 and tier 2 reactions that include the catalyst element", () => {
    const fireCatalyst = [{ upgradeId: "fireCatalyst", stacks: 1 }] as const;
    const sparkCatalyst = [{ upgradeId: "sparkCatalyst", stacks: 1 }] as const;

    expect(getReactionDamage("steam", fireCatalyst)).toBeCloseTo(10.625);
    expect(getReactionDamage("fire", fireCatalyst)).toBeCloseTo(25);
    expect(getReactionDamage("stormCloud", fireCatalyst)).toBeCloseTo(40);
    expect(getReactionDamage("fireVortex", fireCatalyst)).toBeCloseTo(47.5);
    expect(getReactionDamage("electroPuddle", fireCatalyst)).toBeCloseTo(15);

    expect(getReactionDamage("electroPuddle", sparkCatalyst)).toBeCloseTo(18.75);
    expect(getReactionDamage("stormCloud", sparkCatalyst)).toBeCloseTo(40);
    expect(getReactionDamage("steam", sparkCatalyst)).toBeCloseTo(8.5);
    expect(getReactionDamage("fireVortex", sparkCatalyst)).toBeCloseTo(38);
  });

  it("does not boost tier 3 reactions with element catalyst upgrades", () => {
    const catalysts = [
      { upgradeId: "fireCatalyst", stacks: 1 },
      { upgradeId: "sparkCatalyst", stacks: 1 },
    ] as const;

    expect(getReactionDamage("fireStorm", catalysts)).toBeCloseTo(48);
  });

  it("consumes the ground fire catalyst when fire vortex forms on the same cell", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-oil-a", "oil", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
        createTower("tower-heat-b", "heat", "slot-1-outer"),
      ],
    });

    expect(state.reactions[1]?.ground).toBeNull();
    expect(state.reactions[1]?.air).toBe("fireVortex");
  });

  it("keeps raw water and oil as zero-damage control/setup", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-only", "water", "slot-1-outer"),
        createTower("tower-oil-only", "oil", "slot-2-outer"),
      ],
      enemies: [
        createGrunt(),
      ],
    });
    const next = stepRun(state, 1000 / 30);

    expect(next.stats.totalDamage).toBe(0);
    expect(next.enemies[0]?.hp).toBe(30);
    expect(next.enemies[0]?.pathProgress).toBeCloseTo(0.75 / 30);
  });

  it("stacks water and oil slow without creating a reaction", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-oil-a", "oil", "slot-1-outer"),
      ],
    });
    const projection = projectReagents(state.board, state.placedTowers);

    expect(state.reactions[1]).toEqual({ cellIndex: 1, ground: null, air: null });
    expect(projection[1]?.substances).toEqual(["oil", "water"]);
    expect(getCellSpeedMultiplier(projection[1])).toBeCloseTo(0.55);
    expect(getCellSpeedMultiplier(projection[1], [{ upgradeId: "oilControl", stacks: 1 }])).toBeCloseTo(0.55);
  });

  it("does not apply consumed water slow under steam", () => {
    const steam = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
      ],
    });
    const oilySteamProjection = {
      ...projectReagents(steam.board, steam.placedTowers)[1]!,
      substances: ["oil", "water"] as const,
    };

    expect(getCellSpeedMultiplier(projectReagents(steam.board, steam.placedTowers)[1], [], gameConfig, steam.reactions[1])).toBe(1);
    expect(getCellSpeedMultiplier(oilySteamProjection, [], gameConfig, steam.reactions[1])).toBeCloseTo(0.7);
  });

  it("lets oil and direct spark coexist as slow plus raw damage without a reaction", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-oil-a", "oil", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
      ],
      enemies: [
        createGrunt({ pathProgress: 1 }),
      ],
    });
    const next = stepRun(state, 1000);

    expect(state.reactions[1]).toEqual({ cellIndex: 1, ground: null, air: null });
    expect(next.enemies[0]?.hp).toBe(25);
    expect(next.enemies[0]?.pathProgress).toBeCloseTo(1.525);
    expect(next.stats.damageBySource.rawSpark).toBe(5);
    expect(next.stats.damageByReaction.electroPuddle).toBeUndefined();
  });

  it("keeps substance slow for two seconds after the enemy leaves the cell", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-oil-a", "oil", "slot-1-outer"),
      ],
      enemies: [
        createGrunt({ pathProgress: 1.4 }),
      ],
    });
    const afterLeavingCell = stepRun(state, 1000);
    const afterOneLingeringSecond = stepRun(afterLeavingCell, 1000);
    const afterTwoLingeringSeconds = stepRun(afterOneLingeringSecond, 1000);
    const afterExpiredSlow = stepRun(afterTwoLingeringSeconds, 1000);

    expect(afterLeavingCell.enemies[0]?.currentCellIndex).toBe(2);
    expect(afterLeavingCell.enemies[0]?.pathProgress).toBeCloseTo(1.925);
    expect(afterLeavingCell.enemies[0]?.slowEffect).toEqual({ speedMultiplier: 0.7, remainingMs: 2000 });
    expect(afterOneLingeringSecond.enemies[0]?.pathProgress).toBeCloseTo(2.45);
    expect(afterOneLingeringSecond.enemies[0]?.slowEffect).toEqual({ speedMultiplier: 0.7, remainingMs: 1000 });
    expect(afterTwoLingeringSeconds.enemies[0]?.pathProgress).toBeCloseTo(2.975);
    expect(afterTwoLingeringSeconds.enemies[0]?.slowEffect).toBeNull();
    expect(afterExpiredSlow.enemies[0]?.pathProgress).toBeCloseTo(3.725);
  });

  it("applies raw energy damage over the upgraded emitter capacity footprint", () => {
    const state = {
      ...createRun(1, {
        placedTowers: [
          createTower("tower-spark-a", "spark", "slot-1-outer"),
        ],
        enemies: [
          createGrunt({ hp: 100, maxHp: 100, pathProgress: 2 }),
        ],
      }),
      upgrades: [
        { upgradeId: "sparkCapacity" as const, stacks: 1 },
      ],
    };
    const next = stepRun(state, 100);

    expect(next.enemies[0]?.hp).toBe(99.5);
    expect(next.stats.damageBySource.rawSpark).toBe(0.5);
  });

  it("does not continue raw energy from an upgraded source after that source feeds a reaction", () => {
    const state = {
      ...createRun(1, {
        placedTowers: [
          createTower("tower-water-a", "water", "slot-1-outer"),
          createTower("tower-spark-a", "spark", "slot-1-outer"),
        ],
        enemies: [
          createGrunt({ hp: 100, maxHp: 100, pathProgress: 2 }),
        ],
      }),
      upgrades: [
        { upgradeId: "sparkCapacity" as const, stacks: 1 },
      ],
    };
    const projection = projectReagents(state.board, state.placedTowers, state.upgrades);
    const next = stepRun(state, 100);

    expect(state.reactions[1]?.ground).toBe("electroPuddle");
    expect(projection.filter(cell => cell.directEnergy.includes("spark")).map(cell => cell.cellIndex)).toEqual([]);
    expect(next.enemies[0]?.hp).toBe(100);
    expect(next.stats.damageBySource.rawSpark).toBeUndefined();
  });

  it("keeps raw energy from an unconsumed second anchor of a multi-cell slot", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-4-outer"),
        createTower("tower-spark-a", "spark", "slot-5-inner"),
      ],
      enemies: [
        createGrunt({ hp: 100, maxHp: 100, pathProgress: 6 }),
      ],
    });
    const projection = projectReagents(state.board, state.placedTowers);
    const next = stepRun(state, 100);

    expect(state.reactions[4]?.ground).toBe("electroPuddle");
    expect(projection.filter(cell => cell.directEnergy.includes("spark")).map(cell => cell.cellIndex)).toEqual([6]);
    expect(next.enemies[0]?.hp).toBe(99.5);
    expect(next.stats.damageBySource.rawSpark).toBe(0.5);
  });

  it("suppresses raw spark damage when the same cell has a ground reaction", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
      ],
      enemies: [
        createGrunt({ hp: 100, maxHp: 100, pathProgress: 1 }),
      ],
    });
    const next = stepRun(state, 1000);

    expect(state.reactions[1]?.ground).toBe("electroPuddle");
    expect(next.enemies[0]?.hp).toBe(85);
    expect(next.stats.damageBySource.electroPuddle).toBe(15);
    expect(next.stats.damageBySource.rawSpark).toBeUndefined();
  });

  it("starts ground reaction damage when the enemy visually enters the next cell", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
      ],
      enemies: [
        createGrunt({ hp: 100, maxHp: 100, pathProgress: 0.7 }),
      ],
    });
    const next = stepRun(state, 100);

    expect(state.reactions[1]?.ground).toBe("electroPuddle");
    expect(next.enemies[0]?.hp).toBeCloseTo(98.5);
    expect(next.enemies[0]?.currentCellIndex).toBe(1);
    expect(next.stats.damageBySource.electroPuddle).toBeCloseTo(1.5);
  });

  it("suppresses raw energy consumed through nested air reaction inputs", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-2-outer"),
        createTower("tower-heat-b", "heat", "slot-2-outer"),
      ],
      enemies: [
        createGrunt({ hp: 100, maxHp: 100, pathProgress: 2 }),
      ],
    });
    const next = stepRun(state, 100);

    expect(state.reactions[2]).toEqual({ cellIndex: 2, ground: null, air: "stormCloud" });
    expect(next.enemies[0]?.hp).toBeCloseTo(96.8);
    expect(next.stats.damageBySource.stormCloud).toBeCloseTo(3.2);
    expect(next.stats.damageBySource.rawSpark).toBeUndefined();
    expect(next.stats.damageBySource.rawHeat).toBeUndefined();
  });

  it("does not apply consumed heat raw damage under steam", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
      ],
      enemies: [
        createGrunt({ hp: 100, maxHp: 100, pathProgress: 1 }),
      ],
    });
    const next = stepRun(state, 100);

    expect(state.reactions[1]).toEqual({ cellIndex: 1, ground: null, air: "steam" });
    expect(next.enemies[0]?.hp).toBeCloseTo(99.15);
    expect(next.stats.damageBySource.steam).toBeCloseTo(0.85);
    expect(next.stats.damageBySource.rawHeat).toBeUndefined();
  });

  it("damages and kills a Грунт that crosses the Электролужа", () => {
    const state = advanceToNextDraft(startFirstWave(createPlacedStartingRun(1)));

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
    const next = stepMany(state, 750);

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
    const next = stepRun(state, 200);

    expect(getCurrentPathCellIndex(0, 16)).toBe(0);
    expect(getCurrentPathCellIndex(15.99, 16)).toBe(15);
    expect(next.enemies[0]?.pathProgress).toBeGreaterThan(1.9);
    expect(next.enemies[0]?.currentCellIndex).toBe(2);
  });

  it("damages flying enemies only with air reactions", () => {
    const groundReaction = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
      ],
      enemies: [
        createEnemy("enemy-flyer-a", "flyer", { pathProgress: 1 }),
      ],
    });
    const airReaction = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
      ],
      enemies: [
        createEnemy("enemy-flyer-a", "flyer", { pathProgress: 1 }),
      ],
    });

    expect(stepRun(groundReaction, 100).enemies[0]?.hp).toBe(20);
    expect(stepRun(airReaction, 100).enemies[0]?.hp).toBeLessThan(20);
  });

  it("kills a flying enemy before it leaves a two-cell base steam plume", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
      ],
      enemies: [
        createEnemy("enemy-flyer-a", "flyer", { pathProgress: 0.64 }),
      ],
    });
    const next = stepMany(state, 90);

    expect(state.reactions.filter(reaction => reaction.air === "steam").map(reaction => reaction.cellIndex)).toEqual([1, 2]);
    expect(next.enemies).toEqual([]);
    expect(next.stats.kills).toBe(1);
    expect(next.stats.leaks).toBe(0);
  });

  it("does not slow flying enemies with ground substances or reactions", () => {
    const groundSubstances = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-oil-a", "oil", "slot-1-outer"),
      ],
      enemies: [
        createEnemy("enemy-flyer-a", "flyer", { pathProgress: 1 }),
      ],
    });
    const groundReaction = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
      ],
      enemies: [
        createEnemy("enemy-flyer-a", "flyer", { pathProgress: 1 }),
      ],
    });

    expect(stepRun(groundSubstances, 1000).enemies[0]?.pathProgress).toBeCloseTo(1.84);
    expect(stepRun(groundReaction, 1000).enemies[0]?.pathProgress).toBeCloseTo(1.84);
  });

  it("does not damage flying enemies with raw ground energy", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-spark-a", "spark", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-1-outer"),
      ],
      enemies: [
        createEnemy("enemy-flyer-a", "flyer", { pathProgress: 1 }),
      ],
    });
    const next = stepRun(state, 1000);

    expect(next.enemies[0]?.hp).toBe(20);
    expect(next.stats.totalDamage).toBe(0);
  });

  it("applies enemy resistances to raw spark and heat damage", () => {
    const sparkTower = [createTower("tower-spark-a", "spark", "slot-1-outer")];
    const heatTower = [createTower("tower-heat-a", "heat", "slot-1-outer")];
    const gruntSpark = stepRun(createRun(1, {
      placedTowers: sparkTower,
      enemies: [createEnemy("enemy-grunt-a", "grunt", { hp: 100, maxHp: 100, pathProgress: 1 })],
    }), 100);
    const insulatedSpark = stepRun(createRun(1, {
      placedTowers: sparkTower,
      enemies: [createEnemy("enemy-insulated-a", "insulated", { hp: 100, maxHp: 100, pathProgress: 1 })],
    }), 100);
    const gruntHeat = stepRun(createRun(1, {
      placedTowers: heatTower,
      enemies: [createEnemy("enemy-grunt-b", "grunt", { hp: 100, maxHp: 100, pathProgress: 1 })],
    }), 100);
    const flameproofHeat = stepRun(createRun(1, {
      placedTowers: heatTower,
      enemies: [createEnemy("enemy-flameproof-a", "flameproof", { hp: 100, maxHp: 100, pathProgress: 1 })],
    }), 100);

    expect(gruntSpark.enemies[0]?.hp).toBe(99.5);
    expect(insulatedSpark.enemies[0]?.hp).toBeCloseTo(99.825);
    expect(gruntHeat.enemies[0]?.hp).toBe(99.3);
    expect(flameproofHeat.enemies[0]?.hp).toBeCloseTo(99.755);
  });

  it("lets the Вода to Пар to Грозовое облако chain mow down Сварм and Летун", () => {
    const state = stepMany(createRun(1, {
      placedTowers: createStormCloudTowers(),
      enemies: [
        createEnemy("enemy-swarm-a", "swarm"),
        createEnemy("enemy-flyer-a", "flyer"),
      ],
    }), 60);

    expect(state.enemies).toEqual([]);
    expect(state.stats.kills).toBe(2);
    expect(state.stats.damageByReaction.stormCloud).toBeGreaterThan(0);
  });

  it("applies strong resistance without making enemies immune", () => {
    const towers = [
      createTower("tower-water-a", "water", "slot-1-outer"),
      createTower("tower-spark-a", "spark", "slot-1-outer"),
    ];
    const grunt = stepRun(createRun(1, {
      placedTowers: towers,
      enemies: [
        createEnemy("enemy-grunt-a", "grunt", { hp: 100, maxHp: 100, pathProgress: 1 }),
      ],
    }), 100);
    const insulated = stepRun(createRun(1, {
      placedTowers: towers,
      enemies: [
        createEnemy("enemy-insulated-a", "insulated", { hp: 100, maxHp: 100, pathProgress: 1 }),
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
    });
    expect(getWaveSpawnedCount(state.waveRuntime)).toBe(1);

    const cleared = advanceToNextDraft(state);

    expect(cleared.phase).toBe("draft");
    expect(cleared.waveRuntime).toBeNull();
    expect(cleared.stats.waveStats.find(wave => wave.waveId === "wave-1")).toMatchObject({
      kills: 0,
      leaks: getWaveTotalSpawnCount(gameConfig.waves[0]!),
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

  it("ignores debug sandbox actions until debug mode is enabled", () => {
    const state = createRun(1);
    const ignored = applyAction(state, { type: "debugSetCoreHpLocked", locked: true });
    const debugState = applyAction(state, { type: "toggleDebug" });
    const locked = applyAction(debugState, { type: "debugSetCoreHpLocked", locked: true });

    expect(ignored.debugCoreHpLocked).toBe(false);
    expect(locked.debugCoreHpLocked).toBe(true);
  });

  it("supports draft picks and selected bench placement as reducer contracts", () => {
    const draft = advanceToNextDraft(startFirstWave(createPlacedStartingRun(5)));
    const withTower = applyAction(draft, { type: "chooseDraftTower", emitterId: draft.draft!.towerOffers[0]!.emitterId });
    const selected = applyAction(withTower, { type: "selectTower", towerId: withTower.bench[0]!.id });
    const placed = applyAction(selected, { type: "placeSelectedTower", slotId: "slot-3-outer" });

    expect(withTower).toMatchObject({
      phase: "countdown",
      draft: null,
      upgrades: [],
    });
    expect(placed.bench).toHaveLength(withTower.bench.length - 1);
    expect(placed.placedTowers.some(tower => tower.slotId === "slot-3-outer")).toBe(true);
  });

  it("generates tower draft roles with a synergistic support offer", () => {
    const draft = advanceToNextDraft(startFirstWave(createRun(5, {
      placedTowers: [
        createTower("tower-water-only", "water", "slot-1-outer"),
      ],
    })));

    expect(draft.phase).toBe("draft");
    expect(draft.draft?.towerOffers).toHaveLength(3);
    expect(draft.draft?.towerOffers.map(offer => offer.role)).toContain("support");
    expect(getTowerOfferIds(draft).some(emitterId => emitterId === "spark" || emitterId === "heat")).toBe(true);
  });

  it("keeps Магмовый кран out of the tower draft before wave 2", () => {
    const draft = advanceToNextDraft(startFirstWave(createPlacedStartingRun(17)));
    const rerolled = applyAction(draft, { type: "rerollDraft" });

    expect(draft).toMatchObject({
      phase: "draft",
      waveIndex: 0,
    });
    expect(getTowerOfferIds(draft)).not.toContain("heat");
    expect(getTowerOfferIds(rerolled)).not.toContain("heat");
    expect(getTowerOfferIds(draft)).toHaveLength(3);
    expect(new Set(getTowerOfferIds(draft)).size).toBe(3);
  });

  it("offers three distinct tower types in a draft and reroll", () => {
    const drafts = Array.from({ length: 40 }, (_, index) => {
      const draft = advanceToNextDraft(startFirstWave(createPlacedStartingRun(index + 1)));

      return [
        draft,
        applyAction(draft, { type: "rerollDraft" }),
      ];
    }).flat();

    drafts.forEach((draft) => {
      const offerIds = getTowerOfferIds(draft);

      expect(offerIds).toHaveLength(3);
      expect(new Set(offerIds).size).toBe(offerIds.length);
    });
  });

  it("keeps Нефть offered after wave 4 until taken", () => {
    const result = runHeadlessRun(createRun(4, {
      placedTowers: createSteamRingTowers(),
    }), {
      maxSteps: 12000,
      autoStartWaves: true,
      draftActions: state => getDraftCompletionActionsAvoiding(state, "oil"),
      stopWhen: state => state.phase === "draft" && state.waveIndex === 3,
    });

    expect(result.stoppedByPredicate).toBe(true);
    expect(getTowerOfferIds(result.state)).toContain("oil");
  });

  it("spends the single reroll budget on the current draft step", () => {
    const draft = advanceToNextDraft(startFirstWave(createPlacedStartingRun(6)));
    const rerolled = applyAction(draft, { type: "rerollDraft" });
    const exhausted = applyAction(rerolled, { type: "rerollDraft" });

    expect(rerolled.draft?.rerollsRemaining).toBe(0);
    expect(exhausted.draft).toEqual(rerolled.draft);
    expect(exhausted.rng).toEqual(rerolled.rng);
  });

  it("uses milestone upgrade drafts and guarantees the first slot unlock offer", () => {
    const afterWave1Draft = advanceToNextDraft(startFirstWave(createPlacedStartingRun(15)));
    const wave2Countdown = applyAction(afterWave1Draft, { type: "chooseDraftTower", emitterId: afterWave1Draft.draft!.towerOffers[0]!.emitterId });
    const afterWave2Draft = advanceToNextDraft(stepMany(wave2Countdown, 90));
    const afterTowerPick = applyAction(afterWave2Draft, { type: "chooseDraftTower", emitterId: afterWave2Draft.draft!.towerOffers[0]!.emitterId });

    expect(wave2Countdown.phase).toBe("countdown");
    expect(afterTowerPick.phase).toBe("draft");
    expect(afterTowerPick.draft?.step).toBe("upgrade");
    expect(afterTowerPick.draft?.upgradeOffers).toContain("unlockSlot5");
  });

  it("guarantees a second slot unlock offer before returning unlocks to the random pool", () => {
    const unlockSlot5 = gameConfig.upgrades.find(upgrade => upgrade.id === "unlockSlot5")!;
    const withOneUnlock = applyUpgradeToState(createRun(15), unlockSlot5);
    const generated = createDraftState({
      ...withOneUnlock,
      waveIndex: 3,
    });

    expect(generated.draft.upgradeOffers).toContain("unlockSlot9");
  });

  it("offers at most one corner slot unlock upgrade per draft", () => {
    const afterWave1Draft = advanceToNextDraft(startFirstWave(createPlacedStartingRun(15)));
    const wave2Countdown = applyAction(afterWave1Draft, { type: "chooseDraftTower", emitterId: afterWave1Draft.draft!.towerOffers[0]!.emitterId });
    const afterWave2Draft = advanceToNextDraft(stepMany(wave2Countdown, 90));
    const afterTowerPick = applyAction(afterWave2Draft, { type: "chooseDraftTower", emitterId: afterWave2Draft.draft!.towerOffers[0]!.emitterId });
    const rerolled = applyAction(afterTowerPick, { type: "rerollDraft" });
    const countUnlockOffers = (state: RunState) =>
      state.draft?.upgradeOffers.filter(upgradeId => upgradeId === "unlockSlot5" || upgradeId === "unlockSlot9" || upgradeId === "unlockSlot14").length ?? 0;

    expect(countUnlockOffers(afterTowerPick)).toBeLessThanOrEqual(1);
    expect(countUnlockOffers(rerolled)).toBeLessThanOrEqual(1);
  });

  it("caps upgrade stacks and lets upgrade effects alter reactions", () => {
    const maxedDraft = {
      ...createRun(1),
      phase: "draft" as const,
      draft: {
        step: "upgrade" as const,
        rerollsRemaining: 0,
        towerOffers: [
          { emitterId: "water", role: "support" },
          { emitterId: "spark", role: "generic" },
          { emitterId: "heat", role: "pivot" },
        ] as const,
        upgradeOffers: ["waterCapacity"] as const,
      },
      upgrades: [{ upgradeId: "waterCapacity" as const, stacks: 1 }],
    };
    const capped = applyAction(maxedDraft, { type: "chooseDraftUpgrade", upgradeId: "waterCapacity" });
    const towers = [
      createTower("tower-water-a", "water", "slot-1-outer"),
      createTower("tower-spark-a", "spark", "slot-2-inner"),
    ];

    expect(capped.upgrades).toEqual([{ upgradeId: "waterCapacity", stacks: 1 }]);
    expect(resolveReactions(gameConfig.board, towers)[1]?.ground).toBeNull();
    expect(resolveReactions(gameConfig.board, towers, [{ upgradeId: "waterCapacity", stacks: 1 }])[1]?.ground).toBe("electroPuddle");
  });

  it("recomputes existing heat tower footprint immediately after Жаровая тяга", () => {
    const heatReach = gameConfig.upgrades.find(upgrade => upgrade.id === "heatReach")!;
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-heat-a", "heat", "slot-3-inner"),
      ],
    });
    const upgraded = applyUpgradeToState(state, heatReach);
    const heatCells = projectReagents(upgraded.board, upgraded.placedTowers, upgraded.upgrades)
      .filter(projection => projection.directEnergy.includes("heat"))
      .map(projection => projection.cellIndex);

    expect(projectReagents(state.board, state.placedTowers, state.upgrades).filter(projection => projection.directEnergy.includes("heat")).map(projection => projection.cellIndex)).toEqual([3]);
    expect(heatCells).toEqual([3, 4]);
    expect(upgraded.reactions).toEqual(resolveReactions(upgraded.board, upgraded.placedTowers, upgraded.upgrades));
  });

  it("unlocks a corner slot through an upgrade and preserves it in saves", () => {
    const state = {
      ...createRun(1),
      phase: "draft" as const,
      draft: {
        step: "upgrade" as const,
        rerollsRemaining: 0,
        towerOffers: [] as const,
        upgradeOffers: ["unlockSlot5"] as const,
      },
    };
    const unlocked = applyAction(state, { type: "chooseDraftUpgrade", upgradeId: "unlockSlot5" });
    const restored = deserializeRun(serializeRun(unlocked));

    expect(state.board.slots.find(slot => slot.id === "slot-5-inner")?.locked).toBe(true);
    expect(unlocked.board.slots.find(slot => slot.id === "slot-5-inner")?.locked).toBe(false);
    expect(restored.board.slots.find(slot => slot.id === "slot-5-inner")?.locked).toBe(false);
  });

  it("round-trips draft state and upgrade stacks through save serialization", () => {
    const draft = advanceToNextDraft(startFirstWave(createPlacedStartingRun(8)));
    const withTower = applyAction(draft, { type: "chooseDraftTower", emitterId: draft.draft!.towerOffers[0]!.emitterId });
    const restored = deserializeRun(serializeRun(withTower));

    expect(restored.draft).toEqual(withTower.draft);
    expect(restored.bench).toEqual(withTower.bench);
    expect(restored.rng).toEqual(withTower.rng);
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
        towerOffers: [
          { emitterId: "water", role: "support" },
          { emitterId: "spark", role: "generic" },
          { emitterId: "heat", role: "pivot" },
        ] as const,
        upgradeOffers: [] as const,
      },
    };
    const withTower = applyAction(draft, { type: "chooseDraftTower", emitterId: "water" });

    expect(withTower).toMatchObject({
      phase: "countdown",
      waveIndex: 1,
      countdownMs: gameConfig.balance.postDraftCountdownMs,
      draft: null,
    });

    const wave = stepMany(withTower, 90);

    expect(wave.phase).toBe("wave");
    expect(wave.waveRuntime).toMatchObject({
      waveId: "wave-2",
    });
    expect(getWaveSpawnedCount(wave.waveRuntime)).toBe(1);
    expect(wave.enemies).toHaveLength(1);

    const withMoreSpawns = stepMany(wave, 18);

    expect(getWaveSpawnedCount(withMoreSpawns.waveRuntime)).toBeGreaterThan(1);
  });

  it("drives a minimal headless smoke-run through wave 10", () => {
    const result = runHeadlessRun(createRun(1, {
      placedTowers: createSteamRingTowers(),
    }), {
      maxSteps: 20000,
      autoStartWaves: true,
      autoCompleteDrafts: true,
      stopWhen: state =>
        state.phase === "boss"
        && state.stats.waveStats.some(wave => wave.waveId === "wave-10" && wave.kills + wave.leaks >= getWaveTotalSpawnCount(gameConfig.waves[9]!)),
    });

    expect(result.stoppedByPredicate).toBe(true);
    expect(result.state.coreHp).toBeGreaterThan(0);
    expect(result.state.stats.waveStats.map(wave => wave.waveId)).toContain("wave-10");
    expect(result.state.boss).toMatchObject({
      bossId: "barrel-eater",
      hp: 1000,
      lap: 1,
      maxHp: 1000,
    });
  });

  it("drives a headless full run from wave 1 through Бочкоед to victory", () => {
    const result = runHeadlessRun(createRun(1, {
      placedTowers: createDominantRingTowers(),
    }), {
      maxSteps: 50000,
      autoStartWaves: true,
      autoCompleteDrafts: true,
      stopWhen: state => state.phase === "victory" || state.phase === "defeat",
    });

    expect(result.stoppedByPredicate).toBe(true);
    expect(result.state.phase).toBe("victory");
    expect(result.state.stats.waveStats.map(wave => wave.waveId)).toContain("wave-10");
    expect(result.state.boss?.hp).toBe(0);
    expect(result.state.stats.damageByReaction.fire).toBeGreaterThan(0);
  });

  it("drives an underbuilt scripted strategy to terminal failure", () => {
    const result = runHeadlessStrategy({
      id: "mixed-damage-skipped-upgrades",
      seed: 8,
      placementPlan: {
        water: ["slot-1-outer", "slot-2-outer", "slot-3-outer", "slot-5-outer", "slot-7-outer"],
        spark: ["slot-4-outer", "slot-7-inner", "slot-9-inner", "slot-14-inner"],
        heat: ["slot-2-inner", "slot-3-inner", "slot-5-inner", "slot-7-inner"],
        oil: ["slot-2-outer", "slot-4-outer", "slot-6-outer"],
      },
      draftPlan: {
        towerPriority: ["heat", "oil", "spark", "water"],
        upgradePriority: ["sparkCapacity", "heatReach", "waterCapacity", "fireCatalyst", "oilControl"],
      },
    }, {
      maxSteps: 50000,
      stopWhen: state => state.phase === "victory" || state.phase === "defeat",
    });

    expect(result.stoppedByPredicate).toBe(true);
    expect(result.summary.phase).toBe("defeat");
    expect(result.summary.wavesCleared).toBeLessThanOrEqual(10);
    expect(result.summary.coreHp).toBe(0);
    expect(result.summary.leaks).toBeGreaterThan(0);
    expect(result.summary.damageBySource.rawSpark).toBeGreaterThan(0);
  });

  it("drives a weak scripted strategy to meaningful leaks or defeat", () => {
    const result = runHeadlessStrategy({
      id: "weak-water-only",
      seed: 8,
      placementPlan: {
        water: ["slot-1-outer", "slot-2-outer", "slot-3-outer"],
      },
      draftPlan: {
        towerPriority: ["water", "oil", "heat", "spark"],
        upgradePriority: ["waterCapacity", "oilControl", "heatReach", "sparkCapacity", "fireCatalyst"],
      },
    }, {
      maxSteps: 50000,
      stopWhen: state => state.phase === "victory" || state.phase === "defeat",
    });

    expect(result.stoppedByPredicate).toBe(true);
    expect(result.summary.phase).toBe("defeat");
    expect(result.summary.leaks).toBeGreaterThan(0);
    expect(result.summary.coreHp).toBe(0);
  });

  it("progresses boss laps and applies configured core damage", () => {
    const state = createBossRun({
      boss: createBossState({ pathProgress: 17.95, triggeredAbilityIds: ["exitSmash"] }),
    });
    const next = stepRun(state, 1000);

    expect(next.phase).toBe("boss");
    expect(next.coreHp).toBe(12);
    expect(next.boss).toMatchObject({
      lap: 2,
      reactionBreakIds: [],
      vulnerableMs: 0,
    });
  });

  it("triggers Бочкоед exit smash once, deals 2 core damage, and starts lap 2", () => {
    const triggered = stepRun(createBossRun({
      boss: createBossState({ pathProgress: 9 }),
    }), 100);

    expect(triggered.boss?.activeAbility?.id).toBe("exitSmash");
    expect(triggered.coreHp).toBe(gameConfig.balance.coreHp);

    const impact = stepRun(triggered, 2200);

    expect(impact.coreHp).toBe(gameConfig.balance.coreHp - 2);
    expect(impact.boss).toMatchObject({
      lap: 2,
      pathProgress: gameConfig.board.pathCells.length - 1,
      currentCellIndex: gameConfig.board.pathCells.length - 1,
      reactionBreakIds: [],
      vulnerableMs: 0,
    });
    expect(impact.boss?.activeAbility).toMatchObject({
      id: "exitSmash",
      impactApplied: true,
    });

    const stillSmashing = stepRun(impact, 3999);

    expect(stillSmashing.boss?.activeAbility?.id).toBe("exitSmash");

    const finished = stepRun(impact, 4000);

    expect(finished.coreHp).toBe(gameConfig.balance.coreHp - 2);
    expect(finished.boss?.activeAbility).toBeNull();
    expect(finished.boss?.triggeredAbilityIds).toContain("exitSmash");

    const resumed = stepRun(finished, 100);

    expect(resumed.boss?.pathProgress).toBeGreaterThan(gameConfig.board.pathCells.length - 1);
    expect(resumed.boss?.pathProgress).toBeLessThan(gameConfig.board.pathCells.length);
  });

  it("does not fire a boss ability when Бочкоед dies at its trigger point", () => {
    const state = createBossRun({
      placedTowers: [
        createTower("tower-water-a", "water", "slot-9-outer"),
        createTower("tower-spark-a", "spark", "slot-9-outer"),
      ],
      boss: createBossState({ hp: 1, maxHp: gameConfig.boss.hp, pathProgress: 9 }),
    });
    const next = stepRun(state, 1000);

    expect(next.phase).toBe("victory");
    expect(next.boss?.hp).toBe(0);
    expect(next.boss?.triggeredAbilityIds).not.toContain("exitSmash");
  });

  it("defeats the run if Бочкоед completes the final lap alive", () => {
    const state = createBossRun({
      coreHp: 3,
      boss: createBossState({ lap: 3, pathProgress: 53.95, triggeredAbilityIds: ["exitSmash", "rightSideSuppression", "summonWave"] }),
    });
    const next = stepRun(state, 1000);

    expect(next.phase).toBe("defeat");
    expect(next.coreHp).toBe(0);
    expect(next.boss?.hp).toBeGreaterThan(0);
  });

  it("suppresses reaction damage only on the right-side boss cells while active", () => {
    const placedTowers = [
      createTower("tower-water-a", "water", "slot-10-outer"),
      createTower("tower-spark-a", "spark", "slot-10-outer"),
    ];
    const unsuppressed = stepRun(createBossRun({
      placedTowers,
      boss: createBossState({ hp: 100, maxHp: 100, lap: 2, pathProgress: 28, triggeredAbilityIds: ["exitSmash", "rightSideSuppression"] }),
    }), 1000);
    const suppressed = stepRun(createBossRun({
      placedTowers,
      boss: createBossState({
        hp: 100,
        maxHp: 100,
        lap: 2,
        pathProgress: 28,
        triggeredAbilityIds: ["exitSmash", "rightSideSuppression"],
        suppressionRemainingMs: 1000,
      }),
    }), 1000);
    const outsideSuppression = stepRun(createBossRun({
      placedTowers: [
        createTower("tower-water-a", "water", "slot-6-outer"),
        createTower("tower-spark-a", "spark", "slot-6-outer"),
      ],
      boss: createBossState({
        hp: 100,
        maxHp: 100,
        lap: 2,
        pathProgress: 24,
        triggeredAbilityIds: ["exitSmash", "rightSideSuppression"],
        suppressionRemainingMs: 1000,
      }),
    }), 1000);

    expect(unsuppressed.boss?.hp).toBeLessThan(100);
    expect(suppressed.boss?.hp).toBeGreaterThan(unsuppressed.boss?.hp ?? 100);
    expect(suppressed.stats.damageByReaction.electroPuddle ?? 0).toBe(0);
    expect(suppressed.stats.damageBySource.rawSpark).toBeUndefined();
    expect(outsideSuppression.boss?.hp).toBeLessThan(100);
  });

  it("holds at lap 3 start and summons extra enemies before resuming", () => {
    const started = stepRun(createBossRun({
      boss: createBossState({
        lap: 3,
        pathProgress: 36,
        triggeredAbilityIds: ["exitSmash", "rightSideSuppression"],
      }),
    }), 100);

    expect(started.boss?.activeAbility?.id).toBe("summonWave");
    expect(started.boss?.pathProgress).toBe(36);

    const summoned = stepRun(started, 2000);

    expect(summoned.boss?.activeAbility).toMatchObject({
      id: "summonWave",
      impactApplied: true,
    });
    expect(summoned.boss?.summonRuntime).not.toBeNull();
    expect(summoned.boss?.pathProgress).toBe(36);

    const waiting = stepRun(summoned, 1900);

    expect(waiting.enemies.length).toBeGreaterThan(0);
    expect(waiting.boss?.activeAbility?.id).toBe("summonWave");
    expect(waiting.boss?.pathProgress).toBe(36);

    const finishedHold = stepRun(waiting, 100);

    expect(finishedHold.boss?.activeAbility).toBeNull();
    expect(finishedHold.boss?.pathProgress).toBe(36);

    const resumed = stepRun(finishedHold, 100);

    expect(resumed.enemies.length).toBeGreaterThan(0);
    expect(resumed.boss?.pathProgress).toBeGreaterThan(36);
    expect(resumed.boss?.triggeredAbilityIds).toContain("summonWave");
  });

  it("triggers boss Reaction Break from three distinct reaction ids per lap", () => {
    const state = createBossRun({
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
      ],
      boss: createBossState({
        pathProgress: 1,
        reactionBreakIds: ["fire", "steam"],
      }),
    });
    const next = stepRun(state, 100);

    expect(next.boss?.reactionBreakIds).toEqual(["electroPuddle", "fire", "steam"]);
    expect(next.boss?.vulnerableMs).toBe(gameConfig.boss.vulnerableDurationMs);
    expect(next.stats.bossBreaks).toBe(1);
  });

  it("does not trigger boss Reaction Break from repeated reaction ids", () => {
    const state = createBossRun({
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
      ],
      boss: createBossState({
        pathProgress: 1,
        reactionBreakIds: ["electroPuddle"],
      }),
    });
    const next = stepRun(state, 100);

    expect(next.boss?.reactionBreakIds).toEqual(["electroPuddle"]);
    expect(next.boss?.vulnerableMs).toBe(0);
    expect(next.stats.bossBreaks).toBe(0);
  });

  it("damages the boss with raw energy without counting it for Reaction Break", () => {
    const state = createBossRun({
      placedTowers: [
        createTower("tower-spark-a", "spark", "slot-1-outer"),
      ],
      boss: createBossState({
        hp: 100,
        maxHp: 100,
        pathProgress: 1,
        reactionBreakIds: ["fire", "steam"],
      }),
    });
    const next = stepRun(state, 1000);

    expect(next.boss?.hp).toBe(95);
    expect(next.boss?.reactionBreakIds).toEqual(["fire", "steam"]);
    expect(next.boss?.vulnerableMs).toBe(0);
    expect(next.stats.bossBreaks).toBe(0);
    expect(next.stats.damageBySource.rawSpark).toBe(5);
    expect("rawSpark" in next.stats.damageByReaction).toBe(false);
  });

  it("applies the vulnerable boss damage multiplier for its duration", () => {
    const towers = [
      createTower("tower-water-a", "water", "slot-1-outer"),
      createTower("tower-spark-a", "spark", "slot-1-outer"),
    ];
    const normal = stepRun(createBossRun({ placedTowers: towers, boss: createBossState({ hp: 100, maxHp: 100, pathProgress: 1 }) }), 1000);
    const vulnerable = stepRun(createBossRun({
      placedTowers: towers,
      boss: createBossState({ hp: 100, maxHp: 100, pathProgress: 1, vulnerableMs: 1000 }),
    }), 1000);

    expect(100 - (vulnerable.boss?.hp ?? 100)).toBeCloseTo((100 - (normal.boss?.hp ?? 100)) * 2);
    expect(vulnerable.boss?.vulnerableMs).toBe(0);
  });

  it("transitions to victory when the boss dies and aggregates reaction stats", () => {
    const state = createBossRun({
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
      ],
      boss: createBossState({ hp: 1, maxHp: gameConfig.boss.hp, pathProgress: 1 }),
    });
    const next = stepRun(state, 1000);

    expect(next.phase).toBe("victory");
    expect(next.boss?.hp).toBe(0);
    expect(next.stats.totalDamage).toBe(1);
    expect(next.stats.damageByReaction.electroPuddle).toBe(1);
  });

  it("round-trips boss and end-state data through save serialization", () => {
    const state = {
      ...createBossRun({
        boss: createBossState({ hp: 123, pathProgress: 9.5, reactionBreakIds: ["steam", "fireVortex"] }),
      }),
      phase: "victory" as const,
      stats: {
        ...createBossRun().stats,
        bossBreaks: 2,
        totalDamage: 77,
        damageBySource: { steam: 30, fireVortex: 47 },
        damageByReaction: { steam: 30, fireVortex: 47 },
      },
    };
    const restored = deserializeRun(serializeRun(state));

    expect(restored.phase).toBe("victory");
    expect(restored.boss).toEqual(state.boss);
    expect(restored.stats.bossBreaks).toBe(2);
    expect(restored.stats.damageBySource).toEqual({ steam: 30, fireVortex: 47 });
    expect(restored.stats.damageByReaction).toEqual({ steam: 30, fireVortex: 47 });
  });

  it("normalizes legacy saves without damageBySource", () => {
    const legacy = createRun(1);
    const legacyStats = {
      leaks: legacy.stats.leaks,
      kills: legacy.stats.kills,
      bossBreaks: legacy.stats.bossBreaks,
      totalDamage: 3,
      damageByReaction: { steam: 3 },
      waveStats: [
        {
          waveId: "legacy-wave",
          damage: 3,
          leaks: 0,
          kills: 1,
          damageByReaction: { steam: 3 },
        },
      ],
    } as unknown as RunState["stats"];
    const restored = deserializeRun({
      schemaVersion: gameConfig.balance.schemaVersion,
      state: {
        ...legacy,
        stats: legacyStats as RunState["stats"],
      },
    });

    expect(restored.stats.damageBySource).toEqual({ steam: 3 });
    expect(restored.stats.waveStats[0]?.damageBySource).toEqual({ steam: 3 });
  });

  it("generates a parameterized stadium grid loop without corner slot influence", () => {
    const board = createStadiumLoopBoard(defaultBoardGeometryConfig);
    const twelveCellBoard = createStadiumLoopBoard({
      ...defaultBoardGeometryConfig,
      pathCellCount: 12,
    });
    const lockedJunctionBoard = createStadiumLoopBoard({
      ...defaultBoardGeometryConfig,
      lockInnerCornerSlots: true,
    });

    expect(board.pathCells.map(cell => cell.index)).toEqual(Array.from({ length: 18 }, (_, index) => index));
    expect(board.pathCells.map(cell => cell.isCorner ? cell.index : null).filter(index => index !== null)).toEqual([0, 5, 9, 14]);
    expect(board.pathCells.map(cell => [cell.x, cell.y])).toEqual([
      [102, 669],
      [102, 585],
      [102, 501],
      [102, 417],
      [102, 333],
      [102, 249],
      [186, 249],
      [270, 249],
      [354, 249],
      [438, 249],
      [438, 333],
      [438, 417],
      [438, 501],
      [438, 585],
      [438, 669],
      [354, 669],
      [270, 669],
      [186, 669],
    ]);
    const innerSlots = board.slots.filter(slot => slot.lane === "inner");
    const horizontalCubeClearance = Math.min(...innerSlots.filter(slot => slot.x > defaultBoardGeometryConfig.center.x).map(slot => slot.x))
      - Math.max(...innerSlots.filter(slot => slot.x < defaultBoardGeometryConfig.center.x).map(slot => slot.x));
    const verticalCenterSlots = innerSlots.filter(slot => slot.x === defaultBoardGeometryConfig.center.x);
    const verticalCubeClearance = Math.min(...verticalCenterSlots.filter(slot => slot.y > defaultBoardGeometryConfig.center.y).map(slot => slot.y))
      - Math.max(...verticalCenterSlots.filter(slot => slot.y < defaultBoardGeometryConfig.center.y).map(slot => slot.y));

    expect(horizontalCubeClearance).toBeGreaterThanOrEqual(190);
    expect(verticalCubeClearance).toBeGreaterThanOrEqual(270);
    expect(board.slots).toHaveLength(26);
    expect(board.slots.filter(slot => slot.id.endsWith("-inner"))).toHaveLength(9);
    expect(board.slots.filter(slot => slot.id.endsWith("-outer"))).toHaveLength(17);
    expect(board.slots.filter(slot => slot.cellIndexes.length > 1).map(slot => slot.id)).toEqual([
      "slot-5-inner",
      "slot-9-inner",
      "slot-14-inner",
    ]);
    expect(board.slots.find(slot => slot.id === "slot-5-inner")?.cellIndexes).toEqual([4, 6]);
    expect(board.slots.find(slot => slot.id === "slot-5-outer")).toMatchObject({
      isCorner: true,
      cellIndexes: [5],
    });
    expect(board.slots.find(slot => slot.id === "slot-17-outer")?.cellIndexes).toEqual([17]);
    expect(board.slots.find(slot => slot.id === "slot-0-outer")).toBeUndefined();
    expect(board.slots.find(slot => slot.id === "slot-1-inner")).toBeUndefined();
    expect(board.slots.find(slot => slot.id === "slot-4-inner")).toBeUndefined();
    board.pathCells.forEach((cell) => {
      const outer = board.slots.find(slot => slot.id === `slot-${cell.index}-outer`);

      if (cell.index === 0) {
        expect(outer).toBeUndefined();
      } else {
        expect(Math.hypot(outer!.x - cell.x, outer!.y - cell.y)).toBeCloseTo(cell.isCorner ? defaultBoardGeometryConfig.slotOffset * Math.SQRT2 : defaultBoardGeometryConfig.slotOffset);
      }

      const inner = board.slots.find(slot => slot.id === `slot-${cell.index}-inner`);

      if (inner && !cell.isCorner && outer) {
        expect((inner.x + outer.x) / 2).toBe(cell.x);
        expect((inner.y + outer.y) / 2).toBe(cell.y);
        expect(Math.hypot(inner.x - outer.x, inner.y - outer.y)).toBe(defaultBoardGeometryConfig.slotOffset * 2);
      }
    });
    expect(lockedJunctionBoard.slots.filter(slot => slot.cellIndexes.length > 1).every(slot => slot.locked)).toBe(true);
    expect(lockedJunctionBoard.slots.filter(slot => slot.cellIndexes.length === 1).every(slot => !slot.locked)).toBe(true);
    expect(board.pathCells[0]).toMatchObject({ x: 102, y: 669, isCorner: true });
    expect(board.slots.find(slot => slot.id === "slot-0-inner")).toBeUndefined();
    expect(board.slots.find(slot => slot.id === "slot-1-outer")).toMatchObject({ x: 33, y: 585 });
    expect(board.slots.find(slot => slot.id === "slot-5-outer")).toMatchObject({ x: 33, y: 180 });
    expect(board.slots.find(slot => slot.id === "slot-5-inner")).toMatchObject({ x: 171, y: 318 });
    expect(board.slots.find(slot => slot.id === "slot-9-inner")).toMatchObject({ x: 369, y: 318 });
    expect(board.slots.find(slot => slot.id === "slot-9-outer")).toMatchObject({ x: 507, y: 180 });
    expect(board.slots.find(slot => slot.id === "slot-14-inner")).toMatchObject({ x: 369, y: 600 });
    expect(board.slots.find(slot => slot.id === "slot-14-outer")).toMatchObject({ x: 507, y: 738 });
    expect(board.slots.find(slot => slot.id === "slot-17-outer")).toMatchObject({ x: 186, y: 738 });
    expect(twelveCellBoard.pathCells).toHaveLength(12);
    expect(twelveCellBoard.pathCells.map(cell => cell.isCorner ? cell.index : null).filter(index => index !== null)).toEqual([0, 3, 6, 9]);
    expect(twelveCellBoard.slots).toHaveLength(14);
  });

  it("runs headless simulation with a custom board config", () => {
    const customConfig = cloneConfig(gameConfig);
    const customBoard = createStadiumLoopBoard({
      ...defaultBoardGeometryConfig,
      pathCellCount: 12,
    });

    (customConfig as MutableObject<GameConfig>).board = customBoard;
    (customConfig.balance as MutableObject<GameConfig["balance"]>).pathCellCount = 12;

    const initial = createRun(12, { config: customConfig });
    const result = runHeadlessRun(initial, {
      maxSteps: 2,
      autoStartWaves: true,
      config: customConfig,
    });

    expect(initial.board.pathCells).toHaveLength(12);
    expect(result.state.board.pathCells).toHaveLength(12);
    expect(result.state.phase).toBe("wave");
  });

  it("places physical bench tower instances before the first wave", () => {
    const selected = applyAction(createRun(1), { type: "selectTower", towerId: "tower-water-a" });
    const placed = applyAction(selected, { type: "placeSelectedTower", slotId: "slot-1-outer" });

    expect(placed.bench.map(tower => tower.id)).toEqual([
      "tower-water-b",
      "tower-spark-a",
    ]);
    expect(placed.placedTowers).toEqual([
      {
        id: "tower-water-a",
        emitterId: "water",
        displayName: "Водомёт",
        slotId: "slot-1-outer",
      },
    ]);
    expect(placed.selectedTowerId).toBeNull();
  });

  it("removes a placed tower with one field tap before the first wave", () => {
    const ready = createPlacedStartingRun(1);
    const removed = applyAction(ready, { type: "tapSlot", slotId: "slot-1-outer" });

    expect(removed.phase).toBe("ready");
    expect(removed.placedTowers.some(tower => tower.id === "tower-water-a")).toBe(false);
    expect(removed.bench.find(tower => tower.id === "tower-water-a")?.slotId).toBeNull();
    expect(removed.selectedTowerId).toBeNull();
  });

  it("allows additive bench placement during a running wave", () => {
    const running = startFirstWave(createRun(1));
    const selected = applyAction(running, { type: "selectTower", towerId: "tower-water-a" });
    const placed = applyAction(selected, { type: "tapSlot", slotId: "slot-1-outer" });

    expect(placed.phase).toBe("wave");
    expect(placed.placedTowers.find(tower => tower.id === "tower-water-a")?.slotId).toBe("slot-1-outer");
    expect(placed.bench.some(tower => tower.id === "tower-water-a")).toBe(false);
  });

  it("keeps occupied slots non-destructive while a wave is running", () => {
    const running = startFirstWave(createPlacedStartingRun(1));
    const selectedPlacedTower = applyAction(running, { type: "selectTower", towerId: "tower-water-a" });
    const moveAttempt = applyAction(selectedPlacedTower, { type: "placeSelectedTower", slotId: "slot-2-outer" });
    const tapAttempt = applyAction({ ...running, selectedTowerId: null }, { type: "tapSlot", slotId: "slot-1-outer" });
    const selectedBenchTower = applyAction(running, { type: "selectTower", towerId: "tower-heat-test" });

    expect(moveAttempt.placedTowers.find(tower => tower.id === "tower-water-a")?.slotId).toBe("slot-1-outer");
    expect(tapAttempt.selectedTowerId).toBeNull();
    expect(selectedBenchTower).toBe(running);
  });

  it("moves, removes, and swaps placed towers while paused", () => {
    const paused = applyAction(createPlacedStartingRun(1), { type: "pause" });
    const moved = applyAction(
      applyAction(paused, { type: "selectTower", towerId: "tower-water-a" }),
      { type: "placeSelectedTower", slotId: "slot-3-outer" },
    );
    const removed = applyAction(
      applyAction(moved, { type: "selectTower", towerId: "tower-water-a" }),
      { type: "tapSlot", slotId: "slot-3-outer" },
    );
    const swapped = applyAction(
      applyAction(paused, { type: "selectTower", towerId: "tower-water-a" }),
      { type: "placeSelectedTower", slotId: "slot-2-outer" },
    );

    expect(moved.placedTowers.find(tower => tower.id === "tower-water-a")?.slotId).toBe("slot-3-outer");
    expect(removed.placedTowers.some(tower => tower.id === "tower-water-a")).toBe(false);
    expect(removed.bench.find(tower => tower.id === "tower-water-a")?.slotId).toBeNull();
    expect(swapped.placedTowers.find(tower => tower.id === "tower-water-a")?.slotId).toBe("slot-2-outer");
    expect(swapped.placedTowers.find(tower => tower.id === "tower-water-b")?.slotId).toBe("slot-1-outer");
  });

  it("removes a placed tower with one field tap while paused", () => {
    const paused = applyAction(createPlacedStartingRun(1), { type: "pause" });
    const removed = applyAction(paused, { type: "tapSlot", slotId: "slot-1-outer" });

    expect(removed.placedTowers.some(tower => tower.id === "tower-water-a")).toBe(false);
    expect(removed.bench.find(tower => tower.id === "tower-water-a")?.slotId).toBeNull();
    expect(removed.selectedTowerId).toBeNull();
  });

  it("recomputes tower projection after placement changes", () => {
    const withFirstWater = placeBenchTower(createRun(1), "tower-water-a", "slot-1-outer");
    const withSecondWater = placeBenchTower(withFirstWater, "tower-water-b", "slot-2-outer");
    const withSpark = placeBenchTower(withSecondWater, "tower-spark-a", "slot-2-inner");
    const removedSpark = applyAction(
      applyAction(applyAction(withSpark, { type: "pause" }), { type: "selectTower", towerId: "tower-spark-a" }),
      { type: "tapSlot", slotId: "slot-2-inner" },
    );

    expect(withFirstWater.reactions.every(reaction => reaction.ground === null && reaction.air === null)).toBe(true);
    expect(withSpark.reactions.filter(reaction => reaction.ground === "electroPuddle").map(reaction => reaction.cellIndex)).toEqual([1, 2]);
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

  it("records repeatable run decisions separately from the run save", () => {
    const storage = createMemoryStorage();
    let state = createRun(33);
    let next = applyAction(state, { type: "restart", seed: 33 });

    recordRunReplayAction(state, { type: "restart", seed: 33 }, next, storage);
    state = next;
    next = applyAction(state, { type: "selectTower", towerId: "tower-water-a" });
    recordRunReplayAction(state, { type: "selectTower", towerId: "tower-water-a" }, next, storage);
    state = next;
    next = applyAction(state, { type: "placeSelectedTower", slotId: "slot-1-outer" });
    recordRunReplayAction(state, { type: "placeSelectedTower", slotId: "slot-1-outer" }, next, storage);
    state = next;
    next = applyAction(state, { type: "startWave" });
    recordRunReplayAction(state, { type: "startWave" }, next, storage);

    expect(storage.getItem(RUN_REPLAY_LOG_KEY)).not.toBeNull();
    expect(storage.getItem("jam-td.run.v1")).toBeNull();
    expect(loadRunReplayLog(storage)).toMatchObject({
      seed: 33,
      actions: [
        {
          waveIndex: 0,
          action: { type: "selectTower", towerId: "tower-water-a" },
          results: [
            {
              type: "towerSelected",
              towerId: "tower-water-a",
              emitterId: "water",
              source: "bench",
            },
          ],
        },
        {
          waveIndex: 0,
          action: { type: "placeSelectedTower", slotId: "slot-1-outer" },
          results: [
            {
              type: "towerPlaced",
              towerId: "tower-water-a",
              emitterId: "water",
              fromSlotId: null,
              toSlotId: "slot-1-outer",
            },
          ],
        },
        {
          waveIndex: 0,
          action: { type: "startWave" },
          results: [
            {
              type: "waveStarted",
              waveId: "wave-1",
            },
          ],
        },
      ],
    });
  });

  it("records draft picks with concrete tower and upgrade results", () => {
    const storage = createMemoryStorage();
    const draft = {
      ...createRun(41),
      phase: "draft" as const,
      draft: {
        step: "tower" as const,
        rerollsRemaining: 1,
        towerOffers: [{ emitterId: "heat" as const, role: "support" as const }],
        upgradeOffers: ["heatReach" as const],
      },
    };
    const withTower = applyAction(draft, { type: "chooseDraftTower", emitterId: "heat" });
    const withUpgrade = applyAction(withTower, { type: "chooseDraftUpgrade", upgradeId: "heatReach" });

    recordRunReplayAction(draft, { type: "chooseDraftTower", emitterId: "heat" }, withTower, storage);
    recordRunReplayAction(withTower, { type: "chooseDraftUpgrade", upgradeId: "heatReach" }, withUpgrade, storage);

    expect(loadRunReplayLog(storage)?.actions).toMatchObject([
      {
        action: { type: "chooseDraftTower", emitterId: "heat" },
        results: [
          {
            type: "draftTowerPicked",
            emitterId: "heat",
            towerId: "tower-heat-0-0",
          },
        ],
      },
      {
        action: { type: "chooseDraftUpgrade", upgradeId: "heatReach" },
        results: [
          {
            type: "draftUpgradePicked",
            upgradeId: "heatReach",
            stacks: 1,
          },
        ],
      },
    ]);
  });
});

describe("render performance budget", () => {
  it("keeps procedural reaction marks inside the mobile particle budget", () => {
    const maxEffectMarks = Math.max(...Object.values(renderPerformanceBudget.effectParticleMarks));

    expect(maxEffectMarks).toBeLessThanOrEqual(renderPerformanceBudget.maxParticlesPerEffect);
    expect(renderPerformanceBudget.phaserParticleSystems).toBe(0);
    expect(renderPerformanceBudget.bitmapAtlasCount).toBeLessThanOrEqual(1);
    expect(renderPerformanceBudget.pooledLabels).toBe(true);
  });

  it("does not use blur or post-processing in runtime overlays", () => {
    expect(renderPerformanceBudget.blurOrPostProcessing).toBe(false);
  });
});

describe("game config", () => {
  it("passes validation for the authored P0 config", () => {
    expect(validateGameConfig(gameConfig)).toEqual([]);
  });

  it("reports malformed ids and display names", () => {
    const malformed = cloneConfig(gameConfig);
    const balance = malformed.balance as MutableObject<typeof malformed.balance>;
    const emitters = malformed.emitters as Mutable<typeof malformed.emitters>;
    const reactions = malformed.reactions as Mutable<typeof malformed.reactions>;
    const waves = malformed.waves as Mutable<typeof malformed.waves>;
    const upgrades = malformed.upgrades as Mutable<typeof malformed.upgrades>;

    balance.minSpeedMultiplier = 0;
    emitters[0] = {
      ...emitters[0]!,
      displayName: "",
    };
    reactions[0] = {
      ...reactions[0]!,
      inputs: ["missing-input" as ReactionDefinition["inputs"][number]],
    };
    waves[0] = {
      ...waves[0]!,
      spawnGroups: [{ enemyId: "missing-enemy" as never, count: 1, spawnIntervalMs: 100 }],
    };
    upgrades[0] = {
      ...upgrades[0]!,
      emitterId: "missing-emitter" as never,
    };

    expect(validateGameConfig(malformed)).toEqual([
      "balance has invalid runtime values",
      "emitter water is missing display names",
      "reaction electroPuddle references unknown input missing-input",
      "wave wave-1 group 0 references unknown enemy missing-enemy",
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
      { id: "tower-water-a", emitterId: "water", label: "Водомёт", placed: false },
      { id: "tower-water-b", emitterId: "water", label: "Водомёт", placed: false },
      { id: "tower-spark-a", emitterId: "spark", label: "Разрядник", placed: false },
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

function advanceToNextDraft(state: ReturnType<typeof createRun>): ReturnType<typeof createRun> {
  return runHeadlessRun(state, {
    maxSteps: 30000,
    stopWhen: candidate => candidate.phase === "draft",
  }).state;
}

function startFirstWave(state: ReturnType<typeof createRun>): ReturnType<typeof createRun> {
  return applyAction(state, { type: "startWave" });
}

function advanceToDraftAfterWave2(state: ReturnType<typeof createRun>): ReturnType<typeof createRun> {
  const afterWave1 = advanceToNextDraft(startFirstWave(state));
  const wave2Countdown = getDraftCompletionActionsAvoiding(afterWave1, "heat")
    .reduce((current, action) => applyAction(current, action), afterWave1);
  const wave2 = stepMany(wave2Countdown, 90);

  return advanceToNextDraft(wave2);
}

function getTowerOfferIds(state: ReturnType<typeof createRun>) {
  return state.draft?.towerOffers.map(offer => offer.emitterId) ?? [];
}

function getDraftCompletionActionsAvoiding(state: RunState, avoidedEmitterId: EmitterId): readonly GameAction[] {
  const towerOffer = state.draft?.towerOffers.find(offer => offer.emitterId !== avoidedEmitterId) ?? state.draft?.towerOffers[0];
  const upgradeOffer = state.draft?.upgradeOffers[0];
  const actions: GameAction[] = [];

  if (towerOffer) {
    actions.push({ type: "chooseDraftTower", emitterId: towerOffer.emitterId });
  }

  if (upgradeOffer) {
    actions.push({ type: "chooseDraftUpgrade", upgradeId: upgradeOffer });
  }

  return actions;
}

function createPlacedStartingRun(seed: number): ReturnType<typeof createRun> {
  return createRun(seed, {
    placedTowers: [
      createTower("tower-water-a", "water", "slot-1-outer"),
      createTower("tower-water-b", "water", "slot-2-outer"),
      createTower("tower-spark-a", "spark", "slot-1-outer"),
    ],
  });
}

function createSteamRingTowers() {
  const outerSlots = gameConfig.board.slots.filter(slot => slot.lane === "outer");
  const innerSlots = gameConfig.board.slots.filter(slot => slot.lane === "inner");

  return [
    ...outerSlots.map(slot => createTower(`tower-water-ring-${slot.id}`, "water", slot.id)),
    ...innerSlots.map(slot => createTower(`tower-heat-ring-${slot.id}`, "heat", slot.id)),
  ];
}

function createDominantRingTowers() {
  const pathSlots = gameConfig.board.slots.filter(slot => slot.cellIndexes.length === 1);

  return pathSlots.flatMap(slot => [
    createTower(`tower-dominant-water-${slot.id}`, "water", slot.id),
    createTower(`tower-dominant-heat-steam-${slot.id}`, "heat", slot.id),
    createTower(`tower-dominant-oil-${slot.id}`, "oil", slot.id),
    createTower(`tower-dominant-heat-fire-${slot.id}`, "heat", slot.id),
  ]);
}

function createStormCloudTowers() {
  return [
    createTower("tower-water-a", "water", "slot-1-outer"),
    createTower("tower-heat-a", "heat", "slot-1-outer"),
    createTower("tower-spark-a", "spark", "slot-1-outer"),
  ];
}

function createBossState(overrides: Partial<NonNullable<RunState["boss"]>> = {}): NonNullable<RunState["boss"]> {
  const pathProgress = overrides.pathProgress ?? 0;

  return {
    bossId: gameConfig.boss.id,
    lap: 1,
    hp: gameConfig.boss.hp,
    maxHp: gameConfig.boss.hp,
    pathProgress,
    currentCellIndex: getCurrentPathCellIndex(pathProgress % gameConfig.balance.pathCellCount, gameConfig.balance.pathCellCount),
    vulnerableMs: 0,
    reactionBreakIds: [],
    triggeredAbilityIds: [],
    activeAbility: null,
    suppressionRemainingMs: 0,
    summonRuntime: null,
    ...overrides,
  };
}

function createBossRun(overrides: Partial<RunState> = {}): ReturnType<typeof createRun> {
  return {
    ...createRun(1, {
      placedTowers: overrides.placedTowers,
    }),
    phase: "boss",
    waveIndex: gameConfig.waves.length - 1,
    enemies: [],
    waveRuntime: null,
    boss: createBossState(),
    ...overrides,
  };
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
type MutableObject<T> = {
  -readonly [Key in keyof T]: T[Key]
};

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
