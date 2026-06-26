import type { GuideStepId, HintId, HintProgress, OnboardingProgress } from "./types";
import { createInitialGuideProgress, createInitialOnboardingProgress } from "./progress";
import { FIRST_GUIDE_STEP_ID, ONBOARDING_GUIDE_STEP_IDS } from "./script";
import { ONBOARDING_GUIDE_VERSION, ONBOARDING_SCHEMA_VERSION } from "./types";

export const ONBOARDING_STORAGE_KEY = "jam-td.onboarding.v1";

export interface OnboardingStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

const hintIds = new Set<HintId>([
  "noTowersBeforeFirstStart",
  "noAirAnswerBeforeFlyers",
  "lockedCornerOffer",
  "repeatedLeaks",
  "singleDamageFamilyBeforeResists",
  "bossReactionBreakReminder",
]);

export function saveOnboardingProgress(progress: OnboardingProgress, storage = getBrowserStorage()): void {
  storage?.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(progress));
}

export function loadOnboardingProgress(storage = getBrowserStorage(), now = Date.now()): OnboardingProgress {
  const payload = storage?.getItem(ONBOARDING_STORAGE_KEY);

  if (!payload) {
    return createInitialOnboardingProgress(now);
  }

  try {
    return normalizeOnboardingProgress(JSON.parse(payload), now);
  } catch {
    return createInitialOnboardingProgress(now);
  }
}

export function clearOnboardingProgress(storage = getBrowserStorage()): void {
  storage?.removeItem(ONBOARDING_STORAGE_KEY);
}

export function resetOnboardingProgressForDebug(debugEnabled: boolean, storage = getBrowserStorage()): boolean {
  if (!debugEnabled) {
    return false;
  }

  clearOnboardingProgress(storage);
  return true;
}

function normalizeOnboardingProgress(value: unknown, now: number): OnboardingProgress {
  if (!isRecord(value) || value.schemaVersion !== ONBOARDING_SCHEMA_VERSION) {
    return createInitialOnboardingProgress(now);
  }

  return {
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    guide: normalizeGuide(value.guide, now),
    hints: normalizeHints(value.hints),
  };
}

function normalizeGuide(value: unknown, now: number): OnboardingProgress["guide"] {
  if (!isRecord(value)) {
    return createInitialGuideProgress(now);
  }

  const version = typeof value.version === "string" ? value.version : ONBOARDING_GUIDE_VERSION;

  if (version !== ONBOARDING_GUIDE_VERSION) {
    return createInitialGuideProgress(now);
  }

  const status = value.status === "notStarted" || value.status === "inProgress" || value.status === "completed" || value.status === "skipped"
    ? value.status
    : "notStarted";
  const stepId = isGuideStepId(value.stepId)
    ? value.stepId
    : FIRST_GUIDE_STEP_ID;
  const completedStepIds = Array.isArray(value.completedStepIds)
    ? value.completedStepIds.filter((step): step is OnboardingProgress["guide"]["stepId"] =>
        isGuideStepId(step))
    : [];
  const updatedAt = typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
    ? value.updatedAt
    : now;

  return {
    version,
    status,
    stepId,
    completedStepIds: [...new Set(completedStepIds)],
    updatedAt,
  };
}

function normalizeHints(value: unknown): HintProgress {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(Object.entries(value).flatMap(([hintId, seenState]) => {
    if (!hintIds.has(hintId as HintId) || !isRecord(seenState)) {
      return [];
    }

    const shownCount = typeof seenState.shownCount === "number" && Number.isFinite(seenState.shownCount)
      ? Math.max(0, Math.floor(seenState.shownCount))
      : 0;
    const lastShownAt = typeof seenState.lastShownAt === "number" && Number.isFinite(seenState.lastShownAt)
      ? seenState.lastShownAt
      : 0;

    return [[hintId, { shownCount, lastShownAt }]];
  }));
}

function getBrowserStorage(): OnboardingStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGuideStepId(value: unknown): value is GuideStepId {
  return typeof value === "string" && (ONBOARDING_GUIDE_STEP_IDS as readonly string[]).includes(value);
}
