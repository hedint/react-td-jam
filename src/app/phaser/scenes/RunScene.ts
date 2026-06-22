import type { BoardSlot, GameSnapshot, TowerState } from "@entities/game-session/model/types";
import type { Unsubscribe } from "@shared/lib/event-bus/createTypedEventBus";
import { createFixedStepDriver } from "@entities/game-session/model/fixedStepDriver";
import { hasSavedRun, saveRun } from "@entities/game-session/model/persistence";
import { applyAction, createRun, createSnapshot, stepRun } from "@entities/game-session/model/simulation";
import { assetGroups } from "@shared/assets/manifest";
import { gameEvents } from "@shared/lib/event-bus/gameEvents";
import Phaser from "phaser";
import {
  renderBoardFrame,
  renderBoardSlots,
  renderDynamicPath,
  renderGateMarker,
  renderGreatCube,
  renderPlacementSlotFeedback,
} from "./runSceneBoardRender";
import { RunSceneReactionPresenter } from "./runSceneReactionPresenter";
import { RunSceneReagentPresenter } from "./runSceneReagentRender";
import {
  findSlotAtPoint,
  getActiveReactionLabel,
  getEnemyVisual,
  renderEnemyAccent,
  writeBossPosition,
  writeEnemyPosition,
  writeTowerPosition,
} from "./runSceneRender";
import {
  getTowerDirectionRotation,
  getTowerFieldLabel,
  getTowerHeadSwayRotation,
  getTowerSpriteRenderConfig,
  getTowerSpriteSize,
  renderTowerGrounding,
  TOWER_HEAD_ORIGIN_Y,
} from "./runSceneTowerRender";

const LOGICAL_WIDTH = 540;
const LOGICAL_HEIGHT = 960;
const TICK_STEP_MS = 1000 / 30;

export class RunScene extends Phaser.Scene {
  private readonly driver = createFixedStepDriver({
    initialState: createRun(),
    stepMs: TICK_STEP_MS,
    step: stepRun,
  });

  private worldGraphics?: Phaser.GameObjects.Graphics;
  private effectGraphics?: Phaser.GameObjects.Graphics;
  private enemyGraphics?: Phaser.GameObjects.Graphics;
  private placementGraphics?: Phaser.GameObjects.Graphics;
  private backdropFloor?: Phaser.GameObjects.Image;
  private backdropAtmosphere?: Phaser.GameObjects.Image;
  private titleText?: Phaser.GameObjects.Text;
  private coreText?: Phaser.GameObjects.Text;
  private reactionText?: Phaser.GameObjects.Text;
  private bossLabel?: Phaser.GameObjects.Text;
  private enemyLabels: Phaser.GameObjects.Text[] = [];
  private towerLabels: Phaser.GameObjects.Text[] = [];
  private towerSprites: Phaser.GameObjects.Image[] = [];
  private towerHeadSprites: Phaser.GameObjects.Image[] = [];
  private reagentPresenter?: RunSceneReagentPresenter;
  private reactionPresenter?: RunSceneReactionPresenter;
  private readonly bossPosition = { x: 0, y: 0 };
  private readonly enemyPosition = { x: 0, y: 0 };
  private readonly towerPosition = { x: 0, y: 0 };
  private unsubscribeAction?: Unsubscribe;
  private unsubscribeLoad?: Unsubscribe;
  private autosaveMs = 0;
  private autosaveEnabled = !hasSavedRun();

