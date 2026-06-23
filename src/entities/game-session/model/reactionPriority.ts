import type { EnergyId, EnergySource, TierReactionCoverage } from "./reactionEnergy";
import type {
  BoardState,
  CellEnergyClaim,
  CellReactionState,
  EmitterId,
  GameConfig,
  ReactionDefinition,
  ReactionId,
  ReactionInputId,
  UpgradeStackState,
} from "./types";
import {
  assignEnergyToPool,
  collectConnectedPools,
  createTierEnergyCoverageResult,
  createTierReactionCoverage,
  getTierOneEnergyReactionCapacity,
  suppressReactionInputsCoveredByTierReactions,
} from "./reactionEnergy";

type SubstanceId = Extract<EmitterId, "water" | "oil">;

export interface ReactionPriorityProjectionCell {
  readonly cellIndex: number
  readonly substances: ReadonlySet<SubstanceId>
  readonly energyClaims: readonly CellEnergyClaim[]
}

export function getHigherTierDirectReactionBySource(
  board: BoardState,
  energySources: readonly EnergySource[],
  tierOneReactions: readonly CellReactionState[],
  tierOneProjection: readonly ReactionPriorityProjectionCell[],
  tierOneDirectReactionBySource: ReadonlyMap<string, ReactionId>,
  config: GameConfig,
  getEnergyCapacity: (emitterId: EnergyId, upgrades: readonly UpgradeStackState[], config: GameConfig) => number,
  baseAirReactionCatalystCapacity: number,
): ReadonlyMap<string, ReactionId> {
  const tierTwoDefinitions = config.reactions.filter(reaction => reaction.tier === 2);
  const capacityBonus = baseAirReactionCatalystCapacity - getEnergyCapacity("spark", [], config);
  const reactionCoverage = createTierReactionCoverage(board, tierOneReactions, tierTwoDefinitions, baseAirReactionCatalystCapacity);
  const reservedDirectReactionBySource = new Map<string, ReactionId>();
  const potentialFireVortexCoverage = reservePotentialFireVortexSources(
    board,
    tierOneProjection,
    energySources,
    tierOneReactions,
    tierOneDirectReactionBySource,
    config,
    reservedDirectReactionBySource,
    baseAirReactionCatalystCapacity,
  );
  const effectiveReactionCoverage = mergeReactionCoverage(reactionCoverage, "fireVortex", potentialFireVortexCoverage);
  const energyInputReactions = suppressReactionInputsCoveredByTierReactions(tierOneReactions, tierTwoDefinitions, effectiveReactionCoverage, config);
  const energyCoverageResult = createTierEnergyCoverageResult(board, energySources, energyInputReactions, tierTwoDefinitions, config, reservedDirectReactionBySource, capacityBonus);
  const activeTierTwoReactionIds = new Set<ReactionId>([
    ...[...energyCoverageResult.coverage].filter(([, coverage]) => coverage.size > 0).map(([reactionId]) => reactionId),
    ...[...effectiveReactionCoverage].filter(([, coveredCells]) => coveredCells.size > 0).map(([reactionId]) => reactionId),
  ]);
  const protectedTierOneReactionIds = new Set(
    tierTwoDefinitions
      .filter(reaction => activeTierTwoReactionIds.has(reaction.id))
      .flatMap(reaction => reaction.inputs.filter(input => isReactionId(input, config))),
  );
  const finalReservedDirectReactionBySource = new Map(energyCoverageResult.directReactionBySource);

  tierOneDirectReactionBySource.forEach((reactionId, sourceId) => {
    if (!finalReservedDirectReactionBySource.has(sourceId) && protectedTierOneReactionIds.has(reactionId)) {
      finalReservedDirectReactionBySource.set(sourceId, reactionId);
    }
  });

  return finalReservedDirectReactionBySource;
}

function mergeReactionCoverage(
  reactionCoverage: TierReactionCoverage,
  reactionId: ReactionId,
  extraCoveredCells: ReadonlySet<number>,
): TierReactionCoverage {
  if (extraCoveredCells.size === 0) {
    return reactionCoverage;
  }

  const merged = new Map(reactionCoverage);
  const coveredCells = new Set(merged.get(reactionId) ?? []);

  extraCoveredCells.forEach((cellIndex) => {
    coveredCells.add(cellIndex);
  });
  merged.set(reactionId, coveredCells);

  return merged;
}

