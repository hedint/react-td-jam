<template>
  <div class="run-hud">
    <header class="run-hud__top">
      <div class="run-hud__stat">
        <span>Куб</span>
        <strong>{{ session.coreHp }}</strong>
      </div>
      <div class="run-hud__stat">
        <span>{{ session.phaseLabel }}</span>
        <strong>{{ session.waveLabel }}</strong>
      </div>
      <div class="run-hud__stat run-hud__stat--threat">
        <span>Враг</span>
        <strong>{{ session.waveThreatLabel }}</strong>
      </div>
      <div class="run-hud__stat">
        <span>Т</span>
        <strong>x{{ session.speed }}</strong>
      </div>
      <button
        v-if="session.canStartWave"
        class="run-hud__button"
        type="button"
        @click="startWave"
      >
        Старт
      </button>
      <button
        v-else-if="session.canCompleteDraft"
        class="run-hud__button"
        type="button"
        @click="completeDraft"
      >
        Готово
      </button>
      <button
        v-else
        class="run-hud__button"
        type="button"
        @click="togglePause"
      >
        {{ session.paused ? "Пуск" : "Пауза" }}
      </button>
    </header>

    <section class="run-hud__bottom">
      <div class="run-hud__bench">
        <button
          v-for="tower in session.towerItems"
          :key="tower.id"
          class="run-hud__tower"
          :class="{ 'run-hud__tower--selected': tower.id === session.selectedTowerId }"
          type="button"
          @click="selectTower(tower.id)"
        >
          <span>{{ tower.label }}</span>
          <strong>{{ tower.placed ? "на поле" : "резерв" }}</strong>
        </button>
      </div>
    </section>

    <div
      v-if="resumePromptVisible"
      class="run-hud__scrim run-hud__scrim--blocking"
    >
      <section class="run-hud__modal">
        <h2>Сохранённый ран</h2>
        <dl>
          <div>
            <dt>Seed</dt>
            <dd>{{ savedSeed }}</dd>
          </div>
        </dl>
        <div class="run-hud__modal-actions">
          <button
            class="run-hud__button run-hud__button--primary"
            type="button"
            @click="resumeSavedRun"
          >
            Продолжить
          </button>
          <button
            class="run-hud__button"
            type="button"
            @click="startNewRun"
          >
            Новый ран
          </button>
        </div>
      </section>
    </div>

    <div
      v-else-if="session.paused"
      class="run-hud__scrim"
    >
      <section class="run-hud__modal">
        <h2>Пауза</h2>
        <dl>
          <div>
            <dt>Seed</dt>
            <dd>{{ session.seed }}</dd>
          </div>
          <div>
            <dt>Урон</dt>
            <dd>{{ session.damageLabel }}</dd>
          </div>
        </dl>
        <div class="run-hud__modal-actions">
          <button
            class="run-hud__button run-hud__button--primary"
            type="button"
            @click="resumeRun"
          >
            Продолжить
          </button>
          <button
            class="run-hud__button"
            type="button"
            @click="toggleSpeed"
          >
            x{{ nextSpeed }}
          </button>
          <button
            class="run-hud__button"
            type="button"
            @click="restartRun"
          >
            Рестарт
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { clearSavedRun, hasSavedRun, loadSavedRun } from "@entities/game-session/model/persistence";
import { useGameSessionStore } from "@entities/game-session/model/store";
import { useGameSessionBridge } from "@entities/game-session/model/useGameSessionBridge";
import { gameEvents } from "@shared/lib/event-bus/gameEvents";
import { computed, onMounted, ref } from "vue";

useGameSessionBridge();

const session = useGameSessionStore();
const resumePromptVisible = ref(false);
const savedSeed = ref<number | null>(null);
const nextSpeed = computed(() => session.speed === 1 ? 2 : 1);

onMounted(() => {
  const savedRun = loadSavedRun();

  resumePromptVisible.value = hasSavedRun();
  savedSeed.value = savedRun?.seed ?? null;
});

function togglePause(): void {
  gameEvents.emit("run:action", { type: session.paused ? "resume" : "pause" });
}

function startWave(): void {
  gameEvents.emit("run:action", { type: "startWave" });
}

