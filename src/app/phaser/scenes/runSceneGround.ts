import type { BoardState } from "@entities/game-session/model/types";
import type Phaser from "phaser";
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from "./runSceneLayout";

const ARENA_PADDING = 34;
const ARENA_RADIUS = 38;
const VIGNETTE_STEPS = 6;
const VIGNETTE_BAND = 30;

export interface ArenaFootprint {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly radius: number
}

export function getArenaFootprint(board: BoardState): ArenaFootprint {
  const points = [...board.slots, ...board.pathCells];

  if (points.length === 0) {
    return { x: 0, y: 0, width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT, radius: ARENA_RADIUS };
  }

  const bounds = points.reduce(
    (accumulator, point) => ({
      minX: Math.min(accumulator.minX, point.x),
      maxX: Math.max(accumulator.maxX, point.x),
      minY: Math.min(accumulator.minY, point.y),
      maxY: Math.max(accumulator.maxY, point.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );

  return {
    x: Math.round(bounds.minX - ARENA_PADDING),
    y: Math.round(bounds.minY - ARENA_PADDING),
    width: Math.round(bounds.maxX - bounds.minX + ARENA_PADDING * 2),
    height: Math.round(bounds.maxY - bounds.minY + ARENA_PADDING * 2),
    radius: ARENA_RADIUS,
  };
}

export function renderSceneGrounding(graphics: Phaser.GameObjects.Graphics, board: BoardState): void {
  graphics.clear();

  const footprint = getArenaFootprint(board);

  graphics.fillStyle(0x0A0806, 0.24);
  graphics.fillRoundedRect(
    footprint.x - 10,
    footprint.y - 4,
    footprint.width + 20,
    footprint.height + 22,
    footprint.radius + 8,
  );

  graphics.fillStyle(0x171210, 0.26);
  graphics.fillRoundedRect(footprint.x, footprint.y, footprint.width, footprint.height, footprint.radius);

  graphics.lineStyle(3, 0x05040A, 0.55);
  graphics.strokeRoundedRect(footprint.x, footprint.y, footprint.width, footprint.height, footprint.radius);
  graphics.lineStyle(2, 0x3A2E22, 0.22);
  graphics.strokeRoundedRect(
    footprint.x + 4,
    footprint.y + 4,
    footprint.width - 8,
    footprint.height - 8,
    Math.max(footprint.radius - 4, 0),
  );

  renderEdgeVignette(graphics);
}

function renderEdgeVignette(graphics: Phaser.GameObjects.Graphics): void {
  for (let step = 0; step < VIGNETTE_STEPS; step++) {
    const inset = Math.round(step * VIGNETTE_BAND * 0.6);
    const alpha = 0.34 * (1 - step / VIGNETTE_STEPS);

    graphics.lineStyle(VIGNETTE_BAND, 0x05060A, alpha);
    graphics.strokeRoundedRect(inset, inset, LOGICAL_WIDTH - inset * 2, LOGICAL_HEIGHT - inset * 2, 30);
  }
}
