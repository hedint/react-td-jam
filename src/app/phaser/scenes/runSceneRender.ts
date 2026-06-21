import type { BoardSlot, CellReactionState, EnemyState, PathCell, ReactionId, TowerState } from "@entities/game-session/model/types";
import { gameConfig } from "@entities/game-session/model/config";
import Phaser from "phaser";

export function getEnemyPosition(cells: readonly PathCell[], enemy: EnemyState): Phaser.Math.Vector2 {
  const currentIndex = Math.floor(enemy.pathProgress) % cells.length;
  const nextIndex = (currentIndex + 1) % cells.length;
  const current = cells[currentIndex] ?? cells[0];
  const next = cells[nextIndex] ?? current;
  const amount = enemy.pathProgress - Math.floor(enemy.pathProgress);

  return new Phaser.Math.Vector2(
    Phaser.Math.Linear(current.x, next.x, amount),
    Phaser.Math.Linear(current.y, next.y, amount),
  );
}

export function getTowerPosition(tower: TowerState, slots: readonly BoardSlot[]): Phaser.Math.Vector2 {
  const slot = slots.find(candidate => candidate.id === tower.slotId);

  return new Phaser.Math.Vector2(slot?.x ?? 0, slot?.y ?? 0);
}

export function findSlotAtPoint(slots: readonly BoardSlot[], x: number, y: number): BoardSlot | undefined {
  return slots.find(slot => Phaser.Math.Distance.Between(slot.x, slot.y, x, y) <= 24);
}

export function getEnemyVisual(enemyId: EnemyState["enemyId"]): {
  readonly fill: number
  readonly stroke: number
  readonly radius: number
  readonly shape: "circle" | "diamond" | "wing"
} {
  switch (enemyId) {
    case "grunt":
      return { fill: 0x715640, stroke: 0xE6D3A5, radius: 18, shape: "circle" };
    case "swarm":
      return { fill: 0x5A6B3A, stroke: 0xD6E88D, radius: 13, shape: "circle" };
    case "tank":
      return { fill: 0x5B5148, stroke: 0xF0D7A0, radius: 24, shape: "diamond" };
    case "flyer":
      return { fill: 0x475D85, stroke: 0xB9D5FF, radius: 18, shape: "wing" };
    case "runner":
      return { fill: 0x7E6432, stroke: 0xFFD06E, radius: 15, shape: "circle" };
    case "insulated":
      return { fill: 0x6C6755, stroke: 0xE0D7B6, radius: 20, shape: "diamond" };
    case "flameproof":
      return { fill: 0x743325, stroke: 0xFFB178, radius: 20, shape: "diamond" };
    default:
      return enemyId satisfies never;
  }
}

export function getTowerColors(emitterId: TowerState["emitterId"]): { readonly fill: number, readonly stroke: number } {
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

export function renderGroundReaction(
  graphics: Phaser.GameObjects.Graphics,
  cell: PathCell,
  reactionId: ReactionId,
  pulse: number,
): void {
  switch (reactionId) {
    case "electroPuddle":
      graphics.fillStyle(0x1B9BD0, 0.58);
      graphics.fillEllipse(cell.x, cell.y + 6, 78 + pulse, 38 + pulse);
      graphics.lineStyle(3, 0x9FF7FF, 0.9);
      graphics.strokeEllipse(cell.x, cell.y + 6, 78 + pulse, 38 + pulse);
      graphics.lineStyle(2, 0xE9FFFF, 0.9);
      graphics.beginPath();
      graphics.moveTo(cell.x - 22, cell.y + 2);
      graphics.lineTo(cell.x - 6, cell.y - 8);
      graphics.lineTo(cell.x + 2, cell.y + 4);
      graphics.lineTo(cell.x + 20, cell.y - 6);
      graphics.strokePath();
      break;
    case "fire":
      graphics.fillStyle(0xA53716, 0.62);
      graphics.fillEllipse(cell.x, cell.y + 7, 82 + pulse, 42 + pulse);
      graphics.lineStyle(3, 0xFFB15E, 0.92);
      graphics.strokeEllipse(cell.x, cell.y + 7, 82 + pulse, 42 + pulse);
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
      break;
    case "stormCloud":
      graphics.fillStyle(0x284E64, 0.74);
      graphics.fillCircle(cell.x - 20, y, 21 + pulse);
      graphics.fillCircle(cell.x + 4, y - 9, 25 + pulse);
      graphics.fillCircle(cell.x + 28, y + 2, 18 + pulse);
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
