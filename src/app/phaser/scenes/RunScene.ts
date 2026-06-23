import type { BoardSlot, GameSnapshot, TowerState } from "@entities/game-session/model/types";
import type { Unsubscribe } from "@shared/lib/event-bus/createTypedEventBus";
import { createFixedStepDriver } from "@entities/game-session/model/fixedStepDriver";
import { hasSavedRun, saveRun } from "@entities/game-session/model/persistence";
import { applyAction, createRun, createSnapshot, stepRun } from "@entities/game-session/model/simulation";
import { assetGroups } from "@shared/assets/manifest";
import { gameEvents } from "@shared/lib/event-bus/gameEvents";
import Phaser from "phaser";
import { RunSceneBoardArtPresenter } from "./runSceneBoardArt";
import {
  renderBoardSlots,
  renderPlacementSlotFeedback,
} from "./runSceneBoardRender";
import { renderCore } from "./runSceneCoreRender";
import { RunSceneEntryIntro } from "./runSceneEntryIntro";
import { renderSceneGrounding } from "./runSceneGround";
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from "./runSceneLayout";
import { renderPathFlow } from "./runScenePathFlow";
import { RunSceneReactionPresenter } from "./runSceneReactionPresenter";
import { RunSceneReagentPresenter } from "./runSceneReagentRender";
import {
  findSlotAtPoint,
  getEnemyVisual,
  renderEnemyAccent,
  writeBossIntroPosition,
  writeBossPosition,
  writeEnemyIntroPosition,
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

export class RunScene extends Phaser.Scene {
  private readonly driver = createFixedStepDriver({
    initialState: createRun(),
    stepMs: 1000 / 30,
    step: stepRun,
  });

  private groundGraphics?: Phaser.GameObjects.Graphics;
  private worldGraphics?: Phaser.GameObjects.Graphics;
  private effectGraphics?: Phaser.GameObjects.Graphics;
  private enemyGraphics?: Phaser.GameObjects.Graphics;
  private placementGraphics?: Phaser.GameObjects.Graphics;
  private backdropFloor?: Phaser.GameObjects.Image;
  private coreSprite?: Phaser.GameObjects.Image;
  private coreLiquidGraphics?: Phaser.GameObjects.Graphics;
  private bossLabel?: Phaser.GameObjects.Text;
  private enemyLabels: Phaser.GameObjects.Text[] = [];
  private towerLabels: Phaser.GameObjects.Text[] = [];
  private towerSprites: Phaser.GameObjects.Image[] = [];
  private towerHeadSprites: Phaser.GameObjects.Image[] = [];
  private boardArtPresenter?: RunSceneBoardArtPresenter;
  private reagentPresenter?: RunSceneReagentPresenter;
  private reactionPresenter?: RunSceneReactionPresenter;
  private readonly bossPosition = { x: 0, y: 0 };
  private readonly enemyPosition = { x: 0, y: 0 };
  private readonly towerPosition = { x: 0, y: 0 };
  private readonly entryIntro = new RunSceneEntryIntro();
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
    this.groundGraphics = this.add.graphics().setDepth(-28);
    renderSceneGrounding(this.groundGraphics, this.driver.state.board);
    this.worldGraphics = this.add.graphics().setDepth(5);
    this.effectGraphics = this.add.graphics().setDepth(10);
    this.enemyGraphics = this.add.graphics().setDepth(20);
    this.placementGraphics = this.add.graphics().setDepth(35);
    this.boardArtPresenter = new RunSceneBoardArtPresenter(this);
    this.reagentPresenter = new RunSceneReagentPresenter(this);
    this.reactionPresenter = new RunSceneReactionPresenter(this);

    this.coreSprite = this.add.image(0, 0, assetGroups.board.greatStillCore.key)
      .setOrigin(0.5)
      .setDepth(8);
    this.coreLiquidGraphics = this.add.graphics().setDepth(7.9);

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
    const visualMs = this.time.now;

    this.renderBoard(snapshot, visualMs);
    this.renderReagents(snapshot, visualMs);
    this.renderEffects(snapshot, visualMs);
    this.renderEnemies(snapshot);
    this.renderBoss(snapshot, visualMs);
    this.renderTowers(snapshot.placedTowers, snapshot.board.slots, snapshot.board.pathCells, snapshot.selectedTowerId, visualMs);
    this.renderPlacementFeedback(snapshot);
  }

  private renderBoard(snapshot: GameSnapshot, visualMs: number): void {
    const graphics = this.worldGraphics;
    if (!graphics) {
      return;
    }

    graphics.clear();

    this.boardArtPresenter?.render(snapshot);
    renderPathFlow(graphics, snapshot, visualMs);
    renderCore({
      coreSprite: this.coreSprite,
      liquidGraphics: this.coreLiquidGraphics,
      snapshot,
      visualMs,
    });
    renderBoardSlots(graphics, snapshot);
  }

  private renderEffects(snapshot: GameSnapshot, visualMs: number): void {
    const graphics = this.effectGraphics;
    if (!graphics) {
      return;
    }

    this.reactionPresenter?.render(graphics, snapshot, visualMs);
  }

  private renderReagents(snapshot: GameSnapshot, visualMs: number): void {
    this.reagentPresenter?.render(snapshot, visualMs);
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

    this.entryIntro.pruneEnemies(snapshot.livingEnemies);

    snapshot.livingEnemies.forEach((enemy, index) => {
      const introProgress = this.entryIntro.getEnemyProgress(enemy.id, this.time.now);
      const position = introProgress < 1
        ? writeEnemyIntroPosition(snapshot.board.pathCells, enemy, introProgress, this.enemyPosition)
        : writeEnemyPosition(snapshot.board.pathCells, enemy, this.enemyPosition);
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

  private renderBoss(snapshot: GameSnapshot, visualMs: number): void {
    const graphics = this.enemyGraphics;
    if (!graphics || !snapshot.boss || snapshot.phase !== "boss") {
      this.bossLabel?.setVisible(false);
      this.entryIntro.clearBoss();
      return;
    }

    const introProgress = this.entryIntro.getBossProgress(this.time.now);
    const position = introProgress < 1
      ? writeBossIntroPosition(snapshot.board.pathCells, snapshot.boss, introProgress, this.bossPosition)
      : writeBossPosition(snapshot.board.pathCells, snapshot.boss, this.bossPosition);
    const hpRatio = snapshot.boss.hp / snapshot.boss.maxHp;
    const vulnerable = snapshot.boss.vulnerableMs > 0;
    const pulse = 3 + Math.sin(visualMs / 90) * 3;

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
