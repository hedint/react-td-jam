import type {
  BoardState,
  CellReactionState,
  EmitterId,
  GameConfig,
  ReactionDefinition,
  ReactionId,
  ReactionInputId,
  TowerState,
  UpgradeStackState,
} from "./types";

export type EnergyId = Extract<EmitterId, "spark" | "heat">;

export interface EnergySource {
  readonly emitterId: EnergyId
  readonly towerId: string
  readonly slotId: string
  readonly cellIndexes: readonly number[]
  readonly capacity: number
}

export type TierEnergyCoverage = ReadonlyMap<ReactionId, ReadonlyMap<EnergyId, ReadonlySet<number>>>;
export type TierReactionCoverage = ReadonlyMap<ReactionId, ReadonlySet<number>>;

export interface TierEnergyCoverageResult {
  readonly coverage: TierEnergyCoverage
  readonly directReactionBySource: ReadonlyMap<string, ReactionId>
}

const tierOneEnergyCellReactionCapacity = 2;

export function getTierOneEnergyReactionCapacity(source: EnergySource): number {
  return source.capacity * tierOneEnergyCellReactionCapacity;
}

export function collectConnectedPools(pathCellCount: number, cells: ReadonlySet<number>): readonly (readonly number[])[] {
  const unvisited = new Set(cells);
  const pools: number[][] = [];

  while (unvisited.size > 0) {
    const start = Math.min(...unvisited);
    const pool = new Set<number>([start]);
    const queue = [start];

    unvisited.delete(start);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = [
        (current - 1 + pathCellCount) % pathCellCount,
        (current + 1) % pathCellCount,
      ];

      neighbors.forEach((neighbor) => {
        if (!unvisited.has(neighbor)) {
          return;
        }

        unvisited.delete(neighbor);
        pool.add(neighbor);
        queue.push(neighbor);
      });
    }

    pools.push([...pool].sort((left, right) => left - right));
  }

  return pools.sort((left, right) => left[0]! - right[0]!);
}

export function collectEnergySources(
  board: BoardState,
  placedTowers: readonly TowerState[],
  upgrades: readonly UpgradeStackState[],
  config: GameConfig,
  getEnergyCapacity: (emitterId: EnergyId, upgrades: readonly UpgradeStackState[], config: GameConfig) => number,
): readonly EnergySource[] {
  return placedTowers.flatMap((tower) => {
    if (tower.slotId === null || !isEnergy(tower.emitterId)) {
      return [];
    }

    const slot = board.slots.find(candidate => candidate.id === tower.slotId);

    if (!slot) {
      return [];
    }

    return [{
      emitterId: tower.emitterId,
      towerId: tower.id,
      slotId: slot.id,
      cellIndexes: getCoverageCellIndexes(board.pathCells.length, slot.cellIndexes, getEnergyCapacity(tower.emitterId, upgrades, config)),
      capacity: getEnergyCapacity(tower.emitterId, upgrades, config),
    }];
  });
}

export function getCoverageCellIndexes(
  pathCellCount: number,
  sourceCellIndexes: readonly number[],
  capacity: number,
): readonly number[] {
  const cellIndexes = new Set(sourceCellIndexes);
  const targetCount = Math.max(capacity, sourceCellIndexes.length);
  let distance = 1;

  while (cellIndexes.size < targetCount) {
    for (const sourceCellIndex of sourceCellIndexes) {
      cellIndexes.add((sourceCellIndex + distance) % pathCellCount);

      if (cellIndexes.size >= targetCount) {
        break;
      }
    }

    if (cellIndexes.size >= targetCount) {
      break;
    }

    for (const sourceCellIndex of sourceCellIndexes) {
      cellIndexes.add((sourceCellIndex - distance + pathCellCount) % pathCellCount);

      if (cellIndexes.size >= targetCount) {
        break;
      }
    }

    distance += 1;
  }

  return [...cellIndexes].sort((left, right) => left - right);
}

