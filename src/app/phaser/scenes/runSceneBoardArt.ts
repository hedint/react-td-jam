import type { BoardSlot, GameSnapshot, PathCell } from "@entities/game-session/model/types";
import type Phaser from "phaser";
import { assetGroups } from "@shared/assets/manifest";

const FALLBACK_ROAD_TILE_SIZE = 76;
const SLOT_DISPLAY_SIZE = 52;
const CORNER_SLOT_DISPLAY_SIZE = 62;
const MARKER_DISPLAY_SIZE = 94;
const EXIT_MARKER_DISPLAY_SIZE = 86;

type Direction = "up" | "right" | "down" | "left";

export interface BoardRoadPiecePresentation {
  readonly key: string
  readonly rotation: number
  readonly width: number
  readonly height: number
}

export interface BoardMarkerPresentation {
  readonly x: number
  readonly y: number
  readonly rotation: number
}

export class RunSceneBoardArtPresenter {
  private roadSprites: Phaser.GameObjects.Image[] = [];
  private slotSprites: Phaser.GameObjects.Image[] = [];
  private entranceMarker?: Phaser.GameObjects.Image;
  private exitMarker?: Phaser.GameObjects.Image;

  constructor(private readonly scene: Phaser.Scene) {}

  render(snapshot: GameSnapshot): void {
    this.renderRoad(snapshot.board.pathCells);
    this.renderSlots(snapshot.board.slots);
    this.renderMarkers(snapshot.board.pathCells);
  }

  private renderRoad(cells: readonly PathCell[]): void {
    while (this.roadSprites.length < cells.length) {
      this.roadSprites.push(this.scene.add.image(0, 0, assetGroups.board.roadStraight.key)
        .setOrigin(0.5)
        .setDepth(1));
    }

    cells.forEach((cell, index) => {
      const sprite = this.roadSprites[index];
      const presentation = getBoardRoadPiecePresentation(cells, cell);

      sprite
        ?.setVisible(true)
        .setTexture(presentation.key)
        .setPosition(cell.x, cell.y)
        .setDisplaySize(presentation.width, presentation.height)
        .setRotation(presentation.rotation)
        .setDepth(1 + cell.y / 10000);
    });

    this.roadSprites.slice(cells.length).forEach(sprite => sprite.setVisible(false));
  }

  private renderSlots(slots: readonly BoardSlot[]): void {
    while (this.slotSprites.length < slots.length) {
      this.slotSprites.push(this.scene.add.image(0, 0, assetGroups.board.slotSocket.key)
        .setOrigin(0.5)
        .setDepth(3));
    }

    slots.forEach((slot, index) => {
      const sprite = this.slotSprites[index];
      const size = slot.isCorner ? CORNER_SLOT_DISPLAY_SIZE : SLOT_DISPLAY_SIZE;

      sprite
        ?.setVisible(true)
        .setTexture(slot.isCorner ? assetGroups.board.slotSocketCorner.key : assetGroups.board.slotSocket.key)
        .setPosition(slot.x, slot.y)
        .setDisplaySize(size, size)
        .setRotation(slot.isCorner ? Math.PI / 4 : 0)
        .setAlpha(slot.locked ? 0.42 : 0.92)
        .setDepth(3 + slot.y / 10000);
    });

    this.slotSprites.slice(slots.length).forEach(sprite => sprite.setVisible(false));
  }

  private renderMarkers(cells: readonly PathCell[]): void {
    const entrance = getEntranceMarkerPresentation(cells);
    const exit = getExitMarkerPresentation(cells);

    if (!this.entranceMarker) {
      this.entranceMarker = this.scene.add.image(0, 0, assetGroups.board.markerEntrance.key)
        .setOrigin(0.5)
        .setDepth(4);
    }

    if (!this.exitMarker) {
      this.exitMarker = this.scene.add.image(0, 0, assetGroups.board.markerExit.key)
        .setOrigin(0.5)
        .setDepth(4);
    }

    this.entranceMarker
      .setVisible(entrance !== null)
      .setTexture(assetGroups.board.markerEntrance.key);
    this.exitMarker
      .setVisible(exit !== null)
      .setTexture(assetGroups.board.markerExit.key);

    if (entrance) {
      this.entranceMarker
        .setPosition(entrance.x, entrance.y)
        .setDisplaySize(MARKER_DISPLAY_SIZE, MARKER_DISPLAY_SIZE)
        .setRotation(entrance.rotation)
        .setDepth(4 + entrance.y / 10000);
    }

    if (exit) {
      this.exitMarker
        .setPosition(exit.x, exit.y)
        .setDisplaySize(EXIT_MARKER_DISPLAY_SIZE, EXIT_MARKER_DISPLAY_SIZE)
        .setRotation(exit.rotation)
        .setDepth(4 + exit.y / 10000);
    }
  }
}

