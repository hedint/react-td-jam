import type { BoardSlot, BoardState, EmitterId, PathCell } from "@entities/game-session/model/types";

export interface LanePlacement {
  readonly emitterId: EmitterId
  readonly cellIndex: number
  readonly cellIndexes?: readonly number[]
  readonly side: "top" | "bottom"
}

export interface LaneDefinition {
  readonly id: string
  readonly title: string
  readonly target: string
  readonly cellCount: number
  readonly placements: readonly LanePlacement[]
}

export interface LaneLayout {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly cellStep: number
  readonly cellY: number
  readonly firstCellX: number
}

export const LANE_DEFINITIONS = [
  {
    id: "raw",
    title: "Одиночные эффекты",
    target: "Вода / Нефть / Искра / Жар без реакции",
    cellCount: 4,
    placements: [
      { emitterId: "water", cellIndex: 0, side: "top" },
      { emitterId: "oil", cellIndex: 1, side: "bottom" },
      { emitterId: "spark", cellIndex: 2, side: "top" },
      { emitterId: "heat", cellIndex: 3, side: "bottom" },
    ],
  },
  {
    id: "electro-puddle",
    title: "Электролужа",
    target: "Вода + Искра на одной клетке",
    cellCount: 4,
    placements: [
      { emitterId: "water", cellIndex: 1, side: "top" },
      { emitterId: "spark", cellIndex: 1, side: "bottom" },
    ],
  },
  {
    id: "oil-water-opposite",
    title: "Нефть напротив воды",
    target: "Нефть и Вода стоят напротив на одной клетке",
    cellCount: 4,
    placements: [
      { emitterId: "oil", cellIndex: 1, side: "top" },
      { emitterId: "water", cellIndex: 1, side: "bottom" },
    ],
  },
  {
    id: "oil-spark-opposite",
    title: "Нефть напротив электричества",
    target: "Нефть и Электричество стоят напротив на одной клетке",
    cellCount: 4,
    placements: [
      { emitterId: "oil", cellIndex: 1, side: "top" },
      { emitterId: "spark", cellIndex: 1, side: "bottom" },
    ],
  },
  {
    id: "steam",
    title: "Пар",
    target: "Вода + Жар: текущая и следующая клетка",
    cellCount: 4,
    placements: [
      { emitterId: "water", cellIndex: 1, side: "top" },
      { emitterId: "heat", cellIndex: 1, side: "bottom" },
    ],
  },
  {
    id: "fire",
    title: "Пожар",
    target: "Нефть + Жар на одной клетке",
    cellCount: 4,
    placements: [
      { emitterId: "oil", cellIndex: 1, side: "top" },
      { emitterId: "heat", cellIndex: 1, side: "bottom" },
    ],
  },
  {
    id: "storm-cloud",
    title: "Грозовое облако",
    target: "Пар тянется вперёд, Искра стоит на следующей клетке",
    cellCount: 5,
    placements: [
      { emitterId: "water", cellIndex: 1, side: "top" },
      { emitterId: "heat", cellIndex: 1, side: "bottom" },
      { emitterId: "spark", cellIndex: 2, side: "top" },
    ],
  },
  {
    id: "fire-vortex",
    title: "Огненный вихрь",
    target: "Пар тянется вперёд, Нефть + Жар стоят на следующей клетке",
    cellCount: 5,
    placements: [
      { emitterId: "water", cellIndex: 1, side: "top" },
      { emitterId: "heat", cellIndex: 1, side: "bottom" },
      { emitterId: "oil", cellIndex: 2, side: "bottom" },
      { emitterId: "heat", cellIndex: 2, side: "top" },
    ],
  },
  {
    id: "fire-storm",
    title: "Огненный Шторм",
    target: "Грозовое облако рядом с Огненным вихрем",
    cellCount: 5,
    placements: [
      { emitterId: "water", cellIndex: 1, side: "top" },
      { emitterId: "heat", cellIndex: 1, side: "bottom" },
      { emitterId: "spark", cellIndex: 1, side: "top" },
      { emitterId: "spark", cellIndex: 2, side: "bottom" },
      { emitterId: "water", cellIndex: 3, side: "top" },
      { emitterId: "oil", cellIndex: 3, side: "bottom" },
      { emitterId: "heat", cellIndex: 3, side: "top" },
    ],
  },
] as const satisfies readonly LaneDefinition[];

