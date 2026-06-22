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
        <span>{{ session.phase === "boss" ? "Босс" : "Враг" }}</span>
        <strong class="run-hud__threat-value">
          <span
            v-if="session.waveThreatEnemyId"
            class="run-hud__enemy-icon"
            :class="`run-hud__enemy-icon--${session.waveThreatEnemyId}`"
            aria-hidden="true"
          />
          <span>{{ session.phase === "boss" ? session.bossHpLabel : session.waveThreatLabel }}</span>
        </strong>
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
        v-else-if="!session.draftStep"
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
      v-else-if="session.draftStep"
      class="run-hud__scrim run-hud__scrim--blocking run-hud__scrim--draft"
    >
      <section class="run-hud__draft">
        <header class="run-hud__draft-header">
          <div>
            <span>{{ session.draftStep === "tower" ? "Башня" : "Усиление" }}</span>
            <h2>{{ session.draftStep === "tower" ? "Пополнение мастерской" : "Настройка контрапций" }}</h2>
          </div>
          <button
            class="run-hud__button"
            type="button"
            :disabled="!session.canRerollDraft"
            @click="rerollDraft"
          >
            Реролл {{ session.rerollsRemaining }}
          </button>
        </header>

        <div
          v-if="session.draftStep === 'tower'"
          class="run-hud__draft-grid"
        >
          <button
            v-for="offer in session.draftTowerOffers"
            :key="offer.emitterId"
            class="run-hud__draft-card"
            type="button"
            @click="chooseDraftTower(offer.emitterId)"
          >
            <span>{{ offer.roleLabel }}</span>
            <strong>{{ offer.label }}</strong>
          </button>
        </div>

        <div
          v-else
          class="run-hud__draft-grid"
        >
          <button
            v-for="offer in session.draftUpgradeOffers"
            :key="offer.upgradeId"
            class="run-hud__draft-card"
            type="button"
            @click="chooseDraftUpgrade(offer.upgradeId)"
          >
            <span>{{ offer.stacks }}/{{ offer.maxStacks }}</span>
            <strong>{{ offer.label }}</strong>
          </button>
        </div>
      </section>
    </div>

    <div
      v-else-if="session.phase === 'victory' || session.phase === 'defeat'"
      class="run-hud__scrim run-hud__scrim--blocking"
    >
      <section class="run-hud__modal run-hud__modal--result">
        <h2>{{ resultTitle }}</h2>
        <p class="run-hud__result-note">
          {{ resultSubtitle }}
        </p>
        <dl>
          <div>
            <dt>Seed</dt>
            <dd>{{ session.seed }}</dd>
          </div>
          <div>
            <dt>Волны</dt>
            <dd>{{ session.wavesCleared }}/10</dd>
          </div>
          <div>
            <dt>Утечки</dt>
            <dd>{{ session.leaks }}</dd>
          </div>
          <div>
            <dt>Урон</dt>
            <dd>{{ session.damageLabel }}</dd>
          </div>
          <div>
            <dt>Break</dt>
            <dd>{{ session.bossBreaks }}</dd>
          </div>
          <div>
            <dt>Время</dt>
            <dd>{{ session.runtimeLabel }}</dd>
          </div>
          <div>
            <dt>Топ реакция</dt>
            <dd>{{ session.topReactionLabel }}</dd>
          </div>
        </dl>
        <div class="run-hud__reaction-list">
          <div
            v-for="reaction in session.reactionStats"
            :key="reaction.sourceId"
          >
            <span>{{ reaction.label }}</span>
            <strong>{{ reaction.damage }}</strong>
          </div>
        </div>
        <div class="run-hud__modal-actions">
          <button
            class="run-hud__button run-hud__button--primary"
            type="button"
            @click="restartRun"
          >
            Рестарт
          </button>
          <button
            class="run-hud__button"
            type="button"
            @click="newRun"
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
import type { EmitterId, UpgradeId } from "@entities/game-session/model/types";
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
const resultTitle = computed(() => session.phase === "victory" ? "Бочкоед иссушён" : "Батч пролит");
const resultSubtitle = computed(() =>
  session.phase === "victory"
    ? "Великий Куб удержан."
    : "Бочкоед добрался до Куба.",
);

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

function selectTower(towerId: string): void {
  gameEvents.emit("run:action", { type: "selectTower", towerId: session.selectedTowerId === towerId ? null : towerId });
}

function rerollDraft(): void {
  gameEvents.emit("run:action", { type: "rerollDraft" });
}

function chooseDraftTower(emitterId: EmitterId): void {
  gameEvents.emit("run:action", { type: "chooseDraftTower", emitterId });
}

function chooseDraftUpgrade(upgradeId: UpgradeId): void {
  gameEvents.emit("run:action", { type: "chooseDraftUpgrade", upgradeId });
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

function newRun(): void {
  clearSavedRun();
  gameEvents.emit("run:action", { type: "restart", seed: Date.now() % 100000 });
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

<style scoped src="./RunHud.css"></style>
