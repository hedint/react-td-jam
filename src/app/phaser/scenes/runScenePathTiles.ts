import type { PathCell } from "@entities/game-session/model/types";
import type Phaser from "phaser";

const FALLBACK_TILE_SIZE = 76;

export interface PathTilePresentation {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly effectSize: number
  readonly rotation: number
}

export function getPathTilePresentation(cells: readonly PathCell[], cell: PathCell): PathTilePresentation {
  const previous = cells[(cell.index - 1 + cells.length) % cells.length];
  const next = cells[(cell.index + 1) % cells.length];
  const segment = next && distance(cell, next) > 0 ? next : previous;

  if (!segment) {
    return {
      x: cell.x,
      y: cell.y,
      width: FALLBACK_TILE_SIZE,
      height: FALLBACK_TILE_SIZE,
      effectSize: FALLBACK_TILE_SIZE,
      rotation: 0,
    };
  }

  const segmentDistance = distance(cell, segment);

  return {
    x: cell.x,
    y: cell.y,
    width: segmentDistance,
    height: segmentDistance,
    effectSize: segmentDistance,
    rotation: Math.atan2(segment.y - cell.y, segment.x - cell.x),
  };
}

export function drawPathTile(
  graphics: Phaser.GameObjects.Graphics,
  tile: PathTilePresentation,
  style: {
    readonly fillColor?: number
    readonly fillAlpha?: number
    readonly strokeColor?: number
    readonly strokeAlpha?: number
    readonly strokeWidth?: number
  },
): void {
  const corners = getRotatedRectCorners(tile);
  const fillAlpha = style.fillAlpha ?? 0;
  const strokeAlpha = style.strokeAlpha ?? 0;
  const strokeWidth = style.strokeWidth ?? 0;

  if (style.fillColor !== undefined && fillAlpha > 0) {
    graphics.fillStyle(style.fillColor, fillAlpha);
    graphics.beginPath();
    graphics.moveTo(corners[0].x, corners[0].y);
    corners.slice(1).forEach(corner => graphics.lineTo(corner.x, corner.y));
    graphics.closePath();
    graphics.fillPath();
  }

  if (style.strokeColor !== undefined && strokeAlpha > 0 && strokeWidth > 0) {
    graphics.lineStyle(strokeWidth, style.strokeColor, strokeAlpha);
    graphics.beginPath();
    graphics.moveTo(corners[0].x, corners[0].y);
    corners.slice(1).forEach(corner => graphics.lineTo(corner.x, corner.y));
    graphics.closePath();
    graphics.strokePath();
  }
}

function getRotatedRectCorners(tile: PathTilePresentation): readonly { readonly x: number, readonly y: number }[] {
  const halfWidth = tile.width / 2;
  const halfHeight = tile.height / 2;
  const cos = Math.cos(tile.rotation);
  const sin = Math.sin(tile.rotation);
  const localCorners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ];

  return localCorners.map(corner => ({
    x: tile.x + corner.x * cos - corner.y * sin,
    y: tile.y + corner.x * sin + corner.y * cos,
  }));
}

function distance(left: PathCell, right: PathCell): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}
