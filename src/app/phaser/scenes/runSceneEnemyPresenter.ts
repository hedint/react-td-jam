import type { GamePresentationEvent } from "@entities/game-session/model/presentationEvents";
import type { EnemyId, EnemyState, GameSnapshot, PathCell } from "@entities/game-session/model/types";
import type Phaser from "phaser";
import type { RunSceneEntryIntro } from "./runSceneEntryIntro";
import { assetGroups } from "@shared/assets/manifest";
import {
  getEnemySideFacing,
  writeEnemyIntroPosition,
  writeEnemyPosition,
  writePathProgressPosition,
} from "./runSceneRender";

export type EnemyAnimationName = "move" | "hit" | "death";
export type EnemyAnimationDirection = "side";

export const enemyAnimationNames = ["move", "hit", "death"] as const satisfies readonly EnemyAnimationName[];
export const enemyAnimationDirections = ["side"] as const satisfies readonly EnemyAnimationDirection[];

const enemyAnimationTextureKeys = {
  grunt: {
    move: assetGroups.enemies.gruntMoveSide.key,
    hit: assetGroups.enemies.gruntHitSide.key,
    death: assetGroups.enemies.gruntDeathSide.key,
  },
  swarm: {
    move: assetGroups.enemies.swarmMoveSide.key,
    hit: assetGroups.enemies.swarmHitSide.key,
    death: assetGroups.enemies.swarmDeathSide.key,
  },
  tank: {
    move: assetGroups.enemies.tankMoveSide.key,
    hit: assetGroups.enemies.tankHitSide.key,
    death: assetGroups.enemies.tankDeathSide.key,
  },
  flyer: {
    move: assetGroups.enemies.flyerMoveSide.key,
    hit: assetGroups.enemies.flyerHitSide.key,
    death: assetGroups.enemies.flyerDeathSide.key,
  },
  runner: {
    move: assetGroups.enemies.runnerMoveSide.key,
    hit: assetGroups.enemies.runnerHitSide.key,
    death: assetGroups.enemies.runnerDeathSide.key,
  },
  insulated: {
    move: assetGroups.enemies.insulatedMoveSide.key,
    hit: assetGroups.enemies.insulatedHitSide.key,
    death: assetGroups.enemies.insulatedDeathSide.key,
  },
  flameproof: {
    move: assetGroups.enemies.flameproofMoveSide.key,
    hit: assetGroups.enemies.flameproofHitSide.key,
    death: assetGroups.enemies.flameproofDeathSide.key,
  },
} as const satisfies Record<EnemyId, Record<EnemyAnimationName, string>>;

export interface EnemySpritePresentation {
  readonly displaySize: number
  readonly groundOffsetY: number
  readonly hpOffsetY: number
  readonly verticalHpOffsetY: number
  readonly hpWidth: number
  readonly labelOffsetY: number
  readonly shadowWidth: number
  readonly shadowHeight: number
  readonly flyingCue?: true
}

const NORMAL_ENEMY_DISPLAY_SCALE = 1.1;

const enemySpritePresentations: Record<EnemyId, EnemySpritePresentation> = {
  grunt: scaleEnemySpritePresentation({
    displaySize: 44,
    groundOffsetY: 14,
    hpOffsetY: 36,
    verticalHpOffsetY: 38,
    hpWidth: 22,
    labelOffsetY: 17,
    shadowWidth: 17,
    shadowHeight: 6,
  }),
  swarm: scaleEnemySpritePresentation({
    displaySize: 58,
    groundOffsetY: 20,
    hpOffsetY: 20,
    verticalHpOffsetY: 25,
    hpWidth: 31,
    labelOffsetY: 25,
    shadowWidth: 25,
    shadowHeight: 8,
  }),
  tank: scaleEnemySpritePresentation({
    displaySize: 56,
    groundOffsetY: 17,
    hpOffsetY: 45,
    verticalHpOffsetY: 44,
    hpWidth: 29,
    labelOffsetY: 21,
    shadowWidth: 25,
    shadowHeight: 7,
  }),
  flyer: scaleEnemySpritePresentation({
    displaySize: 70,
    groundOffsetY: 5,
    hpOffsetY: 46,
    verticalHpOffsetY: 53,
    hpWidth: 32,
    labelOffsetY: 30,
    shadowWidth: 26,
    shadowHeight: 7,
    flyingCue: true,
  }),
  runner: scaleEnemySpritePresentation({
    displaySize: 76,
    groundOffsetY: 21,
    hpOffsetY: 30,
    verticalHpOffsetY: 28,
    hpWidth: 34,
    labelOffsetY: 28,
    shadowWidth: 34,
    shadowHeight: 9,
  }),
  insulated: scaleEnemySpritePresentation({
    displaySize: 56,
    groundOffsetY: 17,
    hpOffsetY: 42,
    verticalHpOffsetY: 44,
    hpWidth: 29,
    labelOffsetY: 21,
    shadowWidth: 25,
    shadowHeight: 7,
  }),
  flameproof: scaleEnemySpritePresentation({
    displaySize: 66,
    groundOffsetY: 17,
    hpOffsetY: 28,
    verticalHpOffsetY: 30,
    hpWidth: 32,
    labelOffsetY: 23,
    shadowWidth: 35,
    shadowHeight: 8,
  }),
};

