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
  const paused = ref(false);
  const lastTap = ref<StagePoint | null>(null);
  const viewport = ref<ViewportSize>(initialViewport);

  const elapsedSeconds = computed(() => (elapsedMs.value / 1000).toFixed(1));
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
    paused,
    lastTap,
    lastTapLabel,
    viewport,
    applySnapshot,
    applyViewport,
  };
});
