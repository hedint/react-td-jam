import type { BoardSlot, BoardState, PathCell } from "./types";

export interface BoardGeometryConfig {
  readonly pathCellCount: number
  readonly center: {
    readonly x: number
    readonly y: number
  }
  readonly bounds: {
    readonly left: number
    readonly top: number
    readonly right: number
    readonly bottom: number
  }
  readonly slotOffset: number
}

export const defaultBoardGeometryConfig: BoardGeometryConfig = {
  pathCellCount: 16,
  center: { x: 270, y: 484 },
  bounds: {
    left: 132,
    top: 304,
    right: 408,
    bottom: 664,
  },
  slotOffset: 46,
};

export function createStadiumLoopBoard(config: BoardGeometryConfig = defaultBoardGeometryConfig): BoardState {
  const pathCells = createStadiumLoopCells(config);

  return {
    pathCells,
    slots: createBoardSlots(pathCells, config),
  };
}

export function createStadiumLoopCells(config: BoardGeometryConfig): readonly PathCell[] {
  if (config.pathCellCount < 8 || config.pathCellCount % 4 !== 0) {
    throw new Error("pathCellCount must be a multiple of 4 and at least 8");
  }

  const sideCount = config.pathCellCount / 4;
  const { left, top, right, bottom } = config.bounds;
  const width = right - left;
  const height = bottom - top;
  const cells: PathCell[] = [];

  for (let index = 1; index <= sideCount; index += 1) {
    cells.push(createPathCell(cells.length, left + width * index / sideCount, top, index === sideCount));
  }

  for (let index = 1; index <= sideCount; index += 1) {
    cells.push(createPathCell(cells.length, right, top + height * index / sideCount, index === sideCount));
  }

  for (let index = 1; index <= sideCount; index += 1) {
    cells.push(createPathCell(cells.length, right - width * index / sideCount, bottom, index === sideCount));
  }

  for (let index = 1; index <= sideCount; index += 1) {
    cells.push(createPathCell(cells.length, left, bottom - height * index / sideCount, index === sideCount));
  }

  return cells;
}

function createPathCell(index: number, x: number, y: number, isCorner: boolean): PathCell {
  return {
    id: `cell-${index}`,
    index,
    x: Math.round(x),
    y: Math.round(y),
    isCorner,
  };
}

function createBoardSlots(cells: readonly PathCell[], config: BoardGeometryConfig): readonly BoardSlot[] {
  return cells.flatMap((cell) => {
    const direction = normalize(cell.x - config.center.x, cell.y - config.center.y);
    const inner = {
      x: cell.x - direction.x * config.slotOffset,
      y: cell.y - direction.y * config.slotOffset,
    };
    const outer = {
      x: cell.x + direction.x * config.slotOffset,
      y: cell.y + direction.y * config.slotOffset,
    };
    const cellIndexes = getSlotCellIndexes(cells.length, cell);

    return [
      {
        id: `slot-${cell.index}-inner`,
        cellIndexes,
        locked: false,
        isCorner: cell.isCorner,
        lane: "inner" as const,
        x: Math.round(inner.x),
        y: Math.round(inner.y),
      },
      {
        id: `slot-${cell.index}-outer`,
        cellIndexes,
        locked: false,
        isCorner: cell.isCorner,
        lane: "outer" as const,
        x: Math.round(outer.x),
        y: Math.round(outer.y),
      },
    ];
  });
}

function getSlotCellIndexes(pathCellCount: number, cell: PathCell): readonly number[] {
  if (!cell.isCorner) {
    return [cell.index];
  }

  return [cell.index, (cell.index + 1) % pathCellCount];
}

function normalize(x: number, y: number): { readonly x: number, readonly y: number } {
  const length = Math.hypot(x, y) || 1;

  return {
    x: x / length,
    y: y / length,
  };
}
