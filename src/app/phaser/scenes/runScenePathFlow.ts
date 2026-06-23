import type { GameSnapshot, PathCell } from "@entities/game-session/model/types";
import type Phaser from "phaser";
import { getCoreEntrancePathCell } from "@entities/game-session/model/boardGeometry";
import { getEnemyLeakTargetPresentation } from "./runSceneBoardArt";
import { getPathTilePresentation } from "./runScenePathTiles";

const CHEVRON_COLOR = 0xF0B85B;
const CHEVRON_COUNT = 2;
const CHEVRON_GAP = 6;
const CHEVRON_ARM = 5;
const CHEVRON_DEPTH = 5;
const CHEVRON_BASE_ALPHA = 0.12;
const CHEVRON_PULSE_ALPHA = 0.3;

export interface PathChevronPresentation {
  readonly x: number
  readonly y: number
  readonly rotation: number
  readonly alpha: number
}

export function getPathChevronPresentation(
  cells: readonly PathCell[],
  cell: PathCell,
  visualMs: number,
): PathChevronPresentation {
  const wave = (Math.sin(visualMs / 300 - cell.index * 0.5) + 1) / 2;
  const coreEntranceCell = getCoreEntrancePathCell(cells);
  const leakTarget = getEnemyLeakTargetPresentation(cells);
  const rotation = coreEntranceCell?.index === cell.index && leakTarget
    ? Math.atan2(leakTarget.y - cell.y, leakTarget.x - cell.x)
    : getPathTilePresentation(cells, cell).rotation;

  return {
    x: cell.x,
    y: cell.y,
    rotation,
    alpha: CHEVRON_BASE_ALPHA + wave * CHEVRON_PULSE_ALPHA,
  };
}

export function renderPathFlow(
  graphics: Phaser.GameObjects.Graphics,
  snapshot: GameSnapshot,
  visualMs: number,
): void {
  const cells = snapshot.board.pathCells;

  cells.forEach((cell) => {
    drawChevron(graphics, getPathChevronPresentation(cells, cell, visualMs));
  });
}

function drawChevron(graphics: Phaser.GameObjects.Graphics, chevron: PathChevronPresentation): void {
  const cos = Math.cos(chevron.rotation);
  const sin = Math.sin(chevron.rotation);
  const project = (localX: number, localY: number): { readonly x: number, readonly y: number } => ({
    x: chevron.x + localX * cos - localY * sin,
    y: chevron.y + localX * sin + localY * cos,
  });

  graphics.lineStyle(2, CHEVRON_COLOR, chevron.alpha);

  for (let index = 0; index < CHEVRON_COUNT; index++) {
    const offset = (index - (CHEVRON_COUNT - 1) / 2) * CHEVRON_GAP;
    const tip = project(offset + CHEVRON_DEPTH / 2, 0);
    const top = project(offset - CHEVRON_DEPTH / 2, -CHEVRON_ARM);
    const bottom = project(offset - CHEVRON_DEPTH / 2, CHEVRON_ARM);

    graphics.beginPath();
    graphics.moveTo(top.x, top.y);
    graphics.lineTo(tip.x, tip.y);
    graphics.lineTo(bottom.x, bottom.y);
    graphics.strokePath();
  }
}
