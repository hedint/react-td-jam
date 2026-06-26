<template>
  <div class="run-hud">
    <header class="run-hud__top">
      <button
        class="run-hud__action-button"
        type="button"
        :aria-label="actionAriaLabel"
        :disabled="hudActionDisabled"
        :data-onboarding-target="session.canStartWave ? 'startWave' : 'pauseToggle'"
        @click="activatePrimaryAction"
      >
        <span
          class="run-hud__action-icon"
          :class="actionIconClass"
          aria-hidden="true"
        />
        <span>{{ actionLabel }}</span>
      </button>
      <div
        class="run-hud__panel run-hud__panel--core"
        :aria-label="locale.hud.aria.coreHp(session.coreHp, coreMaxHp)"
      >
        <div class="run-hud__core-main">
          <span
            class="run-hud__heart"
            aria-hidden="true"
          />
          <strong>{{ session.coreHp }}</strong>
        </div>
        <span
          class="run-hud__core-bar"
          aria-hidden="true"
        >
          <span :style="{ width: coreHpPercent }" />
        </span>
      </div>
      <div class="run-hud__panel run-hud__panel--status">
        <div class="run-hud__wave">
          <span class="run-hud__eyebrow">{{ waveEyebrow }}</span>
          <strong>{{ waveCountLabel }}</strong>
        </div>
        <div class="run-hud__threat">
          <template v-if="session.phase === 'boss'">
            <span class="run-hud__eyebrow">{{ locale.hud.boss }}</span>
            <span
              class="run-hud__enemy run-hud__enemy--boss-ogre"
              :title="gameConfig.boss.displayName"
              :aria-label="gameConfig.boss.displayName"
            />
            <strong class="run-hud__threat-value">{{ session.bossHpLabel }}</strong>
          </template>
          <div
            v-else
            class="run-hud__enemies"
            role="list"
            :aria-label="locale.hud.enemy"
          >
            <span
              v-for="enemyId in waveEnemyIds"
              :key="enemyId"
              class="run-hud__enemy"
              role="listitem"
              :class="`run-hud__enemy--${enemyId}`"
              :title="enemyName(enemyId)"
              :aria-label="enemyName(enemyId)"
            />
          </div>
        </div>
      </div>

      <button
        class="run-hud__mute-button"
        type="button"
        :aria-label="muteAriaLabel"
        :aria-pressed="muted"
        :title="muteAriaLabel"
        @click="toggleMute"
      >
        <MuteIcon :muted="muted" />
      </button>
    </header>

    <Transition name="run-hud-bench-slide">
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
            :data-onboarding-emitter="tower.emitterId"
            type="button"
            @click="selectTowerStack(tower)"
          >
            <span class="run-hud__tower-card">
              <span class="run-hud__tower-header">
                <span class="run-hud__tower-name">{{ tower.label }}</span>
              </span>
              <span
                class="run-hud__tower-art"
                aria-hidden="true"
              />
              <span
                v-if="tower.count > 1"
                class="run-hud__tower-count"
              >x{{ tower.count }}</span>
            </span>
          </button>
        </div>
      </section>
    </Transition>

    <div
      v-if="session.draftStep"
      class="run-hud__scrim run-hud__scrim--blocking run-hud__scrim--draft"
    >
      <section class="run-hud__draft">
        <header class="run-hud__draft-header">
          <div>
            <span>{{ session.draftStep === "tower" ? locale.hud.draft.towerEyebrow : locale.hud.draft.upgradeEyebrow }}</span>
            <h2>{{ session.draftStep === "tower" ? locale.hud.draft.towerTitle : locale.hud.draft.upgradeTitle }}</h2>
          </div>
          <button
            class="run-hud__button run-hud__reroll-button"
            type="button"
            :disabled="!session.canRerollDraft"
            :aria-label="locale.hud.draft.reroll"
            @click="rerollDraft"
          >
            <svg
              class="run-hud__reroll-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M20 12a8 8 0 1 1-2.34-5.66" />
              <path d="M20 4v6h-6" />
            </svg>
            <span>{{ locale.hud.draft.reroll }}</span>
          </button>
        </header>

        <div
          v-if="session.draftStep === 'tower'"
          class="run-hud__draft-strip"
        >
          <button
            v-for="offer in session.draftTowerOffers"
            :key="offer.emitterId"
            class="run-hud__draft-card"
            :class="getEmitterClass(offer.emitterId)"
            :data-onboarding-draft-tower="offer.emitterId"
            type="button"
            @click="chooseDraftTower(offer.emitterId)"
          >
            <span class="run-hud__tower-card run-hud__draft-card-shell">
              <span class="run-hud__tower-header">
                <span class="run-hud__tower-name">{{ offer.label }}</span>
              </span>
              <span class="run-hud__tower-art" aria-hidden="true" />
            </span>
          </button>
        </div>

        <div
          v-else
          class="run-hud__draft-strip run-hud__draft-strip--upgrade"
        >
          <button
            v-for="offer in session.draftUpgradeOffers"
            :key="offer.upgradeId"
            class="run-hud__draft-card run-hud__draft-card--upgrade"
            :class="getUpgradeClass(offer.upgradeId)"
            :data-onboarding-draft-upgrade="offer.upgradeId"
            type="button"
            @click="chooseDraftUpgrade(offer.upgradeId)"
          >
            <span class="run-hud__tower-card run-hud__draft-card-shell run-hud__draft-card-shell--upgrade">
              <span class="run-hud__tower-header">
                <span class="run-hud__tower-name">{{ offer.label }}</span>
              </span>
              <span class="run-hud__draft-card-main">
                <span>{{ getUpgradeDescription(offer.upgradeId) }}</span>
              </span>
              <span class="run-hud__tower-count run-hud__upgrade-level">{{ locale.hud.draft.upgradeLevel(offer.stacks, offer.maxStacks) }}</span>
            </span>
          </button>
        </div>
      </section>
    </div>

    <section
      v-else-if="session.paused"
      class="run-hud__pause-chip"
    >
      <span>{{ locale.hud.pause }}</span>
    </section>

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
            <dt>{{ locale.hud.result.seed }}</dt>
            <dd>{{ session.seed }}</dd>
          </div>
          <div>
            <dt>{{ locale.hud.result.waves }}</dt>
            <dd>{{ session.wavesCleared }}/10</dd>
          </div>
          <div>
            <dt>{{ locale.hud.result.leaks }}</dt>
            <dd>{{ session.leaks }}</dd>
          </div>
          <div>
            <dt>{{ locale.hud.result.damage }}</dt>
            <dd>{{ session.damageLabel }}</dd>
          </div>
          <div>
            <dt>{{ locale.hud.result.break }}</dt>
            <dd>{{ session.bossBreaks }}</dd>
          </div>
          <div>
            <dt>{{ locale.hud.result.time }}</dt>
            <dd>{{ session.runtimeLabel }}</dd>
          </div>
          <div>
            <dt>{{ locale.hud.result.topReaction }}</dt>
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
            {{ locale.hud.restart }}
          </button>
          <button
            class="run-hud__button"
            type="button"
            @click="newRun"
          >
            {{ locale.hud.newRun }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EmitterId, EnemyId, UpgradeId } from "@entities/game-session/model/types";