export function createLaneLayout(x: number, y: number, width: number, height: number, cellCount: number): LaneLayout {
  const cellStep = Math.min(58, Math.max(38, (width - 116) / Math.max(1, cellCount - 1)));

  return {
    x,
    y,
    width,
    height,
    cellStep,
    cellY: y + height * 0.62,
    firstCellX: x + width / 2 - (cellCount - 1) * cellStep / 2,
  };
}

export function createPositionedLaneBoard(definition: LaneDefinition, layout: LaneLayout): BoardState {
  const pathCells = Array.from({ length: definition.cellCount }, (_, index) => createCell(definition.id, index, layout.firstCellX + index * layout.cellStep, layout.cellY));
  const sideCounts = new Map<string, number>();
  const slots = definition.placements.map((placement, index) => {
    const cellIndexes = placement.cellIndexes ?? [placement.cellIndex];
    const sideKey = `${placement.side}-${cellIndexes.join("-")}`;
    const sideIndex = sideCounts.get(sideKey) ?? 0;
    const sameSideCount = definition.placements.filter(candidate =>
      candidate.side === placement.side
      && (candidate.cellIndexes ?? [candidate.cellIndex]).join("-") === cellIndexes.join("-"),
    ).length;
    const position = getSlotPosition(pathCells, cellIndexes);
    const spread = (sideIndex - (sameSideCount - 1) / 2) * 34;

    sideCounts.set(sideKey, sideIndex + 1);

    return {
      id: getSlotId(definition.id, index),
      cellIndexes,
      locked: false,
      isCorner: cellIndexes.length > 1,
      x: position.x + spread,
      y: position.y + (placement.side === "top" ? -50 : 50),
      lane: placement.side === "top" ? "inner" : "outer",
    } satisfies BoardSlot;
  });

  return { pathCells, slots };
}

export function createPlaceholderSlot(id: string, placement: LanePlacement): BoardSlot {
  const cellIndexes = placement.cellIndexes ?? [placement.cellIndex];

  return {
    id,
    cellIndexes,
    locked: false,
    isCorner: cellIndexes.length > 1,
    x: 0,
    y: placement.side === "top" ? -50 : 50,
    lane: placement.side === "top" ? "inner" : "outer",
  };
}

export function createPlaceholderCells(cellCount: number): readonly PathCell[] {
  return Array.from({ length: cellCount }, (_, index) => createCell("placeholder", index, index * 54, 0));
}

export function getSlotId(laneId: string, index: number): string {
  return `${laneId}-slot-${index}`;
}

export function getFrame(frameCount: number, frameDurationMs: number, time: number): number {
  return Math.floor(time / frameDurationMs) % frameCount;
}

export function getEmitterColor(emitterId: EmitterId): number {
  switch (emitterId) {
    case "water":
      return 0x43CFE5;
    case "oil":
      return 0x9A7340;
    case "spark":
      return 0x6CE7FF;
    case "heat":
      return 0xF08A28;
    default:
      return emitterId satisfies never;
  }
}

function createCell(laneId: string, index: number, x: number, y: number): PathCell {
  return {
    id: `${laneId}-cell-${index}`,
    index,
    x,
    y,
    isCorner: false,
  };
}

function getSlotPosition(cells: readonly PathCell[], cellIndexes: readonly number[]): { readonly x: number, readonly y: number } {
  const targetCells = cellIndexes
    .map(cellIndex => cells[cellIndex])
    .filter((cell): cell is PathCell => cell !== undefined);

  if (targetCells.length === 0) {
    return { x: cells[0]?.x ?? 0, y: cells[0]?.y ?? 0 };
  }

  return {
    x: targetCells.reduce((sum, cell) => sum + cell.x, 0) / targetCells.length,
    y: targetCells.reduce((sum, cell) => sum + cell.y, 0) / targetCells.length,
  };
}
