import type {
  BoardState,
  CellEnergyClaim,
  CellReactionState,
  CellReagentProjection,
  EmitterId,
  GameConfig,
  ReactionDefinition,
  ReactionId,
  ReactionInputId,
  TowerState,
  UpgradeStackState,
} from "./types";
import { gameConfig } from "./config";

type SubstanceId = Extract<EmitterId, "water" | "oil">;
type EnergyId = Extract<EmitterId, "spark" | "heat">;

interface EnergySource {
  readonly emitterId: EnergyId
  readonly towerId: string
  readonly slotId: string
  readonly cellIndexes: readonly number[]
  readonly capacity: number
}

interface MutableProjection {
  readonly cellIndex: number
  readonly substances: Set<SubstanceId>
  readonly energy: Set<EnergyId>
  readonly directEnergy: Set<EnergyId>
  readonly energyClaims: CellEnergyClaim[]
}

export function resolveReactions(
  board: BoardState,
  placedTowers: readonly TowerState[],
  upgrades: readonly UpgradeStackState[] = [],
  config: GameConfig = gameConfig,
): readonly CellReactionState[] {
  const projection = createMutableProjection(board, placedTowers, upgrades, config);
  return ([1, 2, 3] as const).reduce(
    (state, tier) => resolveTier(board, projection, state, tier, config),
    createEmptyReactionState(board),
  );
}

export function projectReagents(
  board: BoardState,
  placedTowers: readonly TowerState[],
  upgrades: readonly UpgradeStackState[] = [],
  config: GameConfig = gameConfig,
): readonly CellReagentProjection[] {
  return createMutableProjection(board, placedTowers, upgrades, config).map(cell => ({
    cellIndex: cell.cellIndex,
    substances: [...cell.substances].sort(),
    energy: [...cell.energy].sort(),
    directEnergy: [...cell.directEnergy].sort(),
    energyClaims: [...cell.energyClaims].sort((left, right) =>
      left.emitterId.localeCompare(right.emitterId)
      || left.slotId.localeCompare(right.slotId)
      || left.towerId.localeCompare(right.towerId),
    ),
  }));
}

export function getCellSpeedMultiplier(
  projection: CellReagentProjection | undefined,
  upgrades: readonly UpgradeStackState[] = [],
  config: GameConfig = gameConfig,
  reaction?: CellReactionState,
): number {
  if (!projection) {
    return 1;
  }

  const consumedEmitterIds = getAirReactionConsumedEmitterIds(reaction, config);
  const totalSlow = projection.substances.filter(substance => !consumedEmitterIds.has(substance)).reduce((slow, substance) => {
    const definition = config.emitters.find(emitter => emitter.id === substance);
    const slowBonus = getSubstanceSlowBonus(substance, upgrades, config);
    const baseSlow = 1 - (definition?.speedMultiplier ?? 1);

    return slow + Math.max(0, baseSlow + slowBonus);
  }, 0);

  return Math.max(config.balance.minSpeedMultiplier, 1 - totalSlow);
}

export function getAirReactionConsumedEmitterIds(
  reaction: CellReactionState | undefined,
  config: GameConfig = gameConfig,
): ReadonlySet<EmitterId> {
  if (!reaction?.air) {
    return new Set();
  }

  const definition = config.reactions.find(candidate => candidate.id === reaction.air);
  const emitterIds = new Set(config.emitters.map(emitter => emitter.id));

  return new Set(definition?.inputs.flatMap(input => getReactionInputEmitterIds(input, config, emitterIds, new Set())) ?? []);
}

