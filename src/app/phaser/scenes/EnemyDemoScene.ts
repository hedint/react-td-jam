import type { EnemyId } from "@entities/game-session/model/types";
import { gameConfig } from "@entities/game-session/model/config";
import { assetGroups } from "@shared/assets/manifest";
import Phaser from "phaser";
import {
  bossSpritePresentation,
  getBossAnimationTextureKey,
  getBossPhaserAnimationKey,
  registerBossAnimations,
} from "./runSceneBossPresenter";
import {
  getEnemyAnimationTextureKey,
  getEnemyPhaserAnimationKey,
  getEnemySpritePresentation,
  registerEnemyAnimations,
} from "./runSceneEnemyPresenter";

type RoadAxis = "horizontal" | "vertical";

interface EnemyDemoView {
  readonly enemyId: EnemyId
  readonly axis: RoadAxis
  readonly sprite: Phaser.GameObjects.Sprite
  readonly label: Phaser.GameObjects.Text
}

const ROAD_TILE_OVERLAP = 6;
const VERTICAL_ROAD_RIGHT_GUTTER = 50;
const VERTICAL_ROAD_Y_OFFSET = -100;
const ENEMY_IDS = ["grunt", "swarm", "tank", "flyer", "runner", "insulated", "flameproof"] as const satisfies readonly EnemyId[];

export class EnemyDemoScene extends Phaser.Scene {
  private backgroundGraphics?: Phaser.GameObjects.Graphics;
  private overlayGraphics?: Phaser.GameObjects.Graphics;
  private titleText?: Phaser.GameObjects.Text;
  private subtitleText?: Phaser.GameObjects.Text;
  private bossSprite?: Phaser.GameObjects.Sprite;
  private bossLabel?: Phaser.GameObjects.Text;
  private bossTowerBase?: Phaser.GameObjects.Image;
  private bossTowerHead?: Phaser.GameObjects.Image;
  private readonly roadSprites: Phaser.GameObjects.Image[] = [];
  private readonly enemyViews: EnemyDemoView[] = [];

  constructor() {
    super("EnemyDemoScene");
  }

  create(): void {
    registerEnemyAnimations(this);
    registerBossAnimations(this);
    this.backgroundGraphics = this.add.graphics().setDepth(0);
    this.overlayGraphics = this.add.graphics().setDepth(20);
    this.titleText = this.add.text(0, 0, "Enemy Demo", createTextStyle(22, "#f3ead8", "700")).setOrigin(0.5).setDepth(40);
    this.subtitleText = this.add.text(0, 0, "Горизонтальная и вертикальная дорога с боевым размером тайла", createTextStyle(12, "#b9aa91", "600"))
      .setOrigin(0.5)
      .setDepth(40);

    ENEMY_IDS.forEach((enemyId) => {
      this.enemyViews.push(this.createEnemyView(enemyId, "horizontal"));
      this.enemyViews.push(this.createEnemyView(enemyId, "vertical"));
    });

    this.createBossView();
  }

  update(time: number): void {
    this.renderBackground();
    this.layoutDemo(time);
  }

  private createEnemyView(enemyId: EnemyId, axis: RoadAxis): EnemyDemoView {
    const sprite = this.add.sprite(0, 0, getEnemyAnimationTextureKey(enemyId, "move"), 0)
      .setOrigin(0.5, 1)
      .setDepth(24);
    const label = this.add.text(0, 0, getEnemyDisplayName(enemyId), createTextStyle(12, "#ead8b4", "700"))
      .setOrigin(0.5)
      .setDepth(31);

    sprite.play(getEnemyPhaserAnimationKey(enemyId, "move"));

    return {
      enemyId,
      axis,
      sprite,
      label,
    };
  }

