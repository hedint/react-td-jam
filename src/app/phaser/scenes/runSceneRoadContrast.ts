import type { PathCell } from "@entities/game-session/model/types";
import type Phaser from "phaser";

type Direction = "up" | "right" | "down" | "left";

interface RoadPiecePresentation {
  readonly rotation: number
  readonly width: number
  readonly height: number
}

interface RoadContrastGraphics {
  readonly shadow: Phaser.GameObjects.Graphics
  readonly surface: Phaser.GameObjects.Graphics
  readonly edge: Phaser.GameObjects.Graphics
}

interface RoadContrastStyle {
  readonly shadowOverhang: number
  readonly shadowAlpha: number
  readonly surfaceWashAlpha: number
  readonly surfaceWashInset: number
  readonly surfaceWashColor: number
}

export function renderRoadContrast(
  graphics: RoadContrastGraphics,
  cells: readonly PathCell[],
  getRoadPiecePresentation: (cells: readonly PathCell[], cell: PathCell) => RoadPiecePresentation,
  getRoadDisplaySize: (cells: readonly PathCell[]) => number,
  style: RoadContrastStyle,
): void {
  graphics.shadow.clear();
  graphics.surface.clear();
  graphics.edge.clear();

  drawRoadSurfaceWash(graphics.surface, cells, {
    color: style.surfaceWashColor,
    alpha: style.surfaceWashAlpha,
    width: getRoadDisplaySize(cells) - style.surfaceWashInset,
  });

  cells.forEach((cell) => {
    const presentation = getRoadPiecePresentation(cells, cell);

    drawRotatedRect(graphics.shadow, {
      x: cell.x,
      y: cell.y,
      width: presentation.width + style.shadowOverhang,
      height: presentation.height + style.shadowOverhang,
      rotation: presentation.rotation,
    }, {
      fillColor: 0x050403,
      fillAlpha: style.shadowAlpha,
    });
  });
}

function drawRoadSurfaceWash(
  graphics: Phaser.GameObjects.Graphics,
  cells: readonly PathCell[],
  style: {
    readonly color: number
    readonly alpha: number
    readonly width: number
  },
): void {
  const firstCell = cells[0];

  if (!firstCell || cells.length < 2 || style.alpha <= 0 || style.width <= 0) {
    return;
  }

  getStraightRoadRuns(cells).forEach((run) => {
    const runPresentation = getTrimmedRoadRunPresentation(run, style.width / 2);

    if (!runPresentation) {
      return;
    }

    drawRotatedRect(graphics, {
      x: runPresentation.x,
      y: runPresentation.y,
      width: runPresentation.length,
      height: style.width,
      rotation: runPresentation.rotation,
    }, {
      fillColor: style.color,
      fillAlpha: style.alpha,
    });
  });

  getCornerRoadCells(cells).forEach((cell) => {
    drawRotatedRect(graphics, {
      x: cell.x,
      y: cell.y,
      width: style.width,
      height: style.width,
      rotation: 0,
    }, {
      fillColor: style.color,
      fillAlpha: style.alpha,
    });
  });
}

function getStraightRoadRuns(cells: readonly PathCell[]): readonly {
  readonly from: PathCell
  readonly to: PathCell
}[] {
  const firstCell = cells[0];

  if (!firstCell || cells.length < 2) {
    return [];
  }

  const runs: {
    from: PathCell
    to: PathCell
    directionKey: string
  }[] = [];

  cells.forEach((cell, index) => {
    const nextCell = cells[(index + 1) % cells.length];

    if (!nextCell || (cell.x === nextCell.x && cell.y === nextCell.y)) {
      return;
    }

    const directionKey = getSegmentDirectionKey(cell, nextCell);
    const currentRun = runs.at(-1);

    if (currentRun?.directionKey === directionKey) {
      currentRun.to = nextCell;
      return;
    }

    runs.push({
      from: cell,
      to: nextCell,
      directionKey,
    });
  });

  return runs;
}

function getTrimmedRoadRunPresentation(
  run: {
    readonly from: PathCell
    readonly to: PathCell
  },
  trim: number,
): {
  readonly x: number
  readonly y: number
  readonly length: number
  readonly rotation: number
} | null {
  const distance = Math.hypot(run.to.x - run.from.x, run.to.y - run.from.y);
  const length = distance - trim * 2;

  if (length <= 0) {
    return null;
  }

  const directionX = (run.to.x - run.from.x) / distance;
  const directionY = (run.to.y - run.from.y) / distance;
  const startX = run.from.x + directionX * trim;
  const startY = run.from.y + directionY * trim;
  const endX = run.to.x - directionX * trim;
  const endY = run.to.y - directionY * trim;

  return {
    x: (startX + endX) / 2,
    y: (startY + endY) / 2,
    length,
    rotation: Math.atan2(run.to.y - run.from.y, run.to.x - run.from.x),
  };
}

function getCornerRoadCells(cells: readonly PathCell[]): readonly PathCell[] {
  return cells.filter((cell) => {
    const directions = getCellConnectionDirections(cells, cell);

    if (directions.length < 2) {
      return false;
    }

    const [first, second] = directions;

    return first !== undefined && second !== undefined && !areOppositeDirections(first, second);
  });
}

function getCellConnectionDirections(cells: readonly PathCell[], cell: PathCell): readonly Direction[] {
  const previous = cells[(cell.index - 1 + cells.length) % cells.length];
  const next = cells[(cell.index + 1) % cells.length];
  const directions: Direction[] = [];

  if (previous) {
    directions.push(getDirectionBetween(cell, previous));
  }

  if (next) {
    directions.push(getDirectionBetween(cell, next));
  }

  return directions;
}

function getDirectionBetween(from: PathCell, to: PathCell): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }

  return dy > 0 ? "down" : "up";
}

function areOppositeDirections(first: Direction, second: Direction): boolean {
  return (
    (first === "up" && second === "down")
    || (first === "down" && second === "up")
    || (first === "left" && second === "right")
    || (first === "right" && second === "left")
  );
}

function getSegmentDirectionKey(from: PathCell, to: PathCell): string {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return deltaX > 0 ? "right" : "left";
  }

  return deltaY > 0 ? "down" : "up";
}

function drawRotatedRect(
  graphics: Phaser.GameObjects.Graphics,
  tile: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
    readonly rotation: number
  },
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
    graphics.moveTo(corners[0]!.x, corners[0]!.y);
    corners.slice(1).forEach(corner => graphics.lineTo(corner.x, corner.y));
    graphics.closePath();
    graphics.fillPath();
  }

  if (style.strokeColor !== undefined && strokeAlpha > 0 && strokeWidth > 0) {
    graphics.lineStyle(strokeWidth, style.strokeColor, strokeAlpha);
    graphics.beginPath();
    graphics.moveTo(corners[0]!.x, corners[0]!.y);
    corners.slice(1).forEach(corner => graphics.lineTo(corner.x, corner.y));
    graphics.closePath();
    graphics.strokePath();
  }
}

function getRotatedRectCorners(tile: {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly rotation: number
}): readonly { readonly x: number, readonly y: number }[] {
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
