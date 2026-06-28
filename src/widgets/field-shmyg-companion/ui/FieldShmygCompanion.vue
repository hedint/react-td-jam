<template>
  <div
    class="field-shmyg-companion-layer"
  >
    <div
      v-if="bubbleVisible"
      class="field-shmyg-companion"
      :style="bubbleStyle"
      aria-live="polite"
      aria-hidden="false"
    >
      <strong>{{ locale.speaker }}</strong>
      <p>{{ currentLine }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReactionId, RuntimeSnapshot, StagePoint } from "@entities/game-session/model/types";
import type {
  FieldShmygComboFillerId,
  FieldShmygImportantSpeechId,
  FieldShmygSpeechMemory,
  FieldShmygSpeechRequest,
  OnboardingProgress,
} from "@entities/onboarding/model";
import type { Unsubscribe } from "@shared/lib/event-bus/createTypedEventBus";
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from "@app/phaser/scenes/runSceneLayout";
import {
  canShowFieldShmygSpeech,
  createInitialFieldShmygSpeechMemory,
  FIELD_SHMYG_FALLBACK_TARGET,
  getFieldShmygComboFillerMinWaveIndex,
  getFieldShmygComboFillerReactionId,
  loadOnboardingProgress,
  recordFieldShmygSpeech,
  shouldOfferFieldShmygFlyerHint,
} from "@entities/onboarding/model";
import { ru } from "@shared/i18n/ru";
import { gameEvents } from "@shared/lib/event-bus/gameEvents";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const locale = ru.onboarding.fieldCompanion;
const snapshot = ref<RuntimeSnapshot | null>(null);
const shmygPoint = ref<StagePoint | null>(null);
const shmygTargetId = ref<string | null>(null);
const shmygAtTarget = ref(false);
const currentLine = ref("");
const currentLineUntil = ref(0);
const now = ref(Date.now());
let speechMemory: FieldShmygSpeechMemory = createInitialFieldShmygSpeechMemory();
let unsubscribeSnapshot: Unsubscribe | null = null;
let unsubscribePosition: Unsubscribe | null = null;
let tickTimer: number | null = null;
let guideWasActiveThisRun = false;
let previousCoreHp: number | null = null;
let previousPhase: RuntimeSnapshot["phase"] | null = null;
let previousBossAbilityId: string | null = null;
let previousSnapshot: RuntimeSnapshot | null = null;
let seenReactionIds = new Set<ReactionId>();
let pendingBossArrival = false;
let pendingBossAbility = false;

const comboFillerIds = [
  "stormCloudCombo",
  "fireVortexCombo",
  "fireStormCombo",
] as const satisfies readonly FieldShmygComboFillerId[];

const bubbleVisible = computed(() => {
  const nextSnapshot = snapshot.value;

  return currentLine.value.length > 0
    && currentLineUntil.value > now.value
    && shmygPoint.value !== null
    && nextSnapshot !== null
    && nextSnapshot.phase !== "draft"
    && nextSnapshot.phase !== "victory"
    && nextSnapshot.phase !== "defeat";
});

const bubbleStyle = computed<Record<string, string>>(() => {
  const nextSnapshot = snapshot.value;
  const point = shmygPoint.value;

  if (!nextSnapshot || !point) {
    return { transform: "translate(0, 0)" };
  }

  const zoom = Math.min(nextSnapshot.viewport.width / LOGICAL_WIDTH, nextSnapshot.viewport.height / LOGICAL_HEIGHT);
  const offsetX = (nextSnapshot.viewport.width - LOGICAL_WIDTH * zoom) / 2;
  const offsetY = (nextSnapshot.viewport.height - LOGICAL_HEIGHT * zoom) / 2;
  const x = clamp(offsetX + point.x * zoom + 14, 12, nextSnapshot.viewport.width - 164);
  const y = clamp(offsetY + point.y * zoom - 64, 82, nextSnapshot.viewport.height - 132);

  return {
    transform: `translate(${Math.round(x)}px, ${Math.round(y)}px)`,
  };
});

