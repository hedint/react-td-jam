import type { CellReactionState, CellReagentProjection, EmitterId, GameSnapshot, PathCell } from "@entities/game-session/model/types";
import type Phaser from "phaser";
import { gameConfig } from "@entities/game-session/model/config";
import { getAirReactionConsumedEmitterIds, projectReagents } from "@entities/game-session/model/reactions";
import { assetGroups } from "@shared/assets/manifest";
import { getPathTilePresentation } from "./runScenePathTiles";

export interface ReagentAssetVisual {
  readonly key: string
  readonly alpha: number
  readonly scale: number
  readonly depth: number
  readonly jitter: number
  readonly frameCount?: number
  readonly frameDurationMs?: number
}

export class RunSceneReagentPresenter {
  private sprites: Phaser.GameObjects.Image[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  render(snapshot: GameSnapshot, visualMs: number): void {
    const projections = projectReagents(snapshot.board, snapshot.placedTowers, snapshot.upgrades);
    const reactionsByCellIndex = new Map(snapshot.activeReactions.map(reaction => [reaction.cellIndex, reaction]));
    let spriteIndex = 0;

    projections.forEach((projection) => {
      const cell = snapshot.board.pathCells[projection.cellIndex];
      const emitterIds = getVisibleReagentEmitterIds(projection, reactionsByCellIndex.get(projection.cellIndex));

      if (!cell || emitterIds.length === 0) {
        return;
      }

      emitterIds.forEach((emitterId, index) => {
        this.renderSprite(spriteIndex, snapshot.board.pathCells, cell, emitterId, index, emitterIds.length, visualMs);
        spriteIndex += 1;
      });
    });

    this.sprites.slice(spriteIndex).forEach((sprite) => {
      sprite.setVisible(false);
    });
  }

  private renderSprite(
    index: number,
    cells: readonly PathCell[],
    cell: PathCell,
    emitterId: EmitterId,
    overlapIndex: number,
    overlapCount: number,
    visualMs: number,
  ): void {
    while (this.sprites.length <= index) {
      this.sprites.push(this.scene.add.image(0, 0, assetGroups.reactions.reagentWaterPuddle.key)
        .setOrigin(0.5)
        .setDepth(6));
    }

    const visual = getReagentAssetVisual(emitterId);
    const tile = getPathTilePresentation(cells, cell);
    const pulse = getReagentPulse(emitterId, visualMs, cell.index, overlapIndex);
    const offset = overlapCount > 1 ? (overlapIndex - (overlapCount - 1) / 2) * visual.jitter : 0;
    const sprite = this.sprites[index];
    const frame = getReagentFrame(visual, visualMs);

    if (!sprite) {
      return;
    }

    sprite.setVisible(true).setTexture(visual.key);

    if (frame !== null) {
      sprite.setFrame(frame);
    }

    sprite
      .setPosition(cell.x + Math.cos(tile.rotation + Math.PI / 2) * offset, cell.y + Math.sin(tile.rotation + Math.PI / 2) * offset)
      .setDisplaySize(tile.effectSize * visual.scale * (1 + pulse), tile.effectSize * visual.scale * (1 + pulse))
      .setAlpha(visual.alpha + pulse)
      .setRotation(tile.rotation + getReagentRotationOffset(emitterId, visualMs, cell.index))
      .setDepth(visual.depth + cell.y / 10000);
  }
}

export function getVisibleReagentEmitterIds(
  projection: CellReagentProjection,
  reaction: CellReactionState | undefined,
): readonly EmitterId[] {
  if (reaction?.ground) {
    return [];
  }

  const consumedEmitterIds = getAirReactionConsumedEmitterIds(reaction, gameConfig);

  return [
    ...projection.substances,
    ...(projection.energy.length > 0 ? projection.energy : projection.directEnergy),
  ].filter(emitterId => !consumedEmitterIds.has(emitterId));
}

export function getReagentAssetVisual(emitterId: EmitterId): ReagentAssetVisual {
  switch (emitterId) {
    case "water":
      return {
        key: assetGroups.reactions.reagentWaterRipple.key,
        alpha: 0.82,
        scale: 1.1,
        depth: 6,
        jitter: 7,
        frameCount: 8,
        frameDurationMs: 500,
      };
    case "oil":
      return {
        key: assetGroups.reactions.reagentOilSlick.key,
        alpha: 0.86,
        scale: 1.1,
        depth: 6,
        jitter: 7,
        frameCount: 8,
        frameDurationMs: 500,
      };
    case "spark":
      return {
        key: assetGroups.reactions.reagentSparkCharge.key,
        alpha: 0.78,
        scale: 0.96,
        depth: 7,
        jitter: 8,
        frameCount: 8,
        frameDurationMs: 500,
      };
    case "heat":
      return {
        key: assetGroups.reactions.reagentHeatScorch.key,
        alpha: 0.78,
        scale: 1.04,
        depth: 6.5,
        jitter: 8,
        frameCount: 8,
        frameDurationMs: 500,
      };
    default:
      return emitterId satisfies never;
  }
}

function getReagentFrame(
  visual: ReagentAssetVisual,
  visualMs: number,
): number | null {
  if (!visual.frameCount || !visual.frameDurationMs) {
    return null;
  }

  return Math.floor(visualMs / visual.frameDurationMs) % visual.frameCount;
}

function getReagentPulse(
  emitterId: EmitterId,
  visualMs: number,
  cellIndex: number,
  overlapIndex: number,
): number {
  if (emitterId === "water" || emitterId === "oil" || emitterId === "spark" || emitterId === "heat") {
    return 0;
  }

  return Math.sin(visualMs / 260 + cellIndex + overlapIndex) * 0.035;
}

function getReagentRotationOffset(emitterId: EmitterId, visualMs: number, cellIndex: number): number {
  if (emitterId === "water" || emitterId === "oil" || emitterId === "spark" || emitterId === "heat") {
    return 0;
  }

  return Math.sin(visualMs / 480 + cellIndex) * 0.035;
}
