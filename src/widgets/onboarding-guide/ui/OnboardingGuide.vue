<template>
  <div
    v-if="visible && currentStep"
    ref="guideRoot"
    class="onboarding-guide"
    :class="guideClass"
    aria-live="polite"
  >
    <div
      v-if="targetIndicatorStyle"
      class="onboarding-guide__tap-target"
      :style="targetIndicatorStyle"
      aria-hidden="true"
    >
      <span class="onboarding-guide__tap-ring" />
      <span class="onboarding-guide__cursor" />
    </div>

    <section class="onboarding-guide__bubble">
      <div class="onboarding-guide__panel">
        <header class="onboarding-guide__header">
          <strong>{{ locale.speaker }}</strong>
        </header>
        <p>{{ stepText }}</p>
        <p
          v-if="nudgeVisible"
          class="onboarding-guide__nudge"
        >
          {{ locale.nudges.blocked }}
        </p>
        <button
          v-if="canContinue"
          ref="continueButton"
          class="onboarding-guide__continue"
          type="button"
          @click="continueGuide"
        >
          {{ locale.controls.continue }}
        </button>
      </div>
      <ShmygSprite
        class="onboarding-guide__shmyg"
        :state="currentStep.pose"
        :size="shmygSize"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import type { BoardSlot, RuntimeSnapshot } from "@entities/game-session/model/types";
import type { GuideStep, GuideTarget, OnboardingProgress } from "@entities/onboarding/model";
import type { Unsubscribe } from "@shared/lib/event-bus/createTypedEventBus";
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from "@app/phaser/scenes/runSceneLayout";
import {
  completeGuide,
  completeGuideStep,
  getGuidePlacementTargetSlot,
  getGuideStep,
  isGuidePlacementStepId,
  isGuideStepComplete,
  isGuideTargetAvailable,
  loadOnboardingProgress,
  saveOnboardingProgress,
  shouldAutoOpenGuide,
  startGuide,
} from "@entities/onboarding/model";
import { ru } from "@shared/i18n/ru";
import { gameEvents } from "@shared/lib/event-bus/gameEvents";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ShmygSprite from "./ShmygSprite.vue";

const locale = ru.onboarding.guide;
const guideRoot = ref<HTMLElement | null>(null);
const continueButton = ref<HTMLButtonElement | null>(null);
const progress = ref<OnboardingProgress>(loadOnboardingProgress());
const snapshot = ref<RuntimeSnapshot | null>(null);
const domTargetBox = ref<DOMRect | null>(null);
const nudgeUntil = ref(0);
let unsubscribeSnapshot: Unsubscribe | null = null;
let unsubscribeBlocked: Unsubscribe | null = null;
let nudgeTimer: number | null = null;

const activeStep = computed<GuideStep | null>(() => progress.value.guide.status === "inProgress" ? getGuideStep(progress.value.guide.stepId) : null);
const visible = computed(() => activeStep.value !== null && isCurrentStepAvailable(activeStep.value));
const currentStep = computed<GuideStep | null>(() => visible.value ? activeStep.value : null);
const currentTarget = computed<GuideTarget | null>(() => currentStep.value?.target ?? null);
const stepText = computed(() => {
  const step = currentStep.value;

  return step ? locale.steps[step.textKey] : "";
});
const canContinue = computed(() => currentTarget.value?.type === "continue");
const nudgeVisible = computed(() => nudgeUntil.value > Date.now());
const shmygSize = computed(() => snapshot.value && snapshot.value.viewport.width <= 380 ? 96 : 112);
const guideClass = computed(() => {
  const step = currentStep.value;
  const target = currentTarget.value;
  const stepClass = step ? `onboarding-guide--step-${step.id}` : "";

  if (!target) {
    return ["onboarding-guide--observe", stepClass];
  }

  return [`onboarding-guide--${target.type}`, stepClass];
});
const domTargetSelector = computed(() => getDomTargetSelector(currentTarget.value));
const fieldTargetSlot = computed(() => getFieldTargetSlot(snapshot.value, currentStep.value));
const fieldScale = computed(() => {
  const viewport = snapshot.value?.viewport;

  if (!viewport) {
    return { offsetX: 0, offsetY: 0, zoom: 1 };
  }

  const zoom = Math.min(viewport.width / LOGICAL_WIDTH, viewport.height / LOGICAL_HEIGHT);

  return {
    offsetX: (viewport.width - LOGICAL_WIDTH * zoom) / 2,
    offsetY: (viewport.height - LOGICAL_HEIGHT * zoom) / 2,
    zoom,
  };
});
const targetIndicatorStyle = computed<Record<string, string> | null>(() => {
  if (!visible.value) {
    return null;
  }

  if (currentStep.value?.id === "draftUpgradePick") {
    return null;
  }

  if (fieldTargetSlot.value) {
    return getFieldTargetStyle(fieldTargetSlot.value);
  }

  if (!domTargetBox.value) {
    return null;
  }

  return {
    "--onboarding-target-transform": `translate(${domTargetBox.value.left + domTargetBox.value.width * 0.58}px, ${domTargetBox.value.top + domTargetBox.value.height * 0.48}px)`,
    "transform": "var(--onboarding-target-transform)",
  };
});

