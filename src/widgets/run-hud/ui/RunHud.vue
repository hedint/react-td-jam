<template>
  <div class="run-hud">
    <header class="run-hud__top">
      <div class="run-hud__stat run-hud__stat--core">
        <span>Куб</span>
        <strong>{{ session.coreHp }}</strong>
      </div>
      <div class="run-hud__stat run-hud__stat--wave">
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
      <div class="run-hud__stat run-hud__stat--speed">
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

    <section
      v-if="reserveTowerStacks.length > 0"
      class="run-hud__bottom"
      :class="{ 'run-hud__bottom--locked': session.draftStep }"
    >
      <div class="run-hud__bench">
        <button
          v-for="tower in reserveTowerStacks"
          :key="tower.emitterId"
          class="run-hud__tower"
          :class="[
            getEmitterClass(tower.emitterId),
            { 'run-hud__tower--selected': !session.draftStep && tower.selected },
          ]"
          :disabled="Boolean(session.draftStep)"
          type="button"
          @click="selectTowerStack(tower)"
        >
          <span class="run-hud__tower-name">{{ tower.label }}</span>
          <span class="run-hud__tower-art" aria-hidden="true" />
          <span
            v-if="tower.count > 1"
            class="run-hud__tower-count"
          >x{{ tower.count }}</span>
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
            <h2>{{ session.draftStep === "tower" ? "Пополнение мастерской" : "Выберите усиление" }}</h2>
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
            :class="getEmitterClass(offer.emitterId)"
            type="button"
            @click="chooseDraftTower(offer.emitterId)"
          >
            <span class="run-hud__draft-card-art" aria-hidden="true" />
            <strong>{{ offer.label }}</strong>
          </button>
        </div>

        <div
          v-else
          class="run-hud__draft-grid run-hud__draft-grid--upgrade"
        >
          <button
            v-for="offer in session.draftUpgradeOffers"
            :key="offer.upgradeId"
            class="run-hud__draft-card run-hud__draft-card--upgrade"
            :class="getUpgradeClass(offer.upgradeId)"
            type="button"
            @click="chooseDraftUpgrade(offer.upgradeId)"
          >
            <span class="run-hud__draft-card-main">
              <strong>{{ offer.label }}</strong>
              <span>{{ getUpgradeDescription(offer.upgradeId) }}</span>
            </span>
            <span class="run-hud__upgrade-level">Уровень {{ offer.stacks }}/{{ offer.maxStacks }}</span>
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
            :class="getDamageSourceClass(reaction.sourceId)"
          >
            <span class="run-hud__reaction-mark" aria-hidden="true" />
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
const reserveTowerStacks = computed(() => {
  const stacks = new Map<EmitterId, { emitterId: EmitterId, label: string, ids: string[] }>();

  session.towerItems.filter(tower => !tower.placed).forEach((tower) => {
    const stack = stacks.get(tower.emitterId);

    if (stack) {
      stack.ids.push(tower.id);
      return;
    }

    stacks.set(tower.emitterId, {
      emitterId: tower.emitterId,
      label: tower.label,
      ids: [tower.id],
    });
  });

  return [...stacks.values()].map(stack => ({
    ...stack,
    count: stack.ids.length,
    selected: session.selectedTowerId !== null && stack.ids.includes(session.selectedTowerId),
  }));
});
const resultTitle = computed(() => session.phase === "victory" ? "Бочкоед иссушён" : "Зелье пролито");
const resultSubtitle = computed(() =>
  session.phase === "victory"
    ? "Великий Куб удержан."
    : "Бочкоед добрался до Куба.",
);

function getEmitterClass(emitterId: EmitterId): string {
  return `run-hud--${emitterId}`;
}

function getUpgradeClass(upgradeId: UpgradeId): string {
  switch (upgradeId) {
    case "waterCapacity":
      return getEmitterClass("water");
    case "oilControl":
    case "fireCatalyst":
      return getEmitterClass("oil");
    case "sparkCapacity":
      return getEmitterClass("spark");
    case "heatReach":
      return getEmitterClass("heat");
    default:
      return upgradeId satisfies never;
  }
}

function getUpgradeDescription(upgradeId: UpgradeId): string {
  switch (upgradeId) {
    case "waterCapacity":
      return "Водомёт покрывает больше клеток.";
    case "oilControl":
      return "Нефть сильнее замедляет врагов.";
    case "sparkCapacity":
      return "Разрядник питает больше реакций.";
    case "heatReach":
      return "Магмовый кран питает больше реакций.";
    case "fireCatalyst":
      return "Пожар наносит больше урона.";
    default:
      return upgradeId satisfies never;
  }
}

function getDamageSourceClass(sourceId: string): string {
  switch (sourceId) {
    case "rawSpark":
    case "electroPuddle":
    case "stormCloud":
      return getEmitterClass("spark");
    case "rawHeat":
    case "fire":
    case "fireVortex":
    case "fireStorm":
      return getEmitterClass("heat");
    case "steam":
      return getEmitterClass("water");
    default:
      return getEmitterClass("oil");
  }
}

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

function selectTowerStack(tower: { readonly ids: readonly string[], readonly selected: boolean }): void {
  if (session.draftStep) {
    return;
  }

  gameEvents.emit("run:action", { type: "selectTower", towerId: tower.selected ? null : tower.ids[0] ?? null });
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
