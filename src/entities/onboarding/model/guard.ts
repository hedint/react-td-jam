import type { GameAction, RuntimeSnapshot } from "@entities/game-session/model/types";
import type { GuideStepId, OnboardingProgress } from "./types";
import { isGuideStepComplete, isGuideTargetAction, isGuideTargetAvailable } from "./predicates";
import { getGuideStep } from "./script";

export type GuidedActionBlockReason = "nonTargetAction" | "debugAction";

export type GuidedActionDecision
  = | { readonly type: "allow" }
    | { readonly type: "block", readonly stepId: GuideStepId, readonly reason: GuidedActionBlockReason }
    | { readonly type: "completeStepThenAllow", readonly stepId: GuideStepId };

export interface GuidedActionOptions {
  readonly debugBypass?: boolean
}

export function evaluateGuidedAction(
  progress: OnboardingProgress,
  snapshot: RuntimeSnapshot,
  action: GameAction,
  options: GuidedActionOptions = {},
): GuidedActionDecision {
  if (progress.guide.status !== "inProgress") {
    return { type: "allow" };
  }

  const step = getGuideStep(progress.guide.stepId);

  if (isGuideStepComplete(step, snapshot)) {
    return { type: "completeStepThenAllow", stepId: step.id };
  }

  if (!step.blocksGameplay) {
    return { type: "allow" };
  }

  if (!isGuideTargetAvailable(step, snapshot)) {
    return { type: "allow" };
  }

  if (isGuideSafeAction(action, snapshot)) {
    return { type: "allow" };
  }

  if (isDebugAction(action)) {
    return options.debugBypass
      ? { type: "allow" }
      : { type: "block", stepId: step.id, reason: "debugAction" };
  }

  if (isGuideTargetAction(step, snapshot, action)) {
    return { type: "completeStepThenAllow", stepId: step.id };
  }

  return { type: "block", stepId: step.id, reason: "nonTargetAction" };
}

function isGuideSafeAction(action: GameAction, snapshot: RuntimeSnapshot): boolean {
  if (action.type === "restart") {
    return true;
  }

  if (action.type === "resume") {
    return true;
  }

  if (action.type === "pause") {
    return snapshot.phase === "wave" || snapshot.phase === "boss";
  }

  return false;
}

function isDebugAction(action: GameAction): boolean {
  return action.type === "toggleDebug" || action.type.startsWith("debug");
}
