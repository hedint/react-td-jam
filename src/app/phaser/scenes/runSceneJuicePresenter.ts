import type { GamePresentationEvent } from "@entities/game-session/model/presentationEvents";
import type { GameSnapshot, PathCell } from "@entities/game-session/model/types";
import type Phaser from "phaser";
import { renderPerformanceBudget } from "./renderPerformance";
import { LOGICAL_WIDTH } from "./runSceneLayout";

const MAX_FLOATING_LABELS = 24;
const MAX_MARK_EFFECTS = 36;
const FLOATING_LABEL_TTL_MS = 760;
const MARK_TTL_MS = 420;
const MIN_DAMAGE_LABEL_AMOUNT = 1;
const DAMAGE_LABEL_INTERVAL_MS = 170;
const CORE_Y = 428;

interface ScenePoint {
  readonly x: number
  readonly y: number
}

interface FloatingLabel {
  readonly text: Phaser.GameObjects.Text
  readonly createdAt: number
  readonly ttlMs: number
  readonly startX: number
  readonly startY: number
  readonly rise: number
}

interface DamageBucket {
  amount: number
  lastShownAt: number
}

type MarkEffect
  = | {
    readonly type: "puff"
    readonly createdAt: number
    readonly ttlMs: number
    readonly x: number
    readonly y: number
    readonly color: number
  }
  | {
    readonly type: "burst"
    readonly createdAt: number
    readonly ttlMs: number
    readonly x: number
    readonly y: number
    readonly color: number
    readonly strong: boolean
  }
  | {
    readonly type: "core"
    readonly createdAt: number
    readonly ttlMs: number
    readonly x: number
    readonly y: number
  };

export class RunSceneJuicePresenter {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly damageBuckets = new Map<string, DamageBucket>();
  private floatingLabels: FloatingLabel[] = [];
  private markEffects: MarkEffect[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(46);
  }

  queue(events: readonly GamePresentationEvent[], snapshot: GameSnapshot, visualMs: number): void {
    events.forEach((event) => {
      switch (event.type) {
        case "enemyDamaged":
          this.queueEnemyDamaged(event, snapshot, visualMs);
          break;
        case "enemyKilled":
          this.queueEnemyKilled(event, snapshot, visualMs);
          break;
        case "coreDamaged":
          this.queueCoreDamaged(event, visualMs);
          break;
        case "reactionBurst":
          this.queueReactionBurst(event, snapshot, visualMs);
          break;
        case "bossBreak":
          this.queueBossBreak(event, snapshot, visualMs);
          break;
        default:
          event satisfies never;
      }
    });
  }

  render(visualMs: number): void {
    this.graphics.clear();
    this.renderMarks(visualMs);
    this.renderFloatingLabels(visualMs);
  }

  private queueEnemyDamaged(event: Extract<GamePresentationEvent, { readonly type: "enemyDamaged" }>, snapshot: GameSnapshot, visualMs: number): void {
    const point = writePathProgressPoint(snapshot.board.pathCells, event.pathProgress);
    const bucket = this.getDamageBucket(event.enemyInstanceId);

    bucket.amount += event.amount;

    if (bucket.amount >= MIN_DAMAGE_LABEL_AMOUNT && visualMs - bucket.lastShownAt >= DAMAGE_LABEL_INTERVAL_MS) {
      this.queueFloatingLabel(`-${Math.round(bucket.amount)}`, point.x, point.y - 36, "#fff2a8", visualMs, 22);
      bucket.amount = 0;
      bucket.lastShownAt = visualMs;
    }
  }

  private queueEnemyKilled(event: Extract<GamePresentationEvent, { readonly type: "enemyKilled" }>, snapshot: GameSnapshot, visualMs: number): void {
    const point = writePathProgressPoint(snapshot.board.pathCells, event.pathProgress);
    const bucket = this.damageBuckets.get(event.enemyInstanceId);

    if (bucket && bucket.amount >= 0.5) {
      this.queueFloatingLabel(`-${Math.ceil(bucket.amount)}`, point.x, point.y - 36, "#fff2a8", visualMs, 22);
    }

    this.damageBuckets.delete(event.enemyInstanceId);

    this.queueMark({
      type: "puff",
      createdAt: visualMs,
      ttlMs: MARK_TTL_MS,
      x: point.x,
      y: point.y,
      color: 0xF4DCA5,
    });
  }

  private queueCoreDamaged(event: Extract<GamePresentationEvent, { readonly type: "coreDamaged" }>, visualMs: number): void {
    this.queueFloatingLabel(`-${event.amount}`, LOGICAL_WIDTH / 2, CORE_Y - 72, "#ffb15e", visualMs, 24);
    this.queueMark({
      type: "core",
      createdAt: visualMs,
      ttlMs: 520,
      x: LOGICAL_WIDTH / 2,
      y: CORE_Y,
    });
    this.shake(170, 0.006);
  }

  private queueReactionBurst(event: Extract<GamePresentationEvent, { readonly type: "reactionBurst" }>, snapshot: GameSnapshot, visualMs: number): void {
    const cell = snapshot.board.pathCells[event.cellIndex];

    if (!cell) {
      return;
    }

    const strong = event.reactionId === "fireStorm";
    const markCount = strong
      ? renderPerformanceBudget.effectParticleMarks.fireStorm
      : Math.min(3, renderPerformanceBudget.maxParticlesPerEffect);

    Array.from({ length: markCount }).forEach((_, index) => {
      const angle = index / markCount * Math.PI * 2;
      const distance = strong ? 34 : 21;

      this.queueMark({
        type: "burst",
        createdAt: visualMs + index * 12,
        ttlMs: strong ? 620 : 380,
        x: cell.x + Math.cos(angle) * distance,
        y: cell.y - 22 + Math.sin(angle) * distance * 0.55,
        color: strong ? 0xFFF2A8 : 0x9FF7FF,
        strong,
      });
    });

    if (strong) {
      this.shake(210, 0.007);
    }
  }