  constructor() {
    super("RunScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#101217");
    this.backdropFloor = this.add.image(0, 0, assetGroups.scene.cavernFortressFloor.key)
      .setOrigin(0)
      .setDepth(-30);
    this.backdropAtmosphere = this.add.image(0, 0, assetGroups.scene.cavernFortressAtmosphere.key)
      .setOrigin(0)
      .setDepth(-20);
    this.worldGraphics = this.add.graphics().setDepth(0);
    this.effectGraphics = this.add.graphics().setDepth(10);
    this.enemyGraphics = this.add.graphics().setDepth(20);
    this.placementGraphics = this.add.graphics().setDepth(35);
    this.reagentPresenter = new RunSceneReagentPresenter(this);
    this.reactionPresenter = new RunSceneReactionPresenter(this);

    this.titleText = this.add.text(LOGICAL_WIDTH / 2, 122, "Осадная галерея", {
      align: "center",
      color: "#f3ead8",
      fontFamily: "Arial, sans-serif",
      fontSize: "24px",
      fontStyle: "700",
    }).setOrigin(0.5).setDepth(40);

    this.coreText = this.add.text(LOGICAL_WIDTH / 2, 480, "", {
      align: "center",
      color: "#ffe0a6",
      fontFamily: "Arial, sans-serif",
      fontSize: "18px",
      fontStyle: "700",
    }).setOrigin(0.5).setDepth(42);

    this.reactionText = this.add.text(LOGICAL_WIDTH / 2, 692, "", {
      align: "center",
      color: "#b9fbff",
      fontFamily: "Arial, sans-serif",
      fontSize: "18px",
      fontStyle: "700",
    }).setOrigin(0.5).setDepth(42);

    this.bossLabel = this.add.text(0, 0, "", {
      align: "center",
      color: "#ffe0a6",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "700",
    }).setOrigin(0.5).setDepth(42);

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const tap = {
        x: Math.round(pointer.worldX),
        y: Math.round(pointer.worldY),
      };
      const slot = findSlotAtPoint(this.driver.state.board.slots, tap.x, tap.y);

      this.driver.replaceState(applyAction(this.driver.state, { type: "tap", point: tap }));
      if (slot) {
        this.driver.replaceState(applyAction(this.driver.state, { type: "tapSlot", slotId: slot.id }));
        this.autosaveEnabled = true;
        this.saveCurrentRun();
      }
      gameEvents.emit("pointer:tap", tap);
      this.renderSnapshot(createSnapshot(this.driver.state));
      this.publishSnapshot();
    });

    this.unsubscribeAction = gameEvents.on("run:action", (action) => {
      this.driver.replaceState(applyAction(this.driver.state, action));
      this.autosaveEnabled = true;
      this.saveCurrentRun();
      this.renderSnapshot(createSnapshot(this.driver.state));
      this.publishSnapshot();
    });
    this.unsubscribeLoad = gameEvents.on("run:load", (state) => {
      this.driver.replaceState(state);
      this.autosaveEnabled = true;
      this.saveCurrentRun();
      this.renderSnapshot(createSnapshot(this.driver.state));
      this.publishSnapshot();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeAction?.();
      this.unsubscribeLoad?.();
    });

    this.scale.on("resize", this.handleResize, this);
    this.handleResize();
    this.renderSnapshot(createSnapshot(this.driver.state));
    this.publishSnapshot();
  }

  update(_time: number, deltaMs: number): void {
    const state = this.driver.stepFrame(deltaMs);
    const snapshot = createSnapshot(state);

    this.renderSnapshot(snapshot);
    this.publishSnapshot(snapshot);
    this.autosaveMs += deltaMs;

    if (this.autosaveMs >= 1000) {
      this.saveCurrentRun();
      this.autosaveMs = 0;
    }
  }

  private handleResize(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const zoom = Math.min(width / LOGICAL_WIDTH, height / LOGICAL_HEIGHT);

    this.cameras.main.setViewport(0, 0, width, height);
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);

    gameEvents.emit("viewport:resize", { width, height });
  }

  private renderSnapshot(snapshot: GameSnapshot): void {
    this.renderBoard(snapshot);
    this.renderReagents(snapshot);
    this.renderEffects(snapshot);
    this.renderEnemies(snapshot);
    this.renderBoss(snapshot);
    this.renderTowers(snapshot.placedTowers, snapshot.board.slots, snapshot.board.pathCells, snapshot.selectedTowerId, this.time.now);
    this.renderPlacementFeedback(snapshot);

    if (this.coreText) {
      this.coreText.setText(`Великий Куб: ${snapshot.coreHp}`);
    }

    if (this.reactionText) {
      this.reactionText.setText(getActiveReactionLabel(snapshot.activeReactions));
      this.reactionText.setAlpha(0.82 + Math.sin(snapshot.elapsedMs / 120) * 0.18);
    }
  }

  private renderBoard(snapshot: GameSnapshot): void {
    const graphics = this.worldGraphics;
    if (!graphics) {
      return;
    }

    graphics.clear();

    const cells = snapshot.board.pathCells;
    this.backdropAtmosphere?.setAlpha(getAtmosphereAlpha(snapshot));
    renderBoardFrame(graphics);
    renderDynamicPath(graphics, cells, snapshot.elapsedMs);
    renderGateMarker(graphics, cells, snapshot.elapsedMs);
    renderGreatCube(graphics, snapshot);
    renderBoardSlots(graphics, snapshot);
  }

  private renderEffects(snapshot: GameSnapshot): void {
    const graphics = this.effectGraphics;
    if (!graphics) {
      return;
    }

    this.reactionPresenter?.render(graphics, snapshot);
  }

  private renderReagents(snapshot: GameSnapshot): void {
    this.reagentPresenter?.render(snapshot);
  }

  private renderPlacementFeedback(snapshot: GameSnapshot): void {
    const graphics = this.placementGraphics;
    if (!graphics) {
      return;
    }

    graphics.clear();
    renderPlacementSlotFeedback(graphics, snapshot, this.time.now);
  }

  private renderEnemies(snapshot: GameSnapshot): void {
    const graphics = this.enemyGraphics;
    if (!graphics) {
      return;
    }

    graphics.clear();

    while (this.enemyLabels.length < snapshot.livingEnemies.length) {
      this.enemyLabels.push(this.add.text(0, 0, "", {
        align: "center",
        color: "#ead8b4",
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        fontStyle: "700",
      }).setOrigin(0.5).setDepth(42));
    }

    snapshot.livingEnemies.forEach((enemy, index) => {
      const position = writeEnemyPosition(snapshot.board.pathCells, enemy, this.enemyPosition);
      const hpRatio = enemy.hp / enemy.maxHp;
      const label = this.enemyLabels[index];
      const visual = getEnemyVisual(enemy.enemyId);

      graphics.fillStyle(visual.fill, 1);
      graphics.lineStyle(3, visual.stroke, 0.9);
      if (visual.shape === "wing") {
        graphics.beginPath();
        graphics.moveTo(position.x, position.y - 18);
        graphics.lineTo(position.x - 25, position.y + 10);
        graphics.lineTo(position.x - 5, position.y + 4);
        graphics.lineTo(position.x, position.y + 20);
        graphics.lineTo(position.x + 5, position.y + 4);
        graphics.lineTo(position.x + 25, position.y + 10);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
      } else if (visual.shape === "diamond") {
        graphics.beginPath();
        graphics.moveTo(position.x, position.y - 20);
        graphics.lineTo(position.x + 20, position.y);
        graphics.lineTo(position.x, position.y + 20);
        graphics.lineTo(position.x - 20, position.y);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
      } else {
        graphics.fillCircle(position.x, position.y, visual.radius);
        graphics.strokeCircle(position.x, position.y, visual.radius);
      }
      renderEnemyAccent(graphics, enemy.enemyId, position, visual.radius);
      graphics.fillStyle(0x101217, 0.95);
      graphics.fillRoundedRect(position.x - 22, position.y - 34, 44, 7, 3);
      graphics.fillStyle(0xCDE6A7, 1);
      graphics.fillRoundedRect(position.x - 20, position.y - 32, 40 * hpRatio, 3, 2);

      label?.setVisible(true);
      label?.setPosition(position.x, position.y + 28);
      label?.setText(enemy.displayName);
    });

    this.enemyLabels.slice(snapshot.livingEnemies.length).forEach((label) => {
      label.setVisible(false);
    });
  }

  private renderBoss(snapshot: GameSnapshot): void {
    const graphics = this.enemyGraphics;
    if (!graphics || !snapshot.boss || snapshot.phase !== "boss") {
      this.bossLabel?.setVisible(false);
      return;
    }

    const position = writeBossPosition(snapshot.board.pathCells, snapshot.boss, this.bossPosition);
    const hpRatio = snapshot.boss.hp / snapshot.boss.maxHp;
    const vulnerable = snapshot.boss.vulnerableMs > 0;
    const pulse = 3 + Math.sin(snapshot.elapsedMs / 90) * 3;

    if (vulnerable) {
      graphics.fillStyle(0xFFF2A8, 0.2);
      graphics.fillCircle(position.x, position.y, 46 + pulse);
      graphics.lineStyle(4, 0xFFF2A8, 0.9);
      graphics.strokeCircle(position.x, position.y, 48 + pulse);
    }

    graphics.fillStyle(0x4A2419, 1);
    graphics.lineStyle(4, vulnerable ? 0xFFF2A8 : 0xE39A56, 0.95);
    graphics.fillEllipse(position.x, position.y, 74, 54);
    graphics.strokeEllipse(position.x, position.y, 74, 54);
    graphics.lineStyle(3, 0x7C3E25, 0.9);
    graphics.beginPath();
    graphics.moveTo(position.x - 30, position.y - 18);
    graphics.lineTo(position.x - 24, position.y + 22);
    graphics.moveTo(position.x + 30, position.y - 18);
    graphics.lineTo(position.x + 24, position.y + 22);
    graphics.strokePath();
    graphics.fillStyle(0x6A3320, 0.95);
    graphics.fillRoundedRect(position.x - 21, position.y - 29, 42, 9, 3);
    graphics.fillRoundedRect(position.x - 27, position.y + 20, 54, 8, 3);
    graphics.fillStyle(0x20110E, 0.95);
    graphics.fillCircle(position.x - 17, position.y - 7, 8);
    graphics.fillCircle(position.x + 17, position.y - 7, 8);
    graphics.lineStyle(3, 0x8D4B2E, 0.95);
    graphics.beginPath();
    graphics.moveTo(position.x - 27, position.y + 13);
    graphics.lineTo(position.x - 9, position.y + 24);
    graphics.lineTo(position.x + 9, position.y + 24);
    graphics.lineTo(position.x + 27, position.y + 13);
    graphics.strokePath();
    if (vulnerable) {
      graphics.lineStyle(2, 0xFFF2A8, 0.95);
      graphics.beginPath();
      graphics.moveTo(position.x - 8, position.y - 24);
      graphics.lineTo(position.x + 2, position.y - 9);
      graphics.lineTo(position.x - 3, position.y + 5);
      graphics.lineTo(position.x + 10, position.y + 18);
      graphics.strokePath();
    }

    graphics.fillStyle(0x101217, 0.96);
    graphics.fillRoundedRect(position.x - 39, position.y - 47, 78, 8, 3);
    graphics.fillStyle(vulnerable ? 0xFFF2A8 : 0xECA35E, 1);
    graphics.fillRoundedRect(position.x - 36, position.y - 45, 72 * hpRatio, 4, 2);

    this.bossLabel?.setVisible(true);
    this.bossLabel?.setPosition(position.x, position.y + 46);
    this.bossLabel?.setText(vulnerable ? "Уязвим" : `Круг ${snapshot.boss.lap}`);
  }

  private renderTowers(
    towers: readonly TowerState[],
    slots: readonly BoardSlot[],
    cells: GameSnapshot["board"]["pathCells"],
    selectedTowerId: string | null,
    visualMs: number,
  ): void {
    while (this.towerLabels.length < towers.length) {
      this.towerLabels.push(this.add.text(0, 0, "", {
        align: "center",
        color: "#f6f0df",
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        fontStyle: "700",
      }).setOrigin(0.5).setDepth(42));
    }
    while (this.towerSprites.length < towers.length) {
      this.towerSprites.push(this.add.image(0, 0, assetGroups.towers.towerSpritePlaceholder.key)
        .setOrigin(0.5)
        .setDepth(26));
    }
    while (this.towerHeadSprites.length < towers.length * 2) {
      this.towerHeadSprites.push(this.add.image(0, 0, assetGroups.towers.towerSpritePlaceholder.key).setOrigin(0.31, TOWER_HEAD_ORIGIN_Y).setDepth(27));
    }

    this.towerLabels.forEach((label, index) => {
      const tower = towers[index];
      if (!tower) {
        label.setVisible(false);
        this.towerSprites[index]?.setVisible(false);
        return;
      }

      const position = writeTowerPosition(tower, slots, this.towerPosition);
      const slot = slots.find(candidate => candidate.id === tower.slotId);
      const isSelected = tower.id === selectedTowerId;
      const sprite = this.towerSprites[index];

      const graphics = this.worldGraphics;
      if (!graphics || !slot || !sprite) {
        label.setVisible(false);
        sprite?.setVisible(false);
        return;
      }

      const spriteSize = getTowerSpriteSize(slot);
      const headSize = spriteSize * 1.14;
      const renderConfig = getTowerSpriteRenderConfig(tower, slot, cells);

      renderTowerGrounding(graphics, tower, slot, position, isSelected, visualMs);
      sprite
        .setVisible(true)
        .setTexture(renderConfig.baseKey)
        .setPosition(position.x, position.y)
        .setDisplaySize(spriteSize, spriteSize)
        .setRotation(0)
        .setDepth(26 + position.y / 10000);
      sprite.setAlpha(isSelected ? 1 : 0.96);
      for (let directionIndex = 0; directionIndex < 2; directionIndex += 1) {
        const headSprite = this.towerHeadSprites[index * 2 + directionIndex];
        const direction = renderConfig.directions[directionIndex];

        if (!headSprite || !direction) {
          headSprite?.setVisible(false);
          continue;
        }

        headSprite
          .setVisible(true)
          .setTexture(renderConfig.headKey)
          .setOrigin(renderConfig.headOriginX, TOWER_HEAD_ORIGIN_Y)
          .setPosition(position.x, position.y)
          .setDisplaySize(headSize, headSize)
          .setRotation(getTowerDirectionRotation(direction) + getTowerHeadSwayRotation(tower, slot, directionIndex, visualMs))
          .setDepth(27 + position.y / 10000)
          .setAlpha(isSelected ? 1 : 0.98);
      }

      label.setVisible(isSelected);
      label.setPosition(position.x, position.y - spriteSize * 0.52);
      label.setText(getTowerFieldLabel(tower.emitterId));
    });

    this.towerSprites.slice(towers.length).forEach(sprite => sprite.setVisible(false));
    this.towerHeadSprites.slice(towers.length * 2).forEach(sprite => sprite.setVisible(false));
  }

  private publishSnapshot(snapshot = createSnapshot(this.driver.state)): void {
    gameEvents.emit("session:snapshot", {
      ...snapshot,
      fps: Math.round(this.game.loop.actualFps),
      viewport: {
        width: this.scale.width,
        height: this.scale.height,
      },
    });
  }

  private saveCurrentRun(): void {
    if (!this.autosaveEnabled) {
      return;
    }

    saveRun(this.driver.state);
  }
}

function getAtmosphereAlpha(snapshot: GameSnapshot): number {
  const phaseAlpha = snapshot.phase === "boss"
    ? 0.96
    : snapshot.phase === "wave"
      ? 0.88
      : 0.78;

  return phaseAlpha + Math.sin(snapshot.elapsedMs / 720) * 0.04;
}
