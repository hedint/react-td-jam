import type {
  EmitterId,
  GameConfig,
} from "./types";
import { createStadiumLoopBoard, defaultBoardGeometryConfig } from "./boardGeometry";

const board = createStadiumLoopBoard(defaultBoardGeometryConfig);

export const gameConfig: GameConfig = {
  balance: {
    schemaVersion: 1,
    pathCellCount: 16,
    coreHp: 15,
    leakDamage: 1,
    tickRate: 30,
    rerollsPerDraft: 1,
  },
  board,
  emitters: [
    { id: "water", displayName: "Вода", towerDisplayName: "Водомёт", family: "substance" },
    { id: "oil", displayName: "Нефть", towerDisplayName: "Маслонасос", family: "substance" },
    { id: "spark", displayName: "Искра", towerDisplayName: "Разрядник", family: "energy" },
    { id: "heat", displayName: "Жар", towerDisplayName: "Магмовый кран", family: "energy" },
  ],
  reactions: [
    { id: "electroPuddle", displayName: "Электролужа", tier: 1, layer: "ground", dps: 16, inputs: ["water", "spark"] },
    { id: "steam", displayName: "Пар", tier: 1, layer: "air", dps: 6, inputs: ["water", "heat"] },
    { id: "fire", displayName: "Пожар", tier: 1, layer: "ground", dps: 18, inputs: ["oil", "heat"] },
    { id: "stormCloud", displayName: "Грозовое облако", tier: 2, layer: "air", dps: 30, inputs: ["steam", "spark"] },
    { id: "fireVortex", displayName: "Огненный вихрь", tier: 2, layer: "air", dps: 34, inputs: ["fire", "steam"] },
    { id: "fireStorm", displayName: "Огненный Шторм", tier: 3, layer: "air", dps: 60, inputs: ["stormCloud", "fireVortex"] },
  ],
  enemies: [
    { id: "grunt", displayName: "Грунт", hp: 30, speedCellsPerSecond: 1, leakDamage: 1 },
    { id: "swarm", displayName: "Сварм", hp: 12, speedCellsPerSecond: 1.2, leakDamage: 1 },
    { id: "tank", displayName: "Танк", hp: 90, speedCellsPerSecond: 0.62, leakDamage: 1 },
    { id: "flyer", displayName: "Летун", hp: 24, speedCellsPerSecond: 1.05, leakDamage: 1 },
    { id: "runner", displayName: "Бегун", hp: 22, speedCellsPerSecond: 1.65, leakDamage: 1 },
    { id: "insulated", displayName: "Грязевик", hp: 55, speedCellsPerSecond: 0.9, leakDamage: 1 },
    { id: "flameproof", displayName: "Магма-выползень", hp: 60, speedCellsPerSecond: 0.86, leakDamage: 1 },
  ],
  waves: [
    { id: "wave-1", enemyId: "grunt", count: 1 },
    { id: "wave-2", enemyId: "swarm", count: 8 },
    { id: "wave-3", enemyId: "flyer", count: 5 },
    { id: "wave-4", enemyId: "tank", count: 3 },
    { id: "wave-5", enemyId: "runner", count: 6 },
    { id: "wave-6", enemyId: "insulated", count: 5 },
    { id: "wave-7", enemyId: "flameproof", count: 5 },
    { id: "wave-8", enemyId: "swarm", count: 12 },
    { id: "wave-9", enemyId: "tank", count: 5 },
    { id: "wave-10", enemyId: "runner", count: 10 },
  ],
  boss: {
    id: "barrel-eater",
    displayName: "Бочкоед",
    laps: 3,
    lapCoreDamage: 2,
  },
  upgrades: [
    { id: "waterCapacity", displayName: "Напор водомёта", maxStacks: 3, emitterId: "water" },
    { id: "sparkCapacity", displayName: "Емкость разрядника", maxStacks: 3, emitterId: "spark" },
    { id: "heatReach", displayName: "Жаровая тяга", maxStacks: 2, emitterId: "heat" },
  ],
};

export function validateGameConfig(config: GameConfig): readonly string[] {
  const errors: string[] = [];
  const emitterIds = new Set(config.emitters.map(emitter => emitter.id));
  const reactionIds = new Set(config.reactions.map(reaction => reaction.id));
  const enemyIds = new Set(config.enemies.map(enemy => enemy.id));
  const upgradeIds = new Set(config.upgrades.map(upgrade => upgrade.id));

  if (config.balance.pathCellCount !== config.board.pathCells.length) {
    errors.push("balance.pathCellCount must match board.pathCells.length");
  }

  config.emitters.forEach((emitter) => {
    if (!emitter.displayName || !emitter.towerDisplayName) {
      errors.push(`emitter ${emitter.id} is missing display names`);
    }
  });

  config.reactions.forEach((reaction) => {
    if (!reaction.displayName) {
      errors.push(`reaction ${reaction.id} is missing displayName`);
    }

    reaction.inputs.forEach((input) => {
      if (!emitterIds.has(input as EmitterId) && !reactionIds.has(input as never)) {
        errors.push(`reaction ${reaction.id} references unknown input ${input}`);
      }
    });
  });

  config.waves.forEach((wave) => {
    if (!enemyIds.has(wave.enemyId)) {
      errors.push(`wave ${wave.id} references unknown enemy ${wave.enemyId}`);
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
  });

  return errors;
}
