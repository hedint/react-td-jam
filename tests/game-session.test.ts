import type { EmitterId, GameAction, GameConfig, ReactionDefinition, RunState } from "@entities/game-session/model/types";
import { renderPerformanceBudget } from "@app/phaser/scenes/renderPerformance";
import { createStadiumLoopBoard, defaultBoardGeometryConfig } from "@entities/game-session/model/boardGeometry";
import { gameConfig, validateGameConfig } from "@entities/game-session/model/config";
import { createFixedStepDriver } from "@entities/game-session/model/fixedStepDriver";
import { runHeadlessRun, runHeadlessStrategy } from "@entities/game-session/model/headlessRun";
import { clearSavedRun, hasSavedRun, loadSavedRun, saveRun } from "@entities/game-session/model/persistence";
import { collectConnectedPools, getCellSpeedMultiplier, projectReagents, resolveReactions } from "@entities/game-session/model/reactions";
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
    expect(state.board.slots).toHaveLength(23);
    expect(state.board.slots.every(slot => !slot.locked)).toBe(true);
    expect(state.bench.map(tower => tower.displayName)).toEqual([
      "Водомёт",
      "Водомёт",
      "Водомёт",
      "Маслонасос",
      "Маслонасос",
      "Маслонасос",
      "Разрядник",
      "Разрядник",
      "Разрядник",
      "Магмовый кран",
      "Магмовый кран",
      "Магмовый кран",
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
    expect(getTowerOfferIds(draftBeforeFlyers)).toContain("heat");
    expect(getTowerOfferIds(rerolled)).toContain("heat");
    expect(withHeat.bench.some(tower => tower.emitterId === "heat")).toBe(true);
  });

  it("does not gate the first flying wave when Жар is refused", () => {
    const draftBeforeFlyers = advanceToDraftAfterWave2(createRun(22));
    const refusedHeat = applyAction(draftBeforeFlyers, { type: "chooseDraftTower", emitterId: "water" });
    const countdown = applyAction(refusedHeat, { type: "chooseDraftUpgrade", upgradeId: refusedHeat.draft!.upgradeOffers[0]! });
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
        createTower("tower-heat-a", "heat", "slot-0-inner"),
      ],
    });

    expect(projectReagents(state.board, state.placedTowers)[1]).toEqual({
      cellIndex: 1,
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
    expect(state.reactions[1]).toEqual({ cellIndex: 1, ground: null, air: "steam" });
    expect(state.reactions[2]).toEqual({ cellIndex: 2, ground: null, air: "steam" });
  });

  it("uses adjacent spark to turn the two-cell steam plume into storm clouds without leaking past steam", () => {
    const oneSparkCell = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-0-inner"),
        createTower("tower-spark-a", "spark", "slot-2-outer"),
      ],
    });
    const twoSparkCells = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-0-inner"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
        createTower("tower-spark-b", "spark", "slot-2-outer"),
      ],
    });

    expect(oneSparkCell.reactions.filter(reaction => reaction.air === "stormCloud").map(reaction => reaction.cellIndex)).toEqual([1, 2]);
    expect(oneSparkCell.reactions[3]).toEqual({ cellIndex: 3, ground: null, air: null });
    expect(twoSparkCells.reactions.filter(reaction => reaction.air === "stormCloud").map(reaction => reaction.cellIndex)).toEqual([1, 2]);
    expect(twoSparkCells.reactions[3]).toEqual({ cellIndex: 3, ground: null, air: null });
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
        createTower("tower-spark-a", "spark", "slot-0-inner"),
        createTower("tower-spark-b", "spark", "slot-4-inner"),
      ],
    });
    const projection = projectReagents(state.board, state.placedTowers);
    const energizedCells = projection.filter(cell => cell.energy.includes("spark")).map(cell => cell.cellIndex);

    expect(energizedCells).toEqual([1, 2]);
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
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-0-inner"),
        createTower("tower-oil-a", "oil", "slot-7-outer"),
        createTower("tower-heat-b", "heat", "slot-8-inner"),
      ],
    });
    const stormCloud = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-0-inner"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
      ],
    });
    const fireVortex = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-0-inner"),
        createTower("tower-oil-a", "oil", "slot-1-outer"),
        createTower("tower-heat-b", "heat", "slot-2-inner"),
      ],
    });
    const fireStorm = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-0-inner"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
        createTower("tower-spark-b", "spark", "slot-2-outer"),
        createTower("tower-water-b", "water", "slot-3-outer"),
        createTower("tower-heat-b", "heat", "slot-4-inner"),
        createTower("tower-oil-b", "oil", "slot-4-outer"),
        createTower("tower-heat-c", "heat", "slot-4-outer"),
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
      createTower("tower-water-a", "water", "slot-1-outer"),
      createTower("tower-heat-a", "heat", "slot-0-inner"),
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
        createTower("tower-spark-a", "spark", "slot-0-inner"),
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

  it("allows one ground and one air reaction to coexist on a cell", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-0-inner"),
        createTower("tower-spark-a", "spark", "slot-1-outer"),
      ],
    });

    expect(state.reactions[1]?.ground).not.toBeNull();
    expect(state.reactions[1]?.air).not.toBeNull();
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
    expect(next.enemies[0]?.pathProgress).toBeCloseTo(1 / 30);
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
    expect(getCellSpeedMultiplier(projection[1], [{ upgradeId: "oilControl", stacks: 1 }])).toBeCloseTo(0.45);
    expect(getCellSpeedMultiplier(projection[1], [{ upgradeId: "oilControl", stacks: 10 }])).toBe(gameConfig.balance.minSpeedMultiplier);
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
    expect(next.enemies[0]?.pathProgress).toBeCloseTo(1.7);
    expect(next.stats.damageBySource.rawSpark).toBe(5);
    expect(next.stats.damageByReaction.electroPuddle).toBeUndefined();
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
    expect(next.enemies[0]?.hp).toBeCloseTo(99.3);
    expect(next.stats.damageBySource.steam).toBeCloseTo(0.7);
    expect(next.stats.damageBySource.rawHeat).toBeUndefined();
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
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-0-inner"),
      ],
      enemies: [
        createEnemy("enemy-flyer-a", "flyer", { pathProgress: 1 }),
      ],
    });
    const airReaction = createRun(1, {
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-heat-a", "heat", "slot-0-inner"),
      ],
      enemies: [
        createEnemy("enemy-flyer-a", "flyer", { pathProgress: 1 }),
      ],
    });

    expect(stepRun(groundReaction, 100).enemies[0]?.hp).toBe(24);
    expect(stepRun(airReaction, 100).enemies[0]?.hp).toBeLessThan(24);
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

    expect(next.enemies[0]?.hp).toBe(24);
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
      createTower("tower-spark-a", "spark", "slot-0-inner"),
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
    const withTower = applyAction(draft, { type: "chooseDraftTower", emitterId: draft.draft!.towerOffers[0]!.emitterId });
    const selected = applyAction(withTower, { type: "selectTower", towerId: withTower.bench[0]!.id });
    const placed = applyAction(selected, { type: "placeSelectedTower", slotId: "slot-3-outer" });
    const upgraded = applyAction(withTower, { type: "chooseDraftUpgrade", upgradeId: withTower.draft!.upgradeOffers[0]! });

    expect(withTower.draft?.step).toBe("upgrade");
    expect(placed.bench).toHaveLength(withTower.bench.length - 1);
    expect(placed.placedTowers.some(tower => tower.slotId === "slot-3-outer")).toBe(true);
    expect(upgraded).toMatchObject({
      phase: "countdown",
      draft: null,
      upgrades: [{ upgradeId: withTower.draft!.upgradeOffers[0]!, stacks: 1 }],
    });
  });

  it("generates tower draft roles with a synergistic support offer", () => {
    const draft = stepMany(startFirstWave(createRun(5, {
      placedTowers: [
        createTower("tower-water-only", "water", "slot-1-outer"),
      ],
    })), 520);

    expect(draft.phase).toBe("draft");
    expect(draft.draft?.towerOffers).toHaveLength(3);
    expect(draft.draft?.towerOffers.map(offer => offer.role)).toContain("support");
    expect(getTowerOfferIds(draft).some(emitterId => emitterId === "spark" || emitterId === "heat")).toBe(true);
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
    const draft = stepMany(startFirstWave(createPlacedStartingRun(6)), 90);
    const rerolled = applyAction(draft, { type: "rerollDraft" });
    const exhausted = applyAction(rerolled, { type: "rerollDraft" });

    expect(rerolled.draft?.rerollsRemaining).toBe(0);
    expect(exhausted.draft).toEqual(rerolled.draft);
    expect(exhausted.rng).toEqual(rerolled.rng);
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
      upgrades: [{ upgradeId: "waterCapacity" as const, stacks: 2 }],
    };
    const capped = applyAction(maxedDraft, { type: "chooseDraftUpgrade", upgradeId: "waterCapacity" });
    const towers = [
      createTower("tower-water-a", "water", "slot-1-outer"),
      createTower("tower-spark-a", "spark", "slot-2-inner"),
    ];

    expect(capped.upgrades).toEqual([{ upgradeId: "waterCapacity", stacks: 2 }]);
    expect(resolveReactions(gameConfig.board, towers)[1]?.ground).toBeNull();
    expect(resolveReactions(gameConfig.board, towers, [{ upgradeId: "waterCapacity", stacks: 1 }])[1]?.ground).toBe("electroPuddle");
  });

  it("round-trips draft state and upgrade stacks through save serialization", () => {
    const draft = stepMany(startFirstWave(createPlacedStartingRun(8)), 90);
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
        upgradeOffers: ["waterCapacity", "sparkCapacity", "heatReach"] as const,
      },
    };
    const withTower = applyAction(draft, { type: "chooseDraftTower", emitterId: "water" });
    const countdown = applyAction(withTower, { type: "chooseDraftUpgrade", upgradeId: "waterCapacity" });

    expect(countdown).toMatchObject({
      phase: "countdown",
      waveIndex: 1,
      countdownMs: gameConfig.balance.postDraftCountdownMs,
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
        state.phase === "boss"
        && state.stats.waveStats.some(wave => wave.waveId === "wave-10" && wave.kills + wave.leaks >= gameConfig.waves[9]!.count),
    });

    expect(result.stoppedByPredicate).toBe(true);
    expect(result.state.coreHp).toBeGreaterThan(0);
    expect(result.state.stats.waveStats.map(wave => wave.waveId)).toContain("wave-10");
    expect(result.state.boss).toMatchObject({
      bossId: "barrel-eater",
      lap: 1,
    });
  });

  it("drives a headless full run from wave 1 through Бочкоед to victory", () => {
    const result = runHeadlessRun(createRun(1, {
      placedTowers: createElectroRingTowers(),
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
    expect(result.state.stats.damageByReaction.electroPuddle).toBeGreaterThan(0);
  });

  it("drives an expected-win scripted strategy with bounded leaks and mixed reaction damage", () => {
    const result = runHeadlessStrategy({
      id: "expected-win-p0",
      seed: 8,
      placementPlan: {
        water: ["slot-1-outer", "slot-2-outer", "slot-3-outer", "slot-5-outer", "slot-7-outer"],
        spark: ["slot-0-inner", "slot-4-inner", "slot-6-inner", "slot-8-inner"],
        heat: ["slot-2-inner", "slot-4-inner", "slot-6-inner", "slot-8-inner"],
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
    expect(result.summary.phase).toBe("victory");
    expect(result.summary.wavesCleared).toBe(10);
    expect(result.summary.leaks).toBeLessThanOrEqual(3);
    expect(result.summary.damageByReaction.electroPuddle).toBeGreaterThan(0);
    expect(
      (result.summary.damageByReaction.stormCloud ?? 0)
      + (result.summary.damageByReaction.fireVortex ?? 0)
      + (result.summary.damageByReaction.fireStorm ?? 0),
    ).toBeGreaterThan(0);
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
      boss: createBossState({ pathProgress: 15.95 }),
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

  it("defeats the run if Бочкоед completes the final lap alive", () => {
    const state = createBossRun({
      coreHp: 3,
      boss: createBossState({ lap: 3, pathProgress: 47.95 }),
    });
    const next = stepRun(state, 1000);

    expect(next.phase).toBe("defeat");
    expect(next.coreHp).toBe(0);
    expect(next.boss?.hp).toBeGreaterThan(0);
  });

  it("triggers boss Reaction Break from three distinct reaction ids per lap", () => {
    const state = createBossRun({
      placedTowers: [
        createTower("tower-water-a", "water", "slot-1-outer"),
        createTower("tower-spark-a", "spark", "slot-0-inner"),
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
        createTower("tower-spark-a", "spark", "slot-0-inner"),
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
      createTower("tower-spark-a", "spark", "slot-0-inner"),
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
        createTower("tower-spark-a", "spark", "slot-0-inner"),
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

    expect(board.pathCells.map(cell => cell.index)).toEqual(Array.from({ length: 16 }, (_, index) => index));
    expect(board.pathCells.map(cell => cell.isCorner ? cell.index : null).filter(index => index !== null)).toEqual([0, 4, 8, 12]);
    expect(board.pathCells.map(cell => [cell.x, cell.y])).toEqual([
      [118, 636],
      [118, 560],
      [118, 484],
      [118, 408],
      [118, 332],
      [194, 332],
      [270, 332],
      [346, 332],
      [422, 332],
      [422, 408],
      [422, 484],
      [422, 560],
      [422, 636],
      [346, 636],
      [270, 636],
      [194, 636],
    ]);
    expect(board.slots).toHaveLength(23);
    expect(board.slots.filter(slot => slot.id.endsWith("-inner"))).toHaveLength(8);
    expect(board.slots.filter(slot => slot.id.endsWith("-outer"))).toHaveLength(15);
    expect(board.slots.filter(slot => slot.cellIndexes.length > 1).map(slot => slot.id)).toEqual([
      "slot-0-inner",
      "slot-4-inner",
      "slot-8-inner",
      "slot-12-inner",
    ]);
    expect(board.slots.find(slot => slot.id === "slot-0-inner")?.cellIndexes).toEqual([1, 15]);
    expect(board.slots.find(slot => slot.id === "slot-4-inner")?.cellIndexes).toEqual([3, 5]);
    expect(board.slots.find(slot => slot.id === "slot-4-outer")).toMatchObject({
      isCorner: true,
      cellIndexes: [4],
    });
    expect(board.slots.find(slot => slot.id === "slot-15-outer")?.cellIndexes).toEqual([15]);
    expect(board.slots.find(slot => slot.id === "slot-0-outer")).toBeUndefined();
    expect(board.slots.find(slot => slot.id === "slot-1-inner")).toBeUndefined();
    expect(board.slots.find(slot => slot.id === "slot-3-inner")).toBeUndefined();
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
    expect(board.pathCells[0]).toMatchObject({ x: 118, y: 636, isCorner: true });
    expect(board.slots.find(slot => slot.id === "slot-0-inner")).toMatchObject({ x: 194, y: 560 });
    expect(board.slots.find(slot => slot.id === "slot-1-outer")).toMatchObject({ x: 42, y: 560 });
    expect(board.slots.find(slot => slot.id === "slot-4-outer")).toMatchObject({ x: 42, y: 256 });
    expect(board.slots.find(slot => slot.id === "slot-4-inner")).toMatchObject({ x: 194, y: 408 });
    expect(board.slots.find(slot => slot.id === "slot-8-inner")).toMatchObject({ x: 346, y: 408 });
    expect(board.slots.find(slot => slot.id === "slot-8-outer")).toMatchObject({ x: 498, y: 256 });
    expect(board.slots.find(slot => slot.id === "slot-12-inner")).toMatchObject({ x: 346, y: 560 });
    expect(board.slots.find(slot => slot.id === "slot-12-outer")).toMatchObject({ x: 498, y: 712 });
    expect(board.slots.find(slot => slot.id === "slot-15-outer")).toMatchObject({ x: 194, y: 712 });
    expect(twelveCellBoard.pathCells).toHaveLength(12);
    expect(twelveCellBoard.pathCells.map(cell => cell.isCorner ? cell.index : null).filter(index => index !== null)).toEqual([0, 3, 6, 9]);
    expect(twelveCellBoard.slots).toHaveLength(15);
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
      "tower-water-c",
      "tower-oil-a",
      "tower-oil-b",
      "tower-oil-c",
      "tower-spark-a",
      "tower-spark-b",
      "tower-spark-c",
      "tower-heat-a",
      "tower-heat-b",
      "tower-heat-c",
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
    const withSpark = placeBenchTower(withSecondWater, "tower-spark-a", "slot-0-inner");
    const removedSpark = applyAction(
      applyAction(applyAction(withSpark, { type: "pause" }), { type: "selectTower", towerId: "tower-spark-a" }),
      { type: "tapSlot", slotId: "slot-0-inner" },
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
      enemyId: "missing-enemy" as never,
    };
    upgrades[0] = {
      ...upgrades[0]!,
      emitterId: "missing-emitter" as never,
    };

    expect(validateGameConfig(malformed)).toEqual([
      "balance has invalid runtime values",
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
      { id: "tower-water-c", label: "Водомёт", placed: false },
      { id: "tower-oil-a", label: "Маслонасос", placed: false },
      { id: "tower-oil-b", label: "Маслонасос", placed: false },
      { id: "tower-oil-c", label: "Маслонасос", placed: false },
      { id: "tower-spark-a", label: "Разрядник", placed: false },
      { id: "tower-spark-b", label: "Разрядник", placed: false },
      { id: "tower-spark-c", label: "Разрядник", placed: false },
      { id: "tower-heat-a", label: "Магмовый кран", placed: false },
      { id: "tower-heat-b", label: "Магмовый кран", placed: false },
      { id: "tower-heat-c", label: "Магмовый кран", placed: false },
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
  const wave2Countdown = chooseFirstDraftOffers(afterWave1);
  const wave2 = stepMany(wave2Countdown, 90);

  return stepMany(wave2, 600);
}

function chooseFirstDraftOffers(state: ReturnType<typeof createRun>): ReturnType<typeof createRun> {
  const towerOffer = state.draft?.towerOffers[0];
  const withTower = towerOffer
    ? applyAction(state, { type: "chooseDraftTower", emitterId: towerOffer.emitterId })
    : state;
  const upgradeOffer = withTower.draft?.upgradeOffers[0];

  return upgradeOffer
    ? applyAction(withTower, { type: "chooseDraftUpgrade", upgradeId: upgradeOffer })
    : withTower;
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
      createTower("tower-spark-a", "spark", "slot-0-inner"),
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

function createElectroRingTowers() {
  const outerSlots = gameConfig.board.slots.filter(slot => slot.lane === "outer");
  const innerSlots = gameConfig.board.slots.filter(slot => slot.lane === "inner");

  return [
    ...outerSlots.map(slot => createTower(`tower-water-electro-${slot.id}`, "water", slot.id)),
    ...innerSlots.map(slot => createTower(`tower-spark-electro-${slot.id}`, "spark", slot.id)),
  ];
}

function createStormCloudTowers() {
  return [
    createTower("tower-water-a", "water", "slot-1-outer"),
    createTower("tower-water-b", "water", "slot-2-outer"),
    createTower("tower-heat-a", "heat", "slot-0-inner"),
    createTower("tower-spark-a", "spark", "slot-2-inner"),
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
