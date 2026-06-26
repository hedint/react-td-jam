<template>
  <main class="game-page">
    <div class="stage-shell">
      <div class="stage">
        <template v-if="runStarted">
          <PhaserCanvas class="stage__canvas" />
          <RunHud class="stage__hud" />
          <OnboardingGuide class="stage__guide" />
        </template>
        <section
          v-else
          class="title-overlay"
        >
          <div class="title-overlay__panel">
            <p class="title-overlay__kicker">
              {{ locale.title.subtitle }}
            </p>
            <h1>{{ locale.title.name }}</h1>
            <div class="title-overlay__actions">
              <button
                v-if="savedRunAvailable"
                class="title-overlay__button title-overlay__button--primary"
                type="button"
                @click="continueRun"
              >
                {{ locale.hud.continueRun }}
              </button>
              <button
                class="title-overlay__button"
                :class="{ 'title-overlay__button--primary': !savedRunAvailable }"
                type="button"
                @click="startNewRun"
              >
                {{ locale.hud.newRun }}
              </button>
            </div>
          </div>
        </section>
        <DebugHud
          v-if="debugEnabled && runStarted"
        />
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import type { RunState, RuntimeSnapshot } from "@entities/game-session/model/types";
import type { Unsubscribe } from "@shared/lib/event-bus/createTypedEventBus";
import PhaserCanvas from "@app/phaser/ui/PhaserCanvas.vue";
import { clearSavedRun, loadSavedRun } from "@entities/game-session/model/persistence";
import { ru } from "@shared/i18n/ru";
import { gameEvents } from "@shared/lib/event-bus/gameEvents";
import DebugHud from "@widgets/debug-hud/ui/DebugHud.vue";
import OnboardingGuide from "@widgets/onboarding-guide/ui/OnboardingGuide.vue";
import RunHud from "@widgets/run-hud/ui/RunHud.vue";
import { onBeforeUnmount, onMounted, ref } from "vue";

const debugEnabled = new URLSearchParams(window.location.search).get("debug") === "1";
const locale = ru;
const runStarted = ref(false);
const savedRunAvailable = ref(false);
let pendingLoad: RunState | null = null;
let pendingRestartSeed: number | null = null;
let unsubscribeInitialSnapshot: Unsubscribe | null = null;

function syncVisualViewportSize(): void {
  const visualViewport = window.visualViewport;
  const height = visualViewport?.height ?? window.innerHeight;

  document.documentElement.style.setProperty("--app-visual-height", `${height}px`);
}

