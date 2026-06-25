<template>
  <aside
    class="debug-hud"
    :class="{ 'debug-hud--collapsed': collapsed }"
    aria-label="Debug HUD"
  >
    <button
      v-if="collapsed"
      class="debug-hud__strip"
      type="button"
      aria-label="Expand Debug HUD"
      @click="collapsed = false"
    >
      <span>runtime</span>
      <strong>{{ debugStatusLabel }}</strong>
      <span>+</span>
    </button>
    <template v-else>
      <div class="debug-hud__header">
        <span class="debug-hud__label">runtime</span>
        <span class="debug-hud__status">{{ debugStatusLabel }}</span>
        <button
          class="debug-hud__collapse"
          type="button"
          aria-label="Collapse Debug HUD"
          @click="collapsed = true"
        >
          -
        </button>
      </div>
      <dl class="debug-hud__grid">
        <div>
          <dt>tick</dt>
          <dd>{{ session.tick }}</dd>
        </div>
        <div>
          <dt>time</dt>
          <dd>{{ session.elapsedSeconds }}s</dd>
        </div>
        <div>
          <dt>fps</dt>
          <dd>{{ session.fps }}</dd>
        </div>
        <div>
          <dt>tap</dt>
          <dd>{{ session.lastTapLabel }}</dd>
        </div>
        <div>
          <dt>stage</dt>
          <dd>{{ session.viewport.width }}x{{ session.viewport.height }}</dd>
        </div>
      </dl>
      <div class="debug-hud__controls">
        <button type="button" @click="restartSeed">
          seed
        </button>
        <button type="button" @click="jumpWave">
          wave
        </button>
        <button type="button" @click="jumpBoss">
          boss
        </button>
        <button type="button" @click="toggleGod">
          {{ session.debugCoreHpLocked ? "god on" : "god off" }}
        </button>
        <button type="button" @click="cycleSpeed">
          x{{ nextSpeed }}
        </button>
        <button type="button" @click="spawnEnemy">
          spawn
        </button>
        <button type="button" @click="addTower">
          tower
        </button>
        <button type="button" @click="applyUpgrade">
          upgrade
        </button>
        <button type="button" @click="unlockSlot">
          unlock
        </button>
        <button type="button" @click="forceReaction">
          react
        </button>
        <button type="button" @click="clearReactions">
          clear
        </button>
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
import type { EmitterId, EnemyId, ReactionId, UpgradeId } from "@entities/game-session/model/types";
import { useGameSessionStore } from "@entities/game-session/model/store";
import { useGameSessionBridge } from "@entities/game-session/model/useGameSessionBridge";
import { gameEvents } from "@shared/lib/event-bus/gameEvents";
import { computed, ref, watch } from "vue";

useGameSessionBridge();

const session = useGameSessionStore();
const speeds = [1, 2, 4, 8] as const;
const enemies: readonly EnemyId[] = ["grunt", "swarm", "tank", "flyer", "runner", "insulated", "flameproof"];
const emitters: readonly EmitterId[] = ["water", "spark", "heat", "oil"];
const upgrades: readonly UpgradeId[] = ["unlockSlot5", "sparkCapacity", "heatReach", "waterCapacity", "fireCatalyst", "sparkCatalyst", "oilControl", "unlockSlot9", "unlockSlot14"];
const reactions: readonly ReactionId[] = ["electroPuddle", "steam", "fire", "stormCloud", "fireVortex", "fireStorm"];
const unlockSlots = ["slot-5-inner", "slot-9-inner", "slot-14-inner"] as const;
const enemyIndex = ref(0);
const emitterIndex = ref(0);
const upgradeIndex = ref(0);
const reactionIndex = ref(0);
const unlockIndex = ref(0);
const waveTarget = ref(0);
const collapsed = ref(false);
const debugStatusLabel = computed(() => session.debugVisible ? "debug on" : "arming");
const nextSpeed = computed(() => speeds[(speeds.indexOf(session.speed) + 1) % speeds.length] ?? 1);

watch(
  () => [session.coreHp, session.debugVisible] as const,
  () => {
    if (session.coreHp <= 0 || session.debugVisible) {
      return;
    }

    gameEvents.emit("run:action", { type: "toggleDebug" });
  },
  { immediate: true },
);

function restartSeed(): void {
  gameEvents.emit("run:action", { type: "restart", seed: session.seed || 1 });
}

function jumpWave(): void {
  gameEvents.emit("run:action", { type: "debugJumpToWave", waveIndex: waveTarget.value % 10 });
  waveTarget.value += 1;
}

