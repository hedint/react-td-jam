<template>
  <div class="run-hud__reaction-list-shell">
    <div
      ref="reactionListRef"
      class="run-hud__reaction-list"
      @scroll="updateScrollbar"
    >
      <div
        v-for="reaction in reactions"
        :key="reaction.sourceId"
        :class="getDamageSourceClass(reaction.sourceId)"
      >
        <span class="run-hud__reaction-mark" aria-hidden="true" />
        <span>{{ reaction.label }}</span>
        <strong>{{ reaction.damage }}</strong>
      </div>
    </div>
    <span
      v-if="scrollbarVisible"
      class="run-hud__reaction-scrollbar"
      aria-hidden="true"
    >
      <span
        class="run-hud__reaction-scrollbar-thumb"
        :style="scrollbarStyle"
      />
    </span>
  </div>
</template>

<script setup lang="ts">
import type { DamageSourceId } from "@entities/game-session/model/types";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{
  readonly reactions: readonly {
    readonly sourceId: DamageSourceId
    readonly label: string
    readonly damage: number
  }[]
}>();

const reactionListRef = ref<HTMLElement | null>(null);
const scrollbarVisible = ref(false);
const thumbHeight = ref("28px");
const thumbOffset = ref("0px");
const scrollbarStyle = computed(() => ({
  height: thumbHeight.value,
  transform: `translateY(${thumbOffset.value})`,
}));
let resizeObserver: ResizeObserver | null = null;

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

onMounted(async () => {
  await nextTick();
  observeList();
  updateScrollbar();
});

watch(
  () => props.reactions.length,
  async () => {
    await nextTick();
    observeList();
    updateScrollbar();
  },
  { immediate: true },
);

function observeList(): void {
  resizeObserver?.disconnect();
  resizeObserver = null;

  const list = reactionListRef.value;

  if (!list) {
    scrollbarVisible.value = false;
    return;
  }

  resizeObserver = new ResizeObserver(() => updateScrollbar());
  resizeObserver.observe(list);
}

function updateScrollbar(): void {
  const list = reactionListRef.value;

  if (!list) {
    scrollbarVisible.value = false;
    return;
  }

  const scrollRange = list.scrollHeight - list.clientHeight;
  scrollbarVisible.value = scrollRange > 1;

  if (!scrollbarVisible.value) {
    thumbHeight.value = "0px";
    thumbOffset.value = "0px";
    return;
  }

  const trackHeight = Math.max(0, list.clientHeight - 8);
  const nextThumbHeight = Math.min(trackHeight, Math.max(28, Math.round((list.clientHeight / list.scrollHeight) * trackHeight)));
  const maxOffset = Math.max(0, trackHeight - nextThumbHeight);
  const nextOffset = Math.round((list.scrollTop / scrollRange) * maxOffset);

  thumbHeight.value = `${nextThumbHeight}px`;
  thumbOffset.value = `${nextOffset}px`;
}

function getDamageSourceClass(sourceId: DamageSourceId): string {
  switch (sourceId) {
    case "rawSpark":
    case "electroPuddle":
    case "stormCloud":
      return "run-hud--spark";
    case "rawHeat":
    case "fire":
    case "fireVortex":
    case "fireStorm":
      return "run-hud--heat";
    case "steam":
      return "run-hud--water";
    default:
      return "run-hud--oil";
  }
}
</script>

<style scoped>
.run-hud__reaction-list-shell {
  --element-color: var(--skin-brass);
  --element-icon: radial-gradient(circle, var(--skin-brass) 0 42%, transparent 44%);
  --reaction-scrollbar-track: rgb(0 0 0 / 24%);
  --reaction-scrollbar-thumb: color-mix(in srgb, var(--skin-brass), #2b2a27 28%);

  position: relative;
  margin: 0 0 14px;
}

.run-hud__reaction-list {
  display: grid;
  gap: 7px;
  max-height: 116px;
  padding-right: 13px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.run-hud__reaction-list::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.run-hud__reaction-scrollbar {
  position: absolute;
  top: 4px;
  right: 2px;
  bottom: 4px;
  display: block;
  width: 7px;
  pointer-events: none;
  background:
    linear-gradient(90deg, transparent, rgb(255 220 140 / 10%) 45% 55%, transparent),
    var(--reaction-scrollbar-track);
  border: 1px solid rgb(200 167 106 / 12%);
  border-radius: 999px;
  box-shadow:
    inset 0 0 0 1px rgb(0 0 0 / 28%),
    0 0 8px rgb(0 0 0 / 22%);
}

.run-hud__reaction-scrollbar-thumb {
  position: absolute;
  top: 0;
  right: 1px;
  left: 1px;
  display: block;
  background:
    linear-gradient(180deg, rgb(255 234 175 / 58%), transparent 26%),
    linear-gradient(180deg, var(--reaction-scrollbar-thumb), #5f482a);
  border: 1px solid rgb(255 231 162 / 34%);
  border-radius: 999px;
  box-shadow:
    inset 0 0 0 1px rgb(0 0 0 / 38%),
    0 0 8px rgb(240 138 40 / 16%);
}

.run-hud__reaction-list div {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  background: rgb(0 0 0 / 24%);
  border: 1px solid color-mix(in srgb, var(--element-color), transparent 64%);
  border-radius: var(--skin-chip-radius);
}

.run-hud--water {
  --element-color: #55b9ff;
  --element-icon:
    linear-gradient(135deg, transparent 18%, rgb(97 214 214 / 88%) 19% 44%, transparent 45%),
    radial-gradient(circle at 50% 64%, rgb(215 239 240 / 92%) 0 30%, transparent 32%);
}

.run-hud--oil {
  --element-color: #b99b6a;
  --element-icon: radial-gradient(ellipse at 50% 58%, #15100d 0 48%, #7d664b 50% 68%, transparent 70%);
}

.run-hud--spark {
  --element-color: #ffe36d;
  --element-icon: conic-gradient(from 18deg, transparent 0 12%, #ffe36d 13% 18%, transparent 19% 38%, #ffe36d 39% 45%, transparent 46% 100%);
}

.run-hud--heat {
  --element-color: var(--skin-magma);
  --element-icon: radial-gradient(circle at 50% 70%, #ffe1a5 0 16%, #f08a28 18% 46%, #61251a 48% 62%, transparent 64%);
}

.run-hud__reaction-mark {
  width: 14px;
  height: 14px;
  background:
    var(--element-icon),
    linear-gradient(180deg, rgb(0 0 0 / 20%), rgb(0 0 0 / 58%));
  border: 1px solid color-mix(in srgb, var(--element-color), white 16%);
  border-radius: 50%;
}

.run-hud__reaction-list span,
.run-hud__reaction-list strong {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
