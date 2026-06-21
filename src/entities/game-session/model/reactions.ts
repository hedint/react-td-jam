import type {
  BoardState,
  CellEnergyClaim,
  CellReactionState,
  CellReagentProjection,
  DamageFamily,
  EmitterId,
  ReactionId,
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

interface DamageEntry {
  readonly reactionId: ReactionId
  readonly layer: "ground" | "air"
  readonly damageFamily: DamageFamily
  readonly amount: number
}

const groundPriority: readonly ReactionId[] = ["fire", "electroPuddle"];
const t2AirPriority: readonly ReactionId[] = ["fireVortex", "stormCloud"];

export function resolveReactions(
  board: BoardState,
  placedTowers: readonly TowerState[],
  upgrades: readonly UpgradeStackState[] = [],
): readonly CellReactionState[] {
  const projection = createMutableProjection(board, placedTowers, upgrades);
  const t1 = resolveTier1(board, projection);
  const t2 = resolveTier2(board, projection, t1);

  return resolveTier3(board, t2);
}

export function projectReagents(
  board: BoardState,
  placedTowers: readonly TowerState[],
  upgrades: readonly UpgradeStackState[] = [],
): readonly CellReagentProjection[] {
  return createMutableProjection(board, placedTowers, upgrades).map(cell => ({
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

export function getReactionDamageEntries(
  reaction: CellReactionState,
  deltaMs: number,
  upgrades: readonly UpgradeStackState[] = [],
): readonly DamageEntry[] {
  return [
    { reactionId: reaction.ground, layer: "ground" as const },
    { reactionId: reaction.air, layer: "air" as const },
  ]
    .filter((entry): entry is { readonly reactionId: ReactionId, readonly layer: "ground" | "air" } => entry.reactionId !== null)
    .map((entry) => {
      const definition = getReactionDefinition(entry.reactionId);

      return {
        reactionId: entry.reactionId,
        layer: entry.layer,
        damageFamily: definition.damageFamily,
        amount: (definition.dps + getReactionDpsBonus(entry.reactionId, upgrades)) * deltaMs / 1000,
      };
    })
    .filter(entry => entry.amount > 0);
}

export function getCellSpeedMultiplier(
  projection: CellReagentProjection | undefined,
  upgrades: readonly UpgradeStackState[] = [],
): number {
  if (!projection) {
    return 1;
  }

  return projection.substances.reduce((multiplier, substance) => {
    const definition = gameConfig.emitters.find(emitter => emitter.id === substance);
    const slowBonus = getSubstanceSlowBonus(substance, upgrades);

    return Math.min(multiplier, Math.max(gameConfig.balance.minSpeedMultiplier, (definition?.speedMultiplier ?? 1) - slowBonus));
  }, 1);
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
        getSubstanceCoverageBonus(emitterId, upgrades),
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
      capacity: getEnergyCapacity(emitterId, upgrades),
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

function resolveTier1(
  board: BoardState,
  projection: readonly MutableProjection[],
): readonly CellReactionState[] {
  return board.pathCells.map<CellReactionState>((cell) => {
    const reagent = projection[cell.index]!;
    const groundCandidates: ReactionId[] = [];
    const hasWater = reagent.substances.has("water");
    const hasOil = reagent.substances.has("oil");
    const hasSpark = reagent.energy.has("spark");
    const hasHeat = reagent.energy.has("heat");

    if (hasWater && hasSpark) {
      groundCandidates.push("electroPuddle");
    }

    if (hasOil && hasHeat) {
      groundCandidates.push("fire");
    }

    return {
      cellIndex: cell.index,
      ground: chooseByPriority(groundCandidates, groundPriority),
      air: hasWater && hasHeat ? "steam" : null,
    };
  });
}

function resolveTier2(
  board: BoardState,
  projection: readonly MutableProjection[],
  t1: readonly CellReactionState[],
): readonly CellReactionState[] {
  return board.pathCells.map<CellReactionState>((cell) => {
    const contextIndexes = getContextIndexes(board.pathCells.length, cell.index);
    const hasSteam = contextIndexes.some(index => t1[index]?.air === "steam");
    const hasFire = contextIndexes.some(index => t1[index]?.ground === "fire");
    const hasSpark = contextIndexes.some(index => projection[index]?.directEnergy.has("spark") || projection[index]?.energy.has("spark"));
    const candidates: ReactionId[] = [];

    if (hasSteam && hasSpark) {
      candidates.push("stormCloud");
    }

    if (hasFire && hasSteam) {
      candidates.push("fireVortex");
    }

    return {
      ...t1[cell.index]!,
      air: chooseByPriority(candidates, t2AirPriority) ?? t1[cell.index]!.air,
    };
  });
}

function resolveTier3(
  board: BoardState,
  t2: readonly CellReactionState[],
): readonly CellReactionState[] {
  return board.pathCells.map<CellReactionState>((cell) => {
    const contextIndexes = getContextIndexes(board.pathCells.length, cell.index);
    const hasStormCloud = contextIndexes.some(index => t2[index]?.air === "stormCloud");
    const hasFireVortex = contextIndexes.some(index => t2[index]?.air === "fireVortex");

    return {
      ...t2[cell.index]!,
      air: hasStormCloud && hasFireVortex ? "fireStorm" : t2[cell.index]!.air,
    };
  });
}

function getReactionDefinition(reactionId: ReactionId) {
  const definition = gameConfig.reactions.find(reaction => reaction.id === reactionId);

  if (!definition) {
    throw new Error(`Unknown reaction ${reactionId}`);
  }

  return definition;
}

function getEnergyCapacity(emitterId: EnergyId, upgrades: readonly UpgradeStackState[]): number {
  return (gameConfig.emitters.find(emitter => emitter.id === emitterId)?.energyCapacity ?? 1)
    + getUpgradeEffectTotal(upgrades, emitterId, "energyCapacity");
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

function getSubstanceCoverageBonus(emitterId: SubstanceId, upgrades: readonly UpgradeStackState[]): number {
  return getUpgradeEffectTotal(upgrades, emitterId, "substanceCoverage");
}

function getSubstanceSlowBonus(emitterId: EmitterId, upgrades: readonly UpgradeStackState[]): number {
  return getUpgradeEffectTotal(upgrades, emitterId, "substanceSlow");
}

function getReactionDpsBonus(reactionId: ReactionId, upgrades: readonly UpgradeStackState[]): number {
  return upgrades.reduce((bonus, stack) => {
    const definition = gameConfig.upgrades.find(upgrade => upgrade.id === stack.upgradeId);

    if (definition?.effect.type !== "reactionDps" || definition.effect.reactionId !== reactionId) {
      return bonus;
    }

    return bonus + definition.effect.amount * stack.stacks;
  }, 0);
}

function getUpgradeEffectTotal(
  upgrades: readonly UpgradeStackState[],
  emitterId: EmitterId,
  effectType: "energyCapacity" | "substanceCoverage" | "substanceSlow",
): number {
  return upgrades.reduce((total, stack) => {
    const definition = gameConfig.upgrades.find(upgrade => upgrade.id === stack.upgradeId);

    if (definition?.emitterId !== emitterId || definition.effect.type !== effectType) {
      return total;
    }

    return total + definition.effect.amount * stack.stacks;
  }, 0);
}

function chooseByPriority<T extends ReactionId>(candidates: readonly T[], priority: readonly ReactionId[]): T | null {
  return [...candidates]
    .sort((left, right) => priority.indexOf(left) - priority.indexOf(right))[0] ?? null;
}

function isSubstance(emitterId: EmitterId): emitterId is SubstanceId {
  return emitterId === "water" || emitterId === "oil";
}

function isEnergy(emitterId: EmitterId): emitterId is EnergyId {
  return emitterId === "spark" || emitterId === "heat";
}
