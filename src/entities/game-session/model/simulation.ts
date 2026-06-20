import type {
  BoardState,
  CellReactionState,
  EmitterId,
  EnemyState,
  GameSessionState,
  GameSnapshot,
  ReactionId,
  RngState,
  RunState,
  TowerState,
} from "./types";

const RNG_MODULUS = 0x100000000;
const RNG_MULTIPLIER = 1664525;
const RNG_INCREMENT = 1013904223;

const ELECTRO_PUDDLE_DPS = 16;
const GRUNT_MAX_HP = 20;
const GRUNT_CELLS_PER_SECOND = 1;
const CORE_HP = 5;
const LEAK_DAMAGE = 1;
const SPARK_CAPACITY = 2;

const sliceBoard: BoardState = {
  pathCells: [
    { id: "cell-0", index: 0, x: 190, y: 330 },
    { id: "cell-1", index: 1, x: 270, y: 330 },
    { id: "cell-2", index: 2, x: 350, y: 330 },
    { id: "cell-3", index: 3, x: 350, y: 430 },
  ],
  slots: [
    { id: "slot-water-a", cellIndexes: [0], locked: false },
    { id: "slot-water-b", cellIndexes: [1], locked: false },
    { id: "slot-spark-a", cellIndexes: [0], locked: false },
  ],
};

const startingTowers: readonly TowerState[] = [
  {
    id: "tower-water-a",
    emitterId: "water",
    displayName: "Водомёт",
    slotId: "slot-water-a",
  },
  {
    id: "tower-water-b",
    emitterId: "water",
    displayName: "Водомёт",
    slotId: "slot-water-b",
  },
  {
    id: "tower-spark-a",
    emitterId: "spark",
    displayName: "Разрядник",
    slotId: "slot-spark-a",
  },
];

export interface CreateRunOptions {
  readonly placedTowers?: readonly TowerState[]
  readonly enemies?: readonly EnemyState[]
}

export function createRng(seed: number): RngState {
  return {
    seed,
    state: seed >>> 0,
  };
}

export function nextRandom(rng: RngState): [RngState, number] {
  const state = (Math.imul(rng.state, RNG_MULTIPLIER) + RNG_INCREMENT) >>> 0;

  return [
    {
      seed: rng.seed,
      state,
    },
    state / RNG_MODULUS,
  ];
}

export function createRun(seed = 1, options: CreateRunOptions = {}): RunState {
  const placedTowers = options.placedTowers ?? startingTowers;

  return {
    phase: "wave",
    seed,
    rng: createRng(seed),
    tick: 0,
    elapsedMs: 0,
    paused: false,
    coreHp: CORE_HP,
    board: sliceBoard,
    bench: startingTowers.filter(tower => !placedTowers.some(placed => placed.id === tower.id)),
    placedTowers,
    enemies: options.enemies ?? [createGrunt()],
    reactions: resolveReactions(sliceBoard, placedTowers),
    lastTap: null,
  };
}

export function createGameSession(): GameSessionState {
  return createRun();
}

export function stepRun(state: RunState, deltaMs: number): RunState {
  if (state.paused) {
    return state;
  }

  const reactions = resolveReactions(state.board, state.placedTowers);
  const damageByCell = new Map<number, number>();

  reactions.forEach((reaction) => {
    if (reaction.ground === "electroPuddle") {
      damageByCell.set(reaction.cellIndex, ELECTRO_PUDDLE_DPS * deltaMs / 1000);
    }
  });

  let coreHp = state.coreHp;
  const enemies = state.enemies.flatMap((enemy) => {
    if (enemy.hp <= 0 || enemy.leaked) {
      return [];
    }

    const pathProgress = enemy.pathProgress + GRUNT_CELLS_PER_SECOND * deltaMs / 1000;

    if (pathProgress >= state.board.pathCells.length) {
      coreHp = Math.max(0, coreHp - LEAK_DAMAGE);

      return [];
    }

    const cellIndex = Math.floor(pathProgress) % state.board.pathCells.length;
    const hp = Math.max(0, enemy.hp - (damageByCell.get(cellIndex) ?? 0));

    if (hp <= 0) {
      return [];
    }

    return [
      {
        ...enemy,
        hp,
        pathProgress,
      },
    ];
  });

  return {
    ...state,
    phase: coreHp <= 0 ? "defeat" : state.phase,
    tick: state.tick + 1,
    elapsedMs: state.elapsedMs + deltaMs,
    coreHp,
    enemies,
    reactions,
  };
}

