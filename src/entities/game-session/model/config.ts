import type {
  GameConfig,
} from "./types";
import { createStadiumLoopBoard, defaultBoardGeometryConfig } from "./boardGeometry";

const board = createStadiumLoopBoard({
  ...defaultBoardGeometryConfig,
  lockInnerCornerSlots: true,
});

export const gameConfig: GameConfig = {
  balance: {
    schemaVersion: 8,
    pathCellCount: 18,
    coreHp: 15,
    leakDamage: 1,
    tickRate: 30,
    rerollsPerDraft: 1,
    postDraftCountdownMs: 3000,
    minSpeedMultiplier: 0.32,
    upgradeDraftMilestoneWaves: [2, 4, 6, 8],
  },
  board,
  emitters: [
    { id: "water", displayName: "Вода", towerDisplayName: "Водомёт", family: "substance", speedMultiplier: 0.85 },
    { id: "oil", displayName: "Нефть", towerDisplayName: "Маслонасос", family: "substance", speedMultiplier: 0.70 },
    { id: "spark", displayName: "Искра", towerDisplayName: "Разрядник", family: "energy", energyCapacity: 1, rawDps: 5, rawDamageFamily: "electric" },
    { id: "heat", displayName: "Жар", towerDisplayName: "Магмовый кран", family: "energy", energyCapacity: 1, rawDps: 7, rawDamageFamily: "fire" },
  ],
  reactions: [
    { id: "electroPuddle", displayName: "Электролужа", tier: 1, layer: "ground", damageFamily: "electric", dps: 15, inputs: ["water", "spark"] },
    { id: "steam", displayName: "Пар", tier: 1, layer: "air", damageFamily: "steam", dps: 7, inputs: ["water", "heat"] },
    { id: "fire", displayName: "Пожар", tier: 1, layer: "ground", damageFamily: "fire", dps: 20, inputs: ["oil", "heat"] },
    { id: "stormCloud", displayName: "Грозовое облако", tier: 2, layer: "air", damageFamily: "electric", dps: 32, inputs: ["steam", "spark"] },
    { id: "fireVortex", displayName: "Огненный вихрь", tier: 2, layer: "air", damageFamily: "fire", dps: 38, inputs: ["fire", "steam"] },
    { id: "fireStorm", displayName: "Огненный Шторм", tier: 3, layer: "air", damageFamily: "storm", dps: 48, inputs: ["stormCloud", "fireVortex"] },
  ],
  enemies: [
    { id: "grunt", displayName: "Заморыш", hp: 30, speedCellsPerSecond: 0.75, leakDamage: 1 },
    { id: "swarm", displayName: "Кусака", hp: 14, speedCellsPerSecond: 0.915, leakDamage: 1 },
    { id: "tank", displayName: "Тролль", hp: 105, speedCellsPerSecond: 0.435, leakDamage: 1 },
    { id: "flyer", displayName: "Нетопырь", hp: 24, speedCellsPerSecond: 0.84, leakDamage: 1, traits: ["flying"] },
    { id: "runner", displayName: "Варг", hp: 26, speedCellsPerSecond: 1.29, leakDamage: 1 },
    { id: "insulated", displayName: "Грязевик", hp: 62, speedCellsPerSecond: 0.66, leakDamage: 1, resistances: { electric: 0.35 } },
    { id: "flameproof", displayName: "Магмень", hp: 68, speedCellsPerSecond: 0.63, leakDamage: 1, resistances: { fire: 0.35 } },
  ],
  waves: [
    { id: "wave-1", telegraphEnemyIds: ["grunt"], spawnGroups: [{ enemyId: "grunt", count: 10, spawnIntervalMs: 975 }] },
    { id: "wave-2", telegraphEnemyIds: ["swarm"], spawnGroups: [{ enemyId: "swarm", count: 22, spawnIntervalMs: 416 }] },
    { id: "wave-3", telegraphEnemyIds: ["flyer"], spawnGroups: [{ enemyId: "flyer", count: 11, spawnIntervalMs: 754 }] },
    {
      id: "wave-4",
      telegraphEnemyIds: ["tank", "grunt"],
      spawnGroups: [
        { enemyId: "tank", count: 6, spawnIntervalMs: 1365 },
        { enemyId: "grunt", count: 17, spawnIntervalMs: 507, startDelayMs: 850 },
      ],
    },
    {
      id: "wave-5",
      telegraphEnemyIds: ["runner", "swarm"],
      spawnGroups: [
        { enemyId: "runner", count: 15, spawnIntervalMs: 676 },
        { enemyId: "swarm", count: 21, spawnIntervalMs: 416, startDelayMs: 800 },
      ],
    },
    {
      id: "wave-6",
      telegraphEnemyIds: ["insulated", "tank"],
      spawnGroups: [
        { enemyId: "insulated", count: 10, spawnIntervalMs: 1250 },
        { enemyId: "tank", count: 5, spawnIntervalMs: 1850, startDelayMs: 1800 },
      ],
    },
    {
      id: "wave-7",
      telegraphEnemyIds: ["flameproof", "runner", "flyer"],
      spawnGroups: [
        { enemyId: "flameproof", count: 10, spawnIntervalMs: 1105 },
        { enemyId: "runner", count: 13, spawnIntervalMs: 754, startDelayMs: 800 },
        { enemyId: "flyer", count: 9, spawnIntervalMs: 910, startDelayMs: 1500 },
      ],
    },
    {
      id: "wave-8",
      telegraphEnemyIds: ["flyer", "insulated"],
      spawnGroups: [
        { enemyId: "flyer", count: 13, spawnIntervalMs: 980, startDelayMs: 900 },
        { enemyId: "insulated", count: 9, spawnIntervalMs: 1650, startDelayMs: 2300 },
      ],
    },
    {
      id: "wave-9",
      telegraphEnemyIds: ["tank", "flameproof", "swarm"],
      spawnGroups: [
        { enemyId: "tank", count: 7, spawnIntervalMs: 1625 },
        { enemyId: "flameproof", count: 10, spawnIntervalMs: 1105, startDelayMs: 1100 },
        { enemyId: "swarm", count: 22, spawnIntervalMs: 520, startDelayMs: 2000 },
      ],
    },
    {
      id: "wave-10",
      telegraphEnemyIds: ["runner", "flyer", "tank"],
      spawnGroups: [
        { enemyId: "runner", count: 18, spawnIntervalMs: 754 },
        { enemyId: "flyer", count: 13, spawnIntervalMs: 910, startDelayMs: 950 },
        { enemyId: "tank", count: 7, spawnIntervalMs: 1625, startDelayMs: 1700 },
      ],
    },
  ],
  boss: {
    id: "barrel-eater",
    displayName: "Бочкоед",
    hp: 1000,
    laps: 3,
    lapCoreDamage: 3,
    speedCellsPerSecond: 0.46575,
    speedIncreasePerLap: 0.1725,
    reactionBreakThreshold: 3,
    vulnerableDurationMs: 5000,
    vulnerableDamageMultiplier: 2,
    abilities: {
      exitSmash: {
        id: "exitSmash",
        triggerLap: 1,
        triggerPathProgress: 9,
        prepareMs: 1200,
        leapMs: 1000,
        smashMs: 4000,
        coreDamage: 2,
      },
      rightSideSuppression: {
        id: "rightSideSuppression",
        triggerLap: 2,
        triggerPathProgress: 9,
        castMs: 900,
        durationMs: 6000,
        cellIndexes: [10, 11, 12, 13, 14],
      },
      summonWave: {
        id: "summonWave",
        triggerLap: 3,
        holdMs: 2000,
        postSummonHoldMs: 2000,
        spawnGroups: [
          { enemyId: "swarm", count: 8, spawnIntervalMs: 250 },
          { enemyId: "runner", count: 4, spawnIntervalMs: 450, startDelayMs: 600 },
        ],
      },
    },
  },
  upgrades: [
    { id: "waterCapacity", displayName: "Напор водомёта", maxStacks: 1, emitterId: "water", effect: { type: "substanceCoverage", amount: 1 } },
    { id: "oilControl", displayName: "Подача маслонасоса", maxStacks: 1, emitterId: "oil", effect: { type: "substanceCoverage", amount: 1 } },
    { id: "sparkCapacity", displayName: "Емкость разрядника", maxStacks: 1, emitterId: "spark", effect: { type: "energyCapacity", amount: 1 } },
    { id: "heatReach", displayName: "Жаровая тяга", maxStacks: 1, emitterId: "heat", effect: { type: "energyCapacity", amount: 1 } },
    { id: "fireCatalyst", displayName: "Пламенная присадка", maxStacks: 2, emitterId: "heat", effect: { type: "reactionDamageMultiplier", emitterId: "heat", amount: 0.25 } },
    { id: "sparkCatalyst", displayName: "Искровой катализатор", maxStacks: 2, emitterId: "spark", effect: { type: "reactionDamageMultiplier", emitterId: "spark", amount: 0.25 } },
    { id: "unlockSlot5", displayName: "Открыть северо-западный угловой слот для башни", maxStacks: 1, effect: { type: "unlockSlot", slotId: "slot-5-inner", amount: 1 } },
    { id: "unlockSlot9", displayName: "Открыть северо-восточный угловой слот для башни", maxStacks: 1, effect: { type: "unlockSlot", slotId: "slot-9-inner", amount: 1 } },
    { id: "unlockSlot14", displayName: "Открыть юго-восточный угловой слот для башни", maxStacks: 1, effect: { type: "unlockSlot", slotId: "slot-14-inner", amount: 1 } },
  ],
};

