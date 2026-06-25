import type {
  CellReactionState,
  CellReagentProjection,
  DamageFamily,
  DamageSourceId,
  EmitterId,
  GameConfig,
  ReactionId,
  ReactionInputId,
  UpgradeStackState,
} from "./types";
import { gameConfig } from "./config";
import { getAirReactionConsumedEmitterIds } from "./reactions";

export interface DamageEntry {
  readonly sourceId: DamageSourceId
  readonly reactionId: ReactionId
  readonly countsForReactionBreak: true
  readonly layer: "ground" | "air"
  readonly damageFamily: DamageFamily
  readonly amount: number
}

export interface CellDamageEntry {
  readonly sourceId: DamageSourceId
  readonly reactionId: ReactionId | null
  readonly countsForReactionBreak: boolean
  readonly layer: "ground" | "air"
  readonly damageFamily: DamageFamily
  readonly amount: number
}

export function getReactionDamageEntries(
  reaction: CellReactionState,
  deltaMs: number,
  upgrades: readonly UpgradeStackState[] = [],
  config: GameConfig = gameConfig,
): readonly DamageEntry[] {
  return [
    { reactionId: reaction.ground, layer: "ground" as const },
    { reactionId: reaction.air, layer: "air" as const },
  ]
    .filter((entry): entry is { readonly reactionId: ReactionId, readonly layer: "ground" | "air" } => entry.reactionId !== null)
    .map((entry) => {
      const definition = getReactionDefinition(entry.reactionId, config);

      return {
        sourceId: entry.reactionId,
        reactionId: entry.reactionId,
        countsForReactionBreak: true as const,
        layer: entry.layer,
        damageFamily: definition.damageFamily,
        amount: definition.dps * getReactionDamageMultiplier(entry.reactionId, upgrades, config) * deltaMs / 1000,
      };
    })
    .filter(entry => entry.amount > 0);
}

export function getCellDamageEntries(
  reaction: CellReactionState,
  projection: CellReagentProjection | undefined,
  deltaMs: number,
  upgrades: readonly UpgradeStackState[] = [],
  config: GameConfig = gameConfig,
): readonly CellDamageEntry[] {
  const reactionEntries = getReactionDamageEntries(reaction, deltaMs, upgrades, config);

  if (!projection || reaction.ground !== null) {
    return reactionEntries;
  }

  const consumedEmitterIds = getAirReactionConsumedEmitterIds(reaction, config);
  const rawEntries = projection.directEnergy
    .filter(emitterId => !consumedEmitterIds.has(emitterId))
    .map(emitterId => getRawEnergyDamageEntry(emitterId, deltaMs, config))
    .filter((entry): entry is CellDamageEntry => entry !== null);

  return [...reactionEntries, ...rawEntries];
}

function getReactionDefinition(reactionId: ReactionId, config: GameConfig) {
  const definition = config.reactions.find(reaction => reaction.id === reactionId);

  if (!definition) {
    throw new Error(`Unknown reaction ${reactionId}`);
  }

  return definition;
}

function getRawEnergyDamageEntry(emitterId: EmitterId, deltaMs: number, config: GameConfig): CellDamageEntry | null {
  const definition = config.emitters.find(emitter => emitter.id === emitterId);

  if (definition?.family !== "energy" || !definition.rawDps || !definition.rawDamageFamily) {
    return null;
  }

  return {
    sourceId: getRawEnergyDamageSourceId(emitterId),
    reactionId: null,
    countsForReactionBreak: false,
    layer: "ground",
    damageFamily: definition.rawDamageFamily,
    amount: definition.rawDps * deltaMs / 1000,
  };
}

function getRawEnergyDamageSourceId(emitterId: EmitterId): DamageSourceId {
  switch (emitterId) {
    case "spark":
      return "rawSpark";
    case "heat":
      return "rawHeat";
    case "water":
    case "oil":
      throw new Error(`Emitter ${emitterId} has no raw damage source`);
    default:
      return emitterId satisfies never;
  }
}

function getReactionDamageMultiplier(reactionId: ReactionId, upgrades: readonly UpgradeStackState[], config: GameConfig): number {
  const bonus = upgrades.reduce((total, stack) => {
    const definition = config.upgrades.find(upgrade => upgrade.id === stack.upgradeId);

    if (
      definition?.effect.type !== "reactionDamageMultiplier"
      || !doesReactionIncludeEmitter(reactionId, definition.effect.emitterId, config)
    ) {
      return total;
    }

    return total + definition.effect.amount * stack.stacks;
  }, 0);

  return 1 + bonus;
}

function doesReactionIncludeEmitter(
  reactionId: ReactionId,
  emitterId: EmitterId,
  config: GameConfig,
  visited: ReadonlySet<ReactionId> = new Set(),
): boolean {
  if (visited.has(reactionId)) {
    return false;
  }

  const definition = getReactionDefinition(reactionId, config);

  if (definition.tier > 2) {
    return false;
  }

  const nextVisited = new Set(visited).add(reactionId);

  return definition.inputs.some(input =>
    input === emitterId
    || (isReactionId(input, config) && doesReactionIncludeEmitter(input, emitterId, config, nextVisited)),
  );
}

function isReactionId(input: ReactionInputId, config: GameConfig): input is ReactionId {
  return config.reactions.some(reaction => reaction.id === input);
}
