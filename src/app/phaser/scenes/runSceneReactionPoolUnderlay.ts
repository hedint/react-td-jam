import type { CellReactionState, PathCell, ReactionId } from "@entities/game-session/model/types";
import type Phaser from "phaser";
import { collectConnectedPools } from "@entities/game-session/model/reactions";
import { getPathTilePresentation } from "./runScenePathTiles";

type ReactionVisualLayer = "ground" | "air";
export type ReactionPoolUnderlayId = Extract<ReactionId, "electroPuddle" | "fire" | "steam" | "stormCloud" | "fireVortex">;

const ELECTRO_PUDDLE_UNDERLAY_Y_OFFSET = 8;
const ELECTRO_PUDDLE_UNDERLAY_WATER_COLOR = 0x0B779C;

export const ELECTRO_PUDDLE_POOL_UNDERLAY_DEPTH = 7.6;
export const AIR_REACTION_POOL_UNDERLAY_DEPTH = 17.4;

export interface ReactionPoolLinkPresentation {
  readonly from: RenderPoint
  readonly to: RenderPoint
  readonly outerWidth: number
  readonly innerWidth: number
  readonly outerColor: number
  readonly innerColor: number
  readonly outerAlpha: number
  readonly innerAlpha: number
}

export interface ReactionPoolBridgePresentation {
  readonly points: readonly RenderPoint[]
  readonly color: number
  readonly alpha: number
  readonly lineWidth: number
}

export interface ReactionPoolUnderlayPresentation {
  readonly reactionId: ReactionPoolUnderlayId
  readonly depth: number
  readonly links: readonly ReactionPoolLinkPresentation[]
  readonly bridges: readonly ReactionPoolBridgePresentation[]
}

interface RenderPoint {
  readonly x: number
  readonly y: number
}

interface ReactionPoolUnderlayStyle {
  readonly depth: number
  readonly yOffset: number
  readonly outerColor: number
  readonly innerColor: number
  readonly outerWidthScale: number
  readonly innerWidthScale: number
  readonly widthPulseScale: number
  readonly outerAlpha: number
  readonly innerAlpha: number
  readonly bridgeColor?: number
  readonly bridgeAlpha?: number
}

const reactionPoolUnderlayStyles = {
  electroPuddle: {
    depth: ELECTRO_PUDDLE_POOL_UNDERLAY_DEPTH,
    yOffset: ELECTRO_PUDDLE_UNDERLAY_Y_OFFSET,
    outerColor: ELECTRO_PUDDLE_UNDERLAY_WATER_COLOR,
    innerColor: ELECTRO_PUDDLE_UNDERLAY_WATER_COLOR,
    outerWidthScale: 0.48,
    innerWidthScale: 0.26,
    widthPulseScale: 0.03,
    outerAlpha: 1,
    innerAlpha: 1,
    bridgeColor: 0xB7FCFF,
    bridgeAlpha: 0.58,
  },
  fire: {
    depth: ELECTRO_PUDDLE_POOL_UNDERLAY_DEPTH,
    yOffset: 9,
    outerColor: 0x7A2418,
    innerColor: 0xFF813D,
    outerWidthScale: 0.44,
    innerWidthScale: 0.24,
    widthPulseScale: 0.04,
    outerAlpha: 0.72,
    innerAlpha: 0.5,
    bridgeColor: 0xFFE0A0,
    bridgeAlpha: 0.42,
  },
  steam: {
    depth: AIR_REACTION_POOL_UNDERLAY_DEPTH,
    yOffset: -3,
    outerColor: 0xAFCFD5,
    innerColor: 0xE9FCFF,
    outerWidthScale: 0.5,
    innerWidthScale: 0.28,
    widthPulseScale: 0.05,
    outerAlpha: 0.34,
    innerAlpha: 0.22,
  },
  stormCloud: {
    depth: AIR_REACTION_POOL_UNDERLAY_DEPTH,
    yOffset: -4,
    outerColor: 0x284E64,
    innerColor: 0x4EAAC2,
    outerWidthScale: 0.52,
    innerWidthScale: 0.3,
    widthPulseScale: 0.04,
    outerAlpha: 0.5,
    innerAlpha: 0.28,
    bridgeColor: 0x9FF7FF,
    bridgeAlpha: 0.5,
  },
  fireVortex: {
    depth: AIR_REACTION_POOL_UNDERLAY_DEPTH,
    yOffset: -2,
    outerColor: 0x7A2418,
    innerColor: 0xFF813D,
    outerWidthScale: 0.46,
    innerWidthScale: 0.22,
    widthPulseScale: 0.06,
    outerAlpha: 0.42,
    innerAlpha: 0.28,
    bridgeColor: 0xFFE0A0,
    bridgeAlpha: 0.46,
  },
} as const satisfies Record<ReactionPoolUnderlayId, ReactionPoolUnderlayStyle>;

