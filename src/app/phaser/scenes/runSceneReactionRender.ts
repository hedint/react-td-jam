import type { CellReactionState, PathCell, ReactionId } from "@entities/game-session/model/types";
import type { AssetDefinition } from "@shared/assets/manifest";
import { gameConfig } from "@entities/game-session/model/config";
import { assetGroups } from "@shared/assets/manifest";
import { getPathTilePresentation } from "./runScenePathTiles";

type ReactionLayer = NonNullable<CellReactionState["ground"]> | NonNullable<CellReactionState["air"]>;

export interface ReactionVfxDefinition {
  readonly reactionId: ReactionId
  readonly asset: AssetDefinition
  readonly layer: "ground" | "air"
  readonly tier: 1 | 2 | 3
  readonly callout: string
  readonly width: number
  readonly height: number
  readonly yOffset: number
  readonly baseAlpha: number
  readonly pulseScale: number
  readonly rotationSpeed: number
  readonly rotationAmplitude: number
  readonly depth: number
  readonly tileScale: number
}

export interface ReactionSpritePresentation {
  readonly key: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly alpha: number
  readonly rotation: number
  readonly depth: number
}

export const reactionVfxRegistry = {
  electroPuddle: {
    reactionId: "electroPuddle",
    asset: assetGroups.reactions.electroPuddle,
    layer: "ground",
    tier: 1,
    callout: "Электролужа",
    width: 104,
    height: 56,
    yOffset: 8,
    baseAlpha: 0.74,
    pulseScale: 0.02,
    rotationSpeed: 0,
    rotationAmplitude: 0,
    depth: 8,
    tileScale: 1.06,
  },
  steam: {
    reactionId: "steam",
    asset: assetGroups.reactions.steam,
    layer: "air",
    tier: 1,
    callout: "Пар",
    width: 92,
    height: 86,
    yOffset: -42,
    baseAlpha: 0.62,
    pulseScale: 0.04,
    rotationSpeed: 0,
    rotationAmplitude: 0.03,
    depth: 18,
    tileScale: 0,
  },
  fire: {
    reactionId: "fire",
    asset: assetGroups.reactions.fire,
    layer: "ground",
    tier: 1,
    callout: "Пожар",
    width: 100,
    height: 60,
    yOffset: 9,
    baseAlpha: 0.76,
    pulseScale: 0.06,
    rotationSpeed: 0,
    rotationAmplitude: 0.025,
    depth: 8,
    tileScale: 1.08,
  },
  stormCloud: {
    reactionId: "stormCloud",
    asset: assetGroups.reactions.stormCloud,
    layer: "air",
    tier: 2,
    callout: "Грозовое облако",
    width: 104,
    height: 88,
    yOffset: -45,
    baseAlpha: 0.78,
    pulseScale: 0.05,
    rotationSpeed: 0,
    rotationAmplitude: 0.035,
    depth: 18,
    tileScale: 0,
  },
  fireVortex: {
    reactionId: "fireVortex",
    asset: assetGroups.reactions.fireVortex,
    layer: "air",
    tier: 2,
    callout: "Огненный вихрь",
    width: 96,
    height: 96,
    yOffset: -38,
    baseAlpha: 0.78,
    pulseScale: 0.06,
    rotationSpeed: 0.0018,
    rotationAmplitude: 0.03,
    depth: 18,
    tileScale: 0,
  },
  fireStorm: {
    reactionId: "fireStorm",
    asset: assetGroups.reactions.fireStorm,
    layer: "air",
    tier: 3,
    callout: "Огненный Шторм",
    width: 124,
    height: 112,
    yOffset: -42,
    baseAlpha: 0.82,
    pulseScale: 0.07,
    rotationSpeed: 0.0012,
    rotationAmplitude: 0.04,
    depth: 18,
    tileScale: 0,
  },
} as const satisfies Record<ReactionId, ReactionVfxDefinition>;

export function getReactionVfxDefinition(reactionId: ReactionLayer): ReactionVfxDefinition {
  return reactionVfxRegistry[reactionId];
}

export function getReactionSpritePresentation(
  cells: readonly PathCell[],
  cell: PathCell,
  reactionId: ReactionLayer,
  elapsedMs: number,
): ReactionSpritePresentation {
  const definition = getReactionVfxDefinition(reactionId);
  const wave = Math.sin(elapsedMs / 145 + cell.index * 0.9);
  const scale = 1 + wave * definition.pulseScale;
  const bob = definition.layer === "air"
    ? Math.sin(elapsedMs / 220 + cell.index) * 3
    : 0;
  const tile = definition.layer === "ground" ? getPathTilePresentation(cells, cell) : null;
  const width = tile ? tile.effectSize * definition.tileScale : definition.width;
  const height = tile ? tile.effectSize * definition.tileScale : definition.height;
  const rotation = tile?.rotation ?? 0;

  return {
    key: definition.asset.key,
    x: cell.x,
    y: cell.y + definition.yOffset + bob,
    width: width * scale,
    height: height * scale,
    alpha: clamp(definition.baseAlpha + wave * 0.08, 0.42, 0.92),
    rotation: rotation + elapsedMs * definition.rotationSpeed + Math.sin(elapsedMs / 240 + cell.index) * definition.rotationAmplitude,
    depth: definition.depth + cell.y / 10000,
  };
}

export function getReactionDisplayName(reactionId: ReactionId): string {
  return gameConfig.reactions.find(reaction => reaction.id === reactionId)?.displayName
    ?? reactionVfxRegistry[reactionId].callout;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
