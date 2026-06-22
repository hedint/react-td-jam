import type { BoardSlot, GameSnapshot } from "@entities/game-session/model/types";
import type { SlotFeedback } from "./slotPlacementFeedback";
import { gameConfig } from "@entities/game-session/model/config";
import Phaser from "phaser";
import { getSlotFeedback } from "./slotPlacementFeedback";

const LOGICAL_WIDTH = 540;
const LOGICAL_HEIGHT = 960;

export function renderBoardSlots(
  graphics: Phaser.GameObjects.Graphics,
  snapshot: GameSnapshot,
): void {
  const occupiedSlotIds = new Set(snapshot.placedTowers.map(tower => tower.slotId).filter(Boolean));
  const selectedTower = [...snapshot.bench, ...snapshot.placedTowers].find(tower => tower.id === snapshot.selectedTowerId);

  snapshot.board.slots.forEach((slot) => {
    const isOccupied = occupiedSlotIds.has(slot.id);
    const isSelectedSlot = selectedTower?.slotId === slot.id;
    const isBenchSelection = selectedTower ? snapshot.bench.some(tower => tower.id === selectedTower.id) : false;
    const canEditPlacedTowers = snapshot.paused || snapshot.phase === "ready";
    const isValidTarget = selectedTower !== undefined && !slot.locked && (
      isBenchSelection
        ? (!isOccupied || canEditPlacedTowers)
        : canEditPlacedTowers
    );
    const feedback = getSlotFeedback({
      hasSelectedTower: selectedTower !== undefined,
      isSelectedSlot,
      isValidTarget,
      slot,
    });
    const isEmptyValidTarget = feedback === "valid" && !isOccupied;

    const slotRadius = slot.isCorner ? 26 : 22;
    const shouldDrawStateRing = isSelectedSlot || isOccupied || isEmptyValidTarget || slot.locked;

    if (slot.locked) {
      graphics.fillStyle(0x070809, 0.46);
      graphics.fillCircle(slot.x, slot.y, slotRadius);
    }

    if (!shouldDrawStateRing) {
      return;
    }

    if (isEmptyValidTarget && !isSelectedSlot) {
      return;
    }

    graphics.lineStyle(
      isSelectedSlot ? 4 : isOccupied ? 3 : 2,
      getSlotRingColor(feedback, isOccupied),
      getSlotRingAlpha(feedback, isOccupied, isSelectedSlot),
    );
    graphics.strokeCircle(slot.x, slot.y, slotRadius);

    if (isOccupied) {
      graphics.fillStyle(0xC8A76A, 0.18);
      graphics.fillCircle(slot.x, slot.y, slot.isCorner ? 9 : 7);
    }

    if (slot.isCorner) {
      graphics.lineStyle(2, isValidTarget ? 0x6AA99C : 0xC79A55, isValidTarget ? 0.42 : 0.72);
      graphics.beginPath();
      graphics.moveTo(slot.x - 13, slot.y);
      graphics.lineTo(slot.x, slot.y - 13);
      graphics.lineTo(slot.x + 13, slot.y);
      graphics.lineTo(slot.x, slot.y + 13);
      graphics.closePath();
      graphics.strokePath();
    }
  });
}

export function renderPlacementSlotFeedback(
  graphics: Phaser.GameObjects.Graphics,
  snapshot: GameSnapshot,
  visualMs: number,
): void {
  const occupiedSlotIds = new Set(snapshot.placedTowers.map(tower => tower.slotId).filter(Boolean));
  const selectedTower = [...snapshot.bench, ...snapshot.placedTowers].find(tower => tower.id === snapshot.selectedTowerId);

  snapshot.board.slots.forEach((slot) => {
    const isOccupied = occupiedSlotIds.has(slot.id);
    const isSelectedSlot = selectedTower?.slotId === slot.id;
    const isBenchSelection = selectedTower ? snapshot.bench.some(tower => tower.id === selectedTower.id) : false;
    const canEditPlacedTowers = snapshot.paused || snapshot.phase === "ready";
    const isValidTarget = selectedTower !== undefined && !slot.locked && (
      isBenchSelection
        ? (!isOccupied || canEditPlacedTowers)
        : canEditPlacedTowers
    );
    const feedback = getSlotFeedback({
      hasSelectedTower: selectedTower !== undefined,
      isSelectedSlot,
      isValidTarget,
      slot,
    });

    renderSlotFeedback(graphics, slot, isOccupied && feedback === "valid" ? "idle" : feedback, visualMs);
  });
}

