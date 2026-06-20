import type { RuntimeSnapshot, StagePoint, ViewportSize } from "./types";
import { defineStore } from "pinia";
import { computed, ref } from "vue";

const initialViewport: ViewportSize = {
  width: 1280,
  height: 720,
};

export const useGameSessionStore = defineStore("game-session", () => {
  const tick = ref(0);
  const elapsedMs = ref(0);
  const fps = ref(0);
  const seed = ref(0);
  const phase = ref("wave");
  const waveIndex = ref(0);
  const countdownMs = ref(0);
  const coreHp = ref(0);
  const speed = ref<1 | 2>(1);
  const livingEnemyCount = ref(0);
  const activeReactionCount = ref(0);
  const leaks = ref(0);
  const totalDamage = ref(0);
  const selectedTowerId = ref<string | null>(null);
  const towerItems = ref<Array<{ readonly id: string, readonly label: string, readonly placed: boolean }>>([]);
  const paused = ref(false);
  const lastTap = ref<StagePoint | null>(null);
  const viewport = ref<ViewportSize>(initialViewport);

  const elapsedSeconds = computed(() => (elapsedMs.value / 1000).toFixed(1));
  const waveLabel = computed(() => `${waveIndex.value + 1}`);
  const phaseLabel = computed(() => {
    switch (phase.value) {
      case "ready":
        return "Ожидание";
      case "countdown":
        return `Старт ${Math.ceil(countdownMs.value / 1000)}`;
      case "wave":
        return "Волна";
      case "draft":
        return "Драфт";
      default:
        return phase.value;
    }
  });
  const canStartWave = computed(() => phase.value === "ready");
  const canCompleteDraft = computed(() => phase.value === "draft");
  const damageLabel = computed(() => Math.round(totalDamage.value).toString());
  const lastTapLabel = computed(() => {
    if (!lastTap.value) {
      return "none";
    }

    return `${lastTap.value.x}, ${lastTap.value.y}`;
  });

  function applySnapshot(snapshot: RuntimeSnapshot): void {
    tick.value = snapshot.tick;
    elapsedMs.value = snapshot.elapsedMs;
    fps.value = snapshot.fps;
    seed.value = snapshot.seed;
    phase.value = snapshot.phase;
    waveIndex.value = snapshot.waveIndex;
    countdownMs.value = snapshot.countdownMs;
    coreHp.value = snapshot.coreHp;
    speed.value = snapshot.speed;
    livingEnemyCount.value = snapshot.livingEnemies.length;
    activeReactionCount.value = snapshot.activeReactions.length;
    leaks.value = snapshot.stats.leaks;
    totalDamage.value = snapshot.stats.totalDamage;
    selectedTowerId.value = snapshot.selectedTowerId;
    towerItems.value = [
      ...snapshot.placedTowers.map(tower => ({
        id: tower.id,
        label: tower.displayName,
        placed: true,
      })),
      ...snapshot.bench.map(tower => ({
        id: tower.id,
        label: tower.displayName,
        placed: false,
      })),
    ];
    paused.value = snapshot.paused;
    lastTap.value = snapshot.lastTap;
    viewport.value = snapshot.viewport;
  }

  function applyViewport(nextViewport: ViewportSize): void {
    viewport.value = nextViewport;
  }

  return {
    tick,
    elapsedMs,
    elapsedSeconds,
    fps,
    seed,
    phase,
    waveIndex,
    waveLabel,
    phaseLabel,
    countdownMs,
    canStartWave,
    canCompleteDraft,
    coreHp,
    speed,
    livingEnemyCount,
    activeReactionCount,
    leaks,
    totalDamage,
    damageLabel,
    selectedTowerId,
    towerItems,
    paused,
    lastTap,
    lastTapLabel,
    viewport,
    applySnapshot,
    applyViewport,
  };
});
