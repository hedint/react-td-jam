export interface StagePoint {
  readonly x: number
  readonly y: number
}

export interface ViewportSize {
  readonly width: number
  readonly height: number
}

export type RunPhase = "wave" | "victory" | "defeat";
export type EmitterId = "water" | "spark";
export type ReactionId = "electroPuddle";
export type EnemyId = "grunt";

export interface RngState {
  readonly seed: number
  readonly state: number
}

export interface PathCell {
  readonly id: string
  readonly index: number
  readonly x: number
  readonly y: number
}

export interface BoardSlot {
  readonly id: string
  readonly cellIndexes: readonly number[]
  readonly locked: boolean
}

export interface BoardState {
  readonly pathCells: readonly PathCell[]
  readonly slots: readonly BoardSlot[]
}

export interface TowerState {
  readonly id: string
  readonly emitterId: EmitterId
  readonly displayName: string
  readonly slotId: string | null
}

export interface EnemyState {
  readonly id: string
  readonly enemyId: EnemyId
  readonly displayName: string
  readonly hp: number
  readonly maxHp: number
  readonly pathProgress: number
  readonly leaked: boolean
}

export interface CellReactionState {
  readonly cellIndex: number
  readonly ground: ReactionId | null
}

export interface RunState {
  readonly phase: RunPhase
  readonly seed: number
  readonly rng: RngState
  readonly tick: number
  readonly elapsedMs: number
  readonly paused: boolean
  readonly coreHp: number
  readonly board: BoardState
  readonly bench: readonly TowerState[]
  readonly placedTowers: readonly TowerState[]
  readonly enemies: readonly EnemyState[]
  readonly reactions: readonly CellReactionState[]
  readonly lastTap: StagePoint | null
}

export type GameSessionState = RunState;

export interface GameSnapshot extends RunState {
  readonly livingEnemies: readonly EnemyState[]
  readonly activeReactions: readonly CellReactionState[]
}

export interface RuntimeSnapshot extends GameSnapshot {
  readonly fps: number
  readonly viewport: ViewportSize
}
