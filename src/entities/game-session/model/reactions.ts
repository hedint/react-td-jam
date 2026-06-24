/* eslint-disable max-lines */
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
const tierOneEnergyCellReactionCapacity = 2;
const higherTierCatalystCapacity = 3;

interface EmitterToken {
  readonly kind: "emitter"
  readonly id: string
  readonly inputId: EmitterId
  readonly cellIndex: number
  readonly originOrder: number
  readonly sourceId: string
  readonly towerId: string
  readonly slotId: string
}

interface ReactionToken {
  readonly kind: "reaction"
  readonly id: string
  readonly inputId: ReactionId
  readonly cellIndex: number
  readonly originOrder: number
  readonly tier: ReactionDefinition["tier"]
  readonly layer: ReactionDefinition["layer"]
  readonly allocationId: string
}

type InputToken = EmitterToken | ReactionToken;

interface AllocationCandidate {
  readonly id: string
  readonly reactionId: ReactionId
  readonly reactionIndex: number
  readonly selectionRank: number
  readonly tier: ReactionDefinition["tier"]
  readonly layer: ReactionDefinition["layer"]
  readonly anchorCellIndex: number
  readonly originOrder: number
  readonly consumedTokenIds: readonly string[]
  readonly producedCellIndexes: readonly number[]
  readonly producedTokenIds: readonly string[]
}

interface MutableProjection {
  readonly cellIndex: number
  readonly substances: Set<SubstanceId>
  readonly energy: Set<EnergyId>
  readonly directEnergy: Set<EnergyId>
  readonly energyClaims: CellEnergyClaim[]
}

interface EnergyTokenGroup {
  readonly tokens: readonly EmitterToken[]
  readonly pool: readonly number[]
}

interface CoverageClaim {
  readonly sourceId: string
  readonly sourceAnchorCellIndex: number
  readonly cellIndex: number
}

interface ReactionModel {
  readonly projection: readonly MutableProjection[]
  readonly reactions: readonly CellReactionState[]
}

let lastReactionModelCache: {
  readonly board: BoardState
  readonly placedTowers: readonly TowerState[]
  readonly upgrades: readonly UpgradeStackState[]
  readonly config: GameConfig
  readonly model: ReactionModel
} | null = null;

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
        previousCell(pathCellCount, current),
        nextCell(pathCellCount, current),
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

export function resolveReactions(
  board: BoardState,
  placedTowers: readonly TowerState[],
  upgrades: readonly UpgradeStackState[] = [],
  config: GameConfig = gameConfig,
): readonly CellReactionState[] {
  return resolveReactionModel(board, placedTowers, upgrades, config).reactions;
}

