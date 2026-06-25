import type { GamePresentationEvent } from "@entities/game-session/model/presentationEvents";
import type { GameSnapshot } from "@entities/game-session/model/types";
import type Phaser from "phaser";
import type { RunSceneEntryIntro } from "./runSceneEntryIntro";
import { gameConfig } from "@entities/game-session/model/config";
import { assetGroups } from "@shared/assets/manifest";
import { ru } from "@shared/i18n/ru";
import { getEnemySideFacing, writeBossIntroPosition, writeBossPosition } from "./runSceneRender";

export type BossAnimationName
  = | "crawl"
    | "hit"
    | "vulnerable"
    | "death"
    | "leap-prepare"
    | "leap-air"
    | "smash"
    | "blackout-cast"
    | "summon-roar";
export type BossAnimationDirection = "side";

export const bossAnimationNames = [
  "crawl",
  "hit",
  "vulnerable",
  "death",
  "leap-prepare",
  "leap-air",
  "smash",
  "blackout-cast",
  "summon-roar",
] as const satisfies readonly BossAnimationName[];
export const bossAnimationDirections = ["side"] as const satisfies readonly BossAnimationDirection[];

const bossAnimationTextureKeys = {
  "crawl": assetGroups.enemies.bossOgreCrawlSide.key,
  "hit": assetGroups.enemies.bossOgreHitSide.key,
  "vulnerable": assetGroups.enemies.bossOgreVulnerableSide.key,
  "death": assetGroups.enemies.bossOgreDeathSide.key,
  "leap-prepare": assetGroups.enemies.bossOgreLeapPrepareSide.key,
  "leap-air": assetGroups.enemies.bossOgreLeapAirSide.key,
  "smash": assetGroups.enemies.bossOgreSmashSide.key,
  "blackout-cast": assetGroups.enemies.bossOgreBlackoutCastSide.key,
  "summon-roar": assetGroups.enemies.bossOgreSummonRoarSide.key,
} as const satisfies Record<BossAnimationName, string>;

export const bossSpritePresentation = {
  displaySize: 132,
  groundOffsetY: 34,
  hpBarOffsetY: 96,
  hpBarWidth: 112,
  hpBarFillInsetX: 3,
  hpBarHeight: 9,
  labelOffsetY: 57,
  shadowWidth: 78,
  shadowHeight: 18,
  spriteDepth: 36,
  overlayDepth: 41,
} as const;

const SUPPRESSION_CELL_COLOR = 0x5B4B9E;
const DEATH_TTL_MS = 900;
const EXIT_SMASH_PREPARE_MS = gameConfig.boss.abilities.exitSmash.prepareMs;

export function getBossAnimationTextureKey(
  animationName: BossAnimationName,
  direction: BossAnimationDirection = "side",
): string {
  if (direction !== "side") {
    return direction satisfies never;
  }

  return bossAnimationTextureKeys[animationName];
}

export function getBossPhaserAnimationKey(
  animationName: BossAnimationName,
  direction: BossAnimationDirection = "side",
): string {
  return `${getBossAnimationTextureKey(animationName, direction)}.anim`;
}

export function registerBossAnimations(scene: Phaser.Scene): void {
  bossAnimationNames.forEach((animationName) => {
    const key = getBossPhaserAnimationKey(animationName);

    if (scene.anims.exists(key)) {
      return;
    }

    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(getBossAnimationTextureKey(animationName), {
        start: 0,
        end: 3,
      }),
      frameRate: getBossFrameRate(animationName),
      repeat: getBossAnimationRepeat(animationName),
    });
  });
}

