import { getPathTilePresentation } from "@app/phaser/scenes/runScenePathTiles";
import { getReactionSpritePresentation, reactionVfxRegistry } from "@app/phaser/scenes/runSceneReactionRender";
import { getVisibleReagentEmitterIds } from "@app/phaser/scenes/runSceneReagentRender";
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
    const verticalCell = gameConfig.board.pathCells[0]!;
    const horizontalCell = gameConfig.board.pathCells[4]!;
    const verticalPresentation = getReactionSpritePresentation(gameConfig.board.pathCells, verticalCell, "electroPuddle", 0);
    const horizontalPresentation = getReactionSpritePresentation(gameConfig.board.pathCells, horizontalCell, "electroPuddle", 0);

    expect(verticalPresentation.width).toBeGreaterThanOrEqual(56);
    expect(verticalPresentation.height).toBeGreaterThanOrEqual(56);
    expect(Math.abs(verticalPresentation.width - verticalPresentation.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(horizontalPresentation.width - horizontalPresentation.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(verticalPresentation.rotation)).toBeGreaterThan(1);
    expect(Math.abs(horizontalPresentation.rotation)).toBeLessThan(0.01);
  });

  it("presents path cells as square reaction tiles", () => {
    gameConfig.board.pathCells.forEach((cell) => {
      const tile = getPathTilePresentation(gameConfig.board.pathCells, cell);

      expect(tile.width).toBe(tile.height);
      expect(tile.effectSize).toBe(tile.width);
    });
  });

  it("keeps non-input ground reagents visible under air reactions", () => {
    const projection = {
      cellIndex: 1,
      substances: ["oil", "water"],
      energy: [],
      directEnergy: ["spark"],
      energyClaims: [],
    } as const;

    expect(getVisibleReagentEmitterIds(projection, { cellIndex: 1, ground: null, air: "steam" })).toEqual(["oil", "spark"]);
  });

  it("hides emitter inputs consumed by the current air reaction", () => {
    const projection = {
      cellIndex: 1,
      substances: ["water"],
      energy: ["heat"],
      directEnergy: ["heat"],
      energyClaims: [],
    } as const;

    expect(getVisibleReagentEmitterIds(projection, { cellIndex: 1, ground: null, air: "steam" })).toEqual([]);
  });

  it("hides emitter inputs consumed through nested air reaction inputs", () => {
    const projection = {
      cellIndex: 1,
      substances: ["oil", "water"],
      energy: ["heat", "spark"],
      directEnergy: ["heat", "spark"],
      energyClaims: [],
    } as const;

    expect(getVisibleReagentEmitterIds(projection, { cellIndex: 1, ground: null, air: "stormCloud" })).toEqual(["oil"]);
  });

  it("hides ground reagents under ground reactions", () => {
    const projection = {
      cellIndex: 1,
      substances: ["oil", "water"],
      energy: [],
      directEnergy: ["spark"],
      energyClaims: [],
    } as const;

    expect(getVisibleReagentEmitterIds(projection, { cellIndex: 1, ground: "electroPuddle", air: "steam" })).toEqual([]);
  });
});
