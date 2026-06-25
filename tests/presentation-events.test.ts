import type { RunState } from "@entities/game-session/model/types";
import { derivePresentationEvents } from "@entities/game-session/model/presentationEvents";
import { createRun, createSnapshot } from "@entities/game-session/model/simulation";
import { describe, expect, it } from "vitest";

describe("derivePresentationEvents", () => {
  it("emits enemy damage when enemy HP decreases", () => {
    const previous = createSnapshot(createRunWithEnemy({ hp: 30 }));
    const next = createSnapshot(createRunWithEnemy({ hp: 18, pathProgress: 1.5 }));

    expect(derivePresentationEvents(previous, next)).toContainEqual({
      type: "enemyDamaged",
      enemyInstanceId: "enemy-a",
      enemyId: "grunt",
      amount: 12,
      pathProgress: 1.5,
    });
  });

  it("emits killed enemy events when kill stats increase", () => {
    const previous = createSnapshot(createRunWithEnemy({ hp: 8, pathProgress: 2.25 }));
    const next = createSnapshot({
      ...createRunWithEnemy({ hp: 8 }),
      enemies: [],
      stats: {
        ...previous.stats,
        kills: previous.stats.kills + 1,
      },
    });

    expect(derivePresentationEvents(previous, next)).toContainEqual({
      type: "enemyKilled",
      enemyInstanceId: "enemy-a",
      enemyId: "grunt",
      pathProgress: 2.25,
    });
  });

  it("emits core damage when core HP decreases", () => {
    const previous = createSnapshot(createRun(1));
    const next = createSnapshot({
      ...createRun(1),
      coreHp: previous.coreHp - 2,
    });

    expect(derivePresentationEvents(previous, next)).toContainEqual({
      type: "coreDamaged",
      amount: 2,
    });
  });

  it("emits reaction bursts for newly active fire storm cells", () => {
    const previous = createSnapshot(createRun(1));
    const next = createSnapshot({
      ...createRun(1),
      reactions: previous.reactions.map(reaction => reaction.cellIndex === 4
        ? { ...reaction, air: "fireStorm" as const }
        : reaction),
    });

    expect(derivePresentationEvents(previous, next)).toContainEqual({
      type: "reactionBurst",
      reactionId: "fireStorm",
      cellIndex: 4,
    });
  });

  it("emits boss break when boss break stats increase", () => {
    const previous = createSnapshot(createBossRun({ bossBreaks: 0, pathProgress: 5.2 }));
    const next = createSnapshot(createBossRun({ bossBreaks: 1, pathProgress: 5.8 }));

    expect(derivePresentationEvents(previous, next)).toContainEqual({
      type: "bossBreak",
      pathProgress: 5.8,
    });
  });

  it("emits boss damage and kill events", () => {
    const previous = createSnapshot(createBossRun({ bossBreaks: 0, pathProgress: 7, hp: 20 }));
    const next = createSnapshot(createBossRun({ bossBreaks: 0, pathProgress: 7.4, hp: 0 }));

    expect(derivePresentationEvents(previous, next)).toEqual(expect.arrayContaining([
      {
        type: "bossDamaged",
        amount: 20,
        pathProgress: 7.4,
      },
      {
        type: "bossKilled",
        pathProgress: 7.4,
      },
    ]));
  });

  it("emits boss ability start and impact events", () => {
    const previous = createSnapshot(createBossRun({ bossBreaks: 0, pathProgress: 9 }));
    const started = createSnapshot(createBossRun({
      bossBreaks: 0,
      pathProgress: 9,
      activeAbility: { id: "exitSmash", elapsedMs: 0, impactApplied: false },
    }));
    const impacted = createSnapshot(createBossRun({
      bossBreaks: 0,
      pathProgress: 18,
      activeAbility: { id: "exitSmash", elapsedMs: 1100, impactApplied: true },
    }));

    expect(derivePresentationEvents(previous, started)).toContainEqual({
      type: "bossAbilityStarted",
      abilityId: "exitSmash",
      pathProgress: 9,
    });
    expect(derivePresentationEvents(started, impacted)).toContainEqual({
      type: "bossAbilityImpact",
      abilityId: "exitSmash",
      pathProgress: 18,
    });
  });

  it("emits boss suppression and summon impact events", () => {
    const previous = createSnapshot(createBossRun({ bossBreaks: 0, pathProgress: 27 }));
    const suppressed = createSnapshot(createBossRun({ bossBreaks: 0, pathProgress: 27, suppressionRemainingMs: 6000 }));
    const summoned = createSnapshot(createBossRun({
      bossBreaks: 0,
      pathProgress: 36,
      summonRuntime: {
        waveId: "boss-summon",
        elapsedMs: 0,
        groups: [],
      },
    }));

    expect(derivePresentationEvents(previous, suppressed)).toEqual(expect.arrayContaining([
      {
        type: "bossAbilityImpact",
        abilityId: "rightSideSuppression",
        pathProgress: 27,
      },
      {
        type: "bossSuppressionStarted",
        cellIndexes: [10, 11, 12, 13, 14],
      },
    ]));
    expect(derivePresentationEvents(previous, summoned)).toContainEqual({
      type: "bossAbilityImpact",
      abilityId: "summonWave",
      pathProgress: 36,
    });
  });
});

function createRunWithEnemy(overrides: Partial<RunState["enemies"][number]> = {}): RunState {
  const base = createRun(1);

  return {
    ...base,
    phase: "wave",
    enemies: [
      {
        id: "enemy-a",
        enemyId: "grunt",
        displayName: "Грунт",
        hp: 30,
        maxHp: 30,
        pathProgress: 1,
        currentCellIndex: 1,
        leaked: false,
        ...overrides,
      },
    ],
  };
}

function createBossRun(options: {
  readonly bossBreaks: number
  readonly pathProgress: number
  readonly hp?: number
  readonly activeAbility?: NonNullable<RunState["boss"]>["activeAbility"]
  readonly suppressionRemainingMs?: number
  readonly summonRuntime?: NonNullable<RunState["boss"]>["summonRuntime"]
}): RunState {
  const base = createRun(1);

  return {
    ...base,
    phase: "boss",
    boss: {
      bossId: "barrel-eater",
      lap: 1,
      hp: options.hp ?? 200,
      maxHp: 200,
      pathProgress: options.pathProgress,
      currentCellIndex: Math.floor(options.pathProgress),
      vulnerableMs: options.bossBreaks > 0 ? 2500 : 0,
      reactionBreakIds: options.bossBreaks > 0 ? ["electroPuddle", "fire"] : [],
      triggeredAbilityIds: [],
      activeAbility: options.activeAbility ?? null,
      suppressionRemainingMs: options.suppressionRemainingMs ?? 0,
      summonRuntime: options.summonRuntime ?? null,
    },
    stats: {
      ...base.stats,
      bossBreaks: options.bossBreaks,
    },
  };
}