function completeDraft(): void {
  gameEvents.emit("run:action", { type: "completeDraft" });
}

function selectTower(towerId: string): void {
  gameEvents.emit("run:action", { type: "selectTower", towerId: session.selectedTowerId === towerId ? null : towerId });
}

function resumeRun(): void {
  gameEvents.emit("run:action", { type: "resume" });
}

function toggleSpeed(): void {
  gameEvents.emit("run:action", { type: "setSpeed", speed: nextSpeed.value });
}

function restartRun(): void {
  clearSavedRun();
  gameEvents.emit("run:action", { type: "restart", seed: session.seed });
}

function resumeSavedRun(): void {
  const savedRun = loadSavedRun();

  if (savedRun) {
    gameEvents.emit("run:load", savedRun);
  }

  resumePromptVisible.value = false;
}

function startNewRun(): void {
  clearSavedRun();
  resumePromptVisible.value = false;
  gameEvents.emit("run:action", { type: "restart", seed: Date.now() % 100000 });
}
</script>

<style scoped>
.run-hud {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.run-hud__top,
.run-hud__bottom {
  position: absolute;
  left: 14px;
  right: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.run-hud__top {
  top: 12px;
}

.run-hud__bottom {
  bottom: 12px;
}

.run-hud__stat,
.run-hud__bench {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  padding: 7px 9px;
  color: var(--color-text);
  background: rgb(14 15 18 / 72%);
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 8px;
  backdrop-filter: blur(8px);
}

.run-hud__stat {
  box-sizing: border-box;
  flex: 0 0 58px;
  justify-content: space-between;
}

.run-hud__top .run-hud__stat:nth-child(2) {
  flex-basis: 64px;
}

.run-hud__stat--threat {
  flex-basis: 92px;
}

.run-hud__top .run-hud__stat:nth-child(4) {
  flex-basis: 52px;
}

.run-hud__bench {
  width: 100%;
  overflow-x: auto;
  pointer-events: auto;
}

.run-hud__stat span,
.run-hud__tower span,
dt {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.run-hud__stat strong,
.run-hud__tower strong,
dd {
  min-width: 0;
  overflow: hidden;
  margin: 0;
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.run-hud__tower {
  display: grid;
  min-width: 96px;
  padding: 0;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.run-hud__tower--selected {
  outline: 2px solid var(--color-accent-strong);
  outline-offset: 4px;
}

.run-hud__button {
  min-height: 34px;
  padding: 0 11px;
  color: var(--color-text);
  pointer-events: auto;
  cursor: pointer;
  background: rgb(25 28 34 / 88%);
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 8px;
}

.run-hud__button--primary {
  color: #102022;
  background: var(--color-accent-strong);
  border-color: transparent;
}

.run-hud__scrim {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  pointer-events: auto;
  background: rgb(0 0 0 / 42%);
}

.run-hud__scrim:not(.run-hud__scrim--blocking) {
  pointer-events: none;
}

.run-hud__scrim--blocking {
  pointer-events: auto;
}

.run-hud__modal {
  width: min(310px, 100%);
  padding: 16px;
  color: var(--color-text);
  pointer-events: auto;
  background: rgb(18 20 24 / 94%);
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 8px;
  box-shadow: 0 18px 48px rgb(0 0 0 / 42%);
}

.run-hud__modal h2 {
  margin: 0 0 12px;
  font-size: 20px;
  line-height: 1.15;
}

.run-hud__modal dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 0 0 14px;
}

.run-hud__modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 420px) {
  .run-hud__top,
  .run-hud__bottom {
    left: 10px;
    right: 10px;
  }

  .run-hud__top {
    gap: 6px;
  }

  .run-hud__stat {
    flex-basis: 54px;
    padding-inline: 7px;
  }

  .run-hud__top .run-hud__stat:nth-child(2) {
    flex-basis: 58px;
  }

  .run-hud__stat--threat {
    flex-basis: 82px;
  }

  .run-hud__top .run-hud__stat:nth-child(4) {
    flex-basis: 46px;
  }

  .run-hud__stat span,
  .run-hud__tower span {
    font-size: 10px;
  }

  .run-hud__stat strong {
    font-size: 13px;
  }
}
</style>
