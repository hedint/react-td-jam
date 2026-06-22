import type { CellReactionState, CellReagentProjection, EmitterId, GameSnapshot, PathCell } from "@entities/game-session/model/types";
import type Phaser from "phaser";
import { gameConfig } from "@entities/game-session/model/config";
import { collectConnectedPools, getAirReactionConsumedEmitterIds, projectReagents } from "@entities/game-session/model/reactions";
import { assetGroups } from "@shared/assets/manifest";
import { getPathTilePresentation } from "./runScenePathTiles";

export type ReagentPoolUnderlayEmitterId = Extract<EmitterId, "water" | "oil">;

const REAGENT_POOL_UNDERLAY_DEPTH = 5.6;
const reagentPoolUnderlayStyles = {
  water: {
    color: 0x0B779C,
    alpha: 1,
    outerWidthScale: 0.48,
    innerWidthScale: 0.26,
    widthPulseScale: 0.03,
  },
  oil: {
    color: 0x2C2319,
    alpha: 0.92,
    outerWidthScale: 0.5,
    innerWidthScale: 0.28,
    widthPulseScale: 0.025,
  },
} as const satisfies Record<ReagentPoolUnderlayEmitterId, {
  readonly color: number
  readonly alpha: number
  readonly outerWidthScale: number
  readonly innerWidthScale: number
  readonly widthPulseScale: number
}>;

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
  private readonly underlayGraphics: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene) {
    this.underlayGraphics = scene.add.graphics().setDepth(REAGENT_POOL_UNDERLAY_DEPTH);
  }

  render(snapshot: GameSnapshot, visualMs: number): void {
    const projections = projectReagents(snapshot.board, snapshot.placedTowers, snapshot.upgrades);
    const reactionsByCellIndex = new Map(snapshot.activeReactions.map(reaction => [reaction.cellIndex, reaction]));
    const visibleEmitterIdsByCell = projections.map(projection => ({
      cellIndex: projection.cellIndex,
      emitterIds: getVisibleReagentEmitterIds(projection, reactionsByCellIndex.get(projection.cellIndex)),
    }));
    let spriteIndex = 0;

    this.underlayGraphics.clear();
    renderReagentPoolUnderlays(this.underlayGraphics, snapshot.board.pathCells, visibleEmitterIdsByCell, visualMs);

    projections.forEach((projection) => {
      const cell = snapshot.board.pathCells[projection.cellIndex];
      const emitterIds = visibleEmitterIdsByCell[projection.cellIndex]?.emitterIds ?? [];

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

export function getVisibleReagentConnectedPools(
  visibleEmitterIdsByCell: readonly { readonly cellIndex: number, readonly emitterIds: readonly EmitterId[] }[],
  pathCellCount: number,
  emitterId: ReagentPoolUnderlayEmitterId,
): readonly (readonly number[])[] {
  const matchingCellIndexes = new Set(
    visibleEmitterIdsByCell
      .filter(cell => cell.emitterIds.includes(emitterId))
      .map(cell => cell.cellIndex),
  );

  return collectConnectedPools(pathCellCount, matchingCellIndexes);
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

function renderReagentPoolUnderlays(
  graphics: Phaser.GameObjects.Graphics,
  cells: readonly PathCell[],
  visibleEmitterIdsByCell: readonly { readonly cellIndex: number, readonly emitterIds: readonly EmitterId[] }[],
  visualMs: number,
): void {
  (Object.keys(reagentPoolUnderlayStyles) as ReagentPoolUnderlayEmitterId[]).forEach((emitterId) => {
    getVisibleReagentConnectedPools(visibleEmitterIdsByCell, cells.length, emitterId)
      .filter(pool => pool.length > 1)
      .forEach(pool => drawReagentPoolUnderlay(graphics, cells, pool, emitterId, visualMs));
  });
}

function drawReagentPoolUnderlay(
  graphics: Phaser.GameObjects.Graphics,
  cells: readonly PathCell[],
  pool: readonly number[],
  emitterId: ReagentPoolUnderlayEmitterId,
  visualMs: number,
): void {
  const style = reagentPoolUnderlayStyles[emitterId];
  const poolIndexes = new Set(pool);

  graphics.setDepth(REAGENT_POOL_UNDERLAY_DEPTH);
  [...poolIndexes]
    .sort((left, right) => left - right)
    .forEach((cellIndex) => {
      const nextCellIndex = (cellIndex + 1) % cells.length;
      const fromCell = cells[cellIndex];
      const toCell = cells[nextCellIndex];

      if (!poolIndexes.has(nextCellIndex) || !fromCell || !toCell) {
        return;
      }

      const fromTile = getPathTilePresentation(cells, fromCell);
      const toTile = getPathTilePresentation(cells, toCell);
      const bridgeSize = Math.min(fromTile.effectSize, toTile.effectSize);
      const pulse = Math.sin(visualMs / 210 + cellIndex * 0.61 + nextCellIndex * 0.37);
      const from = { x: fromCell.x, y: fromCell.y };
      const to = { x: toCell.x, y: toCell.y };

      drawCapsule(graphics, from, to, bridgeSize * (style.outerWidthScale + pulse * style.widthPulseScale), style.color, style.alpha);
      drawCapsule(graphics, from, to, bridgeSize * (style.innerWidthScale + pulse * style.widthPulseScale * 0.66), style.color, style.alpha);
    });
}

function drawCapsule(
  graphics: Phaser.GameObjects.Graphics,
  from: { readonly x: number, readonly y: number },
  to: { readonly x: number, readonly y: number },
  width: number,
  color: number,
  alpha: number,
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const radius = width / 2;
  const normalX = -dy / distance * radius;
  const normalY = dx / distance * radius;

  graphics.fillStyle(color, alpha);
  graphics.fillCircle(from.x, from.y, radius);
  graphics.fillCircle(to.x, to.y, radius);
  graphics.beginPath();
  graphics.moveTo(from.x + normalX, from.y + normalY);
  graphics.lineTo(to.x + normalX, to.y + normalY);
  graphics.lineTo(to.x - normalX, to.y - normalY);
  graphics.lineTo(from.x - normalX, from.y - normalY);
  graphics.closePath();
  graphics.fillPath();
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