export function getBoardRoadPiecePresentation(
  cells: readonly PathCell[],
  cell: PathCell,
): BoardRoadPiecePresentation {
  const directions = getCellConnectionDirections(cells, cell);

  if (directions.length < 2) {
    const size = getRoadTileSize(cells);

    return {
      key: assetGroups.board.roadStraight.key,
      rotation: 0,
      width: size,
      height: size,
    };
  }

  const [first, second] = directions;
  const isStraight = areOppositeDirections(first, second);

  return {
    key: isStraight ? assetGroups.board.roadStraight.key : assetGroups.board.roadCorner.key,
    rotation: isStraight ? getStraightRotation(first, second) : getCornerRotation(first, second),
    width: getRoadTileSize(cells),
    height: getRoadTileSize(cells),
  };
}

export function getEntranceMarkerPresentation(cells: readonly PathCell[]): BoardMarkerPresentation | null {
  const entrance = cells[0];
  const next = cells[1];

  if (!entrance || !next) {
    return null;
  }

  const x = entrance.x + Math.sign(entrance.x - next.x) * getRoadTileSize(cells);
  const y = entrance.y + Math.sign(entrance.y - next.y) * getRoadTileSize(cells);

  return {
    x,
    y,
    rotation: getDirectionRotation(getDirectionBetween({ ...entrance, x, y }, entrance)),
  };
}

export function getExitMarkerPresentation(cells: readonly PathCell[]): BoardMarkerPresentation | null {
  const entrance = cells[0];
  const next = cells[1];
  const previous = cells[cells.length - 1];

  if (!entrance || !next || !previous) {
    return null;
  }

  const tileSize = getRoadTileSize(cells);
  const x = entrance.x + Math.sign(next.x - entrance.x + previous.x - entrance.x) * tileSize;
  const y = entrance.y + Math.sign(next.y - entrance.y + previous.y - entrance.y) * tileSize + Math.round(tileSize / 3);

  return {
    x,
    y,
    rotation: getDirectionRotation(getDirectionBetween(previous, { ...entrance, x, y })),
  };
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

function getRoadTileSize(cells: readonly PathCell[]): number {
  const distances = cells.flatMap((cell, index) => {
    const next = cells[(index + 1) % cells.length];

    if (!next) {
      return [];
    }

    return [Math.hypot(next.x - cell.x, next.y - cell.y)];
  }).filter(distance => distance > 0);

  return Math.round(Math.min(...distances, FALLBACK_ROAD_TILE_SIZE));
}

function areOppositeDirections(first: Direction, second: Direction): boolean {
  return (
    (first === "up" && second === "down")
    || (first === "down" && second === "up")
    || (first === "left" && second === "right")
    || (first === "right" && second === "left")
  );
}

function getStraightRotation(first: Direction, second: Direction): number {
  return first === "left" || first === "right" || second === "left" || second === "right"
    ? Math.PI / 2
    : 0;
}

function getCornerRotation(first: Direction, second: Direction): number {
  const key = [first, second].sort().join("-");

  switch (key) {
    case "right-up":
      return 0;
    case "down-right":
      return Math.PI / 2;
    case "down-left":
      return Math.PI;
    case "left-up":
      return -Math.PI / 2;
    default:
      return 0;
  }
}

function getDirectionRotation(direction: Direction): number {
  switch (direction) {
    case "up":
      return 0;
    case "right":
      return Math.PI / 2;
    case "down":
      return Math.PI;
    case "left":
      return -Math.PI / 2;
    default:
      return direction satisfies never;
  }
}