  private queueBossBreak(event: Extract<GamePresentationEvent, { readonly type: "bossBreak" }>, snapshot: GameSnapshot, visualMs: number): void {
    const point = writePathProgressPoint(snapshot.board.pathCells, event.pathProgress);

    this.queueMark({
      type: "burst",
      createdAt: visualMs,
      ttlMs: 680,
      x: point.x,
      y: point.y - 20,
      color: 0xFFF2A8,
      strong: true,
    });
    this.shake(220, 0.007);
  }

  private queueFloatingLabel(text: string, x: number, y: number, color: string, visualMs: number, rise: number): void {
    const label = this.getAvailableLabel();

    if (!label) {
      return;
    }

    label
      .setText(text)
      .setPosition(x, y)
      .setColor(color)
      .setAlpha(1)
      .setVisible(true);

    this.floatingLabels.push({
      text: label,
      createdAt: visualMs,
      ttlMs: FLOATING_LABEL_TTL_MS,
      startX: x,
      startY: y,
      rise,
    });
  }

  private getAvailableLabel(): Phaser.GameObjects.Text | null {
    const reusable = this.labels.find(label => !label.visible);

    if (reusable) {
      return reusable;
    }

    if (this.labels.length >= MAX_FLOATING_LABELS) {
      return null;
    }

    const label = this.scene.add.text(0, 0, "", {
      align: "center",
      color: "#fff2a8",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "700",
      stroke: "#101217",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(47).setVisible(false);

    this.labels.push(label);

    return label;
  }

  private getDamageBucket(enemyInstanceId: string): DamageBucket {
    const bucket = this.damageBuckets.get(enemyInstanceId);

    if (bucket) {
      return bucket;
    }

    const nextBucket = {
      amount: 0,
      lastShownAt: Number.NEGATIVE_INFINITY,
    };

    this.damageBuckets.set(enemyInstanceId, nextBucket);

    return nextBucket;
  }

  private queueMark(mark: MarkEffect): void {
    this.markEffects = [...this.markEffects, mark].slice(-MAX_MARK_EFFECTS);
  }

  private renderFloatingLabels(visualMs: number): void {
    this.floatingLabels = this.floatingLabels.filter((label) => {
      const progress = (visualMs - label.createdAt) / label.ttlMs;

      if (progress >= 1) {
        label.text.setVisible(false);
        return false;
      }

      label.text
        .setPosition(label.startX, label.startY - progress * label.rise)
        .setAlpha(progress < 0.68 ? 1 : 1 - (progress - 0.68) / 0.32);
      return true;
    });
  }

  private renderMarks(visualMs: number): void {
    this.markEffects = this.markEffects.filter((mark) => {
      const progress = (visualMs - mark.createdAt) / mark.ttlMs;

      if (progress < 0) {
        return true;
      }

      if (progress >= 1) {
        return false;
      }

      const alpha = 1 - progress;

      switch (mark.type) {
        case "puff":
          this.graphics.fillStyle(mark.color, 0.28 * alpha);
          this.graphics.fillCircle(mark.x, mark.y, 18 + progress * 24);
          this.graphics.lineStyle(3, 0xFFFFFF, 0.42 * alpha);
          this.graphics.strokeCircle(mark.x, mark.y, 16 + progress * 31);
          break;
        case "burst":
          this.graphics.fillStyle(mark.color, mark.strong ? 0.44 * alpha : 0.28 * alpha);
          this.graphics.fillCircle(mark.x, mark.y, (mark.strong ? 20 : 12) + progress * (mark.strong ? 42 : 22));
          this.graphics.lineStyle(mark.strong ? 4 : 2, mark.color, 0.78 * alpha);
          this.graphics.strokeCircle(mark.x, mark.y, (mark.strong ? 16 : 10) + progress * (mark.strong ? 52 : 28));
          break;
        case "core":
          this.graphics.lineStyle(5, 0xFFB15E, 0.84 * alpha);
          this.graphics.strokeCircle(mark.x, mark.y, 52 + progress * 38);
          this.graphics.fillStyle(0xFF5F3D, 0.16 * alpha);
          this.graphics.fillCircle(mark.x, mark.y, 64 + progress * 22);
          break;
        default:
          mark satisfies never;
      }

      return true;
    });
  }

  private shake(durationMs: number, intensity: number): void {
    if (prefersReducedMotion()) {
      return;
    }

    this.scene.cameras.main.shake(durationMs, intensity);
  }
}

function writePathProgressPoint(cells: readonly PathCell[], pathProgress: number): ScenePoint {
  const currentIndex = Math.max(0, Math.min(cells.length - 1, Math.floor(pathProgress) % cells.length));
  const nextIndex = Math.max(0, Math.min(cells.length - 1, (currentIndex + 1) % cells.length));
  const current = cells[currentIndex] ?? cells[0] ?? { x: LOGICAL_WIDTH / 2, y: CORE_Y };
  const next = cells[nextIndex] ?? current;
  const amount = Math.max(0, Math.min(1, pathProgress - Math.floor(pathProgress)));

  return {
    x: current.x + (next.x - current.x) * amount,
    y: current.y + (next.y - current.y) * amount,
  };
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