export function validateGameConfig(config: GameConfig): readonly string[] {
  const errors: string[] = [];
  const emitterIds = new Set<string>(config.emitters.map(emitter => emitter.id));
  const reactionIds = new Set<string>(config.reactions.map(reaction => reaction.id));
  const enemyIds = new Set(config.enemies.map(enemy => enemy.id));
  const upgradeIds = new Set(config.upgrades.map(upgrade => upgrade.id));

  if (config.balance.pathCellCount !== config.board.pathCells.length) {
    errors.push("balance.pathCellCount must match board.pathCells.length");
  }

  if (
    config.balance.coreHp <= 0
    || config.balance.leakDamage <= 0
    || config.balance.tickRate <= 0
    || config.balance.rerollsPerDraft < 0
    || config.balance.postDraftCountdownMs < 0
    || config.balance.minSpeedMultiplier <= 0
    || config.balance.minSpeedMultiplier > 1
  ) {
    errors.push("balance has invalid runtime values");
  }

  config.emitters.forEach((emitter) => {
    if (!emitter.displayName || !emitter.towerDisplayName) {
      errors.push(`emitter ${emitter.id} is missing display names`);
    }

    if (emitter.family === "energy" && (emitter.energyCapacity ?? 0) <= 0) {
      errors.push(`emitter ${emitter.id} must have positive energyCapacity`);
    }

    if (emitter.family === "energy" && emitter.rawDps !== undefined && emitter.rawDps <= 0) {
      errors.push(`emitter ${emitter.id} rawDps must be positive`);
    }

    if (emitter.rawDps !== undefined && !emitter.rawDamageFamily) {
      errors.push(`emitter ${emitter.id} rawDps requires rawDamageFamily`);
    }

    if (emitter.family === "substance" && (emitter.speedMultiplier ?? 1) > 1) {
      errors.push(`emitter ${emitter.id} speedMultiplier cannot exceed 1`);
    }
  });

  config.reactions.forEach((reaction) => {
    if (!reaction.displayName) {
      errors.push(`reaction ${reaction.id} is missing displayName`);
    }

    if (reaction.dps <= 0) {
      errors.push(`reaction ${reaction.id} must have positive dps`);
    }

    reaction.inputs.forEach((input) => {
      if (!emitterIds.has(input) && !reactionIds.has(input)) {
        errors.push(`reaction ${reaction.id} references unknown input ${input}`);
      }
    });
  });

  config.waves.forEach((wave) => {
    if (wave.spawnGroups.length <= 0) {
      errors.push(`wave ${wave.id} must have at least one spawn group`);
    }

    wave.spawnGroups.forEach((group, groupIndex) => {
      if (!enemyIds.has(group.enemyId)) {
        errors.push(`wave ${wave.id} group ${groupIndex} references unknown enemy ${group.enemyId}`);
      }

      if (group.count <= 0 || group.spawnIntervalMs <= 0 || (group.startDelayMs ?? 0) < 0) {
        errors.push(`wave ${wave.id} group ${groupIndex} must have positive count/spawnIntervalMs and non-negative startDelayMs`);
      }
    });

    wave.telegraphEnemyIds?.forEach((enemyId) => {
      if (!enemyIds.has(enemyId)) {
        errors.push(`wave ${wave.id} references unknown telegraph enemy ${enemyId}`);
      }
    });
  });

  if (!config.boss.displayName) {
    errors.push(`boss ${config.boss.id} is missing displayName`);
  }

  if (
    config.boss.hp <= 0
    || config.boss.laps <= 0
    || config.boss.lapCoreDamage <= 0
    || config.boss.speedCellsPerSecond <= 0
    || config.boss.speedIncreasePerLap < 0
    || config.boss.reactionBreakThreshold <= 0
    || config.boss.vulnerableDurationMs <= 0
    || config.boss.vulnerableDamageMultiplier < 1
  ) {
    errors.push(`boss ${config.boss.id} has invalid combat values`);
  }

  const bossAbilities = config.boss.abilities;
  if (
    bossAbilities.exitSmash.coreDamage <= 0
    || bossAbilities.exitSmash.prepareMs < 0
    || bossAbilities.exitSmash.leapMs < 0
    || bossAbilities.exitSmash.smashMs < 0
    || bossAbilities.rightSideSuppression.castMs < 0
    || bossAbilities.rightSideSuppression.durationMs <= 0
    || bossAbilities.rightSideSuppression.cellIndexes.length === 0
    || bossAbilities.summonWave.holdMs < 0
    || bossAbilities.summonWave.postSummonHoldMs < 0
    || bossAbilities.summonWave.spawnGroups.length === 0
  ) {
    errors.push(`boss ${config.boss.id} has invalid ability values`);
  }

  bossAbilities.summonWave.spawnGroups.forEach((group, groupIndex) => {
    if (!enemyIds.has(group.enemyId)) {
      errors.push(`boss ${config.boss.id} summon group ${groupIndex} references unknown enemy ${group.enemyId}`);
    }

    if (group.count <= 0 || group.spawnIntervalMs <= 0 || (group.startDelayMs ?? 0) < 0) {
      errors.push(`boss ${config.boss.id} summon group ${groupIndex} must have positive count/spawnIntervalMs and non-negative startDelayMs`);
    }
  });

  config.upgrades.forEach((upgrade) => {
    if (!upgrade.displayName) {
      errors.push(`upgrade ${upgrade.id} is missing displayName`);
    }

    if (upgradeIds.size !== config.upgrades.length) {
      errors.push("upgrade ids must be unique");
    }

    if (upgrade.emitterId && !emitterIds.has(upgrade.emitterId)) {
      errors.push(`upgrade ${upgrade.id} references unknown emitter ${upgrade.emitterId}`);
    }

    if (upgrade.maxStacks <= 0) {
      errors.push(`upgrade ${upgrade.id} must have positive maxStacks`);
    }

    if (upgrade.effect.amount <= 0) {
      errors.push(`upgrade ${upgrade.id} must have positive effect amount`);
    }

    if (upgrade.effect.type === "reactionDamageMultiplier" && !emitterIds.has(upgrade.effect.emitterId)) {
      errors.push(`upgrade ${upgrade.id} references unknown effect emitter ${upgrade.effect.emitterId}`);
    }
  });

  return errors;
}
