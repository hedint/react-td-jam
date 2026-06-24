import type { BoardSlot, PathCell, TowerState } from "@entities/game-session/model/types";
import type Phaser from "phaser";
import type { RenderPoint } from "./runSceneRender";
import { assetGroups } from "@shared/assets/manifest";
import { ru } from "@shared/i18n/ru";

export type TowerDirection = "up" | "upRight" | "right" | "downRight" | "down" | "downLeft" | "left" | "upLeft";

export interface TowerSpriteRenderConfig {
  readonly baseKey: string
  readonly headKey: string
  readonly headOriginX: number
  readonly directions: readonly TowerDirection[]
}

export const TOWER_HEAD_ORIGIN_Y = 0.5;

const TOWER_HEAD_ORIGIN_X: Record<TowerState["emitterId"], number> = {
  water: 0.31,
  oil: 0.31,
  spark: 0.3,
  heat: 0.31,
};

const DIRECTION_ROTATION: Record<TowerDirection, number> = {
  up: -Math.PI / 2,
  upRight: -Math.PI / 4,
  right: 0,
  downRight: Math.PI / 4,
  down: Math.PI / 2,
  downLeft: Math.PI * 3 / 4,
  left: Math.PI,
  upLeft: -Math.PI * 3 / 4,
};
const TOWER_HEAD_SWAY_AMPLITUDE = 0.055;

export function getTowerFieldLabel(emitterId: TowerState["emitterId"]): string {
  return ru.phaser.towerFields[emitterId];
}

export function getTowerSpriteRenderConfig(
  tower: TowerState,
  slot: BoardSlot,
  cells: readonly PathCell[],
): TowerSpriteRenderConfig {
  const directions = getTowerDirections(slot, cells);

  return {
    baseKey: getTowerBaseSpriteKey(tower.emitterId),
    headKey: getTowerHeadSpriteKey(tower.emitterId),
    headOriginX: TOWER_HEAD_ORIGIN_X[tower.emitterId],
    directions,
  };
}

export function getTowerDirections(slot: BoardSlot, cells: readonly PathCell[]): readonly TowerDirection[] {
  if (slot.isCorner) {
    return getCornerTowerDirections(slot, cells);
  }

  return [getDirectionFromSlotToCell(slot, cells[slot.cellIndexes[0] ?? 0])];
}

export function getTowerDirectionRotation(direction: TowerDirection): number {
  return DIRECTION_ROTATION[direction];
}

export function getTowerHeadSwayRotation(
  tower: TowerState,
  slot: BoardSlot,
  directionIndex: number,
  visualMs: number,
): number {
  const phase = visualMs / 520 + slot.x * 0.017 + slot.y * 0.011 + tower.id.length * 0.19 + directionIndex * Math.PI;

  return Math.sin(phase) * TOWER_HEAD_SWAY_AMPLITUDE;
}

function getTowerBaseSpriteKey(emitterId: TowerState["emitterId"]): string {
  switch (emitterId) {
    case "water":
      return assetGroups.towers.waterCannonBase.key;
    case "oil":
      return assetGroups.towers.oilPumpBase.key;
    case "spark":
      return assetGroups.towers.sparkDischargerBase.key;
    case "heat":
      return assetGroups.towers.magmaCraneBase.key;
    default:
      return emitterId satisfies never;
  }
}

function getTowerHeadSpriteKey(emitterId: TowerState["emitterId"]): string {
  switch (emitterId) {
    case "water":
      return assetGroups.towers.waterCannonHead.key;
    case "oil":
      return assetGroups.towers.oilPumpHead.key;
    case "spark":
      return assetGroups.towers.sparkDischargerHead.key;
    case "heat":
      return assetGroups.towers.magmaCraneHead.key;
    default:
      return emitterId satisfies never;
  }
}

export function getTowerSpriteSize(slot: BoardSlot): number {
  if (slot.lane === "inner") {
    return slot.isCorner ? 70 : 66;
  }

  return slot.isCorner ? 78 : 74;
}

