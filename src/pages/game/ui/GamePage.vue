<template>
  <main class="game-page">
    <div class="stage-shell">
      <div class="stage">
        <PhaserCanvas class="stage__canvas" />
        <DebugHud class="stage__hud" />
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import PhaserCanvas from "@app/phaser/ui/PhaserCanvas.vue";
import DebugHud from "@widgets/debug-hud/ui/DebugHud.vue";
</script>

<style scoped>
.game-page {
  display: grid;
  width: 100vw;
  height: 100dvh;
  min-height: 100vh;
  place-items: center;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  background:
    linear-gradient(rgb(255 255 255 / 3%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(255 255 255 / 3%) 1px, transparent 1px),
    radial-gradient(circle at 50% 50%, #202536 0, var(--color-page) 68%);
  background-size: 32px 32px, 32px 32px, cover;
}

.stage-shell {
  display: grid;
  width: min(100vw, calc(100dvh * 16 / 9));
  max-width: 100vw;
  aspect-ratio: 16 / 9;
  place-items: stretch;
}

.stage {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
  border: 1px solid rgb(255 255 255 / 12%);
  background: var(--color-stage-bg);
  box-shadow: 0 18px 64px rgb(0 0 0 / 38%);
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

@media (orientation: portrait) {
  .stage-shell {
    width: 100vw;
  }

  .stage {
    border-inline: 0;
  }
}
</style>
