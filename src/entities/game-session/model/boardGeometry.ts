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
  readonly tileSize: number
  readonly slotOffset: number
  readonly lockInnerCornerSlots: boolean
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
  tileSize: 76,
  slotOffset: 76,
  lockInnerCornerSlots: false,
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
  const left = config.center.x - config.tileSize * sideCount / 2;
  const top = config.center.y - config.tileSize * sideCount / 2;
  const right = left + config.tileSize * sideCount;
  const bottom = top + config.tileSize * sideCount;
  const cells: PathCell[] = [];

  for (let index = 0; index <= sideCount; index += 1) {
    cells.push(createPathCell(cells.length, left, bottom - config.tileSize * index, index === 0 || index === sideCount));
  }

  for (let index = 1; index <= sideCount; index += 1) {
    cells.push(createPathCell(cells.length, left + config.tileSize * index, top, index === sideCount));
  }

  for (let index = 1; index <= sideCount; index += 1) {
    cells.push(createPathCell(cells.length, right, top + config.tileSize * index, index === sideCount));
  }

  for (let index = 1; index < sideCount; index += 1) {
    cells.push(createPathCell(cells.length, right - config.tileSize * index, bottom, false));
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
  const bounds = getCellBounds(cells);

  return cells.flatMap<BoardSlot>((cell) => {
    const innerDirection = getInnerDirection(cell, bounds);
    const outerDirection = {
      x: -innerDirection.x,
      y: -innerDirection.y,
    };
    const singleCellSlotBase = {
      cellIndexes: [cell.index],
      locked: false,
      isCorner: cell.isCorner,
    };
    const outerSlot = {
      ...singleCellSlotBase,
      id: `slot-${cell.index}-outer`,
      lane: "outer" as const,
      x: Math.round(cell.x + outerDirection.x * config.slotOffset),
      y: Math.round(cell.y + outerDirection.y * config.slotOffset),
    };
    const outerSlots = cell.index === 0 ? [] : [outerSlot];

    if (cell.isCorner) {
      return [
        {
          cellIndexes: getInnerCornerCellIndexes(cells.length, cell),
          locked: config.lockInnerCornerSlots,
          isCorner: true,
          id: `slot-${cell.index}-inner`,
          lane: "inner" as const,
          x: Math.round(cell.x + innerDirection.x * config.slotOffset),
          y: Math.round(cell.y + innerDirection.y * config.slotOffset),
        },
        ...outerSlots,
      ];
    }

    if (isAdjacentToCorner(cells, cell)) {
      return outerSlots;
    }

    return [
      {
        ...singleCellSlotBase,
        id: `slot-${cell.index}-inner`,
        lane: "inner" as const,
        x: Math.round(cell.x + innerDirection.x * config.slotOffset),
        y: Math.round(cell.y + innerDirection.y * config.slotOffset),
      },
      ...outerSlots,
    ];
  });
}

function getInnerCornerCellIndexes(pathCellCount: number, cell: PathCell): readonly number[] {
  return [
    (cell.index - 1 + pathCellCount) % pathCellCount,
    (cell.index + 1) % pathCellCount,
  ].sort((left, right) => left - right);
}

function isAdjacentToCorner(cells: readonly PathCell[], cell: PathCell): boolean {
  const previous = cells[(cell.index - 1 + cells.length) % cells.length];
  const next = cells[(cell.index + 1) % cells.length];

  return !cell.isCorner && (previous?.isCorner === true || next?.isCorner === true);
}

function getCellBounds(cells: readonly PathCell[]): {
  readonly minX: number
  readonly maxX: number
  readonly minY: number
  readonly maxY: number
} {
  return cells.reduce(
    (bounds, cell) => ({
      minX: Math.min(bounds.minX, cell.x),
      maxX: Math.max(bounds.maxX, cell.x),
      minY: Math.min(bounds.minY, cell.y),
      maxY: Math.max(bounds.maxY, cell.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
}

function getInnerDirection(
  cell: PathCell,
  bounds: ReturnType<typeof getCellBounds>,
): { readonly x: number, readonly y: number } {
  const x = cell.x === bounds.minX
    ? 1
    : cell.x === bounds.maxX
      ? -1
      : 0;
  const y = cell.y === bounds.minY
    ? 1
    : cell.y === bounds.maxY
      ? -1
      : 0;

  return { x, y };
}