  private renderBackground(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const graphics = this.backgroundGraphics;

    if (!graphics) {
      return;
    }

    graphics.clear();
    graphics.fillGradientStyle(0x151923, 0x151923, 0x241D18, 0x101217, 1);
    graphics.fillRect(0, 0, width, height);
    graphics.lineStyle(1, 0xFFFFFF, 0.035);

    for (let x = 0; x <= width; x += 32) {
      graphics.lineBetween(x, 0, x, height);
    }

    for (let y = 0; y <= height; y += 32) {
      graphics.lineBetween(0, y, width, y);
    }

    graphics.lineStyle(1, 0xC8A76A, 0.22);
    graphics.strokeRoundedRect(16, 16, Math.max(1, width - 32), Math.max(1, height - 32), 10);
  }

  private layoutDemo(time: number): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const tileSize = getCombatRoadTileSize();
    const roadDisplaySize = tileSize + ROAD_TILE_OVERLAP;
    const topY = Math.max(108, height * 0.21);
    const bottomY = Math.min(height - 98, height * 0.78);
    const horizontalY = Math.round(topY);
    const verticalX = Math.round(width - VERTICAL_ROAD_RIGHT_GUTTER - roadDisplaySize / 2);
    const horizontalCells = createHorizontalRoadCells(width, horizontalY, tileSize);
    const verticalCells = createVerticalRoadCells(verticalX, horizontalY + VERTICAL_ROAD_Y_OFFSET, bottomY, tileSize);

