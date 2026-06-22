import type { EnemyState } from "@entities/game-session/model/types";

const ENTRY_INTRO_MS = 420;

export class RunSceneEntryIntro {
  private readonly enemyFirstSeenAtMs = new Map<string, number>();
  private bossFirstSeenAtMs: number | null = null;

  pruneEnemies(enemies: readonly Pick<EnemyState, "id">[]): void {
    const activeEnemyIds = new Set(enemies.map(enemy => enemy.id));

    this.enemyFirstSeenAtMs.forEach((_firstSeenAtMs, enemyId) => {
      if (!activeEnemyIds.has(enemyId)) {
        this.enemyFirstSeenAtMs.delete(enemyId);
      }
    });
  }

  getEnemyProgress(enemyId: string, nowMs: number): number {
    const firstSeenAtMs = this.enemyFirstSeenAtMs.get(enemyId) ?? nowMs;

    if (!this.enemyFirstSeenAtMs.has(enemyId)) {
      this.enemyFirstSeenAtMs.set(enemyId, firstSeenAtMs);
    }

    return (nowMs - firstSeenAtMs) / ENTRY_INTRO_MS;
  }

  getBossProgress(nowMs: number): number {
    this.bossFirstSeenAtMs ??= nowMs;

    return (nowMs - this.bossFirstSeenAtMs) / ENTRY_INTRO_MS;
  }

  clearBoss(): void {
    this.bossFirstSeenAtMs = null;
  }
}