export function assignEnergyToPool(
  pathCellCount: number,
  pool: readonly number[],
  sources: readonly EnergySource[],
): readonly { readonly cellIndex: number, readonly source: EnergySource }[] {
  const assignedCellIndexes = new Set<number>();
  const assignedClaims: Array<{ readonly cellIndex: number, readonly source: EnergySource }> = [];
  const remainingBySource = new Map(sources.map(source => [source.towerId, source.capacity]));
  const claims = pool
    .flatMap(cellIndex => sources.map(source => ({
      cellIndex,
      source,
      distance: getSourceDistance(pathCellCount, source, cellIndex),
    })))
    .sort((left, right) =>
      left.distance - right.distance
      || left.source.slotId.localeCompare(right.source.slotId)
      || left.source.towerId.localeCompare(right.source.towerId)
      || left.cellIndex - right.cellIndex,
    );

  claims.forEach((claim) => {
    const remaining = remainingBySource.get(claim.source.towerId) ?? 0;

    if (remaining <= 0 || assignedCellIndexes.has(claim.cellIndex)) {
      return;
    }

    assignedCellIndexes.add(claim.cellIndex);
    assignedClaims.push({
      cellIndex: claim.cellIndex,
      source: claim.source,
    });
    remainingBySource.set(claim.source.towerId, remaining - 1);
  });

  return assignedClaims.sort((left, right) => left.cellIndex - right.cellIndex);
}

export function createTierEnergyCoverage(
  board: BoardState,
  energySources: readonly EnergySource[],
  previous: readonly CellReactionState[],
  definitions: readonly ReactionDefinition[],
  config: GameConfig,
  directReactionBySource: ReadonlyMap<string, ReactionId>,
  capacityBonus = 0,
): TierEnergyCoverage {
  return createTierEnergyCoverageResult(
    board,
    energySources,
    previous,
    definitions,
    config,
    directReactionBySource,
    capacityBonus,
  ).coverage;
}

export function suppressReactionInputsCoveredByTierReactions(
  previous: readonly CellReactionState[],
  definitions: readonly ReactionDefinition[],
  tierReactionCoverage: TierReactionCoverage,
  config: GameConfig,
): readonly CellReactionState[] {
  const consumedReactionIdsByCell = new Map<number, Set<ReactionId>>();

  definitions.forEach((definition) => {
    const coveredCells = tierReactionCoverage.get(definition.id);

    if (!coveredCells) {
      return;
    }

    const reactionInputs = definition.inputs.filter(input => isReactionId(input, config));

    coveredCells.forEach((cellIndex) => {
      const consumedReactionIds = consumedReactionIdsByCell.get(cellIndex) ?? new Set<ReactionId>();

      reactionInputs.forEach((reactionId) => {
        consumedReactionIds.add(reactionId);
      });
      consumedReactionIdsByCell.set(cellIndex, consumedReactionIds);
    });
  });

  return previous.map((reaction) => {
    const consumedReactionIds = consumedReactionIdsByCell.get(reaction.cellIndex);

    if (!consumedReactionIds) {
      return reaction;
    }

    return {
      ...reaction,
      ground: reaction.ground && consumedReactionIds.has(reaction.ground) ? null : reaction.ground,
      air: reaction.air && consumedReactionIds.has(reaction.air) ? null : reaction.air,
    };
  });
}

export function createTierEnergyCoverageResult(
  board: BoardState,
  energySources: readonly EnergySource[],
  previous: readonly CellReactionState[],
  definitions: readonly ReactionDefinition[],
  config: GameConfig,
  directReactionBySource: ReadonlyMap<string, ReactionId>,
  capacityBonus = 0,
): TierEnergyCoverageResult {
  const coverage = new Map<ReactionId, Map<EnergyId, Set<number>>>();
  const assignedReactionBySource = new Map(directReactionBySource);

  definitions.forEach((definition) => {
    const energyInputs = definition.inputs.filter(isEnergy);
    const reactionInputs = definition.inputs.filter(input => isReactionId(input, config));

    if (energyInputs.length === 0 || reactionInputs.length === 0) {
      return;
    }

    const reactionCellIndexes = new Set(
      previous
        .filter(reaction => reactionInputs.some(input => reaction.ground === input || reaction.air === input))
        .map(reaction => reaction.cellIndex),
    );
    const reactionPools = collectConnectedPools(board.pathCells.length, reactionCellIndexes);

    energyInputs.forEach((energyId) => {
      reactionPools.forEach((pool) => {
        const poolSources = energySources
          .filter(source =>
            source.emitterId === energyId
            && canUseEnergySourceForReaction(source, definition.id, assignedReactionBySource)
            && source.cellIndexes.some(sourceCellIndex =>
              pool.some(cellIndex => getContextIndexes(board.pathCells.length, cellIndex).includes(sourceCellIndex)),
            ),
          )
          .map(source => ({
            ...source,
            capacity: source.capacity + capacityBonus,
          }));

        assignEnergyToPool(board.pathCells.length, pool, poolSources).forEach((claim) => {
          const reactionCoverage = coverage.get(definition.id) ?? new Map<EnergyId, Set<number>>();
          const coveredCells = reactionCoverage.get(energyId) ?? new Set<number>();

          coveredCells.add(claim.cellIndex);
          reactionCoverage.set(energyId, coveredCells);
          coverage.set(definition.id, reactionCoverage);
          assignedReactionBySource.set(claim.source.towerId, definition.id);
        });
      });
    });
  });

  return {
    coverage,
    directReactionBySource: assignedReactionBySource,
  };
}

