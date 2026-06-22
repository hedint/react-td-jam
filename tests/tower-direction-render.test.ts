import type { BoardSlot } from "@entities/game-session/model/types";
import { getTowerDirectionRotation, getTowerDirections, getTowerHeadSwayRotation, getTowerSpriteRenderConfig } from "@app/phaser/scenes/runSceneTowerRender";
import { gameConfig } from "@entities/game-session/model/config";
import { createTower } from "@entities/game-session/model/simulation";
import { assetGroups } from "@shared/assets/manifest";
import { describe, expect, it } from "vitest";

function getSlot(slotId: string): BoardSlot {
  const slot = gameConfig.board.slots.find(candidate => candidate.id === slotId);

  if (!slot) {
    throw new Error(`Missing slot ${slotId}`);
  }

  return slot;
}

describe("tower directional rendering", () => {
  it("uses a straight asset rotated toward a one-cell slot target", () => {
    const slot = getSlot("slot-2-outer");
    const config = getTowerSpriteRenderConfig(
      createTower("tower-water-a", "water", slot.id),
      slot,
      gameConfig.board.pathCells,
    );

    expect(config).toMatchObject({
      baseKey: assetGroups.towers.waterCannonBase.key,
      headKey: assetGroups.towers.waterCannonHead.key,
      directions: ["right"],
    });
    expect(getTowerDirectionRotation(config.directions[0]!)).toBeCloseTo(0);
  });

  it("uses corner assets for inner junction slots with two affected cells", () => {
    const slot = getSlot("slot-5-inner");
    const config = getTowerSpriteRenderConfig(
      createTower("tower-spark-a", "spark", slot.id),
      slot,
      gameConfig.board.pathCells,
    );

    expect(config).toMatchObject({
      baseKey: assetGroups.towers.sparkDischargerBase.key,
      headKey: assetGroups.towers.sparkDischargerHead.key,
      directions: ["left", "up"],
    });
    expect(config.directions.map(direction => getTowerDirectionRotation(direction))).toEqual([Math.PI, -Math.PI / 2]);
  });

  it("maps outer corner slots to a single diagonal direction aimed at the corner", () => {
    const slot = getSlot("slot-5-outer");

    expect(getTowerDirections(slot, gameConfig.board.pathCells)).toEqual(["downRight"]);
    expect(getTowerDirectionRotation("downRight")).toBeCloseTo(Math.PI / 4);
  });

  it("keeps idle head sway subtle and animated", () => {
    const slot = getSlot("slot-5-inner");
    const tower = createTower("tower-water-a", "water", slot.id);
    const samples = [0, 250, 500, 750, 1000].map(time => getTowerHeadSwayRotation(tower, slot, 0, time));

    expect(Math.max(...samples.map(Math.abs))).toBeLessThan(0.06);
    expect(new Set(samples.map(sample => sample.toFixed(4))).size).toBeGreaterThan(1);
  });
});
