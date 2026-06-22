import type { DamageSourceId, EmitterId, GameAction, GameConfig, ReactionId, RunPhase, RunState, UpgradeId } from "./types";
import { gameConfig } from "./config";
import { applyAction, createRun, stepRun } from "./simulation";

export interface HeadlessRunOptions {
  readonly maxSteps: number
  readonly stepMs?: number
  readonly autoStartWaves?: boolean
  readonly autoCompleteDrafts?: boolean
  readonly scriptedActions?: (state: RunState) => readonly GameAction[]
  readonly draftActions?: (state: RunState) => readonly GameAction[]
  readonly stopWhen?: (state: RunState) => boolean
  readonly config?: GameConfig
}

export interface HeadlessRunResult {
  readonly state: RunState
  readonly steps: number
  readonly stoppedByPredicate: boolean
}

export type HeadlessPlacementPlan = Partial<Record<EmitterId, readonly string[]>>;

export interface HeadlessDraftPlan {
  readonly towerPriority: readonly EmitterId[]
  readonly upgradePriority: readonly UpgradeId[]
}

export interface HeadlessScriptedStrategy {
  readonly id: string
  readonly seed: number
  readonly placementPlan: HeadlessPlacementPlan
  readonly draftPlan: HeadlessDraftPlan
}

export interface HeadlessStrategySummary {
  readonly strategyId: string
  readonly phase: RunPhase
  readonly wavesCleared: number
  readonly coreHp: number
  readonly leaks: number
  readonly kills: number
  readonly bossBreaks: number
  readonly totalDamage: number
  readonly topReaction: ReactionId | null
  readonly topSource: DamageSourceId | null
  readonly damageBySource: Partial<Record<DamageSourceId, number>>
  readonly damageByReaction: Partial<Record<ReactionId, number>>
}

export interface HeadlessStrategyResult extends HeadlessRunResult {
  readonly summary: HeadlessStrategySummary
}

export function runHeadlessRun(initialState: RunState, options: HeadlessRunOptions): HeadlessRunResult {
  const stepMs = options.stepMs ?? 1000 / 30;
  const config = options.config ?? gameConfig;
  let state = initialState;

  for (let steps = 0; steps < options.maxSteps; steps += 1) {
    if (options.stopWhen?.(state)) {
      return {
        state,
        steps,
        stoppedByPredicate: true,
      };
    }

    options.scriptedActions?.(state).forEach((action) => {
      state = applyAction(state, action, config);
    });

    if (options.autoStartWaves && state.phase === "ready") {
      state = applyAction(state, { type: "startWave" }, config);
    }

    if (state.phase === "draft") {
      options.draftActions?.(state).forEach((action) => {
        state = applyAction(state, action);
      });

      if (options.autoCompleteDrafts) {
        if (state.draft?.step === "tower") {
          const offer = state.draft.towerOffers[0];

          if (offer) {
            state = applyAction(state, { type: "chooseDraftTower", emitterId: offer.emitterId }, config);
          }
        }

        if (state.draft?.step === "upgrade") {
          const upgradeId = state.draft.upgradeOffers[0];

          if (upgradeId) {
            state = applyAction(state, { type: "chooseDraftUpgrade", upgradeId }, config);
          }
        }
      }
    }

    state = stepRun(state, stepMs, config);
  }

  return {
    state,
    steps: options.maxSteps,
    stoppedByPredicate: options.stopWhen?.(state) ?? false,
  };
}

export function runHeadlessStrategy(
  strategy: HeadlessScriptedStrategy,
  options: Omit<HeadlessRunOptions, "autoCompleteDrafts" | "draftActions" | "scriptedActions">,
): HeadlessStrategyResult {
  const config = options.config ?? gameConfig;
  const result = runHeadlessRun(createRun(strategy.seed, { config }), {
    ...options,
    config,
    autoStartWaves: options.autoStartWaves ?? true,
    scriptedActions: state => getPlacementActions(state, strategy.placementPlan),
    draftActions: state => getDraftActions(state, strategy.draftPlan),
  });

  return {
    ...result,
    summary: createHeadlessStrategySummary(strategy.id, result.state),
  };
}

export function createHeadlessStrategySummary(strategyId: string, state: RunState): HeadlessStrategySummary {
  const reactionDamageEntries = Object.entries(state.stats.damageByReaction) as Array<[ReactionId, number]>;
  const sourceDamageEntries = Object.entries(state.stats.damageBySource) as Array<[DamageSourceId, number]>;
  const topReaction = reactionDamageEntries
    .sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
  const topSource = sourceDamageEntries
    .sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;

  return {
    strategyId,
    phase: state.phase,
    wavesCleared: state.stats.waveStats.filter(wave => wave.kills + wave.leaks > 0).length,
    coreHp: state.coreHp,
    leaks: state.stats.leaks,
    kills: state.stats.kills,
    bossBreaks: state.stats.bossBreaks,
    totalDamage: state.stats.totalDamage,
    topReaction,
    topSource,
    damageBySource: state.stats.damageBySource,
    damageByReaction: state.stats.damageByReaction,
  };
}

function getPlacementActions(state: RunState, placementPlan: HeadlessPlacementPlan): readonly GameAction[] {
  const occupiedSlotIds = new Set(state.placedTowers.map(tower => tower.slotId).filter(slotId => slotId !== null));
  const actions: GameAction[] = [];

  state.bench.forEach((tower) => {
    const targetSlotId = placementPlan[tower.emitterId]?.find(slotId => !occupiedSlotIds.has(slotId));

    if (!targetSlotId) {
      return;
    }

    occupiedSlotIds.add(targetSlotId);
    actions.push(
      { type: "selectTower", towerId: tower.id },
      { type: "placeSelectedTower", slotId: targetSlotId },
    );
  });

  return actions;
}

function getDraftActions(state: RunState, draftPlan: HeadlessDraftPlan): readonly GameAction[] {
  if (state.phase !== "draft" || !state.draft) {
    return [];
  }

  const actions: GameAction[] = [];
  const towerOffer = findPreferred(state.draft.towerOffers, draftPlan.towerPriority, offer => offer.emitterId);
  const upgradeOffer = findPreferred(state.draft.upgradeOffers, draftPlan.upgradePriority, upgradeId => upgradeId);

  if (state.draft.step === "tower" && towerOffer) {
    actions.push({ type: "chooseDraftTower", emitterId: towerOffer.emitterId });
  }

  if (upgradeOffer) {
    actions.push({ type: "chooseDraftUpgrade", upgradeId: upgradeOffer });
  }

  return actions;
}

function findPreferred<T, TId extends string>(
  candidates: readonly T[],
  priority: readonly TId[],
  getId: (candidate: T) => TId,
): T | undefined {
  return [...candidates]
    .sort((left, right) => {
      const leftPriority = priority.indexOf(getId(left));
      const rightPriority = priority.indexOf(getId(right));

      return normalizePriority(leftPriority) - normalizePriority(rightPriority);
    })[0];
}

function normalizePriority(priority: number): number {
  return priority === -1 ? Number.MAX_SAFE_INTEGER : priority;
}