onMounted(() => {
  unsubscribeSnapshot = gameEvents.on("session:snapshot", (nextSnapshot) => {
    if (previousSnapshot && isNewRunSnapshot(previousSnapshot, nextSnapshot)) {
      resetRunLocalSpeechState();
    }

    snapshot.value = nextSnapshot;
    if (previousPhase !== "boss" && nextSnapshot.phase === "boss") {
      pendingBossArrival = true;
    }
    if (nextSnapshot.boss?.activeAbility?.id && nextSnapshot.boss.activeAbility.id !== previousBossAbilityId) {
      pendingBossAbility = true;
    }
    getActiveReactionIds(nextSnapshot).forEach(reactionId => seenReactionIds.add(reactionId));
    maybeSpeak(nextSnapshot, loadOnboardingProgress());
    previousCoreHp = nextSnapshot.coreHp;
    previousPhase = nextSnapshot.phase;
    previousBossAbilityId = nextSnapshot.boss?.activeAbility?.id ?? null;
    previousSnapshot = nextSnapshot;
  });
  unsubscribePosition = gameEvents.on("field-shmyg:position", (position) => {
    shmygPoint.value = position.visible ? position.point : null;
    shmygTargetId.value = position.visible ? position.targetId : null;
    shmygAtTarget.value = position.visible && position.atTarget;
  });
  tickTimer = window.setInterval(() => {
    now.value = Date.now();
  }, 250);
});

onBeforeUnmount(() => {
  unsubscribeSnapshot?.();
  unsubscribePosition?.();
  if (tickTimer !== null) {
    window.clearInterval(tickTimer);
  }
});

function maybeSpeak(nextSnapshot: RuntimeSnapshot, progress: OnboardingProgress): void {
  const point = shmygPoint.value;

  if (progress.guide.status === "inProgress") {
    guideWasActiveThisRun = true;
  }

  if (!point || !canSpeakOverSnapshot(nextSnapshot)) {
    return;
  }

  const request = getImportantRequest(nextSnapshot, progress)
    ?? getComboFillerRequest(nextSnapshot)
    ?? getFillerRequest(nextSnapshot);

  if (!request || !canShowFieldShmygSpeech(speechMemory, request)) {
    return;
  }

  speechMemory = recordFieldShmygSpeech(speechMemory, request);
  currentLine.value = getLine(request);
  currentLineUntil.value = request.nowMs + (request.kind === "important" ? 6500 : 4600);
  now.value = request.nowMs;
}

function getImportantRequest(snapshotForSpeech: RuntimeSnapshot, progress: OnboardingProgress): FieldShmygSpeechRequest | null {
  const nowMs = Date.now();
  const base = {
    kind: "important" as const,
    nowMs,
    waveIndex: snapshotForSpeech.waveIndex,
  };

  if (snapshotForSpeech.placedTowers.length === 0) {
    return {
      ...base,
      id: "noTowers",
    };
  }

  if (shouldOfferFieldShmygFlyerHint(snapshotForSpeech, progress, { guideWasActiveThisRun })) {
    return {
      ...base,
      id: "wave3Flyers",
    };
  }

  const activeReactionIds = getActiveReactionIds(snapshotForSpeech);
  if (pendingBossArrival) {
    return isShmygReadyForBossArrivalLine()
      ? {
          ...base,
          id: "bossArrival",
        }
      : null;
  }

  const bossAbilityId = snapshotForSpeech.boss?.activeAbility?.id ?? null;
  if (pendingBossAbility || (bossAbilityId && bossAbilityId !== previousBossAbilityId)) {
    return {
      ...base,
      id: "bossAbility",
    };
  }

  if (activeReactionIds.has("fireStorm")) {
    return {
      ...base,
      id: "firstTier3Reaction",
    };
  }
  if (activeReactionIds.has("stormCloud")) {
    return {
      ...base,
      id: "firstStormCloudReaction",
    };
  }
  if (activeReactionIds.has("fireVortex")) {
    return {
      ...base,
      id: "firstFireVortexReaction",
    };
  }

  if (previousCoreHp !== null && snapshotForSpeech.coreHp < previousCoreHp) {
    return {
      ...base,
      id: "coreDanger",
    };
  }

  return null;
}

function getFillerRequest(snapshotForSpeech: RuntimeSnapshot): FieldShmygSpeechRequest {
  return {
    kind: "filler",
    nowMs: Date.now(),
    waveIndex: snapshotForSpeech.waveIndex,
  };
}

