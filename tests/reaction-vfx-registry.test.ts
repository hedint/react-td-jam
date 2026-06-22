import type { CellReactionState, EmitterId, ReactionId } from "@entities/game-session/model/types";
import { getPathTilePresentation } from "@app/phaser/scenes/runScenePathTiles";
import {
  getElectroPuddlePoolUnderlayPresentation,
  getReactionConnectedPools,
  getReactionPoolUnderlayPresentation,
  getSupportedReactionPoolUnderlayIds,
} from "@app/phaser/scenes/runSceneReactionPoolUnderlay";
import {
  getReactionSpritePresentation,
  reactionVfxRegistry,
} from "@app/phaser/scenes/runSceneReactionRender";
import { getVisibleReagentConnectedPools, getVisibleReagentEmitterIds } from "@app/phaser/scenes/runSceneReagentRender";
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
    const horizontalCell = gameConfig.board.pathCells[6]!;
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

  it("groups connected ground reactions without merging singleton pools", () => {
    const reactions = createReactionCells({
      1: "electroPuddle",
      2: "electroPuddle",
      5: "electroPuddle",
    });

    expect(getReactionConnectedPools(reactions, gameConfig.board.pathCells.length, "electroPuddle", "ground")).toEqual([[1, 2], [5]]);
  });

  it("groups connected ground reactions across the path ring seam", () => {
    const lastCellIndex = gameConfig.board.pathCells.length - 1;
    const reactions = createReactionCells({
      0: "electroPuddle",
      [lastCellIndex]: "electroPuddle",
    });

    expect(getReactionConnectedPools(reactions, gameConfig.board.pathCells.length, "electroPuddle", "ground")).toEqual([[0, lastCellIndex]]);
  });

  it("ignores air reactions and other ground reactions when grouping electro puddles", () => {
    const reactions = createReactionCells({
      1: "electroPuddle",
      2: "fire",
    }).map(reaction => reaction.cellIndex === 3
      ? { ...reaction, air: "electroPuddle" as ReactionId }
      : reaction);

    expect(getReactionConnectedPools(reactions, gameConfig.board.pathCells.length, "electroPuddle", "ground")).toEqual([[1]]);
  });

  it("presents electro puddle underlay bridges below the main ground reaction sprite", () => {
    const presentation = getElectroPuddlePoolUnderlayPresentation(gameConfig.board.pathCells, [1, 2], 120);

    expect(presentation.depth).toBeLessThan(reactionVfxRegistry.electroPuddle.depth);
    expect(presentation.links).toHaveLength(1);
    expect(presentation.links[0]?.outerAlpha).toBe(1);
    expect(presentation.links[0]?.innerAlpha).toBe(1);
    expect(presentation.bridges.length).toBeGreaterThanOrEqual(1);
    expect(presentation.bridges[0]?.points).toHaveLength(4);
  });

  it("supports only the requested multi-cell reaction underlays", () => {
    expect(getSupportedReactionPoolUnderlayIds()).toEqual(["electroPuddle", "fire", "steam", "stormCloud", "fireVortex"]);

    getSupportedReactionPoolUnderlayIds().forEach((reactionId) => {
      const presentation = getReactionPoolUnderlayPresentation(gameConfig.board.pathCells, [1, 2], reactionId, 120);

      expect(presentation?.reactionId).toBe(reactionId);
      expect(presentation?.links).toHaveLength(1);
    });
    expect(getReactionPoolUnderlayPresentation(gameConfig.board.pathCells, [1, 2], "fireStorm", 120)).toBeNull();
  });

  it("groups only visible water and oil reagent pools", () => {
    const visibleEmitterIdsByCell = createVisibleEmitterCells({
      0: ["water"],
      1: ["water", "oil"],
      2: ["oil"],
      4: ["spark"],
    });

    expect(getVisibleReagentConnectedPools(visibleEmitterIdsByCell, gameConfig.board.pathCells.length, "water")).toEqual([[0, 1]]);
    expect(getVisibleReagentConnectedPools(visibleEmitterIdsByCell, gameConfig.board.pathCells.length, "oil")).toEqual([[1, 2]]);
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

function createReactionCells(groundByCellIndex: Record<number, ReactionId>): readonly CellReactionState[] {
  return gameConfig.board.pathCells.map(cell => ({
    cellIndex: cell.index,
    ground: groundByCellIndex[cell.index] ?? null,
    air: null,
  }));
}

function createVisibleEmitterCells(emitterIdsByCellIndex: Record<number, readonly EmitterId[]>): readonly { readonly cellIndex: number, readonly emitterIds: readonly EmitterId[] }[] {
  return gameConfig.board.pathCells.map(cell => ({
    cellIndex: cell.index,
    emitterIds: emitterIdsByCellIndex[cell.index] ?? [],
  }));
}
