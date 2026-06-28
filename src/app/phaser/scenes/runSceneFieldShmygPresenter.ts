import type { RuntimeSnapshot, StagePoint } from "@entities/game-session/model/types";
import type { FieldShmygRouteTarget, FieldShmygSpawnContext, OnboardingProgress } from "@entities/onboarding/model";
import type Phaser from "phaser";
import {
  getFieldShmygRouteTargets,
  shouldShowFieldShmyg,
} from "@entities/onboarding/model";
import { assetGroups } from "@shared/assets/manifest";
import { gameEvents } from "@shared/lib/event-bus/gameEvents";

export type FieldShmygAnimationName = "idle" | "run" | "joy";
export type FieldShmygDirection = "up" | "down" | "left" | "right";

const fieldShmygAnimationNames = ["idle", "run", "joy"] as const satisfies readonly FieldShmygAnimationName[];
const fieldShmygDirections = ["up", "down", "left", "right"] as const satisfies readonly FieldShmygDirection[];
const FIELD_SHMYG_DISPLAY_SIZE = 54;
const FIELD_SHMYG_SPEED_PX_PER_MS = 0.074;
const FIELD_SHMYG_MIN_HOLD_MS = 10000;
const FIELD_SHMYG_HOLD_VARIANCE_MS = 5000;

interface MutableStagePoint {
  x: number
  y: number
}

const fieldShmygTextureKeys = {
  idle: {
    up: assetGroups.guides.shmygFieldIdleUp.key,
    down: assetGroups.guides.shmygFieldIdleDown.key,
    left: assetGroups.guides.shmygFieldIdleLeft.key,
    right: assetGroups.guides.shmygFieldIdleRight.key,
  },
  run: {
    up: assetGroups.guides.shmygFieldRunUp.key,
    down: assetGroups.guides.shmygFieldRunDown.key,
    left: assetGroups.guides.shmygFieldRunLeft.key,
    right: assetGroups.guides.shmygFieldRunRight.key,
  },
  joy: {
    up: assetGroups.guides.shmygFieldJoyUp.key,
    down: assetGroups.guides.shmygFieldJoyDown.key,
    left: assetGroups.guides.shmygFieldJoyLeft.key,
    right: assetGroups.guides.shmygFieldJoyRight.key,
  },
} as const satisfies Record<FieldShmygAnimationName, Record<FieldShmygDirection, string>>;

export function getFieldShmygTextureKey(animationName: FieldShmygAnimationName, direction: FieldShmygDirection): string {
  return fieldShmygTextureKeys[animationName][direction];
}

export function getFieldShmygPhaserAnimationKey(animationName: FieldShmygAnimationName, direction: FieldShmygDirection): string {
  return `${getFieldShmygTextureKey(animationName, direction)}.anim`;
}

export function registerFieldShmygAnimations(scene: Phaser.Scene): void {
  fieldShmygAnimationNames.forEach((animationName) => {
    fieldShmygDirections.forEach((direction) => {
      const key = getFieldShmygPhaserAnimationKey(animationName, direction);

      if (scene.anims.exists(key)) {
        return;
      }

      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(getFieldShmygTextureKey(animationName, direction), {
          start: 0,
          end: 7,
        }),
        frameRate: animationName === "run" ? 10 : 7,
        repeat: -1,
      });
    });
  });
}