import { gameConfig } from "@entities/game-session/model/config";
import { clearSavedRun } from "@entities/game-session/model/persistence";
import { useGameSessionStore } from "@entities/game-session/model/store";
import { useGameSessionBridge } from "@entities/game-session/model/useGameSessionBridge";
import { ru } from "@shared/i18n/ru";
import { gameEvents } from "@shared/lib/event-bus/gameEvents";
import { computed, onMounted, ref } from "vue";
import MuteIcon from "./MuteIcon.vue";

useGameSessionBridge();

const locale = ru;
const session = useGameSessionStore();
const muted = ref(false);
const coreMaxHp = gameConfig.balance.coreHp;
const muteStorageKey = "jam-td:muted";
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
const coreHpPercent = computed(() => `${Math.max(0, Math.min(1, session.coreHp / coreMaxHp)) * 100}%`);
const totalWaves = gameConfig.waves.length;
const previewWaveIndex = computed(() => {
  if (session.phase === "draft") {
    return Math.min(session.waveIndex + 1, totalWaves - 1);
  }

  return Math.min(session.waveIndex, totalWaves - 1);
});
const waveEyebrow = computed(() => locale.hud.wave);
const waveCountLabel = computed(() => {
  if (session.phase === "boss") {
    return session.waveLabel;
  }

  const waveNumber = previewWaveIndex.value + 1;

  return `${waveNumber}/${totalWaves}`;
});
const waveEnemyIds = computed<readonly EnemyId[]>(() => {
  const wave = gameConfig.waves[previewWaveIndex.value];

  if (!wave) {
    return [];
  }

  const ids = wave.telegraphEnemyIds && wave.telegraphEnemyIds.length > 0
    ? wave.telegraphEnemyIds
    : wave.spawnGroups.map(group => group.enemyId);

  return [...new Set(ids)];
});
const actionLabel = computed(() => {
  if (session.canStartWave) {
    return locale.hud.start;
  }

  return session.paused ? locale.hud.resume : locale.hud.pause;
});
const actionAriaLabel = computed(() => {
  if (session.canStartWave) {
    return locale.hud.aria.startWave;
  }

  return session.paused ? locale.hud.aria.resumeRun : locale.hud.aria.pauseRun;
});
const actionIconClass = computed(() => {
  if (session.canStartWave || session.paused) {
    return "run-hud__action-icon--play";
  }

  return "run-hud__action-icon--pause";
});
const hudActionDisabled = computed(() => Boolean(session.draftStep) || session.phase === "victory" || session.phase === "defeat");
const muteAriaLabel = computed(() => muted.value ? locale.hud.aria.unmute : locale.hud.aria.mute);
const resultTitle = computed(() => session.phase === "victory" ? locale.hud.result.victoryTitle : locale.hud.result.defeatTitle);
const resultSubtitle = computed(() =>
  session.phase === "victory"
    ? locale.hud.result.victorySubtitle
    : locale.hud.result.defeatSubtitle,
);