export function getEnemySpritePresentation(enemyId: EnemyId): EnemySpritePresentation {
  return enemySpritePresentations[enemyId];
}

interface LiveEnemySpriteEntry {
  readonly sprite: Phaser.GameObjects.Sprite
  readonly label: Phaser.GameObjects.Text
}

interface DeathSpriteEntry {
  readonly sprite: Phaser.GameObjects.Sprite
  readonly enemyId: EnemyId
  readonly pathProgress: number
  readonly startedAtMs: number
}

export function getEnemyAnimationTextureKey(
  enemyId: EnemyId,
  animationName: EnemyAnimationName,
  direction: EnemyAnimationDirection = "side",
): string {
  if (direction !== "side") {
    return direction satisfies never;
  }

  return enemyAnimationTextureKeys[enemyId][animationName];
}

export function getEnemyPhaserAnimationKey(
  enemyId: EnemyId,
  animationName: EnemyAnimationName,
  direction: EnemyAnimationDirection = "side",
): string {
  return `${getEnemyAnimationTextureKey(enemyId, animationName, direction)}.anim`;
}

export function registerEnemyAnimations(scene: Phaser.Scene): void {
  (Object.keys(enemyAnimationTextureKeys) as EnemyId[]).forEach((enemyId) => {
    enemyAnimationNames.forEach((animationName) => {
      const key = getEnemyPhaserAnimationKey(enemyId, animationName);

      if (scene.anims.exists(key)) {
        return;
      }

      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(getEnemyAnimationTextureKey(enemyId, animationName), {
          start: 0,
          end: 3,
        }),
        frameRate: getFrameRate(animationName, enemyId),
        repeat: animationName === "move" ? -1 : 0,
      });
    });
  });
}

export class RunSceneEnemyPresenter {
  private readonly liveSprites = new Map<string, LiveEnemySpriteEntry>();
  private readonly deathSprites: DeathSpriteEntry[] = [];
  private readonly hitUntilMs = new Map<string, number>();
  private readonly renderPoint = { x: 0, y: 0 };

  constructor(private readonly scene: Phaser.Scene) {}

  queue(events: readonly GamePresentationEvent[], snapshot: GameSnapshot, visualMs: number): void {
    events.forEach((event) => {
      if (event.type === "enemyDamaged") {
        this.hitUntilMs.set(event.enemyInstanceId, visualMs + 220);
        return;
      }

      if (event.type !== "enemyKilled") {
        return;
      }

      const sprite = this.createSprite(event.enemyId).setVisible(true);

      sprite.play(getEnemyPhaserAnimationKey(event.enemyId, "death"));
      this.deathSprites.push({
        sprite,
        enemyId: event.enemyId,
        pathProgress: event.pathProgress,
        startedAtMs: visualMs,
      });
      this.liveSprites.get(event.enemyInstanceId)?.sprite.setVisible(false);
      this.liveSprites.get(event.enemyInstanceId)?.label.setVisible(false);
      writePathProgressPosition(snapshot.board.pathCells, event.pathProgress, this.renderPoint);
      this.positionSprite(sprite, event.enemyId, this.renderPoint, getEnemySideFacing(snapshot.board.pathCells, event.pathProgress), visualMs);
    });
  }