export function createTierReactionCoverage(
  board: BoardState,
  previous: readonly CellReactionState[],
  definitions: readonly ReactionDefinition[],
  capacity: number,
): TierReactionCoverage {
  const coverage = new Map<ReactionId, Set<number>>();

  definitions.forEach((definition) => {
    if (definition.id === "fireVortex") {
      coverage.set(definition.id, coverReactionPool(board, previous, "steam", "fire", capacity));
      return;
    }

    if (definition.id === "fireStorm") {
      coverage.set(definition.id, coverReactionPool(board, previous, "fireVortex", "stormCloud", capacity));
    }
  });

  return coverage;
}

function coverReactionPool(
  board: BoardState,
  previous: readonly CellReactionState[],
  targetReactionId: ReactionId,
  catalystReactionId: ReactionId,
  capacity: number,
): Set<number> {
  const coveredCells = new Set<number>();
  const targetCells = new Set(
    previous
      .filter(reaction => reaction.ground === targetReactionId || reaction.air === targetReactionId)
      .map(reaction => reaction.cellIndex),
  );
  const catalystCells = previous
    .filter(reaction => reaction.ground === catalystReactionId || reaction.air === catalystReactionId)
    .map(reaction => reaction.cellIndex);

  collectConnectedPools(board.pathCells.length, targetCells).forEach((pool) => {
    const nearbyCatalysts = catalystCells.filter(catalystCell =>
      pool.some(cellIndex => getContextIndexes(board.pathCells.length, cellIndex).includes(catalystCell)),
    );

    assignReactionCatalystToPool(board.pathCells.length, pool, nearbyCatalysts, capacity).forEach((cellIndex) => {
      coveredCells.add(cellIndex);
    });
  });

  return coveredCells;
}

function assignReactionCatalystToPool(
  pathCellCount: number,
  pool: readonly number[],
  catalystCells: readonly number[],
  capacity: number,
): readonly number[] {
  const assignedCellIndexes = new Set<number>();
  const remainingByCatalyst = new Map(catalystCells.map(cellIndex => [cellIndex, capacity]));
  const claims = pool
    .flatMap(cellIndex => catalystCells.map(catalystCellIndex => ({
      cellIndex,
      catalystCellIndex,
      distance: ringDistance(pathCellCount, catalystCellIndex, cellIndex),
    })))
    .sort((left, right) =>
      left.distance - right.distance
      || left.catalystCellIndex - right.catalystCellIndex
      || left.cellIndex - right.cellIndex,
    );

  claims.forEach((claim) => {
    const remaining = remainingByCatalyst.get(claim.catalystCellIndex) ?? 0;

    if (remaining <= 0 || assignedCellIndexes.has(claim.cellIndex)) {
      return;
    }

    assignedCellIndexes.add(claim.cellIndex);
    remainingByCatalyst.set(claim.catalystCellIndex, remaining - 1);
  });

  return [...assignedCellIndexes].sort((left, right) => left - right);
}

function getContextIndexes(pathCellCount: number, cellIndex: number): readonly number[] {
  return [
    (cellIndex - 1 + pathCellCount) % pathCellCount,
    cellIndex,
    (cellIndex + 1) % pathCellCount,
  ];
}

function getSourceDistance(pathCellCount: number, source: EnergySource, cellIndex: number): number {
  return Math.min(...source.cellIndexes.map(sourceCell => ringDistance(pathCellCount, sourceCell, cellIndex)));
}

function ringDistance(pathCellCount: number, from: number, to: number): number {
  const direct = Math.abs(from - to);

  return Math.min(direct, pathCellCount - direct);
}

function canUseEnergySourceForReaction(
  source: EnergySource,
  reactionId: ReactionId,
  assignedReactionBySource: ReadonlyMap<string, ReactionId>,
): boolean {
  const assignedReactionId = assignedReactionBySource.get(source.towerId);

  return assignedReactionId === undefined || assignedReactionId === reactionId;
}

function isEnergy(input: ReactionInputId): input is EnergyId {
  return input === "spark" || input === "heat";
}

function isReactionId(input: ReactionInputId, config: GameConfig): input is ReactionId {
  return config.reactions.some(reaction => reaction.id === input);
}