export class RunSceneFieldShmygPresenter {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly position: MutableStagePoint = { x: 0, y: 0 };
  private routeSignature = "";
  private targetIndex = 0;
  private holdUntilMs = 0;
  private lastVisualMs: number | null = null;
  private guideWasActiveThisRun = false;
  private previousElapsedMs = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.shadow = scene.add.graphics().setDepth(24);
    this.sprite = scene.add.sprite(0, 0, getFieldShmygTextureKey("idle", "right"), 0)
      .setOrigin(0.5, 1)
      .setDisplaySize(FIELD_SHMYG_DISPLAY_SIZE, FIELD_SHMYG_DISPLAY_SIZE)
      .setDepth(29)
      .setVisible(false);
  }

  render(snapshot: RuntimeSnapshot, progress: OnboardingProgress, visualMs: number): void {
    this.updateRunContext(snapshot, progress);

    const context: FieldShmygSpawnContext = {
      guideWasActiveThisRun: this.guideWasActiveThisRun,
    };

    if (!shouldShowFieldShmyg(snapshot, progress, context)) {
      this.hide();
      return;
    }

    const targets = getFieldShmygRouteTargets(snapshot);

    if (targets.length === 0) {
      this.hide();
      return;
    }

    this.syncRoute(targets, visualMs);

    const target = targets[this.targetIndex] ?? targets[0]!;
    const deltaMs = this.lastVisualMs === null ? 0 : Math.max(0, visualMs - this.lastVisualMs);
    const isMoving = visualMs >= this.holdUntilMs && this.moveToward(target, deltaMs);
    const direction = getDirection(this.position, target);
    const animationName = isMoving ? "run" : "idle";
    const atTarget = getDistanceSquared(this.position, target) <= 1;

    this.lastVisualMs = visualMs;
    this.renderShadow();
    this.sprite
      .setVisible(true)
      .setPosition(this.position.x, this.position.y)
      .setDisplaySize(FIELD_SHMYG_DISPLAY_SIZE, FIELD_SHMYG_DISPLAY_SIZE)
      .setDepth(29 + this.position.y / 10000)
      .setAlpha(0.98);
    this.playAnimation(animationName, direction);
    gameEvents.emit("field-shmyg:position", {
      visible: true,
      targetId: target.id,
      atTarget,
      point: {
        x: Math.round(this.position.x),
        y: Math.round(this.position.y),
      },
    });
  }

  private updateRunContext(snapshot: RuntimeSnapshot, progress: OnboardingProgress): void {
    if (snapshot.elapsedMs === 0 && this.previousElapsedMs > 0) {
      this.guideWasActiveThisRun = progress.guide.status === "inProgress";
      this.routeSignature = "";
      this.targetIndex = 0;
      this.holdUntilMs = 0;
      this.lastVisualMs = null;
    }

    if (progress.guide.status === "inProgress") {
      this.guideWasActiveThisRun = true;
    }

    this.previousElapsedMs = snapshot.elapsedMs;
  }

  private syncRoute(targets: readonly FieldShmygRouteTarget[], visualMs: number): void {
    const signature = targets.map(target => target.id).join("|");

    if (signature === this.routeSignature) {
      return;
    }

    this.routeSignature = signature;
    this.targetIndex = findNearestTargetIndex(this.position, targets);
    const currentTarget = targets[this.targetIndex] ?? targets[0]!;

    if (!this.sprite.visible) {
      this.position.x = currentTarget.x;
      this.position.y = currentTarget.y;
      this.holdUntilMs = visualMs + getHoldDurationMs(currentTarget.id);
      return;
    }

    this.holdUntilMs = Math.min(this.holdUntilMs, visualMs);
  }

  private moveToward(target: FieldShmygRouteTarget, deltaMs: number): boolean {
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= 1) {
      this.position.x = target.x;
      this.position.y = target.y;
      this.advanceTarget(target);
      return false;
    }

    const step = Math.min(distance, deltaMs * FIELD_SHMYG_SPEED_PX_PER_MS);

    this.position.x += (dx / distance) * step;
    this.position.y += (dy / distance) * step;

    if (step >= distance) {
      this.advanceTarget(target);
    }

    return true;
  }

  private advanceTarget(target: FieldShmygRouteTarget): void {
    this.targetIndex += 1;
    this.holdUntilMs = (this.lastVisualMs ?? this.scene.time.now) + getHoldDurationMs(target.id);
  }

  private renderShadow(): void {
    this.shadow.clear();
    this.shadow.fillStyle(0x050403, 0.34);
    this.shadow.fillEllipse(this.position.x, this.position.y + 3, 26, 8);
  }

  private playAnimation(animationName: FieldShmygAnimationName, direction: FieldShmygDirection): void {
    const key = getFieldShmygPhaserAnimationKey(animationName, direction);

    if (this.sprite.anims.currentAnim?.key === key && this.sprite.anims.isPlaying) {
      return;
    }

    this.sprite.play(key);
  }

  private hide(): void {
    this.sprite.setVisible(false);
    this.shadow.clear();
    this.lastVisualMs = null;
    gameEvents.emit("field-shmyg:position", {
      visible: false,
      point: null,
      targetId: null,
      atTarget: false,
    });
  }
}

function findNearestTargetIndex(position: StagePoint, targets: readonly FieldShmygRouteTarget[]): number {
  if (position.x === 0 && position.y === 0) {
    return 0;
  }

  return targets.reduce((nearestIndex, target, index) => {
    const nearest = targets[nearestIndex] ?? target;

    return getDistanceSquared(position, target) < getDistanceSquared(position, nearest) ? index : nearestIndex;
  }, 0);
}

function getDirection(from: StagePoint, to: StagePoint): FieldShmygDirection {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx < 0 ? "left" : "right";
  }

  return dy < 0 ? "up" : "down";
}

function getDistanceSquared(a: StagePoint, b: StagePoint): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function getHoldDurationMs(targetId: string): number {
  const hash = [...targetId].reduce((value, character) => value + character.charCodeAt(0), 0);

  return FIELD_SHMYG_MIN_HOLD_MS + (hash % FIELD_SHMYG_HOLD_VARIANCE_MS);
}