function reservePotentialFireVortexSources(
  board: BoardState,
  projection: readonly ReactionPriorityProjectionCell[],
  energySources: readonly EnergySource[],
  tierOneReactions: readonly CellReactionState[],
  tierOneDirectReactionBySource: ReadonlyMap<string, ReactionId>,
  config: GameConfig,
  reservedDirectReactionBySource: Map<string, ReactionId>,
  capacity: number,
): ReadonlySet<number> {
  const coveredSteamCells = new Set<number>();
  const steamPools = collectConnectedPools(
    board.pathCells.length,
    new Set(tierOneReactions.filter(reaction => reaction.air === "steam").map(reaction => reaction.cellIndex)),
  );
  const fireDefinition = config.reactions.find(reaction => reaction.id === "fire");

  if (!fireDefinition || steamPools.length === 0) {
    return coveredSteamCells;
  }

  getPotentialTierOneClaims(board, projection, energySources, fireDefinition).forEach((claim) => {
    const matchingSteamPool = steamPools.find(pool =>
      pool.some(cellIndex => getContextIndexes(board.pathCells.length, cellIndex).includes(claim.cellIndex)),
    );

    if (matchingSteamPool && hasIndependentReactionSource(projection, matchingSteamPool, tierOneDirectReactionBySource, "steam", claim.source.towerId)) {
      reservedDirectReactionBySource.set(claim.source.towerId, "fire");
      getClosestPoolCells(board.pathCells.length, matchingSteamPool, claim.cellIndex, capacity).forEach((cellIndex) => {
        coveredSteamCells.add(cellIndex);
      });
    }
  });

  return coveredSteamCells;
}

function hasIndependentReactionSource(
  projection: readonly ReactionPriorityProjectionCell[],
  pool: readonly number[],
  directReactionBySource: ReadonlyMap<string, ReactionId>,
  reactionId: ReactionId,
  excludedSourceId: string,
): boolean {
  return pool.some(cellIndex =>
    projection[cellIndex]?.energyClaims.some(claim =>
      claim.towerId !== excludedSourceId && directReactionBySource.get(claim.towerId) === reactionId,
    ),
  );
}

function getPotentialTierOneClaims(
  board: BoardState,
  projection: readonly ReactionPriorityProjectionCell[],
  energySources: readonly EnergySource[],
  reaction: ReactionDefinition,
): readonly { readonly cellIndex: number, readonly source: EnergySource }[] {
  const substanceId = reaction.inputs.find(isSubstance);
  const energyId = reaction.inputs.find(isEnergy);

  if (!substanceId || !energyId) {
    return [];
  }

  const substanceCells = new Set(projection.filter(cell => cell.substances.has(substanceId)).map(cell => cell.cellIndex));

  return collectConnectedPools(board.pathCells.length, substanceCells).flatMap(pool =>
    assignEnergyToPool(
      board.pathCells.length,
      pool,
      energySources
        .filter(source => source.emitterId === energyId && source.cellIndexes.some(cellIndex => pool.includes(cellIndex)))
        .map(source => ({
          ...source,
          capacity: getTierOneEnergyReactionCapacity(source),
        })),
    ),
  );
}

function getContextIndexes(pathCellCount: number, cellIndex: number): readonly number[] {
  return [
    (cellIndex - 1 + pathCellCount) % pathCellCount,
    cellIndex,
    (cellIndex + 1) % pathCellCount,
  ];
}

function getClosestPoolCells(pathCellCount: number, pool: readonly number[], sourceCellIndex: number, capacity: number): readonly number[] {
  return [...pool]
    .sort((left, right) =>
      ringDistance(pathCellCount, sourceCellIndex, left) - ringDistance(pathCellCount, sourceCellIndex, right)
      || left - right,
    )
    .slice(0, capacity);
}

function ringDistance(pathCellCount: number, from: number, to: number): number {
  const direct = Math.abs(from - to);

  return Math.min(direct, pathCellCount - direct);
}

function isSubstance(input: ReactionInputId): input is SubstanceId {
  return input === "water" || input === "oil";
}

function isEnergy(input: ReactionInputId): input is EnergyId {
  return input === "spark" || input === "heat";
}

function isReactionId(input: ReactionInputId, config: GameConfig): input is ReactionId {
  return config.reactions.some(reaction => reaction.id === input);
}
