<template>
  <aside
    class="debug-hud"
    aria-label="Debug HUD"
  >
    <div class="debug-hud__header">
      <span class="debug-hud__label">runtime</span>
      <span class="debug-hud__status">ok</span>
    </div>
    <dl class="debug-hud__grid">
      <div>
        <dt>tick</dt>
        <dd>{{ session.tick }}</dd>
      </div>
      <div>
        <dt>time</dt>
        <dd>{{ session.elapsedSeconds }}s</dd>
      </div>
      <div>
        <dt>fps</dt>
        <dd>{{ session.fps }}</dd>
      </div>
      <div>
        <dt>tap</dt>
        <dd>{{ session.lastTapLabel }}</dd>
      </div>
      <div>
        <dt>stage</dt>
        <dd>{{ session.viewport.width }}x{{ session.viewport.height }}</dd>
      </div>
    </dl>
  </aside>
</template>

<script setup lang="ts">
import { useGameSessionStore } from "@entities/game-session/model/store";
import { useGameSessionBridge } from "@entities/game-session/model/useGameSessionBridge";

useGameSessionBridge();

const session = useGameSessionStore();
</script>

<style scoped>
.debug-hud {
  position: absolute;
  top: var(--safe-gap);
  left: var(--safe-gap);
  z-index: 2;
  width: min(260px, calc(100% - var(--safe-gap) * 2));
  padding: 10px 12px;
  color: var(--color-text);
  pointer-events: none;
  background: var(--color-panel);
  border: 1px solid var(--color-panel-border);
  border-radius: 8px;
}

.debug-hud__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.debug-hud__label,
.debug-hud__status,
dt {
  color: var(--color-text-muted);
  font-size: 10px;
  line-height: 1.2;
  text-transform: uppercase;
}

.debug-hud__status {
  color: var(--color-accent-strong);
}

.debug-hud__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px 12px;
  margin: 0;
}

.debug-hud__grid div {
  min-width: 0;
}

dt,
dd {
  margin: 0;
}

dd {
  overflow: hidden;
  color: var(--color-text);
  font-size: 12px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .debug-hud {
    width: min(220px, calc(100% - var(--safe-gap) * 2));
    padding: 8px 10px;
  }

  .debug-hud__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
