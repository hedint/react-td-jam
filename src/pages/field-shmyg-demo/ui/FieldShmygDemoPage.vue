<template>
  <main class="field-shmyg-demo">
    <nav class="field-shmyg-demo__nav">
      <RouterLink
        class="field-shmyg-demo__link"
        to="/onboarding-guide-demo"
      >
        {{ locale.guideDemo }}
      </RouterLink>
      <span class="field-shmyg-demo__title">{{ locale.title }}</span>
      <RouterLink
        class="field-shmyg-demo__link"
        to="/"
      >
        {{ locale.back }}
      </RouterLink>
    </nav>

    <section class="field-shmyg-demo__stage">
      <div class="field-shmyg-demo__field">
        <div class="field-shmyg-demo__hud">
          <span>{{ locale.hud.wave }}</span>
          <strong>{{ locale.hud.core }}</strong>
        </div>

        <div class="field-shmyg-demo__board">
          <div class="field-shmyg-demo__road field-shmyg-demo__road--top" />
          <div class="field-shmyg-demo__road field-shmyg-demo__road--left" />
          <div class="field-shmyg-demo__road field-shmyg-demo__road--right" />
          <div class="field-shmyg-demo__road field-shmyg-demo__road--bottom" />

          <img
            v-for="tower in towers"
            :key="tower"
            alt=""
            class="field-shmyg-demo__tower"
            :class="`field-shmyg-demo__tower--${tower}`"
            src="/assets/towers/water-cannon.png"
          >

          <div class="field-shmyg-demo__runner-track">
            <span
              class="field-shmyg-demo__runner"
              aria-label="Шмыг"
              role="img"
            />
          </div>
        </div>
      </div>

      <div class="field-shmyg-demo__samples">
        <article class="field-shmyg-demo__sample">
          <h2>{{ locale.samples.field }}</h2>
          <span
            class="field-shmyg-demo__sprite field-shmyg-demo__sprite--field"
            aria-label="Шмыг"
            role="img"
          />
        </article>

        <article class="field-shmyg-demo__sample">
          <h2>{{ locale.samples.tower }}</h2>
          <div class="field-shmyg-demo__compare">
            <img
              alt=""
              class="field-shmyg-demo__tower-sample"
              src="/assets/towers/water-cannon.png"
            >
            <span
              class="field-shmyg-demo__sprite field-shmyg-demo__sprite--field"
              aria-label="Шмыг"
              role="img"
            />
          </div>
        </article>

        <article class="field-shmyg-demo__sample">
          <h2>{{ locale.samples.review }}</h2>
          <span
            class="field-shmyg-demo__sprite field-shmyg-demo__sprite--review"
            aria-label="Шмыг"
            role="img"
          />
        </article>
      </div>

      <figure class="field-shmyg-demo__strip">
        <img
          :alt="locale.stripAlt"
          :src="stripSrc"
        >
        <figcaption>{{ locale.stripCaption }}</figcaption>
      </figure>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ru } from "@shared/i18n/ru";
import { RouterLink } from "vue-router";

const locale = ru.onboarding.fieldAssetDemo;
const stripSrc = "/assets/guides/shmyg/field/shmyg-field-run-right.png";
const towers = ["leftA", "leftB", "top", "rightA", "rightB", "bottom"] as const;
</script>

