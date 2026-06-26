import type { GuideProgress, GuideStepId, OnboardingProgress } from "./types";
import { FIRST_GUIDE_STEP_ID, getNextGuideStepId } from "./script";
import { ONBOARDING_GUIDE_VERSION, ONBOARDING_SCHEMA_VERSION } from "./types";

export function createInitialGuideProgress(now = Date.now()): GuideProgress {
  return {
    version: ONBOARDING_GUIDE_VERSION,
    status: "notStarted",
    stepId: FIRST_GUIDE_STEP_ID,
    completedStepIds: [],
    updatedAt: now,
  };
}

export function createInitialOnboardingProgress(now = Date.now()): OnboardingProgress {
  return {
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    guide: createInitialGuideProgress(now),
    hints: {},
  };
}

export function shouldAutoOpenGuide(progress: OnboardingProgress): boolean {
  return progress.guide.version === ONBOARDING_GUIDE_VERSION
    && progress.guide.status !== "completed"
    && progress.guide.status !== "skipped";
}

export function startGuide(progress: OnboardingProgress, now = Date.now()): OnboardingProgress {
  if (!shouldAutoOpenGuide(progress)) {
    return progress;
  }

  if (progress.guide.status === "inProgress") {
    return progress;
  }

  return {
    ...progress,
    guide: {
      ...progress.guide,
      status: "inProgress",
      updatedAt: now,
    },
  };
}

export function completeGuideStep(progress: OnboardingProgress, stepId: GuideStepId, now = Date.now()): OnboardingProgress {
  if (progress.guide.status === "completed" || progress.guide.status === "skipped") {
    return progress;
  }

  const completedStepIds = progress.guide.completedStepIds.includes(stepId)
    ? progress.guide.completedStepIds
    : [...progress.guide.completedStepIds, stepId];
  const nextStepId = getNextGuideStepId(stepId);
  const status = nextStepId === "complete" ? "completed" : "inProgress";

  return {
    ...progress,
    guide: {
      ...progress.guide,
      status,
      stepId: nextStepId,
      completedStepIds,
      updatedAt: now,
    },
  };
}

export function completeGuide(progress: OnboardingProgress, now = Date.now()): OnboardingProgress {
  return {
    ...progress,
    guide: {
      ...progress.guide,
      status: "completed",
      stepId: "complete",
      completedStepIds: progress.guide.completedStepIds.includes("complete")
        ? progress.guide.completedStepIds
        : [...progress.guide.completedStepIds, "complete"],
      updatedAt: now,
    },
  };
}

export function skipGuide(progress: OnboardingProgress, now = Date.now()): OnboardingProgress {
  return {
    ...progress,
    guide: {
      ...progress.guide,
      status: "skipped",
      updatedAt: now,
    },
  };
}

export function resetGuideForVersion(progress: OnboardingProgress, now = Date.now()): OnboardingProgress {
  if (progress.guide.version === ONBOARDING_GUIDE_VERSION) {
    return progress;
  }

  return {
    ...progress,
    guide: createInitialGuideProgress(now),
  };
}
