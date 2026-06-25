<template>
  <svg
    class="mute-icon"
    :class="{ 'mute-icon--muted': muted }"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      class="mute-icon__speaker"
      d="M3 9h3.4L11 5v14l-4.6-4H3z"
    />
    <g
      v-if="!muted"
      class="mute-icon__waves"
    >
      <path d="M14 9.4a4 4 0 0 1 0 5.2" />
      <path d="M16.5 7a7.4 7.4 0 0 1 0 10" />
    </g>
    <g
      v-else
      class="mute-icon__cross"
    >
      <path d="m14.8 9.5 4.8 5" />
      <path d="m19.6 9.5-4.8 5" />
    </g>
  </svg>
</template>

<script setup lang="ts">
defineProps<{ muted: boolean }>();
</script>

<style scoped>
.mute-icon {
  display: block;
  width: 21px;
  height: 21px;
  color: #e2c8a0;
}

.mute-icon--muted {
  color: #c9b58f;
}

.mute-icon__speaker {
  fill: currentColor;
  filter: drop-shadow(0 1px 0 rgb(0 0 0 / 55%));
}

.mute-icon__waves {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
}

.mute-icon__cross {
  fill: none;
  stroke: #ef6a4c;
  stroke-width: 2.2;
  stroke-linecap: round;
  filter: drop-shadow(0 0 6px rgb(224 91 63 / 55%));
}
</style>
