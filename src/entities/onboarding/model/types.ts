import type { EmitterId, GameAction, RuntimeSnapshot, UpgradeId } from "@entities/game-session/model/types";

export const ONBOARDING_SCHEMA_VERSION = 1;
export const ONBOARDING_GUIDE_VERSION = "guide-v1";

export type GuideStatus = "notStarted" | "inProgress" | "completed" | "skipped";

export type GuideStepId
  = | "intro"
    | "selectFirstWater"
    | "placeFirstWater"
    | "selectFirstSpark"
    | "placeFirstSpark"
    | "startFirstWave"
    | "observeElectroPuddle"
    | "draftTowerPick"
    | "draftUpgradePick"
    | "mixedThreatPreview"
    | "complete";

export type HintId
  = | "noTowersBeforeFirstStart"
    | "noAirAnswerBeforeFlyers"
    | "lockedCornerOffer"
    | "repeatedLeaks"
    | "singleDamageFamilyBeforeResists"
    | "bossReactionBreakReminder";

export type ShmygGuidePose = "idle" | "talk" | "excited" | "angry";

export type GuideTarget
  = | { readonly type: "continue" }
    | { readonly type: "selectTower", readonly emitterId: EmitterId }
    | { readonly type: "placeSelectedTower", readonly selectedEmitterId: EmitterId, readonly slotId?: string }
    | { readonly type: "startWave" }
    | { readonly type: "chooseDraftTower", readonly emitterId?: EmitterId }
    | { readonly type: "chooseDraftUpgrade", readonly upgradeId?: UpgradeId };

export type GuideCompletionPredicateId
  = | "manualContinue"
    | "selectedWaterTower"
    | "placedWaterTower"
    | "selectedSparkTower"
    | "placedSparkTower"
    | "firstWaveStarted"
    | "electroPuddleObserved"
    | "draftTowerChosen"
    | "draftUpgradeChosen"
    | "mixedThreatAcknowledged"
    | "always";

export interface GuideStep {
  readonly id: GuideStepId
  readonly pose: ShmygGuidePose
  readonly textKey: GuideStepId
  readonly target: GuideTarget | null
  readonly completion: GuideCompletionPredicateId
  readonly blocksGameplay: boolean
}

export interface GuideProgress {
  readonly version: string
  readonly status: GuideStatus
  readonly stepId: GuideStepId
  readonly completedStepIds: readonly GuideStepId[]
  readonly updatedAt: number
}

export interface HintSeenState {
  readonly shownCount: number
  readonly lastShownAt: number
}

export type HintProgress = Partial<Record<HintId, HintSeenState>>;

export interface OnboardingProgress {
  readonly schemaVersion: typeof ONBOARDING_SCHEMA_VERSION
  readonly guide: GuideProgress
  readonly hints: HintProgress
}

export type GuideCompletionPredicate = (snapshot: RuntimeSnapshot) => boolean;
export type GuideTargetActionPredicate = (snapshot: RuntimeSnapshot, action: GameAction) => boolean;
