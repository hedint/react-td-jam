/* eslint-disable max-lines */
import type { DamageSourceId, EmitterId, GameAction, ReactionId, RunState, UpgradeId } from "../src/entities/game-session/model/types";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gameConfig } from "../src/entities/game-session/model/config";
import { applyAction, createRun, createSnapshot, stepRun } from "../src/entities/game-session/model/simulation";

interface BalancePolicy {
  readonly id: string
  readonly description: string
  readonly targetReactions: readonly ReactionId[]
  readonly placementPlan: Partial<Record<EmitterId, readonly string[]>>
  readonly openingTowerPriority?: readonly EmitterId[]
  readonly plannedSlotEvictions?: readonly PlannedSlotEviction[]
  readonly placementBlockers?: readonly PlacementBlocker[]
  readonly benchSlotSwapEmitterIds?: readonly EmitterId[]
  readonly relocationPlan?: Partial<Record<EmitterId, readonly string[]>>
  readonly towerBuildOrder: readonly EmitterId[]
  readonly towerFallbackPriority: readonly EmitterId[]
  readonly upgradeBuildOrder: readonly UpgradeId[]
  readonly upgradeFallbackPriority: readonly UpgradeId[]
}

interface PlannedSlotEviction {
  readonly slotId: string
  readonly emitterId?: EmitterId
  readonly afterUpgradeId?: UpgradeId
}

interface PlacementBlocker {
  readonly slotId: string
  readonly emitterId?: EmitterId
  readonly afterUpgradeId?: UpgradeId
}

interface BalanceRunSummary {
  readonly strategyId: string
  readonly seed: number
  readonly phase: RunState["phase"]
  readonly win: boolean
  readonly coreHp: number
  readonly leaks: number
  readonly kills: number
  readonly waveReached: number
  readonly wavesCleared: number
  readonly bossBreaks: number
  readonly durationMs: number
  readonly totalDamage: number
  readonly firstSlotUnlockWave: number | null
  readonly firstT2Wave: number | null
  readonly firstFinalTargetWave: number | null
  readonly firstT3Wave: number | null
  readonly firstDualT2NearMissWave: number | null
  readonly maxFireVortexCells: number
  readonly maxStormCloudCells: number
  readonly maxFireStormCells: number
  readonly minT2Separation: number | null
  readonly adjacentT2WithoutFireStorm: boolean
  readonly anyT2Formed: boolean
  readonly targetT2Formed: boolean
  readonly finalTargetFormed: boolean
  readonly t3Formed: boolean
  readonly topSource: DamageSourceId | null
  readonly topReaction: ReactionId | null
  readonly upgradePicks: readonly UpgradeId[]
}

interface StrategyAggregate {
  readonly strategyId: string
  readonly description: string
  readonly targetReactions: readonly ReactionId[]
  readonly runs: number
  readonly winRate: number
  readonly coreHp: PercentileSummary
  readonly leaks: PercentileSummary
  readonly durationSeconds: PercentileSummary
  readonly wavesCleared: PercentileSummary
  readonly bossBreaks: PercentileSummary
  readonly anyT2Rate: number
  readonly targetT2Rate: number
  readonly firstT2Wave: PercentileSummary | null
  readonly finalTargetRate: number
  readonly firstFinalTargetWave: PercentileSummary | null
  readonly fireVortexCells: PercentileSummary
  readonly stormCloudCells: PercentileSummary
  readonly fireStormCells: PercentileSummary
  readonly dualT2NearMissRate: number
  readonly minT2Separation: PercentileSummary | null
  readonly adjacentT2WithoutFireStormRate: number
  readonly t3Rate: number
  readonly firstT3Wave: PercentileSummary | null
  readonly firstSlotUnlockWave: PercentileSummary | null
}

interface PercentileSummary {
  readonly p10: number
  readonly median: number
  readonly p90: number
}

const t2ReactionIds = new Set<ReactionId>(["stormCloud", "fireVortex"]);
const openerTowerPriority: readonly EmitterId[] = ["heat", "spark", "water", "oil"];
const commonPlacementPlan: Partial<Record<EmitterId, readonly string[]>> = {
  water: ["slot-1-outer", "slot-2-outer"],
  spark: ["slot-2-inner", "slot-7-inner", "slot-11-inner", "slot-12-inner", "slot-16-inner", "slot-3-inner"],
};
const defaultUpgradeFallback: readonly UpgradeId[] = [
  "waterCapacity",
  "sparkCapacity",
  "heatReach",
  "oilControl",
  "fireCatalyst",
  "unlockSlot5",
  "unlockSlot9",
  "unlockSlot14",
];

