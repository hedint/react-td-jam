<template>
  <main class="enemy-demo-page">
    <nav class="enemy-demo-page__nav">
      <RouterLink
        class="enemy-demo-page__link"
        to="/"
      >
        Игра
      </RouterLink>
      <span class="enemy-demo-page__title">Enemy Demo</span>
      <RouterLink
        class="enemy-demo-page__link"
        to="/tower-demo"
      >
        Башни
      </RouterLink>
    </nav>
    <div class="enemy-demo-page__stage">
      <PhaserCanvas
        class="enemy-demo-page__canvas"
        target-scene="EnemyDemoScene"
      />
    </div>
  </main>
</template>

<script setup lang="ts">
import PhaserCanvas from "@app/phaser/ui/PhaserCanvas.vue";
import { RouterLink } from "vue-router";
</script>

<style scoped>
.enemy-demo-page {
  display: grid;
  width: 100vw;
  height: 100dvh;
  min-height: 760px;
  grid-template-rows: auto 1fr;
  gap: 12px;
  padding: 14px;
  background:
    linear-gradient(rgb(255 255 255 / 3%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(255 255 255 / 3%) 1px, transparent 1px),
    radial-gradient(circle at 50% 42%, #25221d 0, var(--color-page) 70%);
  background-size: 32px 32px, 32px 32px, cover;
}

.enemy-demo-page__nav {
  display: grid;
  width: min(100%, 960px);
  align-items: center;
  justify-self: center;
  grid-template-columns: 1fr auto 1fr;
  color: var(--color-text);
}

.enemy-demo-page__link {
  width: fit-content;
  border: 1px solid rgb(200 167 106 / 42%);
  border-radius: 6px;
  padding: 8px 12px;
  background: rgb(8 8 8 / 42%);
  color: var(--color-text);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}

.enemy-demo-page__link:last-child {
  justify-self: end;
}

.enemy-demo-page__title {
  color: var(--color-text-muted);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
}

.enemy-demo-page__stage {
  overflow: hidden;
  width: min(100%, 960px);
  height: min(760px, calc(100dvh - 72px));
  min-height: 690px;
  justify-self: center;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 12px;
  background: var(--color-stage-bg);
  box-shadow:
    0 18px 64px rgb(0 0 0 / 42%),
    inset 0 0 0 8px rgb(0 0 0 / 20%);
}

.enemy-demo-page__canvas {
  width: 100%;
  height: 100%;
}

@media (max-width: 620px) {
  .enemy-demo-page {
    padding: 0;
    gap: 0;
  }

  .enemy-demo-page__nav {
    padding: 10px 12px;
  }

  .enemy-demo-page__stage {
    width: 100vw;
    height: calc(100dvh - 50px);
    min-height: 0;
    border-inline: 0;
    border-bottom: 0;
    border-radius: 0;
  }
}
</style>