  render(
    graphics: Phaser.GameObjects.Graphics,
    snapshot: GameSnapshot,
    visualMs: number,
    entryIntro: RunSceneEntryIntro,
  ): void {
    const activeEnemyIds = new Set(snapshot.livingEnemies.map(enemy => enemy.id));
    const labeledEnemyIds = new Set<EnemyId>();

    entryIntro.pruneEnemies(snapshot.livingEnemies);
    this.liveSprites.forEach((entry, enemyInstanceId) => {
      if (!activeEnemyIds.has(enemyInstanceId)) {
        entry.sprite.setVisible(false);
        entry.label.setVisible(false);
      }
    });

    snapshot.livingEnemies.forEach((enemy) => {
      const entry = this.getLiveSpriteEntry(enemy);
      const introProgress = entryIntro.getEnemyProgress(enemy.id, visualMs);
      const position = introProgress < 1
        ? writeEnemyIntroPosition(snapshot.board.pathCells, enemy, introProgress, this.renderPoint)
        : writeEnemyPosition(snapshot.board.pathCells, enemy, this.renderPoint);
      const facing = getEnemySideFacing(snapshot.board.pathCells, enemy.pathProgress);
      const presentation = enemySpritePresentations[enemy.enemyId];
      const animationName = this.getLiveAnimationName(enemy, visualMs);

      this.renderShadowAndCue(graphics, enemy.enemyId, position);
      this.renderHpBar(graphics, snapshot.board.pathCells, enemy, position);
      this.positionSprite(entry.sprite, enemy.enemyId, position, facing, visualMs);
      this.playAnimation(entry.sprite, enemy.enemyId, animationName);
      const showEnemyLabel = !labeledEnemyIds.has(enemy.enemyId);

      labeledEnemyIds.add(enemy.enemyId);
      entry.label
        .setVisible(showEnemyLabel)
        .setPosition(position.x, position.y + presentation.labelOffsetY)
        .setText(enemy.displayName);
    });

    this.renderDeathSprites(snapshot, visualMs);
  }

  private renderDeathSprites(snapshot: GameSnapshot, visualMs: number): void {
    const deathTtlMs = 620;

    for (let index = this.deathSprites.length - 1; index >= 0; index -= 1) {
      const entry = this.deathSprites[index]!;
      const ageMs = visualMs - entry.startedAtMs;

      if (ageMs >= deathTtlMs) {
        entry.sprite.setVisible(false);
        this.deathSprites.splice(index, 1);
        continue;
      }

      writePathProgressPosition(snapshot.board.pathCells, entry.pathProgress, this.renderPoint);
      this.positionSprite(
        entry.sprite,
        entry.enemyId,
        this.renderPoint,
        getEnemySideFacing(snapshot.board.pathCells, entry.pathProgress),
        visualMs,
      );
      entry.sprite.setAlpha(1 - clamp((ageMs - 420) / 200, 0, 0.65));
    }
  }

  private getLiveSpriteEntry(enemy: EnemyState): LiveEnemySpriteEntry {
    const existing = this.liveSprites.get(enemy.id);

    if (existing) {
      return existing;
    }

    const sprite = this.createSprite(enemy.enemyId);
    const label = this.scene.add.text(0, 0, "", {
      align: "center",
      color: "#ead8b4",
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
      fontStyle: "700",
    }).setOrigin(0.5).setDepth(42);
    const entry = { sprite, label };

    this.liveSprites.set(enemy.id, entry);

    return entry;
  }

  private createSprite(enemyId: EnemyId): Phaser.GameObjects.Sprite {
    return this.scene.add.sprite(0, 0, getEnemyAnimationTextureKey(enemyId, "move"), 0)
      .setOrigin(0.5, 1)
      .setVisible(false);
  }

  private positionSprite(
    sprite: Phaser.GameObjects.Sprite,
    enemyId: EnemyId,
    position: { readonly x: number, readonly y: number },
    facing: "left" | "right",
    visualMs: number,
  ): void {
    const presentation = enemySpritePresentations[enemyId];
    const bob = enemyId === "flyer" ? Math.sin(visualMs / 120) * 2 : 0;

    sprite
      .setVisible(true)
      .setPosition(position.x, position.y + presentation.groundOffsetY + bob)
      .setDisplaySize(presentation.displaySize, presentation.displaySize)
      .setFlipX(facing === "left")
      .setDepth(21 + position.y / 10000)
      .setAlpha(0.99);
  }

  private playAnimation(sprite: Phaser.GameObjects.Sprite, enemyId: EnemyId, animationName: EnemyAnimationName): void {
    const key = getEnemyPhaserAnimationKey(enemyId, animationName);

    if (sprite.anims.currentAnim?.key === key && sprite.anims.isPlaying) {
      return;
    }

    sprite.play(key);
  }

