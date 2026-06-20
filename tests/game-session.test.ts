import {
  createGrunt,
  createRun,
  createSnapshot,
  createTower,
  nextRandom,
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
      phase: "wave",
      seed: 42,
      tick: 0,
      elapsedMs: 0,
      paused: false,
      coreHp: 5,
      lastTap: null,
    });
    expect(state.placedTowers.map(tower => tower.displayName)).toEqual(["Водомёт", "Водомёт", "Разрядник"]);
    expect(state.enemies[0]?.displayName).toBe("Грунт");
  });

  it("advances seeded RNG deterministically", () => {
    const first = createRun(7).rng;
    const second = createRun(7).rng;

    expect(nextRandom(first)).toEqual(nextRandom(second));
  });

  it("steps deterministically for the slice scenario", () => {
    const runA = stepMany(createRun(11), 90);
    const runB = stepMany(createRun(11), 90);

    expect(runA).toEqual(runB);
    expect(runA.tick).toBe(90);
    expect(runA.elapsedMs).toBeCloseTo(3000);
  });

  it("forms a two-cell Электролужа from the starting Вода + Искра setup", () => {
    const state = createRun(1);

    expect(state.reactions).toEqual([
      { cellIndex: 0, ground: "electroPuddle" },
      { cellIndex: 1, ground: "electroPuddle" },
      { cellIndex: 2, ground: null },
      { cellIndex: 3, ground: null },
    ]);
  });

  it("does not form a damaging reaction from a lone tower", () => {
    const state = createRun(1, {
      placedTowers: [
        createTower("tower-water-only", "water", "slot-water-a"),
      ],
    });
    const next = stepRun(state, 1000 / 30);

    expect(next.reactions.every(reaction => reaction.ground === null)).toBe(true);
    expect(next.enemies[0]?.hp).toBe(20);
  });

  it("damages and kills a Грунт that crosses the Электролужа", () => {
    const state = stepMany(createRun(1), 90);

    expect(state.enemies).toEqual([]);
    expect(state.coreHp).toBe(5);
  });

  it("leaks a surviving Грунт and reduces core HP", () => {
    const state = createRun(1, {
      placedTowers: [],
      enemies: [
        createGrunt({ hp: 100 }),
      ],
    });
    const next = stepMany(state, 130);

    expect(next.enemies).toEqual([]);
    expect(next.coreHp).toBe(4);
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