onMounted(() => {
  savedRunAvailable.value = loadSavedRun() !== null;
  syncVisualViewportSize();
  window.addEventListener("resize", syncVisualViewportSize);
  window.visualViewport?.addEventListener("resize", syncVisualViewportSize);
  window.visualViewport?.addEventListener("scroll", syncVisualViewportSize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", syncVisualViewportSize);
  window.visualViewport?.removeEventListener("resize", syncVisualViewportSize);
  window.visualViewport?.removeEventListener("scroll", syncVisualViewportSize);
  document.documentElement.style.removeProperty("--app-visual-height");
  unsubscribeInitialSnapshot?.();
});

function startNewRun(): void {
  clearSavedRun();
  pendingLoad = null;
  pendingRestartSeed = createRunSeed();
  startRunAndFlushPendingAction();
}

function continueRun(): void {
  const savedRun = loadSavedRun();

  if (!savedRun) {
    savedRunAvailable.value = false;
    return;
  }

  pendingLoad = savedRun;
  pendingRestartSeed = null;
  startRunAndFlushPendingAction();
}

function startRunAndFlushPendingAction(): void {
  unsubscribeInitialSnapshot?.();
  unsubscribeInitialSnapshot = gameEvents.on("session:snapshot", flushPendingInitialAction);
  runStarted.value = true;
}

function flushPendingInitialAction(_snapshot: RuntimeSnapshot): void {
  unsubscribeInitialSnapshot?.();
  unsubscribeInitialSnapshot = null;

  if (pendingLoad) {
    gameEvents.emit("run:load", pendingLoad);
    pendingLoad = null;
    return;
  }

  if (pendingRestartSeed !== null) {
    gameEvents.emit("run:action", { type: "restart", seed: pendingRestartSeed });
    pendingRestartSeed = null;
  }
}

function createRunSeed(): number {
  return Date.now() % 100000;
}
</script>

<style scoped>
.game-page {
  display: grid;
  width: 100vw;
  height: var(--app-visual-height, 100dvh);
  min-height: var(--app-visual-height, 100vh);
  place-items: center;
  padding:
    max(env(safe-area-inset-top), 14px)
    max(env(safe-area-inset-right), 14px)
    max(env(safe-area-inset-bottom), 14px)
    max(env(safe-area-inset-left), 14px);
  background:
    linear-gradient(rgb(255 255 255 / 3%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(255 255 255 / 3%) 1px, transparent 1px),
    radial-gradient(circle at 50% 48%, #25221d 0, var(--color-page) 70%);
  background-size: 32px 32px, 32px 32px, cover;
}

.stage-shell {
  display: grid;
  width: min(100%, 540px, calc((var(--app-visual-height, 100dvh) - 28px) * 9 / 16));
  max-width: 100vw;
  aspect-ratio: 9 / 16;
  place-items: stretch;
}

.stage {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
  border: 1px solid rgb(255 255 255 / 12%);
  background: var(--color-stage-bg);
  border-radius: 28px;
  box-shadow:
    0 18px 64px rgb(0 0 0 / 42%),
    inset 0 0 0 10px rgb(0 0 0 / 22%);
  touch-action: manipulation;
}

.stage__canvas {
  position: absolute;
  inset: 0;
}

.stage__hud {
  position: absolute;
  inset: 0;
}

.stage__guide {
  position: absolute;
  inset: 0;
}

.title-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 22px;
  color: var(--skin-text);
  background:
    radial-gradient(circle at 50% 36%, rgb(240 138 40 / 15%), transparent 38%),
    radial-gradient(circle at 50% 62%, rgb(91 216 232 / 11%), transparent 42%),
    linear-gradient(180deg, rgb(16 18 18 / 88%), rgb(6 7 8 / 94%));
}

.title-overlay__panel {
  position: relative;
  display: grid;
  width: min(360px, 100%);
  gap: 18px;
  padding: 24px 18px 18px;
  text-align: center;
}

.title-overlay__panel::before {
  position: absolute;
  inset: 0;
  z-index: -1;
  content: "";
  background:
    linear-gradient(180deg, rgb(255 255 255 / 9%), transparent 34%),
    repeating-linear-gradient(180deg, rgb(200 167 106 / 8%) 0 2px, transparent 2px 32px),
    linear-gradient(180deg, rgb(43 40 34 / 96%), rgb(13 13 12 / 97%));
  border-style: solid;
  border-color: transparent;
  border-radius: var(--skin-panel-radius);
  border-image: url("/assets/ui/hud-panel-border.png") 24 fill / 18px / 0 round;
  box-shadow:
    inset 0 -16px 28px rgb(0 0 0 / 34%),
    0 24px 70px rgb(0 0 0 / 46%);
}

.title-overlay__kicker {
  margin: 0;
  color: var(--skin-brass);
  font-size: 14px;
  font-weight: 900;
  line-height: 1.1;
  text-transform: uppercase;
  text-shadow: 0 2px 0 rgb(0 0 0 / 58%);
}

.title-overlay h1 {
  margin: -7px 0 2px;
  color: #ffe5ad;
  font-size: 46px;
  font-weight: 950;
  line-height: 0.98;
  text-shadow:
    0 3px 0 rgb(0 0 0 / 62%),
    0 0 18px rgb(240 138 40 / 32%);
}

.title-overlay__actions {
  display: grid;
  gap: 10px;
}

.title-overlay__button {
  min-height: 48px;
  color: var(--skin-text);
  font-size: 14px;
  font-weight: 900;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 10%), transparent 46%),
    linear-gradient(180deg, #46382b, #181716);
  border: 1px solid rgb(200 167 106 / 48%);
  border-radius: var(--skin-chip-radius);
  box-shadow:
    inset 0 0 0 1px rgb(0 0 0 / 58%),
    0 10px 22px rgb(0 0 0 / 32%);
  cursor: pointer;
}

.title-overlay__button--primary {
  color: #1a120d;
  background:
    linear-gradient(180deg, #ffe0a1, var(--skin-brass) 54%, #8a6032);
  border-color: rgb(255 228 159 / 74%);
}

@media (orientation: portrait), (max-width: 720px) {
  .game-page {
    padding-block: 0;
    padding-inline: 0;
  }

  .stage-shell {
    width: min(100vw, 540px);
    height: var(--app-visual-height, 100dvh);
    aspect-ratio: auto;
  }

  .stage {
    border-radius: 0;
    border-inline: 0;
  }
}
</style>