onMounted(() => {
  syncStoredProgress();
  unsubscribeSnapshot = gameEvents.on("session:snapshot", (nextSnapshot) => {
    snapshot.value = nextSnapshot;
    syncStoredProgress(nextSnapshot);
    void nextTick(updateTargetIndicator);
  });
  unsubscribeBlocked = gameEvents.on("onboarding:action-blocked", () => {
    nudgeUntil.value = Date.now() + 1700;
    if (nudgeTimer !== null) {
      window.clearTimeout(nudgeTimer);
    }
    nudgeTimer = window.setTimeout(() => {
      nudgeUntil.value = 0;
      nudgeTimer = null;
    }, 1750);
  });
  window.addEventListener("resize", updateTargetIndicator);
});

onBeforeUnmount(() => {
  clearDomHighlights();
  window.removeEventListener("resize", updateTargetIndicator);
  unsubscribeSnapshot?.();
  unsubscribeBlocked?.();
  if (nudgeTimer !== null) {
    window.clearTimeout(nudgeTimer);
  }
});

watch([visible, domTargetSelector], () => {
  void nextTick(updateTargetIndicator);
}, { immediate: true });

function continueGuide(): void {
  const step = currentStep.value;

  if (!step) {
    return;
  }

  const nextProgress = step.id === "complete"
    ? completeGuide(progress.value)
    : completeGuideStep(progress.value, step.id);

  setProgress(nextProgress);
}

function syncStoredProgress(nextSnapshot = snapshot.value): void {
  const stored = loadOnboardingProgress();
  const started = shouldAutoOpenGuide(stored) ? startGuide(stored) : stored;
  let nextProgress = started;

  if (nextSnapshot && nextProgress.guide.status === "inProgress") {
    const step = getGuideStep(nextProgress.guide.stepId);

    if (isGuideStepComplete(step, nextSnapshot)) {
      nextProgress = completeGuideStep(nextProgress, step.id);
    }
  }

  setProgress(nextProgress);
}

function setProgress(nextProgress: OnboardingProgress): void {
  const previousStepId = progress.value.guide.stepId;
  const changed = JSON.stringify(nextProgress) !== JSON.stringify(progress.value);

  progress.value = nextProgress;
  if (nextProgress.guide.stepId !== previousStepId) {
    nudgeUntil.value = 0;
  }

  if (changed) {
    saveOnboardingProgress(nextProgress);
  }

  void nextTick(updateTargetIndicator);
}

function getDomTargetSelector(target: GuideTarget | null): string | null {
  if (!target) {
    return null;
  }

  switch (target.type) {
    case "continue":
    case "placeSelectedTower":
      return null;
    case "selectTower":
      return `[data-onboarding-emitter="${target.emitterId}"]`;
    case "startWave":
      return `[data-onboarding-target="startWave"]`;
    case "chooseDraftTower":
      return target.emitterId
        ? `[data-onboarding-draft-tower="${target.emitterId}"]`
        : "[data-onboarding-draft-tower]";
    case "chooseDraftUpgrade":
      return target.upgradeId
        ? `[data-onboarding-draft-upgrade="${target.upgradeId}"]`
        : "[data-onboarding-draft-upgrade]";
    default:
      return target satisfies never;
  }
}

function updateTargetIndicator(): void {
  clearDomHighlights();
  domTargetBox.value = null;

  if (!visible.value) {
    return;
  }

  const targetElement = getCurrentDomTargetElement();

  if (!targetElement || !guideRoot.value) {
    return;
  }

  targetElement.dataset.onboardingHighlight = "true";

  const targetRect = targetElement.getBoundingClientRect();
  const guideRect = guideRoot.value.getBoundingClientRect();

  domTargetBox.value = new DOMRect(
    targetRect.left - guideRect.left,
    targetRect.top - guideRect.top,
    targetRect.width,
    targetRect.height,
  );
}

function clearDomHighlights(): void {
  document.querySelectorAll<HTMLElement>("[data-onboarding-highlight=\"true\"]")
    .forEach((element) => {
      delete element.dataset.onboardingHighlight;
    });
}

function getCurrentDomTargetElement(): HTMLElement | null {
  if (currentStep.value?.id === "draftUpgradePick") {
    return null;
  }

  if (canContinue.value) {
    return continueButton.value;
  }

  if (!domTargetSelector.value) {
    return null;
  }

  return document.querySelector<HTMLElement>(domTargetSelector.value);
}

function getFieldTargetSlot(nextSnapshot: RuntimeSnapshot | null, step: GuideStep | null): BoardSlot | null {
  if (!nextSnapshot || !step || step.target?.type !== "placeSelectedTower") {
    return null;
  }

  if (isGuidePlacementStepId(step.id)) {
    return getGuidePlacementTargetSlot(nextSnapshot, step.id);
  }

  const { target } = step;

  return target.slotId
    ? nextSnapshot.board.slots.find(slot => slot.id === target.slotId) ?? null
    : null;
}

function getFieldTargetStyle(slot: BoardSlot): Record<string, string> {
  const { offsetX, offsetY, zoom } = fieldScale.value;

  return {
    "--onboarding-target-transform": `translate(${offsetX + slot.x * zoom}px, ${offsetY + slot.y * zoom}px)`,
    "transform": "var(--onboarding-target-transform)",
  };
}

function isCurrentStepAvailable(step: GuideStep): boolean {
  return snapshot.value ? isGuideTargetAvailable(step, snapshot.value) : true;
}
</script>

<style scoped src="./OnboardingGuide.css"></style>