export function stepGameSession(state: GameSessionState, deltaMs: number): GameSessionState {
  return stepRun(state, deltaMs);
}

export function createSnapshot(state: RunState): GameSnapshot {
  return {
    ...state,
    livingEnemies: state.enemies.filter(enemy => enemy.hp > 0 && !enemy.leaked),
    activeReactions: state.reactions.filter(reaction => reaction.ground !== null),
  };
}

export function createTower(id: string, emitterId: EmitterId, slotId: string | null): TowerState {
  return {
    id,
    emitterId,
    displayName: emitterId === "water" ? "Водомёт" : "Разрядник",
    slotId,
  };
}

export function createGrunt(overrides: Partial<EnemyState> = {}): EnemyState {
  return {
    id: "enemy-grunt-a",
    enemyId: "grunt",
    displayName: "Грунт",
    hp: GRUNT_MAX_HP,
    maxHp: GRUNT_MAX_HP,
    pathProgress: 0,
    leaked: false,
    ...overrides,
  };
}

function resolveReactions(board: BoardState, placedTowers: readonly TowerState[]): readonly CellReactionState[] {
  const waterCells = collectEmitterCells(board, placedTowers, "water");
  const sparkCells = collectEmitterCells(board, placedTowers, "spark");
  const electroCells = new Set<number>();

  sparkCells.forEach((sparkCell) => {
    const pool = collectConnectedPool(board.pathCells.length, waterCells, sparkCell);

    pool.slice(0, SPARK_CAPACITY).forEach((cellIndex) => {
      electroCells.add(cellIndex);
    });
  });

  return board.pathCells.map<CellReactionState>(cell => ({
    cellIndex: cell.index,
    ground: electroCells.has(cell.index) ? "electroPuddle" satisfies ReactionId : null,
  }));
}

function collectEmitterCells(
  board: BoardState,
  placedTowers: readonly TowerState[],
  emitterId: EmitterId,
): Set<number> {
  const cells = new Set<number>();

  placedTowers
    .filter(tower => tower.emitterId === emitterId && tower.slotId !== null)
    .forEach((tower) => {
      const slot = board.slots.find(candidate => candidate.id === tower.slotId);
      slot?.cellIndexes.forEach(cellIndex => cells.add(cellIndex));
    });

  return cells;
}

function collectConnectedPool(pathCellCount: number, cells: Set<number>, sourceCell: number): number[] {
  if (!cells.has(sourceCell)) {
    return [];
  }

  const pool = new Set<number>([sourceCell]);
  const queue = [sourceCell];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = [
      (current - 1 + pathCellCount) % pathCellCount,
      (current + 1) % pathCellCount,
    ];

    neighbors.forEach((neighbor) => {
      if (!cells.has(neighbor) || pool.has(neighbor)) {
        return;
      }

      pool.add(neighbor);
      queue.push(neighbor);
    });
  }

  return [...pool].sort((left, right) => {
    const leftDistance = ringDistance(pathCellCount, sourceCell, left);
    const rightDistance = ringDistance(pathCellCount, sourceCell, right);

    return leftDistance - rightDistance || left - right;
  });
}

function ringDistance(pathCellCount: number, from: number, to: number): number {
  const direct = Math.abs(from - to);

  return Math.min(direct, pathCellCount - direct);
}
