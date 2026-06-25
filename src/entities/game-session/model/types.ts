export interface StagePoint {
  readonly x: number
  readonly y: number
}

export interface ViewportSize {
  readonly width: number
  readonly height: number
}

export type RunPhase = "ready" | "countdown" | "wave" | "draft" | "boss" | "victory" | "defeat";
export type EmitterId = "water" | "oil" | "spark" | "heat";
export type ReactionId = "electroPuddle" | "steam" | "fire" | "stormCloud" | "fireVortex" | "fireStorm";
export type EnemyId = "grunt" | "swarm" | "tank" | "flyer" | "runner" | "insulated" | "flameproof";
export type UpgradeId
  = | "waterCapacity"
    | "oilControl"
    | "sparkCapacity"
    | "heatReach"
    | "fireCatalyst"
    | "unlockSlot5"
    | "unlockSlot9"
    | "unlockSlot14";
export type DraftStep = "tower" | "upgrade";
export type DraftRole = "support" | "generic" | "pivot";
export type EnemyTrait = "flying";
export type DamageFamily = "electric" | "fire" | "steam" | "storm";
export type ReactionInputId = EmitterId | ReactionId;
export type DamageSourceId = ReactionId | "rawSpark" | "rawHeat";
export type BossAbilityId = "exitSmash" | "rightSideSuppression" | "summonWave";

export interface RngState {
  readonly seed: number
  readonly state: number
}

export interface PathCell {
  readonly id: string
  readonly index: number
  readonly x: number
  readonly y: number
  readonly isCorner: boolean
}

export interface BoardSlot {
  readonly id: string
  readonly cellIndexes: readonly number[]
  readonly locked: boolean
  readonly isCorner: boolean
  readonly x: number
  readonly y: number
  readonly lane: "inner" | "outer"
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
  readonly currentCellIndex: number
  readonly leaked: boolean
}

export interface CellReactionState {
  readonly cellIndex: number
  readonly ground: ReactionId | null
  readonly air: ReactionId | null
}

export interface CellEnergyClaim {
  readonly emitterId: EmitterId
  readonly towerId: string
  readonly slotId: string
}

export interface CellReagentProjection {
  readonly cellIndex: number
  readonly substances: readonly EmitterId[]
  readonly energy: readonly EmitterId[]
  readonly directEnergy: readonly EmitterId[]
  readonly energyClaims: readonly CellEnergyClaim[]
}

export interface DraftTowerOffer {
  readonly emitterId: EmitterId
  readonly role: DraftRole
}

export interface DraftState {
  readonly step: DraftStep
  readonly rerollsRemaining: number
  readonly towerOffers: readonly DraftTowerOffer[]
  readonly upgradeOffers: readonly UpgradeId[]
}

export interface UpgradeStackState {
  readonly upgradeId: UpgradeId
  readonly stacks: number
}

export interface BossState {
  readonly bossId: string
  readonly lap: number
  readonly hp: number
  readonly maxHp: number
  readonly pathProgress: number
  readonly currentCellIndex: number
  readonly vulnerableMs: number
  readonly reactionBreakIds: readonly ReactionId[]
  readonly triggeredAbilityIds: readonly BossAbilityId[]
  readonly activeAbility: BossActiveAbilityState | null
  readonly suppressionRemainingMs: number
  readonly summonRuntime: WaveRuntimeState | null
}

export interface BossActiveAbilityState {
  readonly id: BossAbilityId
  readonly elapsedMs: number
  readonly impactApplied: boolean
}

export interface WaveSpawnGroup {
  readonly enemyId: EnemyId
  readonly count: number
  readonly spawnIntervalMs: number
  readonly startDelayMs?: number
}

export interface WaveGroupRuntimeState {
  readonly groupIndex: number
  readonly spawnedCount: number
  readonly nextSpawnMs: number
}

export interface WaveRuntimeState {
  readonly waveId: string
  readonly groups: readonly WaveGroupRuntimeState[]
  readonly elapsedMs: number
}

export interface DebugReactionOverrideState {
  readonly id: string
  readonly cellIndex: number
  readonly layer: "ground" | "air"
  readonly reactionId: ReactionId
  readonly ttlMs: number
}

export interface WaveStats {
  readonly waveId: string
  readonly damage: number
  readonly leaks: number
  readonly kills: number
  readonly damageBySource: Partial<Record<DamageSourceId, number>>
  readonly damageByReaction: Partial<Record<ReactionId, number>>
}

export interface RunStats {
  readonly leaks: number
  readonly kills: number
  readonly bossBreaks: number
  readonly totalDamage: number
  readonly damageBySource: Partial<Record<DamageSourceId, number>>
  readonly damageByReaction: Partial<Record<ReactionId, number>>
  readonly waveStats: readonly WaveStats[]
}

export interface RunState {
  readonly schemaVersion: number
  readonly phase: RunPhase
  readonly seed: number
  readonly rng: RngState
  readonly tick: number
  readonly elapsedMs: number
  readonly waveIndex: number
  readonly countdownMs: number
  readonly paused: boolean
  readonly speed: 1 | 2 | 4 | 8
  readonly coreHp: number
  readonly waveRuntime: WaveRuntimeState | null
  readonly board: BoardState
  readonly bench: readonly TowerState[]
  readonly placedTowers: readonly TowerState[]
  readonly selectedTowerId: string | null
  readonly enemies: readonly EnemyState[]
  readonly reactions: readonly CellReactionState[]
  readonly draft: DraftState | null
  readonly upgrades: readonly UpgradeStackState[]
  readonly boss: BossState | null
  readonly stats: RunStats
  readonly debugVisible: boolean
  readonly debugCoreHpLocked: boolean
  readonly debugReactionOverrides: readonly DebugReactionOverrideState[]
  readonly lastTap: StagePoint | null
}

