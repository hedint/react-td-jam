import type { BossAbilityId, EnemyId, GameSnapshot, ReactionId } from "./types";

export type GamePresentationEvent
  = | {
    readonly type: "enemyDamaged"
    readonly enemyInstanceId: string
    readonly enemyId: EnemyId
    readonly amount: number
    readonly pathProgress: number
  }
  | {
    readonly type: "enemyKilled"
    readonly enemyInstanceId: string
    readonly enemyId: EnemyId
    readonly pathProgress: number
  }
  | {
    readonly type: "coreDamaged"
    readonly amount: number
  }
  | {
    readonly type: "reactionBurst"
    readonly reactionId: ReactionId
    readonly cellIndex: number
  }
  | {
    readonly type: "bossBreak"
    readonly pathProgress: number
  }
  | {
    readonly type: "bossDamaged"
    readonly amount: number
    readonly pathProgress: number
  }
  | {
    readonly type: "bossKilled"
    readonly pathProgress: number
  }
  | {
    readonly type: "bossAbilityStarted"
    readonly abilityId: BossAbilityId
    readonly pathProgress: number
  }
  | {
    readonly type: "bossAbilityImpact"
    readonly abilityId: BossAbilityId
    readonly pathProgress: number
  }
  | {
    readonly type: "bossSuppressionStarted"
    readonly cellIndexes: readonly number[]
  };

export function derivePresentationEvents(
  previous: GameSnapshot,
  next: GameSnapshot,
): readonly GamePresentationEvent[] {
  const events: GamePresentationEvent[] = [];

  events.push(...deriveEnemyDamageEvents(previous, next));
  events.push(...deriveEnemyKillEvents(previous, next));
  events.push(...deriveCoreDamageEvents(previous, next));
  events.push(...deriveReactionBurstEvents(previous, next));
  events.push(...deriveBossBreakEvents(previous, next));
  events.push(...deriveBossDamageEvents(previous, next));
  events.push(...deriveBossAbilityEvents(previous, next));

  return events;
}

function deriveEnemyDamageEvents(previous: GameSnapshot, next: GameSnapshot): readonly GamePresentationEvent[] {
  const nextEnemies = new Map(next.livingEnemies.map(enemy => [enemy.id, enemy]));

  return previous.livingEnemies.flatMap((enemy) => {
    const nextEnemy = nextEnemies.get(enemy.id);
    const nextHp = nextEnemy?.hp ?? 0;
    const amount = enemy.hp - nextHp;

    if (amount <= 0) {
      return [];
    }

    return [{
      type: "enemyDamaged",
      enemyInstanceId: enemy.id,
      enemyId: enemy.enemyId,
      amount,
      pathProgress: nextEnemy?.pathProgress ?? enemy.pathProgress,
    }];
  });
}

function deriveEnemyKillEvents(previous: GameSnapshot, next: GameSnapshot): readonly GamePresentationEvent[] {
  const killCount = Math.max(0, next.stats.kills - previous.stats.kills);

  if (killCount === 0) {
    return [];
  }

  const nextEnemyIds = new Set(next.livingEnemies.map(enemy => enemy.id));
  const missingEnemies = previous.livingEnemies.filter(enemy => !nextEnemyIds.has(enemy.id));

  return missingEnemies.slice(0, killCount).map(enemy => ({
    type: "enemyKilled",
    enemyInstanceId: enemy.id,
    enemyId: enemy.enemyId,
    pathProgress: enemy.pathProgress,
  }));
}

function deriveCoreDamageEvents(previous: GameSnapshot, next: GameSnapshot): readonly GamePresentationEvent[] {
  const amount = previous.coreHp - next.coreHp;

  return amount > 0 ? [{ type: "coreDamaged", amount }] : [];
}

