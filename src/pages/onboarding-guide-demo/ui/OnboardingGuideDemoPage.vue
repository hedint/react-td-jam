<template>
  <main class="shmyg-demo">
    <nav class="shmyg-demo__nav">
      <RouterLink
        class="shmyg-demo__link"
        to="/"
      >
        {{ locale.back }}
      </RouterLink>
      <span class="shmyg-demo__title">{{ locale.title }}</span>
    </nav>

    <section class="shmyg-demo__stage">
      <div class="shmyg-demo__bubble">
        <ShmygSprite
          :state="selectedState"
          :size="128"
        />
        <p>{{ locale.sampleLine }}</p>
      </div>

      <div class="shmyg-demo__controls">
        <button
          v-for="state in states"
          :key="state"
          class="shmyg-demo__button"
          :class="{ 'shmyg-demo__button--active': selectedState === state }"
          type="button"
          :aria-pressed="selectedState === state"
          @click="selectedState = state"
        >
          {{ locale.states[state] }}
        </button>
      </div>

      <div class="shmyg-demo__grid">
        <article
          v-for="state in states"
          :key="state"
          class="shmyg-demo__tile"
        >
          <h2>{{ locale.states[state] }}</h2>
          <ShmygSprite
            :state="state"
            :size="116"
          />
          <div class="shmyg-demo__phone-scale">
            <span>{{ locale.phoneScale }}</span>
            <ShmygSprite
              :state="state"
              :size="82"
            />
          </div>
        </article>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ru } from "@shared/i18n/ru";
import ShmygSprite from "@widgets/onboarding-guide/ui/ShmygSprite.vue";
import { ref } from "vue";
import { RouterLink } from "vue-router";

type ShmygSpriteState = "idle" | "talk" | "excited" | "angry";

const locale = ru.onboarding.assetDemo;
const states = ["idle", "talk", "excited", "angry"] as const satisfies readonly ShmygSpriteState[];
const selectedState = ref<ShmygSpriteState>("idle");
</script>

<style scoped>
.shmyg-demo {
  min-height: 100dvh;
  padding: 20px;
  color: var(--skin-text);
  background:
    linear-gradient(rgb(255 255 255 / 3%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(255 255 255 / 3%) 1px, transparent 1px),
    radial-gradient(circle at 50% 32%, rgb(240 138 40 / 14%), transparent 36%),
    var(--color-page);
  background-size: 32px 32px, 32px 32px, cover, cover;
}

.shmyg-demo__nav {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 14px;
  align-items: center;
  max-width: 940px;
  margin: 0 auto 16px;
}

.shmyg-demo__link {
  min-height: 36px;
  padding: 9px 12px;
  color: var(--skin-text);
  font-size: 13px;
  font-weight: 850;
  text-decoration: none;
  background: linear-gradient(180deg, #46382b, #181716);
  border: 1px solid rgb(200 167 106 / 46%);
  border-radius: var(--skin-chip-radius);
}

.shmyg-demo__title {
  color: #ffe0a1;
  font-size: 18px;
  font-weight: 950;
}

.shmyg-demo__stage {
  display: grid;
  max-width: 940px;
  gap: 16px;
  margin: 0 auto;
}

.shmyg-demo__bubble {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: end;
  min-height: 166px;
  padding: 16px;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 8%), transparent 42%),
    linear-gradient(180deg, rgb(43 40 34 / 96%), rgb(13 13 12 / 97%));
  border-style: solid;
  border-color: transparent;
  border-radius: var(--skin-panel-radius);
  border-image: url("/assets/ui/hud-panel-border.png") 24 fill / 18px / 0 round;
}

.shmyg-demo__bubble p {
  max-width: 560px;
  margin: 0 0 16px;
  color: var(--skin-text);
  font-size: 18px;
  font-weight: 850;
  line-height: 1.25;
  text-shadow: 0 2px 0 rgb(0 0 0 / 44%);
}

.shmyg-demo__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.shmyg-demo__button {
  min-height: 40px;
  padding: 9px 12px;
  color: var(--skin-text);
  font-size: 13px;
  font-weight: 900;
  background: linear-gradient(180deg, #3c3329, #181716);
  border: 1px solid rgb(200 167 106 / 38%);
  border-radius: var(--skin-chip-radius);
  cursor: pointer;
}

.shmyg-demo__button--active {
  color: #1a120d;
  background: linear-gradient(180deg, #ffe0a1, var(--skin-brass) 54%, #8a6032);
  border-color: rgb(255 228 159 / 74%);
}

.shmyg-demo__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.shmyg-demo__tile {
  display: grid;
  min-width: 0;
  gap: 10px;
  justify-items: center;
  padding: 12px;
  background: rgb(24 22 19 / 92%);
  border: 1px solid rgb(200 167 106 / 34%);
  border-radius: var(--skin-panel-radius);
}

.shmyg-demo__tile h2 {
  margin: 0;
  color: var(--skin-brass);
  font-size: 14px;
  font-weight: 900;
}

.shmyg-demo__phone-scale {
  display: grid;
  gap: 6px;
  justify-items: center;
  width: 100%;
  padding: 8px;
  background: rgb(0 0 0 / 22%);
  border: 1px solid rgb(255 255 255 / 8%);
}

.shmyg-demo__phone-scale span {
  color: var(--skin-text-muted);
  font-size: 12px;
  font-weight: 800;
}

@media (max-width: 720px) {
  .shmyg-demo {
    padding: 12px;
  }

  .shmyg-demo__bubble {
    grid-template-columns: 112px 1fr;
    padding: 12px;
  }

  .shmyg-demo__bubble p {
    margin-bottom: 10px;
    font-size: 14px;
  }

  .shmyg-demo__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
