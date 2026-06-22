<template>
  <div
    ref="containerRef"
    class="phaser-host"
  />
</template>

<script setup lang="ts">
import type { PhaserTargetScene } from "@app/phaser/runtime/createPhaserGame";
import type Phaser from "phaser";
import { createPhaserGame } from "@app/phaser/runtime/createPhaserGame";
import { onBeforeUnmount, onMounted, ref } from "vue";

const props = withDefaults(defineProps<{
  readonly targetScene?: PhaserTargetScene
}>(), {
  targetScene: "RunScene",
});

const containerRef = ref<HTMLDivElement | null>(null);
let game: Phaser.Game | null = null;

onMounted(() => {
  if (!containerRef.value) {
    return;
  }

  game = createPhaserGame(containerRef.value, props.targetScene);
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