export interface GameSnapshot extends RunState {
  readonly livingEnemies: readonly EnemyState[]
  readonly activeReactions: readonly CellReactionState[]
}

export interface RuntimeSnapshot extends GameSnapshot {
  readonly fps: number
  readonly viewport: ViewportSize
}

export type GameAction
  = | { readonly type: "pause" }
    | { readonly type: "resume" }
    | { readonly type: "startWave" }
    | { readonly type: "rerollDraft" }
    | { readonly type: "chooseDraftTower", readonly emitterId: EmitterId }
    | { readonly type: "chooseDraftUpgrade", readonly upgradeId: UpgradeId }
    | { readonly type: "setSpeed", readonly speed: 1 | 2 | 4 | 8 }
    | { readonly type: "selectTower", readonly towerId: string | null }
    | { readonly type: "placeSelectedTower", readonly slotId: string }
    | { readonly type: "tapSlot", readonly slotId: string }
    | { readonly type: "toggleDebug" }
    | { readonly type: "debugJumpToWave", readonly waveIndex: number }
    | { readonly type: "debugJumpToBoss" }
    | { readonly type: "debugSetCoreHpLocked", readonly locked: boolean }
    | { readonly type: "debugForceSpawnEnemy", readonly enemyId: EnemyId, readonly count?: number }
    | { readonly type: "debugForceAddTower", readonly emitterId: EmitterId }
    | { readonly type: "debugForceApplyUpgrade", readonly upgradeId: UpgradeId }
    | { readonly type: "debugUnlockSlot", readonly slotId: string }
    | { readonly type: "debugAddReactionOverride", readonly cellIndex: number, readonly layer: "ground" | "air", readonly reactionId: ReactionId, readonly ttlMs?: number }
    | { readonly type: "debugClearReactionOverrides" }
    | { readonly type: "tap", readonly point: StagePoint }
    | { readonly type: "restart", readonly seed?: number };

export interface BalanceConfig {
  readonly schemaVersion: number
  readonly pathCellCount: number
  readonly coreHp: number
  readonly leakDamage: number
  readonly tickRate: number
  readonly rerollsPerDraft: number
  readonly postDraftCountdownMs: number
  readonly minSpeedMultiplier: number
  readonly upgradeDraftMilestoneWaves: readonly number[]
}

export interface EmitterDefinition {
  readonly id: EmitterId
  readonly displayName: string
  readonly towerDisplayName: string
  readonly family: "substance" | "energy"
  readonly energyCapacity?: number
  readonly speedMultiplier?: number
  readonly rawDps?: number
  readonly rawDamageFamily?: DamageFamily
}

export interface ReactionDefinition {
  readonly id: ReactionId
  readonly displayName: string
  readonly tier: 1 | 2 | 3
  readonly layer: "ground" | "air"
  readonly damageFamily: DamageFamily
  readonly dps: number
  readonly inputs: readonly ReactionInputId[]
}

export interface EnemyDefinition {
  readonly id: EnemyId
  readonly displayName: string
  readonly hp: number
  readonly speedCellsPerSecond: number
  readonly leakDamage: number
  readonly traits?: readonly EnemyTrait[]
  readonly resistances?: Partial<Record<DamageFamily, number>>
}

export interface WaveDefinition {
  readonly id: string
  readonly spawnGroups: readonly WaveSpawnGroup[]
  readonly telegraphEnemyIds?: readonly EnemyId[]
}

export interface BossDefinition {
  readonly id: string
  readonly displayName: string
  readonly hp: number
  readonly laps: number
  readonly lapCoreDamage: number
  readonly speedCellsPerSecond: number
  readonly speedIncreasePerLap: number
  readonly reactionBreakThreshold: number
  readonly vulnerableDurationMs: number
  readonly vulnerableDamageMultiplier: number
  readonly abilities: {
    readonly exitSmash: BossExitSmashAbilityDefinition
    readonly rightSideSuppression: BossSuppressionAbilityDefinition
    readonly summonWave: BossSummonAbilityDefinition
  }
}

export interface BossExitSmashAbilityDefinition {
  readonly id: "exitSmash"
  readonly triggerLap: number
  readonly triggerPathProgress: number
  readonly prepareMs: number
  readonly leapMs: number
  readonly smashMs: number
  readonly coreDamage: number
}

export interface BossSuppressionAbilityDefinition {
  readonly id: "rightSideSuppression"
  readonly triggerLap: number
  readonly triggerPathProgress: number
  readonly castMs: number
  readonly durationMs: number
  readonly cellIndexes: readonly number[]
}

export interface BossSummonAbilityDefinition {
  readonly id: "summonWave"
  readonly triggerLap: number
  readonly holdMs: number
  readonly postSummonHoldMs: number
  readonly spawnGroups: readonly WaveSpawnGroup[]
}

export interface UpgradeDefinition {
  readonly id: UpgradeId
  readonly displayName: string
  readonly maxStacks: number
  readonly emitterId?: EmitterId
  readonly effect:
    | { readonly type: "energyCapacity", readonly amount: number }
    | { readonly type: "substanceCoverage", readonly amount: number }
    | { readonly type: "reactionDps", readonly reactionId: ReactionId, readonly amount: number }
    | { readonly type: "unlockSlot", readonly slotId: string, readonly amount: number }
}

export interface GameConfig {
  readonly balance: BalanceConfig
  readonly board: BoardState
  readonly emitters: readonly EmitterDefinition[]
  readonly reactions: readonly ReactionDefinition[]
  readonly enemies: readonly EnemyDefinition[]
  readonly waves: readonly WaveDefinition[]
  readonly boss: BossDefinition
  readonly upgrades: readonly UpgradeDefinition[]
}