export function renderGreatCube(graphics: Phaser.GameObjects.Graphics, snapshot: GameSnapshot): void {
  const center = getBoardCenter(snapshot.board.pathCells);
  const hpRatio = Phaser.Math.Clamp(snapshot.coreHp / gameConfig.balance.coreHp, 0, 1);
  const phaseIntensity = getPhaseIntensity(snapshot.phase);
  const pulse = Math.sin(snapshot.elapsedMs / 180) * 4 * phaseIntensity;
  const glowRadius = 70 + pulse;

  graphics.fillStyle(0x050505, 0.52);
  graphics.fillEllipse(center.x, center.y + 44, 128, 42);
  graphics.fillStyle(0xF08A28, 0.16 + phaseIntensity * 0.08);
  graphics.fillCircle(center.x, center.y, glowRadius);
  graphics.lineStyle(5, 0x7C3E25, 0.45 + phaseIntensity * 0.22);
  graphics.strokeCircle(center.x, center.y, glowRadius + 6);

  graphics.fillStyle(0x21130E, 1);
  graphics.lineStyle(5, 0xF08A28, 0.86);
  graphics.beginPath();
  graphics.moveTo(center.x, center.y - 54);
  graphics.lineTo(center.x + 56, center.y - 22);
  graphics.lineTo(center.x + 48, center.y + 42);
  graphics.lineTo(center.x, center.y + 66);
  graphics.lineTo(center.x - 48, center.y + 42);
  graphics.lineTo(center.x - 56, center.y - 22);
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();

  graphics.fillStyle(0x3A2016, 0.96);
  graphics.beginPath();
  graphics.moveTo(center.x, center.y - 42);
  graphics.lineTo(center.x + 42, center.y - 17);
  graphics.lineTo(center.x, center.y + 6);
  graphics.lineTo(center.x - 42, center.y - 17);
  graphics.closePath();
  graphics.fillPath();
  graphics.fillStyle(0x6D2F18, 0.9);
  graphics.beginPath();
  graphics.moveTo(center.x - 42, center.y - 17);
  graphics.lineTo(center.x, center.y + 6);
  graphics.lineTo(center.x, center.y + 50);
  graphics.lineTo(center.x - 36, center.y + 31);
  graphics.closePath();
  graphics.fillPath();
  graphics.fillStyle(0xA34B20, 0.92);
  graphics.beginPath();
  graphics.moveTo(center.x + 42, center.y - 17);
  graphics.lineTo(center.x, center.y + 6);
  graphics.lineTo(center.x, center.y + 50);
  graphics.lineTo(center.x + 36, center.y + 31);
  graphics.closePath();
  graphics.fillPath();

  graphics.lineStyle(3, 0xFFD58D, 0.62 + phaseIntensity * 0.18);
  graphics.beginPath();
  graphics.moveTo(center.x, center.y - 42);
  graphics.lineTo(center.x, center.y + 50);
  graphics.moveTo(center.x - 42, center.y - 17);
  graphics.lineTo(center.x + 42, center.y - 17);
  graphics.strokePath();

  graphics.fillStyle(0xF08A28, 0.2 + hpRatio * 0.44);
  graphics.fillRoundedRect(center.x - 38, center.y + 72, 76 * hpRatio, 8, 4);
  graphics.lineStyle(2, 0xF3E0B3, 0.72);
  graphics.strokeRoundedRect(center.x - 40, center.y + 70, 80, 12, 5);

  if (hpRatio <= 0.35) {
    graphics.lineStyle(3, 0xE05B3F, 0.92);
    graphics.beginPath();
    graphics.moveTo(center.x - 10, center.y - 28);
    graphics.lineTo(center.x + 3, center.y - 6);
    graphics.lineTo(center.x - 6, center.y + 16);
    graphics.lineTo(center.x + 9, center.y + 38);
    graphics.strokePath();
  }
}

