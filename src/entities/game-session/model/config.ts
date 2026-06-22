import type {
  GameConfig,
} from "./types";
import { createStadiumLoopBoard, defaultBoardGeometryConfig } from "./boardGeometry";

const board = createStadiumLoopBoard(defaultBoardGeometryConfig);

export const gameConfig: GameConfig = {
  balance: {
    schemaVersion: 4,
    pathCellCount: 16,
    coreHp: 15,
    leakDamage: 1,
    tickRate: 30,
    rerollsPerDraft: 1,
    postDraftCountdownMs: 3000,
    minSpeedMultiplier: 0.32,
  },
  board,
  emitters: [
    { id: "water", displayName: "Вода", towerDisplayName: "Водомёт", family: "substance", speedMultiplier: 0.85 },
    { id: "oil", displayName: "Нефть", towerDisplayName: "Маслонасос", family: "substance", speedMultiplier: 0.70 },
    { id: "spark", displayName: "Искра", towerDisplayName: "Разрядник", family: "energy", energyCapacity: 3, rawDps: 5, rawDamageFamily: "electric" },
    { id: "heat", displayName: "Жар", towerDisplayName: "Магмовый кран", family: "energy", energyCapacity: 2, rawDps: 7, rawDamageFamily: "fire" },
  ],
  reactions: [
    { id: "electroPuddle", displayName: "Электролужа", tier: 1, layer: "ground", damageFamily: "electric", dps: 15, inputs: ["water", "spark"] },
    { id: "steam", displayName: "Пар", tier: 1, layer: "air", damageFamily: "steam", dps: 7, inputs: ["water", "heat"] },
    { id: "fire", displayName: "Пожар", tier: 1, layer: "ground", damageFamily: "fire", dps: 20, inputs: ["oil", "heat"] },
    { id: "stormCloud", displayName: "Грозовое облако", tier: 2, layer: "air", damageFamily: "electric", dps: 32, inputs: ["steam", "spark"] },
    { id: "fireVortex", displayName: "Огненный вихрь", tier: 2, layer: "air", damageFamily: "fire", dps: 38, inputs: ["fire", "steam"] },
    { id: "fireStorm", displayName: "Огненный Шторм", tier: 3, layer: "air", damageFamily: "storm", dps: 68, inputs: ["stormCloud", "fireVortex"] },
  ],
  enemies: [
    { id: "grunt", displayName: "Грунт", hp: 30, speedCellsPerSecond: 1, leakDamage: 1 },
    { id: "swarm", displayName: "Сварм", hp: 14, speedCellsPerSecond: 1.22, leakDamage: 1 },
    { id: "tank", displayName: "Танк", hp: 105, speedCellsPerSecond: 0.58, leakDamage: 1 },
    { id: "flyer", displayName: "Летун", hp: 24, speedCellsPerSecond: 1.12, leakDamage: 1, traits: ["flying"] },
    { id: "runner", displayName: "Бегун", hp: 26, speedCellsPerSecond: 1.72, leakDamage: 1 },
    { id: "insulated", displayName: "Грязевик", hp: 62, speedCellsPerSecond: 0.88, leakDamage: 1, resistances: { electric: 0.35 } },
    { id: "flameproof", displayName: "Магма-выползень", hp: 68, speedCellsPerSecond: 0.84, leakDamage: 1, resistances: { fire: 0.35 } },
  ],
  waves: [
    { id: "wave-1", enemyId: "grunt", count: 1, spawnIntervalMs: 900, telegraphEnemyId: "grunt" },
    { id: "wave-2", enemyId: "swarm", count: 9, spawnIntervalMs: 260, telegraphEnemyId: "swarm" },
    { id: "wave-3", enemyId: "flyer", count: 5, spawnIntervalMs: 520, telegraphEnemyId: "flyer" },
    { id: "wave-4", enemyId: "tank", count: 4, spawnIntervalMs: 820, telegraphEnemyId: "tank" },
    { id: "wave-5", enemyId: "runner", count: 7, spawnIntervalMs: 380, telegraphEnemyId: "runner" },
    { id: "wave-6", enemyId: "insulated", count: 6, spawnIntervalMs: 520, telegraphEnemyId: "insulated" },
    { id: "wave-7", enemyId: "flameproof", count: 6, spawnIntervalMs: 520, telegraphEnemyId: "flameproof" },
    { id: "wave-8", enemyId: "swarm", count: 14, spawnIntervalMs: 200, telegraphEnemyId: "swarm" },
    { id: "wave-9", enemyId: "tank", count: 6, spawnIntervalMs: 680, telegraphEnemyId: "tank" },
    { id: "wave-10", enemyId: "runner", count: 12, spawnIntervalMs: 290, telegraphEnemyId: "runner" },
  ],
  boss: {
    id: "barrel-eater",
    displayName: "Бочкоед",
    hp: 620,
    laps: 3,
    lapCoreDamage: 3,
    speedCellsPerSecond: 0.54,
    speedIncreasePerLap: 0.2,
    reactionBreakThreshold: 3,
    vulnerableDurationMs: 5000,
    vulnerableDamageMultiplier: 2,
  },
  upgrades: [
    { id: "waterCapacity", displayName: "Напор водомёта", maxStacks: 2, emitterId: "water", effect: { type: "substanceCoverage", amount: 1 } },
    { id: "oilControl", displayName: "Вязкая смола", maxStacks: 2, emitterId: "oil", effect: { type: "substanceSlow", amount: 0.1 } },
    { id: "sparkCapacity", displayName: "Емкость разрядника", maxStacks: 3, emitterId: "spark", effect: { type: "energyCapacity", amount: 1 } },
    { id: "heatReach", displayName: "Жаровая тяга", maxStacks: 2, emitterId: "heat", effect: { type: "energyCapacity", amount: 1 } },
    { id: "fireCatalyst", displayName: "Пламенная присадка", maxStacks: 2, emitterId: "oil", effect: { type: "reactionDps", reactionId: "fire", amount: 4 } },
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
    if (!enemyIds.has(wave.enemyId)) {
      errors.push(`wave ${wave.id} references unknown enemy ${wave.enemyId}`);
    }

    if (wave.telegraphEnemyId && !enemyIds.has(wave.telegraphEnemyId)) {
      errors.push(`wave ${wave.id} references unknown telegraph enemy ${wave.telegraphEnemyId}`);
    }

    if (wave.count <= 0 || wave.spawnIntervalMs <= 0) {
      errors.push(`wave ${wave.id} must have positive count and spawnIntervalMs`);
    }
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

    if (upgrade.effect.type === "reactionDps" && !reactionIds.has(upgrade.effect.reactionId)) {
      errors.push(`upgrade ${upgrade.id} references unknown reaction ${upgrade.effect.reactionId}`);
    }
  });

  return errors;
}