function getReactionInputEmitterIds(
  input: ReactionInputId,
  config: GameConfig,
  emitterIds: ReadonlySet<string>,
  visitedReactionIds: Set<ReactionId>,
): readonly EmitterId[] {
  if (emitterIds.has(input)) {
    return [input as EmitterId];
  }

  const reactionId = input as ReactionId;
  if (visitedReactionIds.has(reactionId)) {
    return [];
  }

  const definition = config.reactions.find(candidate => candidate.id === reactionId);
  if (!definition) {
    return [];
  }

  visitedReactionIds.add(reactionId);
  return definition.inputs.flatMap(nestedInput => getReactionInputEmitterIds(nestedInput, config, emitterIds, visitedReactionIds));
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

function createMutableProjection(
  board: BoardState,
  placedTowers: readonly TowerState[],
  upgrades: readonly UpgradeStackState[],
  config: GameConfig,
): readonly MutableProjection[] {
  const projection = board.pathCells.map<MutableProjection>(cell => ({
    cellIndex: cell.index,
    substances: new Set<SubstanceId>(),
    energy: new Set<EnergyId>(),
    directEnergy: new Set<EnergyId>(),
    energyClaims: [],
  }));
  const energySources: EnergySource[] = [];

  placedTowers.forEach((tower) => {
    if (tower.slotId === null) {
      return;
    }

    const slot = board.slots.find(candidate => candidate.id === tower.slotId);
    if (!slot) {
      return;
    }

    if (isSubstance(tower.emitterId)) {
      const emitterId = tower.emitterId;
      const cellIndexes = expandCellIndexes(
        board.pathCells.length,
        slot.cellIndexes,
        getSubstanceCoverageBonus(emitterId, upgrades, config),
      );

      cellIndexes.forEach((cellIndex) => {
        projection[cellIndex]?.substances.add(emitterId);
      });
      return;
    }

    if (!isEnergy(tower.emitterId)) {
      return;
    }

    const emitterId = tower.emitterId;

    slot.cellIndexes.forEach((cellIndex) => {
      projection[cellIndex]?.directEnergy.add(emitterId);
    });
    energySources.push({
      emitterId,
      towerId: tower.id,
      slotId: slot.id,
      cellIndexes: slot.cellIndexes,
      capacity: getEnergyCapacity(emitterId, upgrades, config),
    });
  });

  (["water", "oil"] as const).forEach((substanceId) => {
    const substanceCells = new Set(
      projection
        .filter(cell => cell.substances.has(substanceId))
        .map(cell => cell.cellIndex),
    );
    const pools = collectConnectedPools(board.pathCells.length, substanceCells);

    (["spark", "heat"] as const).forEach((energyId) => {
      pools.forEach((pool) => {
        const poolSources = energySources.filter(source =>
          source.emitterId === energyId && source.cellIndexes.some(cellIndex => pool.includes(cellIndex)),
        );

        assignEnergyToPool(board.pathCells.length, pool, poolSources).forEach((claim) => {
          projection[claim.cellIndex]?.energy.add(energyId);
          projection[claim.cellIndex]?.energyClaims.push({
            emitterId: energyId,
            towerId: claim.source.towerId,
            slotId: claim.source.slotId,
          });
        });
      });
    });
  });

  return projection;
}

function assignEnergyToPool(
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

function createEmptyReactionState(board: BoardState): readonly CellReactionState[] {
  return board.pathCells.map(cell => ({
    cellIndex: cell.index,
    ground: null,
    air: null,
  }));
}

function resolveTier(
  board: BoardState,
  projection: readonly MutableProjection[],
  previous: readonly CellReactionState[],
  tier: ReactionDefinition["tier"],
  config: GameConfig,
): readonly CellReactionState[] {
  const definitions = config.reactions.filter(reaction => reaction.tier === tier);

  const resolved = board.pathCells.map<CellReactionState>((cell) => {
    const resolved = definitions
      .filter(reaction => hasReactionInputs(board, projection, previous, tier, cell.index, reaction.inputs, config))
      .reduce<CellReactionState>((state, reaction) => ({
        ...state,
        [reaction.layer]: reaction.id,
      }), previous[cell.index]!);

    return {
      cellIndex: cell.index,
      ground: resolved.ground,
      air: resolved.air,
    };
  });

  return tier === 1 ? extendSteamToNextCell(resolved) : resolved;
}

function extendSteamToNextCell(reactions: readonly CellReactionState[]): readonly CellReactionState[] {
  const steamCellIndexes = reactions
    .filter(reaction => reaction.air === "steam")
    .map(reaction => reaction.cellIndex);

  if (steamCellIndexes.length === 0) {
    return reactions;
  }

  const expandedSteamCellIndexes = new Set([
    ...steamCellIndexes,
    ...steamCellIndexes.map(cellIndex => (cellIndex + 1) % reactions.length),
  ]);

  return reactions.map((reaction) => {
    if (!expandedSteamCellIndexes.has(reaction.cellIndex) || reaction.air !== null) {
      return reaction;
    }

    return {
      ...reaction,
      air: "steam",
    };
  });
}

function hasReactionInputs(
  board: BoardState,
  projection: readonly MutableProjection[],
  previous: readonly CellReactionState[],
  tier: ReactionDefinition["tier"],
  cellIndex: number,
  inputs: readonly ReactionInputId[],
  config: GameConfig,
): boolean {
  const indexes = tier === 1
    ? [cellIndex]
    : getContextIndexes(board.pathCells.length, cellIndex);
  const reactionInputs = inputs.filter(input => isReactionId(input, config));
  const hasCurrentReactionAnchor = tier === 1
    || reactionInputs.length === 0
    || reactionInputs.some(input => hasReactionInput(projection[cellIndex], previous[cellIndex], tier, input, config));

  return hasCurrentReactionAnchor
    && inputs.every((input) => {
      return indexes.some(index => hasReactionInput(projection[index], previous[index], tier, input, config));
    });
}

function hasReactionInput(
  projection: MutableProjection | undefined,
  previous: CellReactionState | undefined,
  tier: ReactionDefinition["tier"],
  input: ReactionInputId,
  config: GameConfig,
): boolean {
  if (isReactionId(input, config)) {
    return previous?.ground === input || previous?.air === input;
  }

  if (!projection) {
    return false;
  }

  if (isSubstance(input)) {
    return projection.substances.has(input);
  }

  if (!isEnergy(input)) {
    return false;
  }

  return tier === 1
    ? projection.energy.has(input)
    : projection.energy.has(input) || projection.directEnergy.has(input);
}

function getEnergyCapacity(emitterId: EnergyId, upgrades: readonly UpgradeStackState[], config: GameConfig): number {
  return (config.emitters.find(emitter => emitter.id === emitterId)?.energyCapacity ?? 1)
    + getUpgradeEffectTotal(upgrades, emitterId, "energyCapacity", config);
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

function expandCellIndexes(pathCellCount: number, cellIndexes: readonly number[], radius: number): readonly number[] {
  const expanded = new Set(cellIndexes);

  cellIndexes.forEach((cellIndex) => {
    for (let distance = 1; distance <= radius; distance += 1) {
      expanded.add((cellIndex - distance + pathCellCount) % pathCellCount);
      expanded.add((cellIndex + distance) % pathCellCount);
    }
  });

  return [...expanded].sort((left, right) => left - right);
}

function getSubstanceCoverageBonus(emitterId: SubstanceId, upgrades: readonly UpgradeStackState[], config: GameConfig): number {
  return getUpgradeEffectTotal(upgrades, emitterId, "substanceCoverage", config);
}

function getSubstanceSlowBonus(emitterId: EmitterId, upgrades: readonly UpgradeStackState[], config: GameConfig): number {
  return getUpgradeEffectTotal(upgrades, emitterId, "substanceSlow", config);
}

function getUpgradeEffectTotal(
  upgrades: readonly UpgradeStackState[],
  emitterId: EmitterId,
  effectType: "energyCapacity" | "substanceCoverage" | "substanceSlow",
  config: GameConfig,
): number {
  return upgrades.reduce((total, stack) => {
    const definition = config.upgrades.find(upgrade => upgrade.id === stack.upgradeId);

    if (definition?.emitterId !== emitterId || definition.effect.type !== effectType) {
      return total;
    }

    return total + definition.effect.amount * stack.stacks;
  }, 0);
}

function isSubstance(emitterId: EmitterId): emitterId is SubstanceId {
  return emitterId === "water" || emitterId === "oil";
}

function isEnergy(emitterId: EmitterId): emitterId is EnergyId {
  return emitterId === "spark" || emitterId === "heat";
}

function isReactionId(input: ReactionInputId, config: GameConfig): input is ReactionId {
  return config.reactions.some(reaction => reaction.id === input);
}