function getComboFillerRequest(snapshotForSpeech: RuntimeSnapshot): FieldShmygSpeechRequest | null {
  const nowMs = Date.now();
  const eligibleIds = comboFillerIds.filter((comboId) => {
    const reactionId = getFieldShmygComboFillerReactionId(comboId);

    return snapshotForSpeech.waveIndex >= getFieldShmygComboFillerMinWaveIndex(comboId)
      && !seenReactionIds.has(reactionId);
  });

  if (eligibleIds.length === 0) {
    return null;
  }

  const comboId = eligibleIds[Math.abs(nowMs) % eligibleIds.length]!;

  return {
    kind: "comboFiller",
    comboId,
    nowMs,
    waveIndex: snapshotForSpeech.waveIndex,
  };
}

function getLine(request: FieldShmygSpeechRequest): string {
  if (request.kind === "filler") {
    return pickLine(locale.filler, request.nowMs);
  }

  if (request.kind === "comboFiller") {
    return request.comboId ? pickLine(locale.comboFiller[request.comboId], request.nowMs) : "";
  }

  const id = request.id satisfies FieldShmygImportantSpeechId | undefined;

  const line = id ? pickLine(locale.important[id], request.nowMs) : "";

  if (id === "bossArrival") {
    pendingBossArrival = false;
  }
  if (id === "bossAbility") {
    pendingBossAbility = false;
  }

  return line;
}

function isShmygReadyForBossArrivalLine(): boolean {
  return shmygAtTarget.value && shmygTargetId.value === FIELD_SHMYG_FALLBACK_TARGET.id;
}

function getActiveReactionIds(snapshotForSpeech: RuntimeSnapshot): Set<ReactionId> {
  return snapshotForSpeech.activeReactions.reduce((reactionIds, reaction) => {
    if (reaction.ground) {
      reactionIds.add(reaction.ground);
    }
    if (reaction.air) {
      reactionIds.add(reaction.air);
    }

    return reactionIds;
  }, new Set<ReactionId>());
}

function canSpeakOverSnapshot(snapshotForSpeech: RuntimeSnapshot): boolean {
  return snapshotForSpeech.phase !== "draft"
    && snapshotForSpeech.phase !== "victory"
    && snapshotForSpeech.phase !== "defeat";
}

function pickLine(lines: readonly string[], seed: number): string {
  return lines[Math.abs(seed) % lines.length] ?? "";
}

function isNewRunSnapshot(previous: RuntimeSnapshot, next: RuntimeSnapshot): boolean {
  return next.tick < previous.tick || next.elapsedMs < previous.elapsedMs || next.seed !== previous.seed;
}

function resetRunLocalSpeechState(): void {
  speechMemory = createInitialFieldShmygSpeechMemory();
  seenReactionIds = new Set<ReactionId>();
  currentLine.value = "";
  currentLineUntil.value = 0;
  guideWasActiveThisRun = false;
  previousCoreHp = null;
  previousPhase = null;
  previousBossAbilityId = null;
  pendingBossArrival = false;
  pendingBossAbility = false;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
</script>

<style scoped>
.field-shmyg-companion-layer {
  pointer-events: none;
}

.field-shmyg-companion {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  width: min(164px, calc(100% - 24px));
  padding: 6px 8px 7px;
  color: var(--skin-text);
  pointer-events: none;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 7%), transparent 46%),
    linear-gradient(180deg, rgb(32 28 23 / 76%), rgb(12 11 10 / 72%));
  border: 1px solid rgb(200 167 106 / 28%);
  border-radius: var(--skin-chip-radius);
  box-shadow:
    inset 0 0 0 1px rgb(0 0 0 / 32%),
    0 8px 18px rgb(0 0 0 / 22%);
  backdrop-filter: blur(1.5px);
}

.field-shmyg-companion strong {
  display: block;
  margin-bottom: 2px;
  color: var(--skin-brass);
  font-size: 9px;
  font-weight: 950;
  line-height: 1.1;
}

.field-shmyg-companion p {
  margin: 0;
  font-size: 10px;
  font-weight: 850;
  line-height: 1.14;
  text-shadow: 0 1px 0 rgb(0 0 0 / 36%);
}

@media (max-width: 380px) {
  .field-shmyg-companion {
    width: min(152px, calc(100% - 24px));
    padding: 6px 7px;
  }

  .field-shmyg-companion p {
    font-size: 9.5px;
  }
}
</style>
