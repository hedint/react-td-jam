<template>
  <main class="game-page">
    <div class="stage-shell">
      <div class="stage">
        <PhaserCanvas class="stage__canvas" />
        <RunHud class="stage__hud" />
        <DebugHud
          v-if="debugEnabled"
          class="stage__debug"
        />
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import PhaserCanvas from "@app/phaser/ui/PhaserCanvas.vue";
import DebugHud from "@widgets/debug-hud/ui/DebugHud.vue";
import RunHud from "@widgets/run-hud/ui/RunHud.vue";

const debugEnabled = new URLSearchParams(window.location.search).get("debug") === "1";
</script>

<style scoped>
.game-page {
  display: grid;
  width: 100vw;
  height: 100dvh;
  min-height: 100vh;
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
  width: min(100%, 540px, calc((100dvh - 28px) * 9 / 16));
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

.stage__hud,
.stage__debug {
  position: absolute;
  inset: 0;
}

@media (orientation: portrait) {
  .game-page {
    padding-inline: 0;
  }

  .stage-shell {
    width: min(100vw, calc(100dvh * 9 / 16));
  }

  .stage {
    border-radius: 0;
    border-inline: 0;
  }
}
</style>
