import type { BoardSlot } from "@entities/game-session/model/types";
import { getSlotFeedback } from "@app/phaser/scenes/slotPlacementFeedback";
import { describe, expect, it } from "vitest";

const slot: BoardSlot = {
  id: "slot-test",
  cellIndexes: [0],
  isCorner: false,
  lane: "inner",
  locked: false,
  x: 100,
  y: 100,
};

describe("slot placement feedback", () => {
  it("marks valid placement targets while a tower is selected", () => {
    expect(getSlotFeedback({
      hasSelectedTower: true,
      isSelectedSlot: false,
      isValidTarget: true,
      slot,
    })).toBe("valid");
  });

  it("does not add desktop hover warnings for invalid live-wave targets", () => {
    expect(getSlotFeedback({
      hasSelectedTower: true,
      isSelectedSlot: false,
      isValidTarget: false,
      slot,
    })).toBe("idle");
  });

  it("keeps a selected tower origin visually anchored", () => {
    expect(getSlotFeedback({
      hasSelectedTower: true,
      isSelectedSlot: true,
      isValidTarget: true,
      slot,
    })).toBe("selected");
  });
});
