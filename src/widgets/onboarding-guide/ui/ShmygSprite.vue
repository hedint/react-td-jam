<template>
  <span
    class="shmyg-sprite"
    :class="`shmyg-sprite--${state}`"
    :style="spriteStyle"
    role="img"
    aria-label="Шмыг"
  />
</template>

<script setup lang="ts">
import { assetGroups } from "@shared/assets/manifest";
import { computed } from "vue";

type ShmygSpriteState = "idle" | "talk" | "excited" | "angry";

const props = withDefaults(defineProps<{
  readonly state?: ShmygSpriteState
  readonly size?: number
}>(), {
  state: "idle",
  size: 104,
});

const spriteSources: Record<ShmygSpriteState, string> = {
  idle: assetGroups.guides.shmygIdle.src,
  talk: assetGroups.guides.shmygTalk.src,
  excited: assetGroups.guides.shmygExcited.src,
  angry: assetGroups.guides.shmygAngry.src,
};

const spriteStyle = computed(() => ({
  "--shmyg-size": `${props.size}px`,
  "--shmyg-src": `url("${spriteSources[props.state]}")`,
}));
</script>

<style scoped>
.shmyg-sprite {
  display: block;
  width: var(--shmyg-size);
  height: var(--shmyg-size);
  overflow: hidden;
  background-image: var(--shmyg-src);
  background-repeat: no-repeat;
  background-position: 0 0;
  background-size: 1200% 100%;
  filter: drop-shadow(0 8px 12px rgb(0 0 0 / 36%));
  animation: shmyg-strip 1.1s steps(11) infinite;
}

.shmyg-sprite--talk {
  animation-duration: 0.96s;
}

.shmyg-sprite--excited {
  animation-duration: 1s;
}

.shmyg-sprite--angry {
  animation-duration: 0.82s;
}

@keyframes shmyg-strip {
  100% {
    background-position: 100% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .shmyg-sprite {
    animation: none;
  }
}
</style>