function deriveReactionBurstEvents(previous: GameSnapshot, next: GameSnapshot): readonly GamePresentationEvent[] {
  const previousReactionKeys = new Set(getActiveReactionKeys(previous));

  return next.activeReactions.flatMap((reaction) => {
    const events: GamePresentationEvent[] = [];

    if (reaction.ground && !previousReactionKeys.has(getReactionKey(reaction.cellIndex, "ground", reaction.ground))) {
      events.push({
        type: "reactionBurst",
        reactionId: reaction.ground,
        cellIndex: reaction.cellIndex,
      });
    }

    if (reaction.air && !previousReactionKeys.has(getReactionKey(reaction.cellIndex, "air", reaction.air))) {
      events.push({
        type: "reactionBurst",
        reactionId: reaction.air,
        cellIndex: reaction.cellIndex,
      });
    }

    return events;
  });
}

function deriveBossBreakEvents(previous: GameSnapshot, next: GameSnapshot): readonly GamePresentationEvent[] {
  const breakCount = Math.max(0, next.stats.bossBreaks - previous.stats.bossBreaks);

  if (breakCount === 0) {
    return [];
  }

  return [{
    type: "bossBreak",
    pathProgress: next.boss?.pathProgress ?? previous.boss?.pathProgress ?? 0,
  }];
}

function deriveBossDamageEvents(previous: GameSnapshot, next: GameSnapshot): readonly GamePresentationEvent[] {
  const previousBoss = previous.boss;
  const nextBoss = next.boss;

  if (!previousBoss || !nextBoss) {
    return [];
  }

  const amount = previousBoss.hp - nextBoss.hp;
  const events: GamePresentationEvent[] = [];

  if (amount > 0) {
    events.push({
      type: "bossDamaged",
      amount,
      pathProgress: nextBoss.pathProgress,
    });
  }

  if (previousBoss.hp > 0 && nextBoss.hp <= 0) {
    events.push({
      type: "bossKilled",
      pathProgress: nextBoss.pathProgress,
    });
  }

  return events;
}

function deriveBossAbilityEvents(previous: GameSnapshot, next: GameSnapshot): readonly GamePresentationEvent[] {
  const previousBoss = previous.boss;
  const nextBoss = next.boss;

  if (!nextBoss) {
    return [];
  }

  const events: GamePresentationEvent[] = [];
  const previousAbility = previousBoss?.activeAbility ?? null;
  const nextAbility = nextBoss.activeAbility;

  if (nextAbility && previousAbility?.id !== nextAbility.id) {
    events.push({
      type: "bossAbilityStarted",
      abilityId: nextAbility.id,
      pathProgress: nextBoss.pathProgress,
    });
  }

  if (previousAbility && !previousAbility.impactApplied && nextAbility?.id === previousAbility.id && nextAbility.impactApplied) {
    events.push({
      type: "bossAbilityImpact",
      abilityId: nextAbility.id,
      pathProgress: nextAbility.id === "exitSmash" ? next.board.pathCells.length : nextBoss.pathProgress,
    });
  }

  if ((previousBoss?.suppressionRemainingMs ?? 0) <= 0 && nextBoss.suppressionRemainingMs > 0) {
    events.push({
      type: "bossAbilityImpact",
      abilityId: "rightSideSuppression",
      pathProgress: nextBoss.pathProgress,
    }, {
      type: "bossSuppressionStarted",
      cellIndexes: [10, 11, 12, 13, 14],
    });
  }

  if (!previousBoss?.summonRuntime && nextBoss.summonRuntime) {
    events.push({
      type: "bossAbilityImpact",
      abilityId: "summonWave",
      pathProgress: nextBoss.pathProgress,
    });
  }

  return events;
}

function getActiveReactionKeys(snapshot: GameSnapshot): readonly string[] {
  return snapshot.activeReactions.flatMap((reaction) => {
    const keys: string[] = [];

    if (reaction.ground) {
      keys.push(getReactionKey(reaction.cellIndex, "ground", reaction.ground));
    }

    if (reaction.air) {
      keys.push(getReactionKey(reaction.cellIndex, "air", reaction.air));
    }

    return keys;
  });
}

function getReactionKey(cellIndex: number, layer: "ground" | "air", reactionId: ReactionId): string {
  return `${cellIndex}:${layer}:${reactionId}`;
}