const policies: readonly BalancePolicy[] = [
  {
    id: "baseline-electro-opener",
    description: "Common 2-cell electro opener, then keeps reinforcing T1 electro as the weak baseline.",
    targetReactions: [],
    placementPlan: withCommonPlacement({
      water: ["slot-3-outer", "slot-4-outer", "slot-5-outer", "slot-6-outer", "slot-7-outer"],
      spark: ["slot-12-inner", "slot-16-inner"],
      heat: ["slot-11-inner"],
      oil: ["slot-10-outer"],
    }),
    towerBuildOrder: ["water", "water", "spark", "heat", "spark", "water", "spark", "water", "spark", "oil"],
    towerFallbackPriority: ["spark", "water", "heat", "oil"],
    upgradeBuildOrder: ["waterCapacity", "sparkCapacity", "waterCapacity", "sparkCapacity", "sparkCapacity"],
    upgradeFallbackPriority: defaultUpgradeFallback,
  },
  {
    id: "stormcloud-rush",
    description: "Human-derived Storm Cloud control line: electro opener, oil tempo, water capacity, then two separated Storm Cloud pools with spark catalysts.",
    targetReactions: ["stormCloud"],
    placementPlan: {
      water: ["slot-2-outer", "slot-3-outer", "slot-7-outer", "slot-5-inner"],
      spark: ["slot-2-inner", "slot-3-inner", "slot-8-outer", "slot-11-inner"],
      heat: ["slot-2-inner", "slot-7-inner", "slot-5-inner"],
      oil: ["slot-1-outer"],
    },
    openingTowerPriority: ["oil", "heat", "water", "spark"],
    benchSlotSwapEmitterIds: ["heat"],
    towerBuildOrder: ["water", "water", "spark", "oil", "heat", "heat", "water", "spark", "oil", "spark", "heat"],
    towerFallbackPriority: ["spark", "heat", "water", "oil"],
    upgradeBuildOrder: ["waterCapacity", "unlockSlot5", "sparkCatalyst", "sparkCatalyst", "sparkCapacity", "heatReach"],
    upgradeFallbackPriority: ["waterCapacity", "unlockSlot5", "sparkCatalyst", "sparkCapacity", "heatReach", "oilControl", "unlockSlot9"],
  },
  {
    id: "fire-vortex-rush",
    description: "Human-like Fire Vortex control line: electro opener, oil tempo, heat reach, then steam + fire around cells 2-4 with fire catalysts.",
    targetReactions: ["fireVortex"],
    placementPlan: {
      water: ["slot-2-outer", "slot-3-outer", "slot-7-outer"],
      spark: ["slot-2-inner", "slot-8-outer"],
      heat: ["slot-2-inner", "slot-3-outer", "slot-7-inner"],
      oil: ["slot-1-outer", "slot-3-inner", "slot-8-inner"],
    },
    openingTowerPriority: ["oil", "heat", "water", "spark"],
    plannedSlotEvictions: [
      { slotId: "slot-1-outer", emitterId: "oil", afterUpgradeId: "heatReach" },
    ],
    placementBlockers: [
      { slotId: "slot-1-outer", emitterId: "oil", afterUpgradeId: "heatReach" },
      { slotId: "slot-2-inner", emitterId: "spark", afterUpgradeId: "heatReach" },
    ],
    benchSlotSwapEmitterIds: ["heat", "oil"],
    towerBuildOrder: ["water", "water", "spark", "oil", "heat", "heat", "oil", "water", "heat", "oil"],
    towerFallbackPriority: ["heat", "oil", "water", "spark"],
    upgradeBuildOrder: ["heatReach", "fireCatalyst", "fireCatalyst", "oilControl", "unlockSlot5", "waterCapacity"],
    upgradeFallbackPriority: ["heatReach", "fireCatalyst", "oilControl", "unlockSlot5", "waterCapacity", "sparkCapacity", "unlockSlot9"],
  },
  {
    id: "fire-vortex-water-spread",
    description: "Human-like line: two electro cells, water spread for steam, then oil + heat into Fire Vortex.",
    targetReactions: ["fireVortex"],
    placementPlan: withCommonPlacement({
      water: ["slot-11-outer", "slot-10-outer", "slot-12-outer", "slot-13-outer"],
      spark: ["slot-7-inner", "slot-11-inner"],
      heat: ["slot-3-inner", "slot-11-inner", "slot-12-inner", "slot-16-inner"],
      oil: ["slot-10-outer", "slot-12-outer", "slot-13-outer", "slot-8-outer"],
    }),
    towerBuildOrder: ["water", "water", "spark", "heat", "oil", "heat", "water", "oil", "heat", "water"],
    towerFallbackPriority: ["heat", "oil", "water", "spark"],
    upgradeBuildOrder: ["waterCapacity", "waterCapacity", "heatReach", "oilControl", "fireCatalyst", "heatReach", "oilControl"],
    upgradeFallbackPriority: defaultUpgradeFallback,
  },
  {
    id: "stormcloud-anti-air",
    description: "Storm Cloud answer for flyers: steam coverage first, spark capacity second.",
    targetReactions: ["stormCloud"],
    placementPlan: withCommonPlacement({
      water: ["slot-3-outer", "slot-4-outer", "slot-5-outer", "slot-6-outer"],
      spark: ["slot-7-inner", "slot-11-inner", "slot-12-inner", "slot-16-inner"],
      heat: ["slot-3-inner", "slot-7-inner", "slot-11-inner"],
      oil: ["slot-8-outer", "slot-10-outer"],
    }),
    towerBuildOrder: ["water", "water", "spark", "heat", "spark", "heat", "water", "spark", "heat", "oil"],
    towerFallbackPriority: ["heat", "spark", "water", "oil"],
    upgradeBuildOrder: ["heatReach", "waterCapacity", "sparkCapacity", "heatReach", "sparkCapacity", "waterCapacity"],
    upgradeFallbackPriority: defaultUpgradeFallback,
  },
  {
    id: "fire-control-runners",
    description: "Uses oil slow and fire damage against runners, then converts the fire lane into Fire Vortex.",
    targetReactions: ["fireVortex"],
    placementPlan: withCommonPlacement({
      water: ["slot-11-outer", "slot-10-outer", "slot-12-outer"],
      spark: ["slot-7-inner", "slot-11-inner"],
      heat: ["slot-3-inner", "slot-11-inner", "slot-12-inner", "slot-16-inner"],
      oil: ["slot-10-outer", "slot-12-outer", "slot-13-outer", "slot-8-outer"],
    }),
    towerBuildOrder: ["water", "water", "spark", "heat", "oil", "heat", "oil", "water", "oil", "heat"],
    towerFallbackPriority: ["oil", "heat", "water", "spark"],
    upgradeBuildOrder: ["oilControl", "waterCapacity", "heatReach", "fireCatalyst", "oilControl", "heatReach"],
    upgradeFallbackPriority: defaultUpgradeFallback,
  },
  {
    id: "slot-unlock-vortex",
    description: "Still opens with electro, then unlocks corner cells only after the Fire Vortex kit is online.",
    targetReactions: ["fireVortex"],
    placementPlan: withCommonPlacement({
      water: ["slot-11-outer", "slot-14-inner", "slot-10-outer", "slot-5-inner"],
      spark: ["slot-7-inner", "slot-9-inner", "slot-11-inner"],
      heat: ["slot-3-inner", "slot-11-inner", "slot-12-inner", "slot-16-inner"],
      oil: ["slot-10-outer", "slot-12-outer", "slot-13-outer", "slot-8-outer"],
    }),
    towerBuildOrder: ["water", "water", "spark", "heat", "oil", "heat", "water", "oil", "spark", "heat"],
    towerFallbackPriority: ["heat", "oil", "water", "spark"],
    upgradeBuildOrder: ["waterCapacity", "heatReach", "unlockSlot5", "oilControl", "fireCatalyst", "unlockSlot9", "heatReach", "unlockSlot14"],
    upgradeFallbackPriority: defaultUpgradeFallback,
  },
  {
    id: "no-slot-stormcloud",
    description: "No planned slot unlocks; tries to hit Storm Cloud and scale it on existing legal slots.",
    targetReactions: ["stormCloud"],
    placementPlan: withCommonPlacement({
      water: ["slot-3-outer", "slot-4-outer", "slot-5-outer", "slot-6-outer"],
      spark: ["slot-7-inner", "slot-11-inner", "slot-12-inner", "slot-16-inner"],
      heat: ["slot-3-inner", "slot-7-inner", "slot-11-inner"],
      oil: ["slot-8-outer", "slot-10-outer"],
    }),
    towerBuildOrder: ["water", "water", "spark", "heat", "spark", "water", "heat", "spark", "water"],
    towerFallbackPriority: ["spark", "heat", "water", "oil"],
    upgradeBuildOrder: ["waterCapacity", "heatReach", "sparkCapacity", "waterCapacity", "sparkCapacity", "heatReach"],
    upgradeFallbackPriority: ["waterCapacity", "heatReach", "sparkCapacity", "oilControl", "fireCatalyst"],
  },
  {
    id: "mixed-dual-t2",
    description: "Adaptive T2 control line: accepts either Storm Cloud or Fire Vortex pieces, keeps the pools separated, and upgrades whichever catalyst appears.",
    targetReactions: ["stormCloud", "fireVortex"],
    placementPlan: {
      water: ["slot-2-outer", "slot-3-outer", "slot-11-outer", "slot-7-outer"],
      spark: ["slot-2-inner", "slot-3-inner", "slot-8-outer", "slot-13-inner"],
      heat: ["slot-2-inner", "slot-11-inner", "slot-12-inner", "slot-7-inner"],
      oil: ["slot-1-outer", "slot-12-outer", "slot-10-outer"],
    },
    openingTowerPriority: ["oil", "heat", "water", "spark"],
    benchSlotSwapEmitterIds: ["heat", "oil"],
    towerBuildOrder: ["water", "water", "spark", "oil", "heat", "water", "heat", "oil", "heat", "spark", "oil"],
    towerFallbackPriority: ["heat", "spark", "oil", "water"],
    upgradeBuildOrder: ["waterCapacity", "heatReach", "sparkCatalyst", "fireCatalyst", "sparkCapacity", "oilControl"],
    upgradeFallbackPriority: ["waterCapacity", "heatReach", "sparkCatalyst", "fireCatalyst", "sparkCapacity", "oilControl", "unlockSlot5", "unlockSlot9"],
  },
  {
    id: "experienced-human-final",
    description: "Reference experienced line: secure 3 Fire Vortex cells, then scale either Storm Cloud to 6 cells or Fire Vortex to 6 cells.",
    targetReactions: ["fireVortex", "stormCloud"],
    placementPlan: withCommonPlacement({
      water: ["slot-11-outer", "slot-10-outer", "slot-12-outer", "slot-13-outer", "slot-3-outer", "slot-5-inner"],
      spark: ["slot-7-inner", "slot-11-inner", "slot-12-inner", "slot-16-inner", "slot-9-inner"],
      heat: ["slot-3-inner", "slot-11-inner", "slot-12-inner", "slot-16-inner", "slot-14-outer"],
      oil: ["slot-10-outer", "slot-12-outer", "slot-13-outer", "slot-8-outer", "slot-14-outer"],
    }),
    towerBuildOrder: ["water", "water", "spark", "heat", "oil", "heat", "water", "oil", "heat", "spark", "spark", "water"],
    towerFallbackPriority: ["heat", "oil", "spark", "water"],
    upgradeBuildOrder: ["waterCapacity", "waterCapacity", "heatReach", "oilControl", "fireCatalyst", "heatReach", "sparkCapacity", "sparkCapacity", "oilControl"],
    upgradeFallbackPriority: defaultUpgradeFallback,
  },
  {
    id: "expert-t3-or-boss-break",
    description: "Forms both T2 branches, then pushes toward Fire Storm / boss reaction break.",
    targetReactions: ["stormCloud", "fireVortex"],
    placementPlan: withCommonPlacement({
      water: ["slot-3-outer", "slot-11-outer", "slot-5-inner", "slot-9-inner", "slot-14-inner", "slot-6-outer"],
      spark: ["slot-7-inner", "slot-9-inner", "slot-11-inner", "slot-12-inner", "slot-16-inner"],
      heat: ["slot-3-inner", "slot-11-inner", "slot-12-inner", "slot-14-outer", "slot-16-outer"],
      oil: ["slot-10-outer", "slot-12-outer", "slot-13-outer", "slot-8-outer"],
    }),
    towerBuildOrder: ["water", "water", "spark", "heat", "spark", "oil", "heat", "water", "oil", "heat", "spark", "water"],
    towerFallbackPriority: ["heat", "spark", "oil", "water"],
    upgradeBuildOrder: ["waterCapacity", "heatReach", "sparkCapacity", "oilControl", "unlockSlot5", "fireCatalyst", "unlockSlot9", "heatReach", "unlockSlot14", "sparkCapacity"],
    upgradeFallbackPriority: defaultUpgradeFallback,
  },
  {
    id: "fire-storm-rush",
    description: "Human-derived Fire Storm line: electro opener, early steam, unlock slot 5, then join Fire Vortex and Storm Cloud around cells 2-6.",
    targetReactions: ["fireStorm"],
    placementPlan: {
      water: ["slot-2-outer", "slot-3-outer", "slot-5-inner"],
      spark: ["slot-2-inner", "slot-3-inner", "slot-6-outer"],
      heat: ["slot-2-inner", "slot-3-outer", "slot-7-inner"],
      oil: ["slot-1-outer", "slot-3-inner"],
    },
    openingTowerPriority: ["oil", "heat", "water", "spark"],
    plannedSlotEvictions: [
      { slotId: "slot-3-outer", emitterId: "water", afterUpgradeId: "heatReach" },
    ],
    placementBlockers: [
      { slotId: "slot-3-outer", emitterId: "water", afterUpgradeId: "heatReach" },
    ],
    benchSlotSwapEmitterIds: ["heat", "oil"],
    relocationPlan: {
      water: ["slot-2-outer", "slot-5-inner"],
      spark: ["slot-6-outer"],
      heat: ["slot-2-inner", "slot-3-outer"],
      oil: ["slot-3-inner"],
    },
    towerBuildOrder: ["water", "water", "spark", "oil", "heat", "water", "heat", "oil", "heat"],
    towerFallbackPriority: ["heat", "oil", "water", "spark"],
    upgradeBuildOrder: ["heatReach", "unlockSlot5", "sparkCapacity"],
    upgradeFallbackPriority: ["heatReach", "unlockSlot5", "sparkCapacity", "waterCapacity", "oilControl", "fireCatalyst", "unlockSlot9"],
  },
];

