<template>
  <div
    ref="containerRef"
    class="phaser-host"
  />
</template>

<script setup lang="ts">
import type Phaser from "phaser";
import { createPhaserGame } from "@app/phaser/runtime/createPhaserGame";
import { onBeforeUnmount, onMounted, ref } from "vue";

const containerRef = ref<HTMLDivElement | null>(null);
let game: Phaser.Game | null = null;

onMounted(() => {
  if (!containerRef.value) {
    return;
  }

  game = createPhaserGame(containerRef.value);
});

onBeforeUnmount(() => {
  game?.destroy(true);
  game = null;
});
</script>

<style scoped>
.phaser-host {
  width: 100%;
  height: 100%;
}

.phaser-host :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
