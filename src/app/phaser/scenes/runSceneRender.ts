import type { BoardSlot, BossState, CellReactionState, EnemyState, PathCell, ReactionId, TowerState } from "@entities/game-session/model/types";
import type Phaser from "phaser";
import { getCoreEntrancePathCell } from "@entities/game-session/model/boardGeometry";
import { gameConfig } from "@entities/game-session/model/config";
import { getEnemyLeakTargetPresentation, getEntranceMarkerPresentation } from "./runSceneBoardArt";

export interface RenderPoint {
  x: number
  y: number
}

export type EnemySideFacing = "left" | "right";

export function writeEnemyPosition(cells: readonly PathCell[], enemy: EnemyState, out: RenderPoint): RenderPoint {
  return writePathProgressPosition(cells, enemy.pathProgress, out);
}

export function writePathProgressPosition(cells: readonly PathCell[], pathProgress: number, out: RenderPoint): RenderPoint {
  const coreEntranceCell = getCoreEntrancePathCell(cells);
  const leakTarget = getEnemyLeakTargetPresentation(cells);

  if (coreEntranceCell && leakTarget && pathProgress >= coreEntranceCell.index) {
    const amount = clamp(pathProgress - coreEntranceCell.index, 0, 1);

    out.x = linear(coreEntranceCell.x, leakTarget.x, amount);
    out.y = linear(coreEntranceCell.y, leakTarget.y, amount);

    return out;
  }

  const currentIndex = Math.floor(pathProgress) % cells.length;
  const nextIndex = (currentIndex + 1) % cells.length;
  const current = cells[currentIndex] ?? cells[0];
  const next = cells[nextIndex] ?? current;
  const amount = pathProgress - Math.floor(pathProgress);

  out.x = linear(current.x, next.x, amount);
  out.y = linear(current.y, next.y, amount);

  return out;
}

export function getEnemySideFacing(cells: readonly PathCell[], pathProgress: number): EnemySideFacing {
  if (cells.length < 2) {
    return "right";
  }

  const normalizedProgress = ((pathProgress % cells.length) + cells.length) % cells.length;
  const currentIndex = Math.floor(normalizedProgress) % cells.length;

  for (let offset = 0; offset < cells.length; offset += 1) {
    const from = cells[(currentIndex + offset) % cells.length] ?? cells[0];
    const to = cells[(currentIndex + offset + 1) % cells.length] ?? from;
    const deltaX = to.x - from.x;

    if (Math.abs(deltaX) > 1) {
      return deltaX < 0 ? "left" : "right";
    }
  }

  return "right";
}

export function writeBossPosition(cells: readonly PathCell[], boss: BossState, out: RenderPoint): RenderPoint {
  const pathProgress = boss.pathProgress % cells.length;
  const currentIndex = Math.floor(pathProgress) % cells.length;
  const nextIndex = (currentIndex + 1) % cells.length;
  const current = cells[currentIndex] ?? cells[0];
  const next = cells[nextIndex] ?? current;
  const amount = pathProgress - Math.floor(pathProgress);

  out.x = linear(current.x, next.x, amount);
  out.y = linear(current.y, next.y, amount);

  return out;
}

export function writeEnemyIntroPosition(
  cells: readonly PathCell[],
  enemy: EnemyState,
  introProgress: number,
  out: RenderPoint,
): RenderPoint {
  writeEnemyPosition(cells, enemy, out);

  return writeIntroPosition(cells, introProgress, out);
}

export function writeBossIntroPosition(
  cells: readonly PathCell[],
  boss: BossState,
  introProgress: number,
  out: RenderPoint,
): RenderPoint {
  writeBossPosition(cells, boss, out);

  return writeIntroPosition(cells, introProgress, out);
}

export function writeTowerPosition(tower: TowerState, slots: readonly BoardSlot[], out: RenderPoint): RenderPoint {
  const slot = slots.find(candidate => candidate.id === tower.slotId);

  out.x = slot?.x ?? 0;
  out.y = slot?.y ?? 0;

  return out;
}