function getEmitterClass(emitterId: EmitterId): string {
  return `run-hud--${emitterId}`;
}

function enemyName(enemyId: EnemyId): string {
  return gameConfig.enemies.find(enemy => enemy.id === enemyId)?.displayName ?? "";
}

function getUpgradeClass(upgradeId: UpgradeId): string {
  switch (upgradeId) {
    case "waterCapacity":
      return getEmitterClass("water");
    case "oilControl":
      return getEmitterClass("oil");
    case "sparkCapacity":
    case "sparkCatalyst":
      return getEmitterClass("spark");
    case "heatReach":
    case "fireCatalyst":
      return getEmitterClass("heat");
    case "unlockSlot5":
    case "unlockSlot9":
    case "unlockSlot14":
      return getEmitterClass("water");
    default:
      return upgradeId satisfies never;
  }
}

function getUpgradeDescription(upgradeId: UpgradeId): string {
  return locale.hud.upgradeDescriptions[upgradeId];
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
  muted.value = window.localStorage.getItem(muteStorageKey) === "1";
  gameEvents.emit("audio:mute-changed", { muted: muted.value });
});

function togglePause(): void {
  gameEvents.emit("run:action", { type: session.paused ? "resume" : "pause" });
}

function startWave(): void {
  gameEvents.emit("run:action", { type: "startWave" });
}

function activatePrimaryAction(): void {
  if (session.canStartWave) {
    startWave();
    return;
  }

  togglePause();
}

function toggleMute(): void {
  muted.value = !muted.value;
  window.localStorage.setItem(muteStorageKey, muted.value ? "1" : "0");
  gameEvents.emit("audio:mute-changed", { muted: muted.value });
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
</script>

<style scoped src="./RunHud.css"></style>