<style scoped>
.field-shmyg-demo {
  min-height: 100dvh;
  padding: 18px;
  color: var(--skin-text);
  background:
    linear-gradient(rgb(255 255 255 / 3%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(255 255 255 / 3%) 1px, transparent 1px),
    radial-gradient(circle at 54% 32%, rgb(212 116 36 / 13%), transparent 34%),
    var(--color-page);
  background-size: 32px 32px, 32px 32px, cover, cover;
}

.field-shmyg-demo__nav {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
  max-width: 980px;
  margin: 0 auto 14px;
}

.field-shmyg-demo__link {
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

.field-shmyg-demo__title {
  overflow: hidden;
  color: #ffe0a1;
  font-size: 18px;
  font-weight: 950;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field-shmyg-demo__stage {
  display: grid;
  max-width: 980px;
  gap: 14px;
  margin: 0 auto;
}

.field-shmyg-demo__field {
  overflow: hidden;
  min-height: 520px;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 7%), transparent 28%),
    linear-gradient(180deg, rgb(35 32 27 / 96%), rgb(13 13 12 / 98%));
  border-style: solid;
  border-color: transparent;
  border-radius: var(--skin-panel-radius);
  border-image: url("/assets/ui/hud-panel-border.png") 24 fill / 18px / 0 round;
}

.field-shmyg-demo__hud {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  color: var(--skin-text-muted);
  font-size: 13px;
  font-weight: 850;
  background: rgb(0 0 0 / 24%);
  border-bottom: 1px solid rgb(200 167 106 / 22%);
}

.field-shmyg-demo__hud strong {
  color: #ffe0a1;
  font-size: 16px;
}

.field-shmyg-demo__board {
  position: relative;
  width: min(100%, 640px);
  height: 420px;
  margin: 18px auto 22px;
  background:
    radial-gradient(circle at 50% 45%, rgb(210 116 48 / 13%), transparent 29%),
    linear-gradient(135deg, #2b2922, #171615 68%);
  border: 1px solid rgb(255 255 255 / 10%);
  box-shadow: inset 0 0 0 8px rgb(0 0 0 / 18%);
}

.field-shmyg-demo__road {
  position: absolute;
  background:
    linear-gradient(90deg, rgb(255 255 255 / 7%), transparent 18%),
    #4a4034;
  border: 1px solid rgb(13 11 9 / 78%);
  box-shadow: inset 0 5px 0 rgb(255 255 255 / 7%);
}

.field-shmyg-demo__road--top,
.field-shmyg-demo__road--bottom {
  left: 88px;
  width: calc(100% - 176px);
  height: 58px;
}

.field-shmyg-demo__road--top {
  top: 72px;
}

.field-shmyg-demo__road--bottom {
  bottom: 72px;
}

.field-shmyg-demo__road--left,
.field-shmyg-demo__road--right {
  top: 130px;
  width: 58px;
  height: 160px;
}

.field-shmyg-demo__road--left {
  left: 88px;
}

.field-shmyg-demo__road--right {
  right: 88px;
}

.field-shmyg-demo__tower,
.field-shmyg-demo__tower-sample {
  width: 76px;
  height: 76px;
  object-fit: contain;
  filter: drop-shadow(0 10px 12px rgb(0 0 0 / 42%));
}

.field-shmyg-demo__tower {
  position: absolute;
  transform: translate(-50%, -50%);
}

.field-shmyg-demo__tower--leftA {
  left: 58px;
  top: 186px;
}

.field-shmyg-demo__tower--leftB {
  left: 58px;
  top: 258px;
}

.field-shmyg-demo__tower--top {
  left: 236px;
  top: 42px;
}

.field-shmyg-demo__tower--rightA {
  right: -6px;
  top: 186px;
}

.field-shmyg-demo__tower--rightB {
  right: -6px;
  top: 258px;
}

.field-shmyg-demo__tower--bottom {
  left: 392px;
  bottom: -20px;
}

.field-shmyg-demo__runner-track {
  position: absolute;
  top: 18px;
  left: 58px;
  width: calc(100% - 116px);
  height: 88px;
  pointer-events: none;
}

.field-shmyg-demo__runner {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 54px;
  height: 54px;
  background-image: url("/assets/guides/shmyg/field/shmyg-field-run-right.png");
  background-repeat: no-repeat;
  background-position: 0 0;
  background-size: 800% 100%;
  filter: drop-shadow(0 8px 8px rgb(0 0 0 / 40%));
  animation:
    field-shmyg-strip 0.74s steps(7) infinite,
    field-shmyg-run 5.2s ease-in-out infinite;
}

.field-shmyg-demo__samples {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.field-shmyg-demo__sample,
.field-shmyg-demo__strip {
  display: grid;
  min-width: 0;
  justify-items: center;
  gap: 10px;
  padding: 12px;
  background: rgb(24 22 19 / 92%);
  border: 1px solid rgb(200 167 106 / 34%);
  border-radius: var(--skin-panel-radius);
}

.field-shmyg-demo__sample h2,
.field-shmyg-demo__strip figcaption {
  margin: 0;
  color: var(--skin-brass);
  font-size: 13px;
  font-weight: 900;
}

.field-shmyg-demo__sprite {
  display: block;
  background-image: url("/assets/guides/shmyg/field/shmyg-field-run-right.png");
  background-repeat: no-repeat;
  background-position: 0 0;
  background-size: 800% 100%;
  filter: drop-shadow(0 8px 10px rgb(0 0 0 / 38%));
  animation: field-shmyg-strip 0.74s steps(7) infinite;
}

.field-shmyg-demo__sprite--field {
  width: 54px;
  height: 54px;
}

.field-shmyg-demo__sprite--review {
  width: 112px;
  height: 112px;
}

.field-shmyg-demo__compare {
  display: flex;
  min-height: 92px;
  align-items: end;
  justify-content: center;
  gap: 12px;
}

.field-shmyg-demo__strip {
  overflow: hidden;
}

.field-shmyg-demo__strip img {
  width: min(100%, 1024px);
  height: auto;
  image-rendering: auto;
}

@keyframes field-shmyg-strip {
  100% {
    background-position: 100% 0;
  }
}

@keyframes field-shmyg-run {
  0%,
  12% {
    transform: translateX(0);
  }

  50%,
  62% {
    transform: translateX(calc(100% - 54px));
  }

  100% {
    transform: translateX(0);
  }
}

@media (max-width: 720px) {
  .field-shmyg-demo {
    padding: 12px;
  }

  .field-shmyg-demo__nav {
    grid-template-columns: 1fr;
  }

  .field-shmyg-demo__title {
    order: -1;
    text-align: left;
    white-space: normal;
  }

  .field-shmyg-demo__field {
    min-height: 430px;
  }

  .field-shmyg-demo__board {
    height: 330px;
  }

  .field-shmyg-demo__road--top,
  .field-shmyg-demo__road--bottom {
    left: 64px;
    width: calc(100% - 128px);
  }

  .field-shmyg-demo__road--left {
    left: 64px;
  }

  .field-shmyg-demo__road--right {
    right: 64px;
  }

  .field-shmyg-demo__tower {
    width: 54px;
    height: 64px;
  }

  .field-shmyg-demo__samples {
    grid-template-columns: 1fr;
  }
}
</style>