function writeIntroPosition(cells: readonly PathCell[], introProgress: number, out: RenderPoint): RenderPoint {
  const entrance = getEntranceMarkerPresentation(cells);

  if (!entrance) {
    return out;
  }

  const targetX = out.x;
  const targetY = out.y;
  const easedProgress = sineOut(clamp(introProgress, 0, 1));

  out.x = linear(entrance.x, targetX, easedProgress);
  out.y = linear(entrance.y, targetY, easedProgress);

  return out;
}

export function findSlotAtPoint(slots: readonly BoardSlot[], x: number, y: number): BoardSlot | undefined {
  return slots.find(slot => distanceBetween(slot.x, slot.y, x, y) <= 24);
}

function linear(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function distanceBetween(leftX: number, leftY: number, rightX: number, rightY: number): number {
  return Math.hypot(rightX - leftX, rightY - leftY);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sineOut(value: number): number {
  return Math.sin(value * Math.PI / 2);
}

export function renderGroundReaction(
  graphics: Phaser.GameObjects.Graphics,
  cell: PathCell,
  reactionId: ReactionId,
  pulse: number,
): void {
  switch (reactionId) {
    case "electroPuddle":
      break;
    case "fire":
      graphics.fillStyle(0xA53716, 0.62);
      graphics.fillEllipse(cell.x, cell.y + 7, 82 + pulse, 42 + pulse);
      graphics.lineStyle(3, 0xFFB15E, 0.92);
      graphics.strokeEllipse(cell.x, cell.y + 7, 82 + pulse, 42 + pulse);
      graphics.lineStyle(2, 0x4A160C, 0.72);
      graphics.beginPath();
      graphics.moveTo(cell.x - 28, cell.y + 16);
      graphics.lineTo(cell.x - 10, cell.y + 8);
      graphics.lineTo(cell.x + 6, cell.y + 18);
      graphics.lineTo(cell.x + 28, cell.y + 8);
      graphics.strokePath();
      graphics.fillStyle(0xFFDB77, 0.86);
      graphics.beginPath();
      graphics.moveTo(cell.x - 16, cell.y + 16);
      graphics.lineTo(cell.x - 3, cell.y - 16 - pulse);
      graphics.lineTo(cell.x + 9, cell.y + 14);
      graphics.lineTo(cell.x + 20, cell.y - 5);
      graphics.lineTo(cell.x + 24, cell.y + 18);
      graphics.closePath();
      graphics.fillPath();
      break;
    default:
      break;
  }
}

export function renderAirReaction(
  graphics: Phaser.GameObjects.Graphics,
  cell: PathCell,
  reactionId: ReactionId,
  pulse: number,
  elapsedMs: number,
): void {
  const y = cell.y - 42;

  switch (reactionId) {
    case "steam":
      graphics.fillStyle(0xD7EFF0, 0.44);
      graphics.fillCircle(cell.x - 18, y + 2, 18 + pulse);
      graphics.fillCircle(cell.x + 2, y - 8, 22 + pulse);
      graphics.fillCircle(cell.x + 23, y + 4, 16 + pulse);
      graphics.lineStyle(2, 0xFFFFFF, 0.62);
      graphics.strokeEllipse(cell.x, y + 4, 76 + pulse, 34 + pulse);
      graphics.lineStyle(2, 0xFFFFFF, 0.5);
      graphics.beginPath();
      graphics.moveTo(cell.x - 18, y + 24);
      graphics.lineTo(cell.x - 25, y + 12);
      graphics.lineTo(cell.x - 16, y - 2);
      graphics.moveTo(cell.x + 4, y + 26);
      graphics.lineTo(cell.x - 5, y + 8);
      graphics.lineTo(cell.x + 8, y - 10);
      graphics.moveTo(cell.x + 24, y + 23);
      graphics.lineTo(cell.x + 17, y + 9);
      graphics.lineTo(cell.x + 28, y);
      graphics.strokePath();
      break;
    case "stormCloud":
      graphics.fillStyle(0x284E64, 0.74);
      graphics.fillCircle(cell.x - 20, y, 21 + pulse);
      graphics.fillCircle(cell.x + 4, y - 9, 25 + pulse);
      graphics.fillCircle(cell.x + 28, y + 2, 18 + pulse);
      graphics.lineStyle(2, 0xC4ECFF, 0.48);
      graphics.beginPath();
      graphics.moveTo(cell.x - 28, y + 19);
      graphics.lineTo(cell.x - 33, y + 35);
      graphics.moveTo(cell.x + 16, y + 19);
      graphics.lineTo(cell.x + 10, y + 37);
      graphics.moveTo(cell.x + 34, y + 16);
      graphics.lineTo(cell.x + 30, y + 31);
      graphics.strokePath();
      graphics.lineStyle(3, 0x9FF7FF, 0.92);
      graphics.beginPath();
      graphics.moveTo(cell.x - 4, y + 12);
      graphics.lineTo(cell.x - 15, y + 34);
      graphics.lineTo(cell.x + 1, y + 29);
      graphics.lineTo(cell.x - 8, y + 50);
      graphics.strokePath();
      break;
    case "fireVortex": {
      const spin = elapsedMs / 130 + cell.index;

      graphics.lineStyle(5, 0xFF813D, 0.88);
      graphics.strokeCircle(cell.x, y + 8, 24 + pulse);
      graphics.lineStyle(2, 0x7A2418, 0.68);
      graphics.strokeCircle(cell.x, y + 8, 12 + pulse / 2);
      graphics.lineStyle(3, 0xFFE0A0, 0.84);
      graphics.beginPath();
      graphics.moveTo(cell.x + Math.cos(spin) * 32, y + 8 + Math.sin(spin) * 12);
      graphics.lineTo(cell.x + Math.cos(spin + 2.1) * 20, y + 8 + Math.sin(spin + 2.1) * 24);
      graphics.lineTo(cell.x + Math.cos(spin + 4.2) * 8, y + 8 + Math.sin(spin + 4.2) * 10);
      graphics.strokePath();
      break;
    }
    case "fireStorm":
      graphics.fillStyle(0x4B183F, 0.5);
      graphics.fillCircle(cell.x, y + 8, 42 + pulse);
      graphics.lineStyle(5, 0xFFCD62, 0.95);
      graphics.strokeCircle(cell.x, y + 8, 42 + pulse);
      graphics.lineStyle(3, 0x9FF7FF, 0.92);
      graphics.strokeCircle(cell.x, y + 8, 24 + pulse);
      graphics.lineStyle(2, 0xFFFFFF, 0.86);
      graphics.beginPath();
      graphics.moveTo(cell.x - 9, y - 24);
      graphics.lineTo(cell.x - 18, y - 2);
      graphics.lineTo(cell.x - 4, y - 8);
      graphics.lineTo(cell.x - 12, y + 18);
      graphics.moveTo(cell.x + 17, y - 17);
      graphics.lineTo(cell.x + 3, y + 5);
      graphics.lineTo(cell.x + 19, y);
      graphics.lineTo(cell.x + 8, y + 24);
      graphics.strokePath();
      graphics.fillStyle(0xFFFFFF, 0.9);
      graphics.fillCircle(cell.x, y + 8, 5 + pulse / 2);
      break;
    default:
      break;
  }
}

export function getActiveReactionLabel(reactions: readonly CellReactionState[]): string {
  const reactionIds = new Set<ReactionId>();

  reactions.forEach((reaction) => {
    if (reaction.ground) {
      reactionIds.add(reaction.ground);
    }

    if (reaction.air) {
      reactionIds.add(reaction.air);
    }
  });

  return [...reactionIds]
    .map(reactionId => gameConfig.reactions.find(reaction => reaction.id === reactionId))
    .filter(reaction => reaction !== undefined)
    .sort((left, right) => right.tier - left.tier || right.dps - left.dps)
    .map(reaction => reaction.displayName)
    .map((displayName, index, names) => index === 0 && names.length > 1 ? `${displayName} +${names.length - 1}` : displayName)[0] ?? "";
}