    this.titleText?.setPosition(width / 2, 28);
    this.subtitleText?.setPosition(width / 2, 51);
    this.overlayGraphics?.clear();
    this.layoutRoadSprites(horizontalCells, "horizontal", roadDisplaySize, 0);
    this.layoutRoadSprites(verticalCells, "vertical", roadDisplaySize, horizontalCells.length);
    this.roadSprites.slice(horizontalCells.length + verticalCells.length).forEach(sprite => sprite.setVisible(false));
    this.layoutEnemyViews(horizontalCells, verticalCells, time);
    this.layoutBossView(width, height, time);
  }

  private createBossView(): void {
    this.bossTowerBase = this.add.image(0, 0, assetGroups.towers.waterCannonBase.key)
      .setOrigin(0.5)
      .setDepth(26)
      .setAlpha(0.72);
    this.bossTowerHead = this.add.image(0, 0, assetGroups.towers.waterCannonHead.key)
      .setOrigin(0.31, 0.52)
      .setDepth(27)
      .setAlpha(0.78);
    this.bossSprite = this.add.sprite(0, 0, getBossAnimationTextureKey("crawl"), 0)
      .setOrigin(0.5, 1)
      .setDepth(bossSpritePresentation.spriteDepth);
    this.bossLabel = this.add.text(0, 0, "", createTextStyle(13, "#ffe0a6", "700"))
      .setOrigin(0.5)
      .setDepth(42);
    this.bossSprite.play(getBossPhaserAnimationKey("crawl"));
  }

  private layoutRoadSprites(
    cells: readonly { readonly x: number, readonly y: number }[],
    axis: RoadAxis,
    size: number,
    startIndex: number,
  ): void {
    cells.forEach((cell, index) => {
      const sprite = this.getRoadSprite(startIndex + index);

      sprite
        .setVisible(true)
        .setTexture(assetGroups.board.roadStraight.key)
        .setPosition(cell.x, cell.y)
        .setDisplaySize(size, size)
        .setRotation(axis === "horizontal" ? Math.PI / 2 : 0)
        .setDepth(1 + cell.y / 10000);
    });
  }

  private getRoadSprite(index: number): Phaser.GameObjects.Image {
    while (this.roadSprites.length <= index) {
      this.roadSprites.push(this.add.image(0, 0, assetGroups.board.roadStraight.key).setOrigin(0.5).setDepth(1));
    }

    return this.roadSprites[index]!;
  }

  private layoutEnemyViews(
    horizontalCells: readonly { readonly x: number, readonly y: number }[],
    verticalCells: readonly { readonly x: number, readonly y: number }[],
    time: number,
  ): void {
    const horizontalPositions = distributeAlongCells(horizontalCells, ENEMY_IDS.length, 0.5);
    const verticalPositions = distributeAlongCells(verticalCells, ENEMY_IDS.length, 0.5);
    const seenLabels = new Set<string>();

    this.enemyViews.forEach((view) => {
      const positions = view.axis === "horizontal" ? horizontalPositions : verticalPositions;
      const position = positions[ENEMY_IDS.indexOf(view.enemyId)];

      if (!position) {
        view.sprite.setVisible(false);
        view.label.setVisible(false);
        return;
      }

      this.layoutEnemyView(view, position, time);
      this.renderHpBar(view.enemyId, view.axis, position);

      const labelKey = `${view.axis}-${view.enemyId}`;
      const shouldShowLabel = !seenLabels.has(labelKey);

      seenLabels.add(labelKey);
      view.label
        .setVisible(shouldShowLabel)
        .setPosition(position.x, position.y + getEnemySpritePresentation(view.enemyId).labelOffsetY)
        .setText(getEnemyDisplayName(view.enemyId));
    });
  }

  private layoutEnemyView(
    view: EnemyDemoView,
    position: { readonly x: number, readonly y: number },
    time: number,
  ): void {
    const presentation = getEnemySpritePresentation(view.enemyId);
    const bob = view.enemyId === "flyer" ? Math.sin(time / 120) * 2 : 0;

    view.sprite
      .setVisible(true)
      .setPosition(position.x, position.y + presentation.groundOffsetY + bob)
      .setDisplaySize(presentation.displaySize, presentation.displaySize)
      .setFlipX(false)
      .setDepth(24 + position.y / 10000);
  }

  private renderHpBar(
    enemyId: EnemyId,
    axis: RoadAxis,
    position: { readonly x: number, readonly y: number },
  ): void {
    const graphics = this.overlayGraphics;
    const presentation = getEnemySpritePresentation(enemyId);

    if (!graphics) {
      return;
    }

    const width = presentation.hpWidth;
    const x = position.x - width / 2;
    const y = position.y - (axis === "vertical" ? presentation.verticalHpOffsetY : presentation.hpOffsetY);

    graphics.fillStyle(0x101217, 0.95);
    graphics.fillRoundedRect(x - 2, y - 2, width + 4, 7, 3);
    graphics.fillStyle(0xCDE6A7, 1);
    graphics.fillRoundedRect(x, y, width * 0.72, 3, 2);
  }

  private layoutBossView(width: number, height: number, time: number): void {
    const sprite = this.bossSprite;
    const label = this.bossLabel;
    const graphics = this.overlayGraphics;

    if (!sprite || !label || !graphics) {
      return;
    }

    const position = {
      x: Math.round(width * 0.42),
      y: Math.round(Math.min(height - 82, Math.max(430, height * 0.66))),
    };
    const pulse = Math.sin(time / 260) * 2;

    graphics.fillStyle(0x15100D, 0.7);
    graphics.fillRoundedRect(position.x - 134, position.y - 39, 268, 78, 12);
    graphics.lineStyle(1, 0xC8A76A, 0.2);
    graphics.strokeRoundedRect(position.x - 134, position.y - 39, 268, 78, 12);
    graphics.fillStyle(0x050403, 0.42);
    graphics.fillEllipse(position.x, position.y + 33, bossSpritePresentation.shadowWidth, bossSpritePresentation.shadowHeight);

    this.bossTowerBase
      ?.setVisible(true)
      .setPosition(position.x + 30, position.y + 2)
      .setDisplaySize(82, 82)
      .setDepth(26 + position.y / 10000);
    this.bossTowerHead
      ?.setVisible(true)
      .setPosition(position.x + 30, position.y + 2)
      .setDisplaySize(92, 92)
      .setDepth(27 + position.y / 10000);

    sprite
      .setVisible(true)
      .setPosition(position.x, position.y + bossSpritePresentation.groundOffsetY + pulse)
      .setDisplaySize(bossSpritePresentation.displaySize, bossSpritePresentation.displaySize)
      .setDepth(bossSpritePresentation.spriteDepth + position.y / 10000);
    label
      .setVisible(true)
      .setPosition(position.x, position.y + bossSpritePresentation.labelOffsetY)
      .setText(`${gameConfig.boss.displayName} · ${gameConfig.boss.hp} HP`);
    this.renderBossHpBar(position);
  }

  private renderBossHpBar(position: { readonly x: number, readonly y: number }): void {
    const graphics = this.overlayGraphics;

    if (!graphics) {
      return;
    }

    const width = bossSpritePresentation.hpBarWidth;
    const fillInsetX = bossSpritePresentation.hpBarFillInsetX;
    const fillWidth = width - fillInsetX * 2;
    const top = position.y - bossSpritePresentation.hpBarOffsetY;

    graphics.fillStyle(0x101217, 0.96);
    graphics.fillRoundedRect(position.x - width / 2, top, width, bossSpritePresentation.hpBarHeight, 3);
    graphics.fillStyle(0xECA35E, 1);
    graphics.fillRoundedRect(position.x - width / 2 + fillInsetX, top + 3, fillWidth * 0.72, 4, 2);
  }
}