export function projectReagents(
  board: BoardState,
  placedTowers: readonly TowerState[],
  upgrades: readonly UpgradeStackState[] = [],
  config: GameConfig = gameConfig,
): readonly CellReagentProjection[] {
  return resolveReactionModel(board, placedTowers, upgrades, config).projection.map(cell => ({
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
  _upgrades: readonly UpgradeStackState[] = [],
  config: GameConfig = gameConfig,
  reaction?: CellReactionState,
): number {
  if (!projection) {
    return 1;
  }

  const consumedEmitterIds = getAirReactionConsumedEmitterIds(reaction, config);
  const totalSlow = projection.substances.filter(substance => !consumedEmitterIds.has(substance)).reduce((slow, substance) => {
    const definition = config.emitters.find(emitter => emitter.id === substance);
    const baseSlow = 1 - (definition?.speedMultiplier ?? 1);

    return slow + Math.max(0, baseSlow);
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

function resolveReactionModel(
  board: BoardState,
  placedTowers: readonly TowerState[],
  upgrades: readonly UpgradeStackState[],
  config: GameConfig,
): ReactionModel {
  if (
    lastReactionModelCache
    && lastReactionModelCache.board === board
    && lastReactionModelCache.placedTowers === placedTowers
    && lastReactionModelCache.upgrades === upgrades
    && lastReactionModelCache.config === config
  ) {
    return lastReactionModelCache.model;
  }

  const emitterTokens = createEmitterTokens(board, placedTowers, upgrades, config);
  const tierOneCandidates = createTierOneCandidatesForConfig(board, emitterTokens, upgrades, config);
  const tierOneReactionTokens = createReactionTokens(tierOneCandidates);
  const tierTwoCandidates = createHigherTierCandidatesForConfig(board, tierOneReactionTokens, emitterTokens, 2, config);
  const lowerTierCandidates = [
    ...tierOneCandidates,
    ...tierTwoCandidates,
  ];
  const lowerTierAccepted = acceptCandidates(lowerTierCandidates, [
    ...emitterTokens,
    ...tierOneReactionTokens,
  ]);
  const fireStormAccepted = acceptFireStormCollisionCandidates(
    createFireStormCollisionCandidates(board, lowerTierAccepted.acceptedCandidates, config),
  );
  const consumedReactionTokenIds = new Set([
    ...lowerTierAccepted.consumedReactionTokenIds,
    ...fireStormAccepted.consumedReactionTokenIds,
  ]);
  const acceptedCandidates = [
    ...lowerTierAccepted.acceptedCandidates,
    ...fireStormAccepted.acceptedCandidates,
  ];

  const model = {
    projection: createProjection(board, emitterTokens, acceptedCandidates),
    reactions: createReactionState(board, acceptedCandidates, consumedReactionTokenIds),
  };

  lastReactionModelCache = {
    board,
    placedTowers,
    upgrades,
    config,
    model,
  };

  return model;
}

function createEmitterTokens(
  board: BoardState,
  placedTowers: readonly TowerState[],
  upgrades: readonly UpgradeStackState[],
  config: GameConfig,
): readonly EmitterToken[] {
  const tokens: EmitterToken[] = [];
  const substanceCells = new Map<string, EmitterToken>();

  placedTowers.forEach((tower, placementOrder) => {
    if (tower.slotId === null) {
      return;
    }

    const slot = board.slots.find(candidate => candidate.id === tower.slotId);
    if (!slot) {
      return;
    }

    const coverage = getTowerCoverageClaims(board.pathCells.length, tower.id, slot.cellIndexes, tower.emitterId, upgrades, config);

    coverage.forEach((claim, coverageIndex) => {
      const token: EmitterToken = {
        kind: "emitter",
        id: `emitter:${tower.id}:${tower.emitterId}:${claim.cellIndex}:${coverageIndex}`,
        inputId: tower.emitterId,
        cellIndex: claim.cellIndex,
        originOrder: placementOrder,
        sourceId: claim.sourceId,
        towerId: tower.id,
        slotId: slot.id,
      };

      if (isSubstance(tower.emitterId)) {
        const key = `${tower.emitterId}:${claim.cellIndex}`;
        const existing = substanceCells.get(key);

        if (!existing || compareTokenPriority(token, existing) < 0) {
          substanceCells.set(key, token);
        }

        return;
      }

      tokens.push(token);
    });
  });

  return [
    ...tokens,
    ...substanceCells.values(),
  ].sort((left, right) =>
    left.cellIndex - right.cellIndex
    || left.originOrder - right.originOrder
    || left.id.localeCompare(right.id),
  );
}

function getTowerCoverageClaims(
  pathCellCount: number,
  towerId: string,
  anchorCellIndexes: readonly number[],
  emitterId: EmitterId,
  upgrades: readonly UpgradeStackState[],
  config: GameConfig,
): readonly CoverageClaim[] {
  const baseCoverage = anchorCellIndexes.length;
  const bonus = isSubstance(emitterId)
    ? getUpgradeEffectTotal(upgrades, emitterId, "substanceCoverage", config)
    : getUpgradeEffectTotal(upgrades, emitterId, "energyCapacity", config);
  const targetCount = baseCoverage * (1 + bonus);
  const claims: CoverageClaim[] = anchorCellIndexes.map(anchorCellIndex => ({
    sourceId: createEmitterSourceId(towerId, anchorCellIndex),
    sourceAnchorCellIndex: anchorCellIndex,
    cellIndex: anchorCellIndex,
  }));
  const coverage = new Set(anchorCellIndexes);
  let distance = 1;

  const addClaim = (sourceAnchorCellIndex: number, cellIndex: number): void => {
    if (coverage.has(cellIndex)) {
      return;
    }

    coverage.add(cellIndex);
    claims.push({
      sourceId: createEmitterSourceId(towerId, sourceAnchorCellIndex),
      sourceAnchorCellIndex,
      cellIndex,
    });
  };

  while (coverage.size < targetCount) {
    for (const anchor of anchorCellIndexes) {
      addClaim(anchor, (anchor + distance) % pathCellCount);

      if (coverage.size >= targetCount) {
        break;
      }
    }

    if (coverage.size >= targetCount) {
      break;
    }

    for (const anchor of anchorCellIndexes) {
      addClaim(anchor, (anchor - distance + pathCellCount) % pathCellCount);

      if (coverage.size >= targetCount) {
        break;
      }
    }

    distance += 1;
  }

  return claims.sort((left, right) =>
    left.cellIndex - right.cellIndex
    || left.sourceAnchorCellIndex - right.sourceAnchorCellIndex
    || left.sourceId.localeCompare(right.sourceId),
  );
}

function createTierOneCandidatesForConfig(
  board: BoardState,
  emitterTokens: readonly EmitterToken[],
  upgrades: readonly UpgradeStackState[],
  config: GameConfig,
): readonly AllocationCandidate[] {
  const definitions = getReactionDefinitionsByTier(config, 1);
  return definitions.flatMap(({ definition, reactionIndex }) =>
    createTierOneCandidates(board, emitterTokens, upgrades, config, definition, reactionIndex));
}

function createTierOneCandidates(
  board: BoardState,
  emitterTokens: readonly EmitterToken[],
  upgrades: readonly UpgradeStackState[],
  config: GameConfig,
  definition: ReactionDefinition,
  reactionIndex: number,
): readonly AllocationCandidate[] {
  const substanceId = definition.inputs.find(isSubstance);
  const energyId = definition.inputs.find(isEnergy);

  if (!substanceId || !energyId) {
    return [];
  }

  const substanceTokens = emitterTokens.filter(token => token.inputId === substanceId);
  const energyTokens = emitterTokens.filter(token => token.inputId === energyId);
  const substanceTokensByCell = new Map(substanceTokens.map(token => [token.cellIndex, token]));
  const substancePools = collectConnectedPools(board.pathCells.length, new Set(substanceTokens.map(token => token.cellIndex)));

  return getEnergyTokenGroupsByPool(energyTokens, substancePools).flatMap((energyGroup) => {
    const anchorEnergyToken = energyGroup.tokens.find(token => substanceTokensByCell.has(token.cellIndex));
    const anchorSubstanceToken = anchorEnergyToken ? substanceTokensByCell.get(anchorEnergyToken.cellIndex) : undefined;

    if (!anchorEnergyToken || !anchorSubstanceToken) {
      return [];
    }

    const selectedSubstanceSelections = getSpreadCellSelectionsByPriority(
      board.pathCells.length,
      energyGroup.pool,
      anchorEnergyToken.cellIndex,
      energyGroup.tokens.length * tierOneEnergyCellReactionCapacity,
    );
    const originOrder = Math.max(anchorEnergyToken.originOrder, anchorSubstanceToken.originOrder);

    return selectedSubstanceSelections.map((selectedSubstanceCellsPrefix, selectionRank) => {
      const selectedSubstanceTokens = selectedSubstanceCellsPrefix
        .map(cellIndex => substanceTokensByCell.get(cellIndex))
        .filter((token): token is EmitterToken => token !== undefined);
      const producedCellIndexes = sortCellIndexes(definition.id === "steam"
        ? getSteamProducedCellIndexes(board.pathCells.length, selectedSubstanceCellsPrefix, anchorEnergyToken.cellIndex, upgrades, config)
        : selectedSubstanceCellsPrefix);
      const id = `allocation:${definition.id}:${anchorEnergyToken.sourceId}:${anchorEnergyToken.cellIndex}:${selectedSubstanceCellsPrefix.join("-")}`;

      return {
        id,
        reactionId: definition.id,
        reactionIndex,
        selectionRank,
        tier: definition.tier,
        layer: definition.layer,
        anchorCellIndex: anchorEnergyToken.cellIndex,
        originOrder,
        consumedTokenIds: [...energyGroup.tokens.map(token => token.id), ...selectedSubstanceTokens.map(token => token.id)],
        producedCellIndexes,
        producedTokenIds: producedCellIndexes.map(cellIndex => createReactionTokenId(id, definition.id, cellIndex)),
      };
    });
  });
}

function getSteamProducedCellIndexes(
  pathCellCount: number,
  selectedWaterCells: readonly number[],
  anchorCellIndex: number,
  upgrades: readonly UpgradeStackState[],
  config: GameConfig,
): readonly number[] {
  const produced = new Set(selectedWaterCells);
  const maxSteamPoolSize = 2 + getSteamExpansionBonus(upgrades, config);
  let cursor = anchorCellIndex;

  while (produced.size < maxSteamPoolSize) {
    cursor = nextCell(pathCellCount, cursor);
    produced.add(cursor);
  }

  return sortCellIndexes([...produced]);
}

function createHigherTierCandidatesForConfig(
  board: BoardState,
  reactionTokens: readonly ReactionToken[],
  emitterTokens: readonly EmitterToken[],
  tier: 2 | 3,
  config: GameConfig,
): readonly AllocationCandidate[] {
  const definitions = getReactionDefinitionsByTier(config, tier);
  return definitions.flatMap(({ definition, reactionIndex }) =>
    createHigherTierCandidates(board, reactionTokens, emitterTokens, definition, reactionIndex, config));
}

function createHigherTierCandidates(
  board: BoardState,
  reactionTokens: readonly ReactionToken[],
  emitterTokens: readonly EmitterToken[],
  definition: ReactionDefinition,
  reactionIndex: number,
  config: GameConfig,
): readonly AllocationCandidate[] {
  const reactionInputs = definition.inputs.filter(input => isReactionId(input, config));
  const energyInputs = definition.inputs.filter(isEnergy);

  if (reactionInputs.length === 0) {
    return [];
  }

  if (energyInputs.length > 0) {
    return createEnergyCatalyzedCandidates(board, reactionTokens, emitterTokens, definition, reactionIndex, reactionInputs[0]!, energyInputs[0]!);
  }

  if (reactionInputs.length >= 2) {
    return createReactionCatalyzedCandidates(board, reactionTokens, definition, reactionIndex, reactionInputs[1]!, reactionInputs[0]!);
  }

  return [];
}

function createEnergyCatalyzedCandidates(
  board: BoardState,
  reactionTokens: readonly ReactionToken[],
  emitterTokens: readonly EmitterToken[],
  definition: ReactionDefinition,
  reactionIndex: number,
  spreadReactionId: ReactionId,
  energyId: EnergyId,
): readonly AllocationCandidate[] {
  const spreadTokens = reactionTokens.filter(token => token.inputId === spreadReactionId);
  const spreadTokensByCell = groupReactionTokensByCell(spreadTokens);
  const pools = collectConnectedPools(board.pathCells.length, new Set(spreadTokens.map(token => token.cellIndex)));
  const energyTokens = emitterTokens.filter(token => token.inputId === energyId);

  return getEnergyTokenGroupsByPool(energyTokens, pools).flatMap((energyGroup) => {
    const anchorEnergyToken = energyGroup.tokens.find(token => spreadTokensByCell.has(token.cellIndex));
    const anchorSpreadTokens = anchorEnergyToken ? spreadTokensByCell.get(anchorEnergyToken.cellIndex) ?? [] : [];

    if (!anchorEnergyToken || anchorSpreadTokens.length === 0) {
      return [];
    }

    return anchorSpreadTokens.flatMap((anchorSpreadToken) => {
      const selectedCellSelections = getSpreadCellSelectionsByPriority(
        board.pathCells.length,
        energyGroup.pool,
        anchorEnergyToken.cellIndex,
        energyGroup.tokens.length * higherTierCatalystCapacity,
      );
      const originOrder = Math.max(anchorEnergyToken.originOrder, anchorSpreadToken.originOrder);

      return selectedCellSelections.flatMap((selectedCellsPrefix, selectionRank) => {
        const selectedReactionTokens = getSelectedReactionTokens(selectedCellsPrefix, spreadTokensByCell, anchorSpreadToken);

        if (selectedReactionTokens.length !== selectedCellsPrefix.length) {
          return [];
        }

        const producedCellIndexes = sortCellIndexes(selectedCellsPrefix);
        const id = `allocation:${definition.id}:${anchorEnergyToken.sourceId}:${anchorSpreadToken.id}:${anchorEnergyToken.cellIndex}:${selectedCellsPrefix.join("-")}`;

        return [{
          id,
          reactionId: definition.id,
          reactionIndex,
          selectionRank,
          tier: definition.tier,
          layer: definition.layer,
          anchorCellIndex: anchorEnergyToken.cellIndex,
          originOrder,
          consumedTokenIds: [...energyGroup.tokens.map(token => token.id), ...selectedReactionTokens.map(token => token.id)],
          producedCellIndexes,
          producedTokenIds: producedCellIndexes.map(cellIndex => createReactionTokenId(id, definition.id, cellIndex)),
        }];
      });
    });
  });
}

function createReactionCatalyzedCandidates(
  board: BoardState,
  reactionTokens: readonly ReactionToken[],
  definition: ReactionDefinition,
  reactionIndex: number,
  spreadReactionId: ReactionId,
  catalystReactionId: ReactionId,
): readonly AllocationCandidate[] {
  const spreadTokens = reactionTokens.filter(token => token.inputId === spreadReactionId);
  const catalystTokens = reactionTokens.filter(token => token.inputId === catalystReactionId);
  const spreadTokensByCell = groupReactionTokensByCell(spreadTokens);
  const pools = collectConnectedPools(board.pathCells.length, new Set(spreadTokens.map(token => token.cellIndex)));

  return catalystTokens.flatMap((catalystToken) => {
    const anchorSpreadTokens = spreadTokensByCell.get(catalystToken.cellIndex) ?? [];
    const pool = pools.find(candidate => candidate.includes(catalystToken.cellIndex));

    if (anchorSpreadTokens.length === 0 || !pool) {
      return [];
    }

    return anchorSpreadTokens.flatMap((anchorSpreadToken) => {
      const originOrder = Math.max(catalystToken.originOrder, anchorSpreadToken.originOrder);

      return getSpreadCellSelectionsByPriority(board.pathCells.length, pool, catalystToken.cellIndex, higherTierCatalystCapacity)
        .flatMap((selectedCells, selectionRank) => {
          const selectedSpreadTokens = getSelectedReactionTokens(selectedCells, spreadTokensByCell, anchorSpreadToken);

          if (selectedSpreadTokens.length !== selectedCells.length) {
            return [];
          }

          const consumedTokenIds = [
            catalystToken.id,
            ...selectedSpreadTokens.map(token => token.id),
          ];
          const producedCellIndexes = sortCellIndexes(selectedCells);
          const id = `allocation:${definition.id}:${catalystToken.id}:${anchorSpreadToken.id}:${catalystToken.cellIndex}:${selectedCells.join("-")}`;

          return [{
            id,
            reactionId: definition.id,
            reactionIndex,
            selectionRank,
            tier: definition.tier,
            layer: definition.layer,
            anchorCellIndex: catalystToken.cellIndex,
            originOrder,
            consumedTokenIds: [...new Set(consumedTokenIds)],
            producedCellIndexes,
            producedTokenIds: producedCellIndexes.map(cellIndex => createReactionTokenId(id, definition.id, cellIndex)),
          }];
        });
    });
  });
}

function createFireStormCollisionCandidates(
  board: BoardState,
  acceptedCandidates: readonly AllocationCandidate[],
  config: GameConfig,
): readonly AllocationCandidate[] {
  const definitionEntry = config.reactions
    .map((definition, reactionIndex) => ({ definition, reactionIndex }))
    .find(entry => entry.definition.id === "fireStorm");

  if (!definitionEntry) {
    return [];
  }

  const fireVortexCandidates = acceptedCandidates.filter(candidate => candidate.reactionId === "fireVortex");
  const stormCloudCandidates = acceptedCandidates.filter(candidate => candidate.reactionId === "stormCloud");
  const candidates = new Map<string, AllocationCandidate>();

  fireVortexCandidates.forEach((fireVortex) => {
    stormCloudCandidates.forEach((stormCloud) => {
      const collision = getPoolCollision(board.pathCells.length, fireVortex.producedCellIndexes, stormCloud.producedCellIndexes);

      if (!collision) {
        return;
      }

      const producedCellIndexes = sortCellIndexes([...new Set([
        ...fireVortex.producedCellIndexes,
        ...stormCloud.producedCellIndexes,
      ])]);
      const consumedTokenIds = [...new Set([
        ...fireVortex.producedTokenIds,
        ...stormCloud.producedTokenIds,
      ])];
      const originOrder = Math.max(
        fireVortex.originOrder,
        stormCloud.originOrder,
      );
      const id = `allocation:fireStorm:${stormCloud.id}:${collision.catalystCellIndex}:${fireVortex.id}:${collision.spreadCellIndex}:${producedCellIndexes.join("-")}`;

      candidates.set(id, {
        id,
        reactionId: definitionEntry.definition.id,
        reactionIndex: definitionEntry.reactionIndex,
        selectionRank: -producedCellIndexes.length,
        tier: definitionEntry.definition.tier,
        layer: definitionEntry.definition.layer,
        anchorCellIndex: Math.min(collision.spreadCellIndex, collision.catalystCellIndex),
        originOrder,
        consumedTokenIds,
        producedCellIndexes,
        producedTokenIds: producedCellIndexes.map(cellIndex => createReactionTokenId(id, definitionEntry.definition.id, cellIndex)),
      });
    });
  });

  return [...candidates.values()];
}

function getPoolCollision(
  pathCellCount: number,
  fireVortexPool: readonly number[],
  stormCloudPool: readonly number[],
): { readonly spreadCellIndex: number, readonly catalystCellIndex: number } | null {
  for (const spreadCellIndex of fireVortexPool) {
    for (const catalystCellIndex of stormCloudPool) {
      if (areNeighborCells(pathCellCount, spreadCellIndex, catalystCellIndex)) {
        return { spreadCellIndex, catalystCellIndex };
      }
    }
  }

  return null;
}

function acceptFireStormCollisionCandidates(candidates: readonly AllocationCandidate[]): {
  readonly acceptedCandidates: readonly AllocationCandidate[]
  readonly consumedReactionTokenIds: ReadonlySet<string>
} {
  const consumedReactionTokenIds = new Set<string>();
  const acceptedCandidates: AllocationCandidate[] = [];

  getAllocationPriorityOrder(candidates).forEach((candidate) => {
    if (candidate.consumedTokenIds.some(tokenId => consumedReactionTokenIds.has(tokenId))) {
      return;
    }

    candidate.consumedTokenIds.forEach(tokenId => consumedReactionTokenIds.add(tokenId));
    acceptedCandidates.push(candidate);
  });

  return { acceptedCandidates, consumedReactionTokenIds };
}

function acceptCandidates(
  candidates: readonly AllocationCandidate[],
  tokens: readonly InputToken[],
): {
  readonly acceptedCandidates: readonly AllocationCandidate[]
  readonly consumedReactionTokenIds: ReadonlySet<string>
} {
  const tokenById = new Map(tokens.map(token => [token.id, token]));
  const candidateById = new Map(candidates.map(candidate => [candidate.id, candidate]));
  const consumedEmitterTokenOwnerById = new Map<string, string>();
  const consumedReactionTokenIds = new Set<string>();
  const acceptedById = new Map<string, AllocationCandidate>();

  getAllocationPriorityOrder(candidates).forEach((candidate) => {
    const closure = getCandidateClosure(candidate, candidateById, tokenById);

    if (!closure || hasCandidateClosureConflict(closure, tokenById, consumedEmitterTokenOwnerById, consumedReactionTokenIds)) {
      return;
    }

    closure.forEach((closureCandidate) => {
      closureCandidate.consumedTokenIds.forEach((tokenId) => {
        const token = tokenById.get(tokenId);

        if (!token) {
          return;
        }

        if (token.kind === "emitter") {
          consumedEmitterTokenOwnerById.set(tokenId, closureCandidate.id);
          return;
        }

        consumedReactionTokenIds.add(tokenId);
      });

      acceptedById.set(closureCandidate.id, closureCandidate);
    });
  });

  return {
    acceptedCandidates: [...acceptedById.values()],
    consumedReactionTokenIds,
  };
}

function getCandidateClosure(
  candidate: AllocationCandidate,
  candidateById: ReadonlyMap<string, AllocationCandidate>,
  tokenById: ReadonlyMap<string, InputToken>,
  visitedCandidateIds = new Set<string>(),
): readonly AllocationCandidate[] | null {
  if (visitedCandidateIds.has(candidate.id)) {
    return [];
  }

  visitedCandidateIds.add(candidate.id);

  const producers = candidate.consumedTokenIds.flatMap((tokenId) => {
    const token = tokenById.get(tokenId);

    if (!token) {
      return [null];
    }

    if (token.kind === "emitter") {
      return [];
    }

    const producer = candidateById.get(token.allocationId);

    if (!producer) {
      return [null];
    }

    return getCandidateClosure(producer, candidateById, tokenById, visitedCandidateIds);
  });

  if (producers.includes(null)) {
    return null;
  }

  return [
    ...(producers as AllocationCandidate[]),
    candidate,
  ].filter((entry, index, entries) =>
    entries.findIndex(candidateEntry => candidateEntry.id === entry.id) === index);
}

function hasCandidateClosureConflict(
  closure: readonly AllocationCandidate[],
  tokenById: ReadonlyMap<string, InputToken>,
  consumedEmitterTokenOwnerById: ReadonlyMap<string, string>,
  consumedReactionTokenIds: ReadonlySet<string>,
): boolean {
  const closureIds = new Set(closure.map(candidate => candidate.id));
  const localConsumedEmitterTokenIds = new Set<string>();
  const localConsumedReactionTokenIds = new Set<string>();

  return closure.some(candidate =>
    candidate.consumedTokenIds.some((tokenId) => {
      const token = tokenById.get(tokenId);

      if (!token) {
        return true;
      }

      if (token.kind === "emitter") {
        const ownerId = consumedEmitterTokenOwnerById.get(tokenId);

        if (ownerId !== undefined && !closureIds.has(ownerId)) {
          return true;
        }

        if (localConsumedEmitterTokenIds.has(tokenId)) {
          return true;
        }

        localConsumedEmitterTokenIds.add(tokenId);

        return false;
      }

      if (consumedReactionTokenIds.has(tokenId) || localConsumedReactionTokenIds.has(tokenId)) {
        return true;
      }

      localConsumedReactionTokenIds.add(tokenId);

      return false;
    }));
}

function createReactionTokens(candidates: readonly AllocationCandidate[]): readonly ReactionToken[] {
  return candidates.flatMap(candidate =>
    candidate.producedCellIndexes.map((cellIndex, index) => ({
      kind: "reaction" as const,
      id: candidate.producedTokenIds[index]!,
      inputId: candidate.reactionId,
      cellIndex,
      originOrder: candidate.originOrder,
      tier: candidate.tier,
      layer: candidate.layer,
      allocationId: candidate.id,
    })));
}

function createProjection(
  board: BoardState,
  emitterTokens: readonly EmitterToken[],
  acceptedCandidates: readonly AllocationCandidate[],
): readonly MutableProjection[] {
  const projection = board.pathCells.map<MutableProjection>(cell => ({
    cellIndex: cell.index,
    substances: new Set<SubstanceId>(),
    energy: new Set<EnergyId>(),
    directEnergy: new Set<EnergyId>(),
    energyClaims: [],
  }));
  const emitterTokenById = new Map(emitterTokens.map(token => [token.id, token]));

  emitterTokens.forEach((token) => {
    const cell = projection[token.cellIndex];

    if (!cell) {
      return;
    }

    if (isSubstance(token.inputId)) {
      cell.substances.add(token.inputId);
      return;
    }

    cell.directEnergy.add(token.inputId);
  });

  acceptedCandidates
    .filter(candidate => candidate.tier === 1)
    .forEach((candidate) => {
      const energyTokens = candidate.consumedTokenIds
        .map(tokenId => emitterTokenById.get(tokenId))
        .filter((token): token is EmitterToken & { readonly inputId: EnergyId } => token !== undefined && isEnergy(token.inputId));

      candidate.producedCellIndexes.forEach((cellIndex) => {
        const cell = projection[cellIndex];

        if (!cell) {
          return;
        }

        energyTokens.forEach((token) => {
          cell.energy.add(token.inputId);
          cell.energyClaims.push({
            emitterId: token.inputId,
            towerId: token.towerId,
            slotId: token.slotId,
          });
        });
      });
    });

  return projection;
}

function createReactionState(
  board: BoardState,
  acceptedCandidates: readonly AllocationCandidate[],
  consumedReactionTokenIds: ReadonlySet<string>,
): readonly CellReactionState[] {
  const reactions = board.pathCells.map(cell => ({
    cellIndex: cell.index,
    ground: null,
    air: null,
  } satisfies CellReactionState));

  getRenderPriorityOrder(acceptedCandidates).forEach((candidate) => {
    candidate.producedCellIndexes.forEach((cellIndex, index) => {
      const tokenId = candidate.producedTokenIds[index];

      if (!tokenId || consumedReactionTokenIds.has(tokenId)) {
        return;
      }

      const cell = reactions[cellIndex];

      if (!cell) {
        return;
      }

      reactions[cellIndex] = {
        ...cell,
        [candidate.layer]: candidate.reactionId,
      };
    });
  });

  return reactions;
}

function getSpreadCellSelectionsByPriority(
  pathCellCount: number,
  pool: readonly number[],
  anchorCellIndex: number,
  capacity: number,
): readonly (readonly number[])[] {
  const poolCells = new Set(pool);
  if (!poolCells.has(anchorCellIndex)) {
    return [];
  }

  const forwardCells = getContiguousSpreadCells(pathCellCount, poolCells, anchorCellIndex, nextCell);
  const backwardCells = getContiguousSpreadCells(pathCellCount, poolCells, anchorCellIndex, previousCell);
  const selections: {
    readonly cells: readonly number[]
    readonly forwardCount: number
    readonly backwardCount: number
  }[] = [];
  const maxForwardCount = Math.min(capacity - 1, forwardCells.length);

  for (let forwardCount = 0; forwardCount <= maxForwardCount; forwardCount += 1) {
    const maxBackwardCount = Math.min(capacity - 1 - forwardCount, backwardCells.length);

    for (let backwardCount = 0; backwardCount <= maxBackwardCount; backwardCount += 1) {
      selections.push({
        cells: [
          anchorCellIndex,
          ...forwardCells.slice(0, forwardCount),
          ...backwardCells.slice(0, backwardCount),
        ],
        forwardCount,
        backwardCount,
      });
    }
  }

  return selections.sort((left, right) =>
    right.cells.length - left.cells.length
    || right.forwardCount - left.forwardCount
    || right.backwardCount - left.backwardCount).map(selection => selection.cells);
}

function sortCellIndexes(cellIndexes: readonly number[]): readonly number[] {
  return [...cellIndexes].sort((left, right) => left - right);
}

function getContiguousSpreadCells(
  pathCellCount: number,
  poolCells: ReadonlySet<number>,
  anchorCellIndex: number,
  getNextCell: (pathCellCount: number, cellIndex: number) => number,
): readonly number[] {
  const cells: number[] = [];
  let cellIndex = getNextCell(pathCellCount, anchorCellIndex);

  while (poolCells.has(cellIndex) && cellIndex !== anchorCellIndex) {
    cells.push(cellIndex);
    cellIndex = getNextCell(pathCellCount, cellIndex);
  }

  return cells;
}

function getEnergyTokenGroupsByPool(
  energyTokens: readonly EmitterToken[],
  pools: readonly (readonly number[])[],
): readonly EnergyTokenGroup[] {
  return pools.flatMap((pool) => {
    const poolCells = new Set(pool);
    const tokensBySource = new Map<string, EmitterToken[]>();

    energyTokens
      .filter(token => poolCells.has(token.cellIndex))
      .forEach((token) => {
        const tokens = tokensBySource.get(token.sourceId) ?? [];

        tokens.push(token);
        tokensBySource.set(token.sourceId, tokens);
      });

    return [...tokensBySource.values()].map(tokens => ({
      tokens: [...tokens].sort(compareTokenPriority),
      pool,
    }));
  });
}

function groupReactionTokensByCell(tokens: readonly ReactionToken[]): ReadonlyMap<number, readonly ReactionToken[]> {
  const tokensByCell = new Map<number, ReactionToken[]>();

  tokens.forEach((token) => {
    const cellTokens = tokensByCell.get(token.cellIndex) ?? [];

    cellTokens.push(token);
    tokensByCell.set(token.cellIndex, cellTokens);
  });

  return new Map([...tokensByCell].map(([cellIndex, cellTokens]) => [
    cellIndex,
    cellTokens.sort(compareTokenPriority),
  ]));
}

function getSelectedReactionTokens(
  cellIndexes: readonly number[],
  tokensByCell: ReadonlyMap<number, readonly ReactionToken[]>,
  anchorToken: ReactionToken,
): readonly ReactionToken[] {
  return cellIndexes
    .map((cellIndex) => {
      const cellTokens = tokensByCell.get(cellIndex) ?? [];

      return cellTokens.find(token => token.allocationId === anchorToken.allocationId)
        ?? cellTokens[0];
    })
    .filter((token): token is ReactionToken => token !== undefined);
}

function getAllocationPriorityOrder(candidates: readonly AllocationCandidate[]): readonly AllocationCandidate[] {
  return [...candidates].sort((left, right) =>
    right.tier - left.tier
    || left.originOrder - right.originOrder
    || right.reactionIndex - left.reactionIndex
    || left.anchorCellIndex - right.anchorCellIndex
    || left.selectionRank - right.selectionRank
    || right.consumedTokenIds.length - left.consumedTokenIds.length
    || right.producedCellIndexes.length - left.producedCellIndexes.length
    || left.id.localeCompare(right.id),
  );
}

function getRenderPriorityOrder(candidates: readonly AllocationCandidate[]): readonly AllocationCandidate[] {
  return [...candidates].sort((left, right) =>
    left.tier - right.tier
    || right.originOrder - left.originOrder
    || left.reactionIndex - right.reactionIndex
    || right.anchorCellIndex - left.anchorCellIndex
    || right.id.localeCompare(left.id),
  );
}

function getReactionDefinitionsByTier(
  config: GameConfig,
  tier: ReactionDefinition["tier"],
): readonly { readonly definition: ReactionDefinition, readonly reactionIndex: number }[] {
  return config.reactions
    .map((definition, reactionIndex) => ({ definition, reactionIndex }))
    .filter(entry => entry.definition.tier === tier);
}

function createReactionTokenId(allocationId: string, reactionId: ReactionId, cellIndex: number): string {
  return `reaction:${allocationId}:${reactionId}:${cellIndex}`;
}

function createEmitterSourceId(towerId: string, anchorCellIndex: number): string {
  return `${towerId}:${anchorCellIndex}`;
}

function compareTokenPriority(left: InputToken, right: InputToken): number {
  return left.originOrder - right.originOrder
    || left.cellIndex - right.cellIndex
    || left.id.localeCompare(right.id);
}

function getSteamExpansionBonus(upgrades: readonly UpgradeStackState[], config: GameConfig): number {
  return Math.max(
    getUpgradeEffectTotal(upgrades, "water", "substanceCoverage", config),
    getUpgradeEffectTotal(upgrades, "heat", "energyCapacity", config),
  );
}

function getUpgradeEffectTotal(
  upgrades: readonly UpgradeStackState[],
  emitterId: EmitterId,
  effectType: "energyCapacity" | "substanceCoverage",
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

function nextCell(pathCellCount: number, cellIndex: number): number {
  return (cellIndex + 1) % pathCellCount;
}

function previousCell(pathCellCount: number, cellIndex: number): number {
  return (cellIndex - 1 + pathCellCount) % pathCellCount;
}

function areNeighborCells(pathCellCount: number, leftCellIndex: number, rightCellIndex: number): boolean {
  return nextCell(pathCellCount, leftCellIndex) === rightCellIndex
    || previousCell(pathCellCount, leftCellIndex) === rightCellIndex;
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