function getBoardCenter(cells: GameSnapshot["board"]["pathCells"]): { readonly x: number, readonly y: number } {
  if (cells.length === 0) {
    return { x: LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT / 2 };
  }

  const bounds = cells.reduce(
    (accumulator, cell) => ({
      minX: Math.min(accumulator.minX, cell.x),
      maxX: Math.max(accumulator.maxX, cell.x),
      minY: Math.min(accumulator.minY, cell.y),
      maxY: Math.max(accumulator.maxY, cell.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );

  return {
    x: Math.round((bounds.minX + bounds.maxX) / 2),
    y: Math.round((bounds.minY + bounds.maxY) / 2),
  };
}

function getPhaseIntensity(phase: GameSnapshot["phase"]): number {
  switch (phase) {
    case "boss":
      return 1.45;
    case "wave":
      return 1.15;
    case "countdown":
      return 1;
    case "defeat":
      return 0.55;
    case "victory":
      return 1.25;
    case "draft":
    case "ready":
      return 0.82;
    default:
      return phase satisfies never;
  }
}

function getSlotRingColor(feedback: SlotFeedback, isOccupied: boolean): number {
  if (isOccupied && feedback !== "selected") {
    return 0xD8C18E;
  }

  switch (feedback) {
    case "selected":
      return 0xF6E27A;
    case "valid":
      return 0xE6B65A;
    case "idle":
      return 0x5F6874;
    default:
      return feedback satisfies never;
  }
}

function getSlotRingAlpha(
  feedback: SlotFeedback,
  isOccupied: boolean,
  isSelectedSlot: boolean,
): number {
  if (feedback === "valid" && !isOccupied) {
    return 0.42;
  }

  if (feedback !== "idle" || isOccupied || isSelectedSlot) {
    return 0.95;
  }

  return 0.62;
}

function renderSlotFeedback(
  graphics: Phaser.GameObjects.Graphics,
  slot: BoardSlot,
  feedback: SlotFeedback,
  visualMs: number,
): void {
  if (feedback === "idle") {
    return;
  }

  const pulse = 1 + Math.sin(visualMs / 110 + slot.x * 0.01 + slot.y * 0.01) * 0.5;
  const radius = slot.isCorner ? 31 : 27;
  const lineAlpha = 0.76 + pulse * 0.18;

  if (feedback === "valid") {
    renderValidSlotGlow(graphics, slot);
    return;
  }

  const color = feedback === "selected" ? 0xF6E27A : 0xC8A76A;

  graphics.fillStyle(color, 0.1);
  graphics.fillCircle(slot.x, slot.y, radius + 2 + pulse);
  graphics.lineStyle(3, color, lineAlpha);
  graphics.strokeCircle(slot.x, slot.y, radius + pulse);
  graphics.lineStyle(1, 0xFFF2C8, 0.72);
  graphics.beginPath();
  graphics.moveTo(slot.x - radius - 4, slot.y);
  graphics.lineTo(slot.x - radius + 6, slot.y);
  graphics.moveTo(slot.x + radius + 4, slot.y);
  graphics.lineTo(slot.x + radius - 6, slot.y);
  graphics.moveTo(slot.x, slot.y - radius - 4);
  graphics.lineTo(slot.x, slot.y - radius + 6);
  graphics.moveTo(slot.x, slot.y + radius + 4);
  graphics.lineTo(slot.x, slot.y + radius - 6);
  graphics.strokePath();
}

function renderValidSlotGlow(graphics: Phaser.GameObjects.Graphics, slot: BoardSlot): void {
  const radius = slot.isCorner ? 24 : 20;

  graphics.fillStyle(0xF0B85B, 0.14);
  graphics.fillCircle(slot.x, slot.y, radius);
}
