import { getPathTilePresentation } from "@app/phaser/scenes/runScenePathTiles";
import { getReactionSpritePresentation, reactionVfxRegistry } from "@app/phaser/scenes/runSceneReactionRender";
import { gameConfig } from "@entities/game-session/model/config";
import { describe, expect, it } from "vitest";

describe("reaction VFX registry", () => {
  it("covers every configured P0 reaction with a non-placeholder Phaser asset", () => {
    const configuredReactionIds = gameConfig.reactions.map(reaction => reaction.id).sort();
    const visualReactionIds = Object.keys(reactionVfxRegistry).sort();

    expect(visualReactionIds).toEqual(configuredReactionIds);
    gameConfig.reactions.forEach((reaction) => {
      const visual = reactionVfxRegistry[reaction.id];

      expect(visual.layer).toBe(reaction.layer);
      expect(visual.tier).toBe(reaction.tier);
      expect(visual.asset.group).toBe("reactions");
      expect(visual.asset.usage).toBe("phaser");
      expect("placeholder" in visual.asset).toBe(false);
    });
  });

  it("presents ground reactions as tile-sized path effects instead of fixed horizontal decals", () => {
    const topCell = gameConfig.board.pathCells[0]!;
    const rightCell = gameConfig.board.pathCells[4]!;
    const topPresentation = getReactionSpritePresentation(gameConfig.board.pathCells, topCell, "electroPuddle", 0);
    const rightPresentation = getReactionSpritePresentation(gameConfig.board.pathCells, rightCell, "electroPuddle", 0);

    expect(topPresentation.width).toBeGreaterThanOrEqual(56);
    expect(topPresentation.height).toBeGreaterThanOrEqual(56);
    expect(Math.abs(topPresentation.width - topPresentation.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(rightPresentation.width - rightPresentation.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(rightPresentation.rotation)).toBeGreaterThan(1);
  });

  it("presents path cells as square reaction tiles", () => {
    gameConfig.board.pathCells.forEach((cell) => {
      const tile = getPathTilePresentation(gameConfig.board.pathCells, cell);

      expect(tile.width).toBe(tile.height);
      expect(tile.effectSize).toBe(tile.width);
    });
  });
});