  private getLiveAnimationName(enemy: EnemyState, visualMs: number): EnemyAnimationName {
    const hitUntilMs = this.hitUntilMs.get(enemy.id) ?? 0;

    if (visualMs < hitUntilMs) {
      return "hit";
    }

    this.hitUntilMs.delete(enemy.id);

    return "move";
  }

  private renderShadowAndCue(
    graphics: Phaser.GameObjects.Graphics,
    enemyId: EnemyId,
    position: { readonly x: number, readonly y: number },
  ): void {
    const presentation = enemySpritePresentations[enemyId];

    graphics.fillStyle(0x070504, enemyId === "flyer" ? 0.2 : 0.34);
    graphics.fillEllipse(position.x, position.y + scaleEnemyVisualValue(24), presentation.shadowWidth, presentation.shadowHeight);

    if (!presentation.flyingCue) {
      return;
    }

    graphics.lineStyle(2, 0xCBEAFF, 0.48);
    graphics.strokeEllipse(position.x, position.y + scaleEnemyVisualValue(20), scaleEnemyVisualValue(48), scaleEnemyVisualValue(14));
    graphics.lineStyle(1, 0xFFFFFF, 0.34);
    graphics.beginPath();
    graphics.moveTo(position.x - scaleEnemyVisualValue(16), position.y + scaleEnemyVisualValue(24));
    graphics.lineTo(position.x - scaleEnemyVisualValue(22), position.y + scaleEnemyVisualValue(16));
    graphics.moveTo(position.x + scaleEnemyVisualValue(14), position.y + scaleEnemyVisualValue(24));
    graphics.lineTo(position.x + scaleEnemyVisualValue(21), position.y + scaleEnemyVisualValue(15));
    graphics.strokePath();
  }

  private renderHpBar(
    graphics: Phaser.GameObjects.Graphics,
    cells: readonly PathCell[],
    enemy: EnemyState,
    position: { readonly x: number, readonly y: number },
  ): void {
    const presentation = enemySpritePresentations[enemy.enemyId];
    const width = presentation.hpWidth;
    const x = position.x - width / 2;
    const hpOffsetY = getPathSegmentAxis(cells, enemy.pathProgress) === "vertical"
      ? presentation.verticalHpOffsetY
      : presentation.hpOffsetY;
    const y = position.y - hpOffsetY;
    const hpRatio = clamp(enemy.hp / enemy.maxHp, 0, 1);

    graphics.fillStyle(0x101217, 0.95);
    graphics.fillRoundedRect(x - 2, y - 2, width + 4, 7, 3);
    graphics.fillStyle(0xCDE6A7, 1);
    graphics.fillRoundedRect(x, y, width * hpRatio, 3, 2);
  }
}

function getFrameRate(animationName: EnemyAnimationName, enemyId: EnemyId): number {
  if (animationName === "move") {
    return enemyId === "tank" || enemyId === "insulated" ? 6 : 8;
  }

  return animationName === "hit" ? 10 : 7;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scaleEnemySpritePresentation(presentation: EnemySpritePresentation): EnemySpritePresentation {
  return {
    ...presentation,
    displaySize: scaleEnemyVisualValue(presentation.displaySize),
    groundOffsetY: scaleEnemyVisualValue(presentation.groundOffsetY),
    hpOffsetY: scaleEnemyVisualValue(presentation.hpOffsetY),
    verticalHpOffsetY: scaleEnemyVisualValue(presentation.verticalHpOffsetY),
    hpWidth: scaleEnemyVisualValue(presentation.hpWidth),
    labelOffsetY: scaleEnemyVisualValue(presentation.labelOffsetY),
    shadowWidth: scaleEnemyVisualValue(presentation.shadowWidth),
    shadowHeight: scaleEnemyVisualValue(presentation.shadowHeight),
  };
}

function scaleEnemyVisualValue(value: number): number {
  return Math.round(value * NORMAL_ENEMY_DISPLAY_SCALE);
}

function getPathSegmentAxis(cells: readonly PathCell[], pathProgress: number): "horizontal" | "vertical" {
  if (cells.length < 2) {
    return "horizontal";
  }

  const normalizedProgress = ((pathProgress % cells.length) + cells.length) % cells.length;
  const currentIndex = Math.floor(normalizedProgress) % cells.length;
  const current = cells[currentIndex] ?? cells[0];
  const next = cells[(currentIndex + 1) % cells.length] ?? current;

  return Math.abs(next.y - current.y) > Math.abs(next.x - current.x) ? "vertical" : "horizontal";
}