export function getReactionConnectedPools(
  reactions: readonly CellReactionState[],
  pathCellCount: number,
  reactionId: ReactionId,
  layer: ReactionVisualLayer,
): readonly (readonly number[])[] {
  const matchingCellIndexes = new Set(
    reactions
      .filter(reaction => layer === "ground" ? reaction.ground === reactionId : reaction.air === reactionId)
      .map(reaction => reaction.cellIndex),
  );

  return collectConnectedPools(pathCellCount, matchingCellIndexes);
}

export function getSupportedReactionPoolUnderlayIds(): readonly ReactionPoolUnderlayId[] {
  return Object.keys(reactionPoolUnderlayStyles) as ReactionPoolUnderlayId[];
}

export function getReactionPoolUnderlayPresentation(
  cells: readonly PathCell[],
  pool: readonly number[],
  reactionId: ReactionId,
  visualMs: number,
): ReactionPoolUnderlayPresentation | null {
  if (!isReactionPoolUnderlayId(reactionId)) {
    return null;
  }

  const style: ReactionPoolUnderlayStyle = reactionPoolUnderlayStyles[reactionId];
  const poolIndexes = new Set(pool);
  const links = [...poolIndexes]
    .sort((left, right) => left - right)
    .flatMap((cellIndex) => {
      const nextCellIndex = (cellIndex + 1) % cells.length;
      const fromCell = cells[cellIndex];
      const toCell = cells[nextCellIndex];

      if (!poolIndexes.has(nextCellIndex) || !fromCell || !toCell) {
        return [];
      }

      const fromTile = getPathTilePresentation(cells, fromCell);
      const toTile = getPathTilePresentation(cells, toCell);
      const bridgeSize = Math.min(fromTile.effectSize, toTile.effectSize);
      const pulse = Math.sin(visualMs / 190 + cellIndex * 0.73 + nextCellIndex * 0.41);

      return [{
        from: offsetReactionPoolPoint(fromCell, style),
        to: offsetReactionPoolPoint(toCell, style),
        outerWidth: bridgeSize * (style.outerWidthScale + pulse * style.widthPulseScale),
        innerWidth: bridgeSize * (style.innerWidthScale + pulse * style.widthPulseScale * 0.66),
        outerColor: style.outerColor,
        innerColor: style.innerColor,
        outerAlpha: style.outerAlpha,
        innerAlpha: style.innerAlpha,
      }];
    });

  return {
    reactionId,
    depth: style.depth,
    links,
    bridges: style.bridgeColor
      ? links.flatMap((link, index) => createReactionBridgeLines(link, visualMs, index, style))
      : [],
  };
}

export function getElectroPuddlePoolUnderlayPresentation(
  cells: readonly PathCell[],
  pool: readonly number[],
  visualMs: number,
): ReactionPoolUnderlayPresentation {
  return getReactionPoolUnderlayPresentation(cells, pool, "electroPuddle", visualMs)!;
}

export function drawElectroPuddlePoolUnderlay(
  graphics: Phaser.GameObjects.Graphics,
  cells: readonly PathCell[],
  pool: readonly number[],
  visualMs: number,
): void {
  drawReactionPoolUnderlayPresentation(graphics, getElectroPuddlePoolUnderlayPresentation(cells, pool, visualMs));
}

export function drawReactionPoolUnderlay(
  graphics: Phaser.GameObjects.Graphics,
  cells: readonly PathCell[],
  pool: readonly number[],
  reactionId: ReactionId,
  visualMs: number,
): void {
  const presentation = getReactionPoolUnderlayPresentation(cells, pool, reactionId, visualMs);

  if (!presentation) {
    return;
  }

  drawReactionPoolUnderlayPresentation(graphics, presentation);
}

