import type { BoardSlot, GameSnapshot } from "@entities/game-session/model/types";
import type { SlotFeedback } from "./slotPlacementFeedback";
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

export function getBoardCenter(cells: GameSnapshot["board"]["pathCells"]): { readonly x: number, readonly y: number } {
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
