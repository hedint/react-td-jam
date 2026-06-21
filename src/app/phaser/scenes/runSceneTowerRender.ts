import type { BoardSlot, TowerState } from "@entities/game-session/model/types";
import type Phaser from "phaser";
import type { RenderPoint } from "./runSceneRender";
import { assetGroups } from "@shared/assets/manifest";

export function getTowerFieldLabel(emitterId: TowerState["emitterId"]): string {
  switch (emitterId) {
    case "water":
      return "Вода";
    case "oil":
      return "Нефть";
    case "spark":
      return "Искра";
    case "heat":
      return "Жар";
    default:
      return emitterId satisfies never;
  }
}

export function getTowerSpriteKey(emitterId: TowerState["emitterId"]): string {
  switch (emitterId) {
    case "water":
      return assetGroups.towers.waterCannon.key;
    case "oil":
      return assetGroups.towers.oilPump.key;
    case "spark":
      return assetGroups.towers.sparkDischarger.key;
    case "heat":
      return assetGroups.towers.magmaCrane.key;
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

export function renderTowerActivationFeedback(
  graphics: Phaser.GameObjects.Graphics,
  tower: TowerState,
  slot: BoardSlot,
  position: RenderPoint,
  active: boolean,
  visualMs: number,
): void {
  if (!active) {
    return;
  }

  const phase = visualMs / 100 + position.x * 0.01 + position.y * 0.01;
  const pulse = 1 + Math.sin(phase) * 0.5;

  switch (tower.emitterId) {
    case "water":
      graphics.lineStyle(3, 0x9DDCFF, 0.54 + pulse * 0.2);
      graphics.beginPath();
      graphics.moveTo(position.x + 14, position.y - 8);
      graphics.lineTo(position.x + 26 + pulse * 4, position.y - 13);
      graphics.moveTo(position.x + 7, position.y + 2);
      graphics.lineTo(position.x + 23 + pulse * 3, position.y + 4);
      graphics.strokePath();
      graphics.fillStyle(0xD7EFF0, 0.26);
      graphics.fillCircle(position.x - 16, position.y - 17, 8 + pulse * 2);
      break;
    case "oil":
      graphics.fillStyle(0x070604, 0.34);
      graphics.fillEllipse(position.x + 15, position.y + 12, 18 + pulse * 4, 7 + pulse);
      graphics.lineStyle(2, 0xA8844F, 0.54);
      graphics.beginPath();
      graphics.moveTo(position.x - 20, position.y + 4);
      graphics.lineTo(position.x - 29 - pulse * 2, position.y + 10);
      graphics.strokePath();
      break;
    case "spark":
      graphics.lineStyle(2, 0x9FF7FF, 0.78);
      graphics.beginPath();
      graphics.moveTo(position.x - 21, position.y - 27);
      graphics.lineTo(position.x - 9, position.y - 37 - pulse * 3);
      graphics.lineTo(position.x + 2, position.y - 25);
      graphics.lineTo(position.x + 18, position.y - 34 - pulse * 2);
      graphics.strokePath();
      graphics.fillStyle(0x61D6D6, 0.12);
      graphics.fillCircle(position.x, position.y - 18, 26 + pulse * 3);
      break;
    case "heat":
      graphics.fillStyle(0xF08A28, 0.12 + pulse * 0.04);
      graphics.fillCircle(position.x, position.y - 7, slot.lane === "inner" ? 28 : 32);
      graphics.lineStyle(3, 0xFFB05B, 0.54 + pulse * 0.16);
      graphics.strokeCircle(position.x, position.y - 4, 18 + pulse * 4);
      graphics.lineStyle(2, 0xFFE0A0, 0.42);
      graphics.beginPath();
      graphics.moveTo(position.x - 14, position.y - 24);
      graphics.lineTo(position.x - 10, position.y - 35 - pulse * 4);
      graphics.moveTo(position.x + 7, position.y - 21);
      graphics.lineTo(position.x + 12, position.y - 34 - pulse * 3);
      graphics.strokePath();
      break;
    default:
      return tower.emitterId satisfies never;
  }
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