function createHorizontalRoadCells(
  width: number,
  y: number,
  tileSize: number,
): readonly { readonly x: number, readonly y: number }[] {
  const count = Math.max(7, ENEMY_IDS.length + 1);
  const totalWidth = (count - 1) * tileSize;
  const startX = Math.round(width / 2 - totalWidth / 2);

  return Array.from({ length: count }, (_, index) => ({
    x: startX + index * tileSize,
    y,
  }));
}

function createVerticalRoadCells(
  x: number,
  topY: number,
  bottomY: number,
  tileSize: number,
): readonly { readonly x: number, readonly y: number }[] {
  const availableHeight = Math.max(tileSize * (ENEMY_IDS.length + 1), bottomY - topY);
  const count = Math.max(8, Math.floor(availableHeight / tileSize) + 1);
  const startY = Math.round(topY);

  return Array.from({ length: count }, (_, index) => ({
    x,
    y: startY + index * tileSize,
  }));
}

function distributeAlongCells(
  cells: readonly { readonly x: number, readonly y: number }[],
  count: number,
  insetCells: number,
): readonly { readonly x: number, readonly y: number }[] {
  const first = insetCells;
  const last = Math.max(first, cells.length - 1 - insetCells);

  return Array.from({ length: count }, (_, index) => {
    const amount = count === 1 ? 0 : index / (count - 1);
    const progress = first + (last - first) * amount;
    const currentIndex = Math.min(cells.length - 2, Math.max(0, Math.floor(progress)));
    const nextIndex = Math.min(cells.length - 1, currentIndex + 1);
    const current = cells[currentIndex] ?? cells[0]!;
    const next = cells[nextIndex] ?? current;
    const segmentAmount = progress - Math.floor(progress);

    return {
      x: Phaser.Math.Linear(current.x, next.x, segmentAmount),
      y: Phaser.Math.Linear(current.y, next.y, segmentAmount),
    };
  });
}

function getCombatRoadTileSize(): number {
  const distances = gameConfig.board.pathCells
    .flatMap((cell, index) => {
      const next = gameConfig.board.pathCells[(index + 1) % gameConfig.board.pathCells.length];

      if (!next) {
        return [];
      }

      return [Math.hypot(next.x - cell.x, next.y - cell.y)];
    })
    .filter(distance => distance > 0);

  return Math.round(distances.length > 0 ? Math.min(...distances) : 76);
}

function getEnemyDisplayName(enemyId: EnemyId): string {
  return gameConfig.enemies.find(enemy => enemy.id === enemyId)?.displayName ?? enemyId;
}

function createTextStyle(size: number, color: string, fontWeight: string): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    align: "center",
    color,
    fontFamily: "Inter, Segoe UI, Arial, sans-serif",
    fontSize: `${size}px`,
    fontStyle: fontWeight,
    stroke: "#070707",
    strokeThickness: 3,
  };
}