function jumpBoss(): void {
  gameEvents.emit("run:action", { type: "debugJumpToBoss" });
}

function toggleGod(): void {
  gameEvents.emit("run:action", { type: "debugSetCoreHpLocked", locked: !session.debugCoreHpLocked });
}

function cycleSpeed(): void {
  gameEvents.emit("run:action", { type: "setSpeed", speed: nextSpeed.value });
}

function spawnEnemy(): void {
  const enemyId = enemies[enemyIndex.value % enemies.length] ?? "grunt";

  enemyIndex.value += 1;
  gameEvents.emit("run:action", { type: "debugForceSpawnEnemy", enemyId, count: 5 });
}

function addTower(): void {
  const emitterId = emitters[emitterIndex.value % emitters.length] ?? "water";

  emitterIndex.value += 1;
  gameEvents.emit("run:action", { type: "debugForceAddTower", emitterId });
}

function applyUpgrade(): void {
  const upgradeId = upgrades[upgradeIndex.value % upgrades.length] ?? "waterCapacity";

  upgradeIndex.value += 1;
  gameEvents.emit("run:action", { type: "debugForceApplyUpgrade", upgradeId });
}

function unlockSlot(): void {
  const slotId = unlockSlots[unlockIndex.value % unlockSlots.length] ?? "slot-5-inner";

  unlockIndex.value += 1;
  gameEvents.emit("run:action", { type: "debugUnlockSlot", slotId });
}

function forceReaction(): void {
  const reactionId = reactions[reactionIndex.value % reactions.length] ?? "electroPuddle";

  reactionIndex.value += 1;
  gameEvents.emit("run:action", {
    type: "debugAddReactionOverride",
    cellIndex: session.waveIndex % 10,
    layer: reactionId === "electroPuddle" || reactionId === "fire" ? "ground" : "air",
    reactionId,
    ttlMs: 12000,
  });
}

function clearReactions(): void {
  gameEvents.emit("run:action", { type: "debugClearReactionOverrides" });
}
</script>

<style scoped>
.debug-hud {
  position: absolute;
  top: var(--safe-gap);
  right: auto;
  bottom: auto;
  left: var(--safe-gap);
  z-index: 2;
  width: min(260px, calc(100% - var(--safe-gap) * 2));
  padding: 10px 12px;
  color: var(--color-text);
  pointer-events: none;
  background: var(--color-panel);
  border: 1px solid var(--color-panel-border);
  border-radius: 8px;
}

.debug-hud--collapsed {
  width: min(210px, calc(100% - var(--safe-gap) * 2));
  padding: 0;
  background: transparent;
  border: 0;
}

.debug-hud__strip {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  width: 100%;
  min-height: 28px;
  gap: 8px;
  padding: 6px 9px;
  color: var(--color-text);
  pointer-events: auto;
  cursor: pointer;
  background: var(--color-panel);
  border: 1px solid var(--color-panel-border);
  border-radius: 8px;
}

.debug-hud__controls {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 10px;
  pointer-events: auto;
}

.debug-hud__controls button {
  min-width: 0;
  padding: 5px 4px;
  color: var(--color-text);
  font: inherit;
  font-size: 10px;
  text-transform: uppercase;
  background: rgb(255 255 255 / 8%);
  border: 1px solid var(--color-panel-border);
  border-radius: 5px;
}

.debug-hud__collapse {
  width: 22px;
  height: 20px;
  padding: 0;
  color: var(--color-text);
  pointer-events: auto;
  cursor: pointer;
  background: rgb(255 255 255 / 8%);
  border: 1px solid var(--color-panel-border);
  border-radius: 5px;
}

.debug-hud__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.debug-hud__label,
.debug-hud__strip span,
.debug-hud__status,
dt {
  color: var(--color-text-muted);
  font-size: 10px;
  line-height: 1.2;
  text-transform: uppercase;
}

.debug-hud__status {
  color: var(--color-accent-strong);
}

.debug-hud__strip strong {
  color: var(--color-accent-strong);
  font-size: 10px;
  line-height: 1.2;
  text-transform: uppercase;
}

.debug-hud__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px 12px;
  margin: 0;
}

.debug-hud__grid div {
  min-width: 0;
}

dt,
dd {
  margin: 0;
}

dd {
  overflow: hidden;
  color: var(--color-text);
  font-size: 12px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .debug-hud {
    width: min(220px, calc(100% - var(--safe-gap) * 2));
    padding: 8px 10px;
  }

  .debug-hud--collapsed {
    width: min(210px, calc(100% - var(--safe-gap) * 2));
    padding: 0;
  }

  .debug-hud__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