export function renderTowerGrounding(
  graphics: Phaser.GameObjects.Graphics,
  tower: TowerState,
  slot: BoardSlot,
  position: RenderPoint,
  selected: boolean,
  visualMs: number,
): void {
  const colors = getTowerColors(tower.emitterId);
  const pulse = 1 + Math.sin(visualMs / 130 + position.x * 0.02) * 0.5;
  const shadowWidth = slot.lane === "inner" ? 48 : 56;
  const shadowHeight = slot.lane === "inner" ? 18 : 21;

  graphics.fillStyle(0x050505, 0.5);
  graphics.fillEllipse(position.x, position.y + 14, shadowWidth, shadowHeight);
  graphics.fillStyle(0x151414, 0.92);
  graphics.fillEllipse(position.x, position.y + 8, shadowWidth * 0.78, shadowHeight * 0.62);
  graphics.lineStyle(2, colors.stroke, selected ? 0.82 : 0.38);
  graphics.strokeEllipse(position.x, position.y + 8, shadowWidth * 0.72, shadowHeight * 0.56);

  if (selected) {
    graphics.fillStyle(0xF6E27A, 0.12);
    graphics.fillCircle(position.x, position.y, 31 + pulse * 2);
    graphics.lineStyle(3, 0xF6E27A, 0.86);
    graphics.strokeCircle(position.x, position.y, 29 + pulse);
    graphics.lineStyle(1, 0xFFF8D6, 0.64);
    graphics.strokeCircle(position.x, position.y, 35 + pulse);
  }
}

function getCornerTowerDirections(slot: BoardSlot, cells: readonly PathCell[]): readonly TowerDirection[] {
  if (slot.cellIndexes.length > 1) {
    return uniqueDirections(slot.cellIndexes.map(cellIndex => getCardinalDirectionFromSlotToCell(slot, cells[cellIndex])));
  }

  if (slot.lane === "outer") {
    return [getDirectionFromSlotToCell(slot, cells[slot.cellIndexes[0] ?? 0])];
  }

  const cornerCellIndex = slot.cellIndexes[0] ?? 0;
  const cornerCell = cells[cornerCellIndex];
  const previousCell = cells[(cornerCellIndex - 1 + cells.length) % cells.length];
  const nextCell = cells[(cornerCellIndex + 1) % cells.length];

  if (!cornerCell || !previousCell || !nextCell) {
    return ["right", "up"];
  }

  return uniqueDirections([
    getCardinalDirection(previousCell.x - cornerCell.x, previousCell.y - cornerCell.y),
    getCardinalDirection(nextCell.x - cornerCell.x, nextCell.y - cornerCell.y),
  ]);
}

function getDirectionFromSlotToCell(slot: BoardSlot, cell: PathCell | undefined): TowerDirection {
  if (!cell) {
    return "right";
  }

  return getCompassDirection(cell.x - slot.x, cell.y - slot.y);
}

function getCardinalDirectionFromSlotToCell(slot: BoardSlot, cell: PathCell | undefined): TowerDirection {
  if (!cell) {
    return "right";
  }

  return getCardinalDirection(cell.x - slot.x, cell.y - slot.y);
}

function getCardinalDirection(x: number, y: number): TowerDirection {
  if (Math.abs(x) >= Math.abs(y)) {
    return x < 0 ? "left" : "right";
  }

  return y < 0 ? "up" : "down";
}

function getCompassDirection(x: number, y: number): TowerDirection {
  const horizontal = Math.abs(x) > 0 ? x < 0 ? "left" : "right" : "";
  const vertical = Math.abs(y) > 0 ? y < 0 ? "up" : "down" : "";

  if (horizontal && vertical) {
    return `${vertical}${capitalizeDirectionPart(horizontal)}` as TowerDirection;
  }

  return (horizontal || vertical || "right") as TowerDirection;
}

function uniqueDirections(directions: readonly TowerDirection[]): readonly TowerDirection[] {
  const unique = [...new Set(directions)];

  return unique.length > 1 ? unique : [unique[0] ?? "right", rotateDirection(unique[0] ?? "right")];
}

function rotateDirection(direction: TowerDirection): TowerDirection {
  switch (direction) {
    case "up":
      return "right";
    case "upRight":
      return "downRight";
    case "right":
      return "down";
    case "downRight":
      return "downLeft";
    case "down":
      return "left";
    case "downLeft":
      return "upLeft";
    case "left":
      return "up";
    case "upLeft":
      return "upRight";
    default:
      return direction satisfies never;
  }
}

function capitalizeDirectionPart(part: "left" | "right"): "Left" | "Right" {
  return part === "left" ? "Left" : "Right";
}

function getTowerColors(emitterId: TowerState["emitterId"]): { readonly fill: number, readonly stroke: number } {
  switch (emitterId) {
    case "water":
      return { fill: 0x287BB8, stroke: 0x9DDCFF };
    case "oil":
      return { fill: 0x2E2A1F, stroke: 0xA8844F };
    case "spark":
      return { fill: 0xF3C24D, stroke: 0xFFF1A8 };
    case "heat":
      return { fill: 0xC84C26, stroke: 0xFFB05B };
    default:
      return emitterId satisfies never;
  }
}