export class RunSceneBossPresenter {
  private readonly overlayGraphics: Phaser.GameObjects.Graphics;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly label: Phaser.GameObjects.Text;
  private readonly renderPoint = { x: 0, y: 0 };
  private hitUntilMs = 0;
  private impactUntilMs = 0;
  private deathStartedAtMs = 0;
  private deathPathProgress = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.overlayGraphics = scene.add.graphics().setDepth(bossSpritePresentation.overlayDepth);
    this.sprite = scene.add.sprite(0, 0, getBossAnimationTextureKey("crawl"), 0)
      .setOrigin(0.5, 1)
      .setDepth(bossSpritePresentation.spriteDepth)
      .setVisible(false);
    this.label = scene.add.text(0, 0, "", {
      align: "center",
      color: "#ffe0a6",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "700",
      stroke: "#101217",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(42).setVisible(false);
  }

  queue(events: readonly GamePresentationEvent[], visualMs: number): void {
    events.forEach((event) => {
      if (event.type === "bossDamaged") {
        this.hitUntilMs = visualMs + 180;
      }

      if (event.type === "bossAbilityImpact" || event.type === "bossBreak") {
        this.impactUntilMs = visualMs + 420;
      }

      if (event.type === "bossKilled") {
        this.deathStartedAtMs = visualMs;
        this.deathPathProgress = event.pathProgress;
        this.sprite.play(getBossPhaserAnimationKey("death"));
      }
    });
  }

  render(
    graphics: Phaser.GameObjects.Graphics,
    snapshot: GameSnapshot,
    visualMs: number,
    entryIntro: RunSceneEntryIntro,
  ): void {
    this.overlayGraphics.clear();

    if (!snapshot.boss || snapshot.phase !== "boss") {
      this.sprite.setVisible(false);
      this.label.setVisible(false);
      entryIntro.clearBoss();
      this.renderDeathSprite(snapshot, visualMs);
      return;
    }

    this.renderSuppression(graphics, snapshot, visualMs);

    const introProgress = entryIntro.getBossProgress(visualMs);
    const position = introProgress < 1
      ? writeBossIntroPosition(snapshot.board.pathCells, snapshot.boss, introProgress, this.renderPoint)
      : writeBossPosition(snapshot.board.pathCells, snapshot.boss, this.renderPoint);
    const vulnerable = snapshot.boss.vulnerableMs > 0;
    const activeAbility = snapshot.boss.activeAbility?.id;
    const facing = getEnemySideFacing(snapshot.board.pathCells, snapshot.boss.pathProgress);
    const pulse = Math.sin(visualMs / 90) * 3;
    const impactPulse = visualMs < this.impactUntilMs ? 8 : 0;
    const liveAnimation = this.getLiveAnimationName(snapshot, visualMs);
    const abilityLift = liveAnimation === "leap-air" ? -24 : 0;

    this.renderShadow(graphics, position.x, position.y, activeAbility, visualMs);
    this.renderTelegraph(graphics, position.x, position.y, activeAbility, vulnerable, pulse, impactPulse);
    this.sprite
      .setVisible(true)
      .setPosition(position.x, position.y + bossSpritePresentation.groundOffsetY + abilityLift)
      .setDisplaySize(bossSpritePresentation.displaySize + impactPulse, bossSpritePresentation.displaySize + impactPulse)
      .setFlipX(facing === "left")
      .setTint(this.getTint(snapshot, visualMs))
      .setAlpha(vulnerable ? 0.92 : 0.99)
      .setDepth(bossSpritePresentation.spriteDepth + position.y / 10000);
    this.playAnimation(liveAnimation);
    this.renderHpBar(this.overlayGraphics, snapshot, position.x, position.y, vulnerable);
    this.label
      .setVisible(true)
      .setPosition(position.x, position.y + bossSpritePresentation.labelOffsetY)
      .setText(this.getLabel(snapshot));
  }

  private renderDeathSprite(snapshot: GameSnapshot, visualMs: number): void {
    if (this.deathStartedAtMs <= 0 || visualMs - this.deathStartedAtMs > DEATH_TTL_MS) {
      this.deathStartedAtMs = 0;
      return;
    }

    writeBossPosition(snapshot.board.pathCells, {
      bossId: "boss-ogre",
      pathProgress: this.deathPathProgress,
      currentCellIndex: 0,
      lap: 0,
      hp: 0,
      maxHp: 1,
      vulnerableMs: 0,
      reactionBreakIds: [],
      triggeredAbilityIds: [],
      activeAbility: null,
      suppressionRemainingMs: 0,
      summonRuntime: null,
    }, this.renderPoint);
    this.sprite
      .setVisible(true)
      .setPosition(this.renderPoint.x, this.renderPoint.y + bossSpritePresentation.groundOffsetY)
      .setDisplaySize(bossSpritePresentation.displaySize, bossSpritePresentation.displaySize)
      .setFlipX(getEnemySideFacing(snapshot.board.pathCells, this.deathPathProgress) === "left")
      .setTint(0xFFFFFF)
      .setAlpha(1 - Math.max(0, visualMs - this.deathStartedAtMs - 650) / 250)
      .setDepth(bossSpritePresentation.spriteDepth + this.renderPoint.y / 10000);
  }

  private renderSuppression(graphics: Phaser.GameObjects.Graphics, snapshot: GameSnapshot, visualMs: number): void {
    if ((snapshot.boss?.suppressionRemainingMs ?? 0) <= 0) {
      return;
    }

    const pulse = 0.55 + Math.sin(visualMs / 130) * 0.12;

    snapshot.board.pathCells
      .filter(cell => cell.index >= 10 && cell.index <= 14)
      .forEach((cell) => {
        graphics.fillStyle(SUPPRESSION_CELL_COLOR, 0.22 * pulse);
        graphics.fillRoundedRect(cell.x - 38, cell.y - 38, 76, 76, 10);
        graphics.lineStyle(3, 0xBBA8FF, 0.62 * pulse);
        graphics.strokeRoundedRect(cell.x - 38, cell.y - 38, 76, 76, 10);
        graphics.lineStyle(2, 0x1A1328, 0.7);
        graphics.beginPath();
        graphics.moveTo(cell.x - 23, cell.y + 18);
        graphics.lineTo(cell.x + 24, cell.y - 18);
        graphics.moveTo(cell.x - 16, cell.y - 22);
        graphics.lineTo(cell.x + 19, cell.y + 21);
        graphics.strokePath();
      });
  }

  private renderShadow(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    activeAbility: string | undefined,
    visualMs: number,
  ): void {
    const leapScale = activeAbility === "exitSmash" ? 0.72 + Math.sin(visualMs / 110) * 0.05 : 1;

    graphics.fillStyle(0x050403, 0.4);
    graphics.fillEllipse(x, y + 33, bossSpritePresentation.shadowWidth * leapScale, bossSpritePresentation.shadowHeight * leapScale);
  }

  private renderTelegraph(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    activeAbility: string | undefined,
    vulnerable: boolean,
    pulse: number,
    impactPulse: number,
  ): void {
    if (vulnerable) {
      graphics.fillStyle(0xFFF2A8, 0.2);
      graphics.fillCircle(x, y, 55 + pulse + impactPulse);
      graphics.lineStyle(4, 0xFFF2A8, 0.9);
      graphics.strokeCircle(x, y, 58 + pulse + impactPulse);
    }

    if (activeAbility === "exitSmash") {
      graphics.lineStyle(5, 0xFFB15E, 0.86);
      graphics.strokeCircle(x, y + 3, 64 + pulse);
      return;
    }

    if (activeAbility === "rightSideSuppression") {
      graphics.lineStyle(4, 0xBBA8FF, 0.9);
      graphics.strokeCircle(x, y + 1, 58 + pulse);
      return;
    }

    if (activeAbility === "summonWave") {
      graphics.lineStyle(5, 0xCDE6A7, 0.8);
      graphics.strokeCircle(x, y + 2, 62 + pulse);
    }
  }

  private renderHpBar(graphics: Phaser.GameObjects.Graphics, snapshot: GameSnapshot, x: number, y: number, vulnerable: boolean): void {
    const hpRatio = snapshot.boss ? snapshot.boss.hp / snapshot.boss.maxHp : 0;
    const width = bossSpritePresentation.hpBarWidth;
    const fillInsetX = bossSpritePresentation.hpBarFillInsetX;
    const fillWidth = width - fillInsetX * 2;
    const top = y - bossSpritePresentation.hpBarOffsetY;

    graphics.fillStyle(0x101217, 0.96);
    graphics.fillRoundedRect(x - width / 2, top, width, bossSpritePresentation.hpBarHeight, 3);
    graphics.fillStyle(vulnerable ? 0xFFF2A8 : 0xECA35E, 1);
    graphics.fillRoundedRect(x - width / 2 + fillInsetX, top + 3, fillWidth * hpRatio, 4, 2);
  }

  private getTint(snapshot: GameSnapshot, visualMs: number): number {
    if (visualMs < this.hitUntilMs) {
      return 0xFFE0A6;
    }

    if (snapshot.boss?.activeAbility?.id === "rightSideSuppression") {
      return 0xC9BEFF;
    }

    if (snapshot.boss?.activeAbility?.id === "summonWave") {
      return 0xCDE6A7;
    }

    return 0xFFFFFF;
  }

  private playAnimation(animationName: BossAnimationName): void {
    const key = getBossPhaserAnimationKey(animationName);

    if (this.sprite.anims.currentAnim?.key === key && this.sprite.anims.isPlaying) {
      return;
    }

    this.sprite.play(key);
  }

  private getLiveAnimationName(snapshot: GameSnapshot, visualMs: number): BossAnimationName {
    const boss = snapshot.boss;

    if (!boss) {
      return "crawl";
    }

    if (boss.activeAbility?.id === "exitSmash") {
      if (boss.activeAbility.elapsedMs < EXIT_SMASH_PREPARE_MS) {
        return "leap-prepare";
      }

      return boss.activeAbility.impactApplied ? "smash" : "leap-air";
    }

    if (boss.activeAbility?.id === "rightSideSuppression") {
      return "blackout-cast";
    }

    if (boss.activeAbility?.id === "summonWave") {
      return "summon-roar";
    }

    if (visualMs < this.hitUntilMs) {
      return "hit";
    }

    if (boss.vulnerableMs > 0) {
      return "vulnerable";
    }

    return "crawl";
  }

  private getLabel(snapshot: GameSnapshot): string {
    const boss = snapshot.boss;

    if (!boss) {
      return "";
    }

    if (boss.activeAbility?.id === "exitSmash") {
      return ru.phaser.bossExitSmash;
    }

    if (boss.activeAbility?.id === "rightSideSuppression") {
      return ru.phaser.bossSuppression;
    }

    if (boss.activeAbility?.id === "summonWave") {
      return ru.phaser.bossSummon;
    }

    return boss.vulnerableMs > 0 ? ru.phaser.bossVulnerable : ru.phaser.bossLap(boss.lap);
  }
}

function getBossFrameRate(animationName: BossAnimationName): number {
  if (animationName === "crawl") {
    return 6;
  }

  if (animationName === "death") {
    return 5;
  }

  if (animationName === "smash") {
    return 0.875;
  }

  if (animationName === "leap-prepare" || animationName === "leap-air") {
    return 3.5;
  }

  return 7;
}

function getBossAnimationRepeat(animationName: BossAnimationName): number {
  return animationName === "death" || animationName === "hit" ? 0 : -1;
}