const quick = process.argv.includes("--quick");
const seedCount = getNumericArg("--seeds") ?? (quick ? 10 : 100);
const seedStart = getNumericArg("--seed-start") ?? 1;
const maxSteps = getNumericArg("--max-steps") ?? 60000;
const stepMs = 1000 / gameConfig.balance.tickRate;
const outputDir = join(process.cwd(), "output", "balance");
const runSummaries = policies.flatMap(policy =>
  Array.from({ length: seedCount }, (_, index) => runPolicy(policy, seedStart + index)),
);
const aggregates = policies.map(policy => aggregatePolicy(policy, runSummaries.filter(run => run.strategyId === policy.id)));
const report = {
  generatedAt: new Date().toISOString(),
  mode: quick ? "quick" : "full",
  seedStart,
  seedCount,
  maxSteps,
  strategies: policies.map(policy => ({
    id: policy.id,
    description: policy.description,
    targetReactions: policy.targetReactions,
  })),
  aggregates,
  runs: runSummaries,
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, quick ? "balance-quick.json" : "balance-full.json"), `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8" });
writeFileSync(join(outputDir, quick ? "balance-quick.md" : "balance-full.md"), renderMarkdownReport(aggregates), { encoding: "utf8" });

console.info(renderConsoleSummary(aggregates));

function runPolicy(policy: BalancePolicy, seed: number): BalanceRunSummary {
  let state = createRun(seed, { config: gameConfig });
  let firstSlotUnlockWave: number | null = null;
  let firstT2Wave: number | null = null;
  let firstFinalTargetWave: number | null = null;
  let firstT3Wave: number | null = null;
  let firstDualT2NearMissWave: number | null = null;
  let maxFireVortexCells = 0;
  let maxStormCloudCells = 0;
  let maxFireStormCells = 0;
  let minT2Separation: number | null = null;
  let adjacentT2WithoutFireStorm = false;
  let t3Formed = false;
  const formedReactions = new Set<ReactionId>();
  const upgradePicks: UpgradeId[] = [];

  for (let step = 0; step < maxSteps; step += 1) {
    if (state.phase === "victory" || state.phase === "defeat") {
      break;
    }

    getPlacementActions(state, policy).forEach((action) => {
      state = applyAction(state, action, gameConfig);
    });

    if (state.phase === "ready") {
      state = applyAction(state, { type: "startWave" }, gameConfig);
    }

    if (state.phase === "draft" && state.draft) {
      const actions = getDraftActions(state, policy);

      actions.forEach((action) => {
        if (action.type === "chooseDraftUpgrade") {
          upgradePicks.push(action.upgradeId);
          if (isSlotUnlock(action.upgradeId) && firstSlotUnlockWave === null) {
            firstSlotUnlockWave = state.waveIndex + 1;
          }
        }
        state = applyAction(state, action, gameConfig);
      });
    }

    const snapshot = createSnapshot(state);
    const fireVortexCellIndexes = getReactionCellIndexes(snapshot.activeReactions, "fireVortex");
    const stormCloudCellIndexes = getReactionCellIndexes(snapshot.activeReactions, "stormCloud");
    const fireStormCellIndexes = getReactionCellIndexes(snapshot.activeReactions, "fireStorm");
    const fireVortexCells = fireVortexCellIndexes.length;
    const stormCloudCells = stormCloudCellIndexes.length;
    const fireStormCells = fireStormCellIndexes.length;
    const t2Separation = getMinCircularSeparation(gameConfig.balance.pathCellCount, fireVortexCellIndexes, stormCloudCellIndexes);

    maxFireVortexCells = Math.max(maxFireVortexCells, fireVortexCells);
    maxStormCloudCells = Math.max(maxStormCloudCells, stormCloudCells);
    maxFireStormCells = Math.max(maxFireStormCells, fireStormCells);
    if (t2Separation !== null) {
      minT2Separation = minT2Separation === null ? t2Separation : Math.min(minT2Separation, t2Separation);
      if (t2Separation <= 2 && fireStormCells === 0) {
        firstDualT2NearMissWave ??= state.waveIndex + 1;
      }
      if (t2Separation === 1 && fireStormCells === 0) {
        adjacentT2WithoutFireStorm = true;
      }
    }
    if (firstFinalTargetWave === null && isFinalTargetCoverage(fireVortexCells, stormCloudCells, fireStormCells)) {
      firstFinalTargetWave = state.waveIndex + 1;
    }

    snapshot.activeReactions.forEach((reaction) => {
      [reaction.ground, reaction.air].forEach((reactionId) => {
        if (!reactionId) {
          return;
        }

        formedReactions.add(reactionId);
        if (firstT2Wave === null && t2ReactionIds.has(reactionId)) {
          firstT2Wave = state.waveIndex + 1;
        }
      });
    });

    if (formedReactions.has("fireStorm")) {
      t3Formed = true;
      firstT3Wave ??= state.waveIndex + 1;
    }

    state = stepRun(state, stepMs, gameConfig);
  }

  const damageBySourceEntries = Object.entries(state.stats.damageBySource) as Array<[DamageSourceId, number]>;
  const damageByReactionEntries = Object.entries(state.stats.damageByReaction) as Array<[ReactionId, number]>;

  return {
    strategyId: policy.id,
    seed,
    phase: state.phase,
    win: state.phase === "victory",
    coreHp: state.coreHp,
    leaks: state.stats.leaks,
    kills: state.stats.kills,
    waveReached: state.waveIndex + 1,
    wavesCleared: state.stats.waveStats.filter(wave => wave.kills + wave.leaks > 0).length,
    bossBreaks: state.stats.bossBreaks,
    durationMs: state.elapsedMs,
    totalDamage: state.stats.totalDamage,
    firstSlotUnlockWave,
    firstT2Wave,
    firstFinalTargetWave,
    firstT3Wave,
    firstDualT2NearMissWave,
    maxFireVortexCells,
    maxStormCloudCells,
    maxFireStormCells,
    minT2Separation,
    adjacentT2WithoutFireStorm,
    anyT2Formed: [...formedReactions].some(reactionId => t2ReactionIds.has(reactionId)),
    targetT2Formed: policy.targetReactions.some(reactionId => formedReactions.has(reactionId)),
    finalTargetFormed: firstFinalTargetWave !== null,
    t3Formed,
    topSource: topEntry(damageBySourceEntries),
    topReaction: topEntry(damageByReactionEntries),
    upgradePicks,
  };
}

function getPlacementActions(state: RunState, policy: BalancePolicy): readonly GameAction[] {
  if (state.phase === "draft") {
    return [];
  }

  const evictionActions = getPlannedEvictionActions(state, policy);

  if (evictionActions.length > 0) {
    return evictionActions;
  }

  const occupiedSlotIds = new Set(state.placedTowers.map(tower => tower.slotId).filter(slotId => slotId !== null));
  const actions: GameAction[] = [];

  state.bench.forEach((tower) => {
    const targetSlotId = policy.placementPlan[tower.emitterId]?.find((slotId) => {
      const slot = state.board.slots.find(candidate => candidate.id === slotId);
      const occupant = state.placedTowers.find(candidate => candidate.slotId === slotId);

      return slot
        && !slot.locked
        && !isPlacementBlocked(state, policy, tower.emitterId, slotId)
        && (!occupiedSlotIds.has(slotId) || (
          policy.benchSlotSwapEmitterIds?.includes(tower.emitterId) === true
          && canEditPlacedTowers(state)
          && occupant !== undefined
          && occupant.emitterId !== tower.emitterId
        ));
    });

    if (!targetSlotId) {
      return;
    }

    occupiedSlotIds.add(targetSlotId);
    actions.push(
      { type: "selectTower", towerId: tower.id },
      { type: "placeSelectedTower", slotId: targetSlotId },
    );
  });

  return actions.length > 0 ? actions : getRelocationActions(state, policy);
}

function getPlannedEvictionActions(state: RunState, policy: BalancePolicy): readonly GameAction[] {
  if (!canEditPlacedTowers(state)) {
    return [];
  }

  const eviction = policy.plannedSlotEvictions?.find((candidate) => {
    if (candidate.afterUpgradeId && !hasUpgrade(state, candidate.afterUpgradeId)) {
      return false;
    }

    const occupant = state.placedTowers.find(tower => tower.slotId === candidate.slotId);

    return occupant !== undefined && (!candidate.emitterId || occupant.emitterId === candidate.emitterId);
  });

  if (!eviction) {
    return [];
  }

  return [
    ...(state.selectedTowerId ? [{ type: "selectTower", towerId: null } satisfies GameAction] : []),
    { type: "tapSlot", slotId: eviction.slotId },
  ];
}

function getRelocationActions(state: RunState, policy: BalancePolicy): readonly GameAction[] {
  if (!policy.relocationPlan || !canUseRelocationPlan(state, policy.relocationPlan)) {
    return [];
  }

  for (const emitterId of Object.keys(policy.relocationPlan) as EmitterId[]) {
    const targetSlotIds = policy.relocationPlan[emitterId] ?? [];

    for (const targetSlotId of targetSlotIds) {
      const occupant = state.placedTowers.find(tower => tower.slotId === targetSlotId);

      if (occupant?.emitterId === emitterId) {
        continue;
      }

      const candidate = state.placedTowers.find(tower =>
        tower.emitterId === emitterId
        && !targetSlotIds.includes(tower.slotId ?? ""));

      if (!candidate) {
        continue;
      }

      return [
        ...(state.paused ? [] : [{ type: "pause" } satisfies GameAction]),
        { type: "selectTower", towerId: candidate.id },
        { type: "placeSelectedTower", slotId: targetSlotId },
        ...(state.paused ? [] : [{ type: "resume" } satisfies GameAction]),
      ];
    }
  }

  return [];
}

function canUseRelocationPlan(
  state: RunState,
  relocationPlan: Partial<Record<EmitterId, readonly string[]>>,
): boolean {
  const requiredUpgradeIds: readonly UpgradeId[] = ["unlockSlot5", "unlockSlot9", "waterCapacity", "heatReach"];
  const takenUpgradeIds = new Set(state.upgrades.filter(upgrade => upgrade.stacks > 0).map(upgrade => upgrade.upgradeId));
  const targetSlotIds = Object.values(relocationPlan).flat();

  return requiredUpgradeIds.every(upgradeId => takenUpgradeIds.has(upgradeId))
    && state.bench.length === 0
    && targetSlotIds.every(slotId => state.board.slots.some(slot => slot.id === slotId && !slot.locked));
}

function canEditPlacedTowers(state: RunState): boolean {
  return state.paused || state.phase === "ready" || state.phase === "countdown";
}

function getDraftActions(state: RunState, policy: BalancePolicy): readonly GameAction[] {
  if (!state.draft) {
    return [];
  }

  if (state.draft.step === "tower") {
    const priority = getTowerPriority(state, policy);
    const offer = findPreferred(state.draft.towerOffers, priority, candidate => candidate.emitterId);

    if (shouldRerollForBetterOffer(state, offer ? priority.indexOf(offer.emitterId) : -1, 1)) {
      return [{ type: "rerollDraft" }];
    }

    return offer ? [{ type: "chooseDraftTower", emitterId: offer.emitterId }] : [];
  }

  const priority = getUpgradePriority(state, policy);
  const upgradeOffer = findPreferred(state.draft.upgradeOffers, priority, upgradeId => upgradeId);

  if (shouldRerollForBetterOffer(state, upgradeOffer ? priority.indexOf(upgradeOffer) : -1, 2)) {
    return [{ type: "rerollDraft" }];
  }

  return upgradeOffer ? [{ type: "chooseDraftUpgrade", upgradeId: upgradeOffer }] : [];
}

function getTowerPriority(state: RunState, policy: BalancePolicy): readonly EmitterId[] {
  const clearedWaveNumber = state.waveIndex + 1;

  if (clearedWaveNumber === 1) {
    return policy.openingTowerPriority ?? openerTowerPriority;
  }

  return unique([
    ...getUnmetBuildOrderItems(countEmitters(state), policy.towerBuildOrder),
    ...policy.towerFallbackPriority,
  ]);
}

function getUpgradePriority(state: RunState, policy: BalancePolicy): readonly UpgradeId[] {
  return unique([
    ...getUnmetBuildOrderItems(countUpgrades(state), policy.upgradeBuildOrder),
    ...policy.upgradeFallbackPriority,
  ]);
}

function countEmitters(state: RunState): ReadonlyMap<EmitterId, number> {
  const counts = new Map<EmitterId, number>();

  [...state.placedTowers, ...state.bench].forEach((tower) => {
    counts.set(tower.emitterId, (counts.get(tower.emitterId) ?? 0) + 1);
  });

  return counts;
}

function countUpgrades(state: RunState): ReadonlyMap<UpgradeId, number> {
  return new Map(state.upgrades.map(upgrade => [upgrade.upgradeId, upgrade.stacks]));
}

function hasUpgrade(state: RunState, upgradeId: UpgradeId): boolean {
  return (state.upgrades.find(upgrade => upgrade.upgradeId === upgradeId)?.stacks ?? 0) > 0;
}

function isPlacementBlocked(state: RunState, policy: BalancePolicy, emitterId: EmitterId, slotId: string): boolean {
  return policy.placementBlockers?.some(blocker =>
    blocker.slotId === slotId
    && (!blocker.emitterId || blocker.emitterId === emitterId)
    && (!blocker.afterUpgradeId || hasUpgrade(state, blocker.afterUpgradeId))) ?? false;
}

function getUnmetBuildOrderItems<TId extends string>(
  currentCounts: ReadonlyMap<TId, number>,
  buildOrder: readonly TId[],
): readonly TId[] {
  const requiredCounts = new Map<TId, number>();
  const priority: TId[] = [];

  buildOrder.forEach((item) => {
    const requiredCount = (requiredCounts.get(item) ?? 0) + 1;

    requiredCounts.set(item, requiredCount);
    if ((currentCounts.get(item) ?? 0) < requiredCount && !priority.includes(item)) {
      priority.push(item);
    }
  });

  return priority;
}

function shouldRerollForBetterOffer(state: RunState, priorityIndex: number, acceptablePriorityIndex: number): boolean {
  return Boolean(
    state.draft
    && state.draft.rerollsRemaining > 0
    && (priorityIndex < 0 || priorityIndex > acceptablePriorityIndex),
  );
}

function withCommonPlacement(
  placementPlan: Partial<Record<EmitterId, readonly string[]>>,
): Partial<Record<EmitterId, readonly string[]>> {
  return {
    water: unique([...(commonPlacementPlan.water ?? []), ...(placementPlan.water ?? [])]),
    spark: unique([...(commonPlacementPlan.spark ?? []), ...(placementPlan.spark ?? [])]),
    heat: placementPlan.heat ?? [],
    oil: placementPlan.oil ?? [],
  };
}

function unique<T>(items: readonly T[]): readonly T[] {
  return [...new Set(items)];
}

function getReactionCellIndexes(
  reactions: ReturnType<typeof createSnapshot>["activeReactions"],
  reactionId: ReactionId,
): readonly number[] {
  return reactions
    .filter(reaction => reaction.ground === reactionId || reaction.air === reactionId)
    .map(reaction => reaction.cellIndex);
}

function getMinCircularSeparation(
  pathCellCount: number,
  leftCellIndexes: readonly number[],
  rightCellIndexes: readonly number[],
): number | null {
  if (leftCellIndexes.length === 0 || rightCellIndexes.length === 0) {
    return null;
  }

  return Math.min(...leftCellIndexes.flatMap(leftCellIndex =>
    rightCellIndexes.map((rightCellIndex) => {
      const direct = Math.abs(leftCellIndex - rightCellIndex);

      return Math.min(direct, pathCellCount - direct);
    })));
}

function isFinalTargetCoverage(fireVortexCells: number, stormCloudCells: number, fireStormCells: number): boolean {
  return fireStormCells > 0 || (fireVortexCells >= 3 && (stormCloudCells >= 6 || fireVortexCells >= 6));
}

function aggregatePolicy(policy: BalancePolicy, runs: readonly BalanceRunSummary[]): StrategyAggregate {
  const unlockWaves = runs.map(run => run.firstSlotUnlockWave).filter(wave => wave !== null);
  const t2Waves = runs.map(run => run.firstT2Wave).filter(wave => wave !== null);
  const finalTargetWaves = runs.map(run => run.firstFinalTargetWave).filter(wave => wave !== null);
  const t3Waves = runs.map(run => run.firstT3Wave).filter(wave => wave !== null);
  const dualT2NearMissWaves = runs.map(run => run.firstDualT2NearMissWave).filter(wave => wave !== null);
  const minT2Separations = runs.map(run => run.minT2Separation).filter(separation => separation !== null);

  return {
    strategyId: policy.id,
    description: policy.description,
    targetReactions: policy.targetReactions,
    runs: runs.length,
    winRate: runs.filter(run => run.win).length / runs.length,
    coreHp: percentiles(runs.map(run => run.coreHp)),
    leaks: percentiles(runs.map(run => run.leaks)),
    durationSeconds: percentiles(runs.map(run => Math.round(run.durationMs / 1000))),
    wavesCleared: percentiles(runs.map(run => run.wavesCleared)),
    bossBreaks: percentiles(runs.map(run => run.bossBreaks)),
    anyT2Rate: runs.filter(run => run.anyT2Formed).length / runs.length,
    targetT2Rate: runs.filter(run => run.targetT2Formed).length / runs.length,
    firstT2Wave: t2Waves.length > 0 ? percentiles(t2Waves) : null,
    finalTargetRate: runs.filter(run => run.finalTargetFormed).length / runs.length,
    firstFinalTargetWave: finalTargetWaves.length > 0 ? percentiles(finalTargetWaves) : null,
    fireVortexCells: percentiles(runs.map(run => run.maxFireVortexCells)),
    stormCloudCells: percentiles(runs.map(run => run.maxStormCloudCells)),
    fireStormCells: percentiles(runs.map(run => run.maxFireStormCells)),
    dualT2NearMissRate: dualT2NearMissWaves.length / runs.length,
    minT2Separation: minT2Separations.length > 0 ? percentiles(minT2Separations) : null,
    adjacentT2WithoutFireStormRate: runs.filter(run => run.adjacentT2WithoutFireStorm).length / runs.length,
    t3Rate: runs.filter(run => run.t3Formed).length / runs.length,
    firstT3Wave: t3Waves.length > 0 ? percentiles(t3Waves) : null,
    firstSlotUnlockWave: unlockWaves.length > 0 ? percentiles(unlockWaves) : null,
  };
}

function renderMarkdownReport(aggregates: readonly StrategyAggregate[]): string {
  const rows = aggregates.map(aggregate => [
    aggregate.strategyId,
    aggregate.targetReactions.join(","),
    percent(aggregate.winRate),
    percentileLabel(aggregate.coreHp),
    percentileLabel(aggregate.leaks),
    percentileLabel(aggregate.durationSeconds),
    percentileLabel(aggregate.wavesCleared),
    percentileLabel(aggregate.bossBreaks),
    percent(aggregate.anyT2Rate),
    percent(aggregate.targetT2Rate),
    aggregate.firstT2Wave ? percentileLabel(aggregate.firstT2Wave) : "n/a",
    percentileLabel(aggregate.fireVortexCells),
    percentileLabel(aggregate.stormCloudCells),
    percentileLabel(aggregate.fireStormCells),
    percent(aggregate.dualT2NearMissRate),
    aggregate.minT2Separation ? percentileLabel(aggregate.minT2Separation) : "n/a",
    percent(aggregate.adjacentT2WithoutFireStormRate),
    percent(aggregate.finalTargetRate),
    aggregate.firstFinalTargetWave ? percentileLabel(aggregate.firstFinalTargetWave) : "n/a",
    percent(aggregate.t3Rate),
    aggregate.firstT3Wave ? percentileLabel(aggregate.firstT3Wave) : "n/a",
    aggregate.firstSlotUnlockWave ? percentileLabel(aggregate.firstSlotUnlockWave) : "n/a",
  ]);

  return [
    "# Balance Report",
    "",
    `Mode: ${quick ? "quick" : "full"}`,
    `Seed range: ${seedStart}-${seedStart + seedCount - 1}`,
    `Seeds per strategy: ${seedCount}`,
    "",
    "| Strategy | Target | Win | Core HP p10/med/p90 | Leaks p10/med/p90 | Duration p10/med/p90 | Waves p10/med/p90 | Breaks p10/med/p90 | Any T2 | Target T2 | First T2 p10/med/p90 | Fire Vortex cells p10/med/p90 | Storm cells p10/med/p90 | Fire Storm cells p10/med/p90 | Dual T2 near-miss | Min T2 gap p10/med/p90 | Adjacent T2 no T3 | Final target | First final p10/med/p90 | T3 | First T3 p10/med/p90 | First unlock p10/med/p90 |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...rows.map(row => `| ${row.join(" | ")} |`),
    "",
    "## Strategy Notes",
    "",
    ...aggregates.flatMap(aggregate => [`- ${aggregate.strategyId}: ${aggregate.description}`, ""]),
    "",
  ].join("\n");
}

function renderConsoleSummary(aggregates: readonly StrategyAggregate[]): string {
  return aggregates
    .map(aggregate => `${aggregate.strategyId}: win=${percent(aggregate.winRate)}, targetT2=${percent(aggregate.targetT2Rate)}, final=${percent(aggregate.finalTargetRate)}, fv=${percentileLabel(aggregate.fireVortexCells)}, storm=${percentileLabel(aggregate.stormCloudCells)}, fs=${percentileLabel(aggregate.fireStormCells)}, gap=${aggregate.minT2Separation ? percentileLabel(aggregate.minT2Separation) : "n/a"}, near=${percent(aggregate.dualT2NearMissRate)}, adjacentNoT3=${percent(aggregate.adjacentT2WithoutFireStormRate)}, core=${percentileLabel(aggregate.coreHp)}, leaks=${percentileLabel(aggregate.leaks)}, t3=${percent(aggregate.t3Rate)}`)
    .join("\n");
}

function percentiles(values: readonly number[]): PercentileSummary {
  const sorted = [...values].sort((left, right) => left - right);

  return {
    p10: pickPercentile(sorted, 0.1),
    median: pickPercentile(sorted, 0.5),
    p90: pickPercentile(sorted, 0.9),
  };
}

function pickPercentile(sorted: readonly number[], percentile: number): number {
  if (sorted.length === 0) {
    return 0;
  }

  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * percentile)))] ?? 0;
}

function percentileLabel(summary: PercentileSummary): string {
  return `${summary.p10}/${summary.median}/${summary.p90}`;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function topEntry<TId extends string>(entries: readonly [TId, number][]): TId | null {
  return [...entries].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function findPreferred<T, TId extends string>(
  candidates: readonly T[],
  priority: readonly TId[],
  getId: (candidate: T) => TId,
): T | undefined {
  return [...candidates]
    .sort((left, right) => normalizePriority(priority.indexOf(getId(left))) - normalizePriority(priority.indexOf(getId(right))))[0];
}

function normalizePriority(priority: number): number {
  return priority === -1 ? Number.MAX_SAFE_INTEGER : priority;
}

function isSlotUnlock(upgradeId: UpgradeId): boolean {
  return upgradeId === "unlockSlot5" || upgradeId === "unlockSlot9" || upgradeId === "unlockSlot14";
}

function getNumericArg(name: string): number | null {
  const value = process.argv.find(arg => arg.startsWith(`${name}=`))?.split("=")[1];
  const parsed = value ? Number(value) : Number.NaN;

  return Number.isFinite(parsed) ? parsed : null;
}