function drawReactionPoolUnderlayPresentation(
  graphics: Phaser.GameObjects.Graphics,
  presentation: ReactionPoolUnderlayPresentation,
): void {
  if (presentation.links.length === 0) {
    return;
  }

  graphics.setDepth(presentation.depth);
  presentation.links.forEach((link) => {
    drawCapsule(graphics, link.from, link.to, link.outerWidth, link.outerColor, link.outerAlpha);
    drawCapsule(graphics, link.from, link.to, link.innerWidth, link.innerColor, link.innerAlpha);
  });
  presentation.bridges.forEach((bridge) => {
    graphics.lineStyle(bridge.lineWidth, bridge.color, bridge.alpha);
    graphics.beginPath();
    graphics.moveTo(bridge.points[0]?.x ?? 0, bridge.points[0]?.y ?? 0);
    bridge.points.slice(1).forEach(point => graphics.lineTo(point.x, point.y));
    graphics.strokePath();
  });
}

function isReactionPoolUnderlayId(reactionId: ReactionId): reactionId is ReactionPoolUnderlayId {
  return reactionId in reactionPoolUnderlayStyles;
}

function offsetReactionPoolPoint(cell: PathCell, style: ReactionPoolUnderlayStyle): RenderPoint {
  return {
    x: cell.x,
    y: cell.y + style.yOffset,
  };
}

function createReactionBridgeLines(
  link: ReactionPoolLinkPresentation,
  visualMs: number,
  linkIndex: number,
  style: ReactionPoolUnderlayStyle,
): readonly ReactionPoolBridgePresentation[] {
  const flash = Math.sin(visualMs / 130 + link.from.x * 0.017 + link.to.y * 0.013 + linkIndex);
  const lineCount = flash > 0.18 ? 2 : 1;

  return Array.from({ length: lineCount }, (_, index) => {
    const center = lineCount === 1 ? 0.5 : 0.4 + index * 0.2;
    const halfLength = index === 0 ? 0.15 : 0.12;
    const baseAlpha = style.bridgeAlpha ?? 0.5;
    const alpha = clamp(baseAlpha + flash * 0.22 - index * 0.12, 0.28, 0.86);

    return {
      points: createJaggedBridgePoints(link.from, link.to, center, halfLength, visualMs, linkIndex + index * 3),
      color: style.bridgeColor ?? 0xFFFFFF,
      alpha,
      lineWidth: index === 0 ? 3 : 2,
    };
  });
}

function createJaggedBridgePoints(
  from: RenderPoint,
  to: RenderPoint,
  center: number,
  halfLength: number,
  visualMs: number,
  seed: number,
): readonly RenderPoint[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const jitter = Math.sin(visualMs / 90 + seed * 1.91) * 7;
  const start = center - halfLength;
  const end = center + halfLength;

  return [
    interpolatePoint(from, to, start, normalX, normalY, -jitter * 0.35),
    interpolatePoint(from, to, center - halfLength * 0.28, normalX, normalY, jitter),
    interpolatePoint(from, to, center + halfLength * 0.24, normalX, normalY, -jitter * 0.72),
    interpolatePoint(from, to, end, normalX, normalY, jitter * 0.3),
  ];
}

function interpolatePoint(
  from: RenderPoint,
  to: RenderPoint,
  amount: number,
  normalX: number,
  normalY: number,
  normalOffset: number,
): RenderPoint {
  return {
    x: from.x + (to.x - from.x) * amount + normalX * normalOffset,
    y: from.y + (to.y - from.y) * amount + normalY * normalOffset,
  };
}

function drawCapsule(
  graphics: Phaser.GameObjects.Graphics,
  from: RenderPoint,
  to: RenderPoint,
  width: number,
  color: number,
  alpha: number,
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const radius = width / 2;
  const normalX = -dy / distance * radius;
  const normalY = dx / distance * radius;

  graphics.fillStyle(color, alpha);
  graphics.fillCircle(from.x, from.y, radius);
  graphics.fillCircle(to.x, to.y, radius);
  graphics.beginPath();
  graphics.moveTo(from.x + normalX, from.y + normalY);
  graphics.lineTo(to.x + normalX, to.y + normalY);
  graphics.lineTo(to.x - normalX, to.y - normalY);
  graphics.lineTo(from.x - normalX, from.y - normalY);
  graphics.closePath();
  graphics.fillPath();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
