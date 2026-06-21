import type { BoardSlot, GameSnapshot, TowerState } from "@entities/game-session/model/types";
import type { Unsubscribe } from "@shared/lib/event-bus/createTypedEventBus";
import { createFixedStepDriver } from "@entities/game-session/model/fixedStepDriver";
import { hasSavedRun, saveRun } from "@entities/game-session/model/persistence";
import { applyAction, createGameSession, createSnapshot, stepGameSession } from "@entities/game-session/model/simulation";
import { gameEvents } from "@shared/lib/event-bus/gameEvents";
import Phaser from "phaser";
import {
  findSlotAtPoint,
  getActiveReactionLabel,
  getBossPosition,
  getEnemyPosition,
  getEnemyVisual,
  getTowerColors,
  getTowerFieldLabel,
  getTowerPosition,
  renderAirReaction,
  renderEnemyAccent,
  renderGroundReaction,
  renderTowerGlyph,
} from "./runSceneRender";

const LOGICAL_WIDTH = 540;
const LOGICAL_HEIGHT = 960;
const TICK_STEP_MS = 1000 / 30;

export class RunScene extends Phaser.Scene {
  private readonly driver = createFixedStepDriver({
    initialState: createGameSession(),
    stepMs: TICK_STEP_MS,
    step: stepGameSession,
  });

  private worldGraphics?: Phaser.GameObjects.Graphics;
  private effectGraphics?: Phaser.GameObjects.Graphics;
  private enemyGraphics?: Phaser.GameObjects.Graphics;
  private titleText?: Phaser.GameObjects.Text;
  private coreText?: Phaser.GameObjects.Text;
  private reactionText?: Phaser.GameObjects.Text;
  private bossLabel?: Phaser.GameObjects.Text;
  private enemyLabels: Phaser.GameObjects.Text[] = [];
  private towerLabels: Phaser.GameObjects.Text[] = [];
  private unsubscribeAction?: Unsubscribe;
  private unsubscribeLoad?: Unsubscribe;
  private autosaveMs = 0;
  private autosaveEnabled = !hasSavedRun();

  constructor() {
    super("RunScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#161413");
    this.worldGraphics = this.add.graphics();
    this.effectGraphics = this.add.graphics();
    this.enemyGraphics = this.add.graphics();

    this.titleText = this.add.text(LOGICAL_WIDTH / 2, 122, "Осадная галерея", {
      align: "center",
      color: "#f3ead8",
      fontFamily: "Arial, sans-serif",
      fontSize: "24px",
      fontStyle: "700",
    }).setOrigin(0.5);

    this.coreText = this.add.text(LOGICAL_WIDTH / 2, 480, "", {
      align: "center",
      color: "#ffe0a6",
      fontFamily: "Arial, sans-serif",
      fontSize: "18px",
      fontStyle: "700",
    }).setOrigin(0.5);

    this.reactionText = this.add.text(LOGICAL_WIDTH / 2, 692, "", {
      align: "center",
      color: "#b9fbff",
      fontFamily: "Arial, sans-serif",
      fontSize: "18px",
      fontStyle: "700",
    }).setOrigin(0.5);

    this.bossLabel = this.add.text(0, 0, "", {
      align: "center",
      color: "#ffe0a6",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "700",
    }).setOrigin(0.5);

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
    this.renderEffects(snapshot);
    this.renderEnemies(snapshot);
    this.renderBoss(snapshot);
    this.renderTowers(snapshot.placedTowers, snapshot.board.slots);

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
    graphics.fillStyle(0x211D1A, 1);
    graphics.fillRoundedRect(48, 88, 444, 784, 26);
    graphics.lineStyle(2, 0x6D5944, 0.8);
    graphics.strokeRoundedRect(62, 108, 416, 744, 22);

    graphics.fillStyle(0x3A2016, 1);
    graphics.fillCircle(LOGICAL_WIDTH / 2, 480, 78);
    graphics.lineStyle(4, 0xF08A28, 0.8);
    graphics.strokeCircle(LOGICAL_WIDTH / 2, 480, 78);

    const cells = snapshot.board.pathCells;
    graphics.lineStyle(22, 0x4B4137, 1);
    graphics.beginPath();
    graphics.moveTo(cells[0]?.x ?? 0, cells[0]?.y ?? 0);
    cells.slice(1).forEach(cell => graphics.lineTo(cell.x, cell.y));
    graphics.closePath();
    graphics.strokePath();

    cells.forEach((cell) => {
      graphics.lineStyle(2, 0xC8A76A, cell.isCorner ? 0.82 : 0.48);
      graphics.strokeCircle(cell.x, cell.y, cell.isCorner ? 9 : 5);
      graphics.fillStyle(0xC8A76A, cell.isCorner ? 0.5 : 0.32);
      graphics.fillCircle(cell.x, cell.y, cell.isCorner ? 4 : 3);

      if (cell.isCorner) {
        graphics.lineStyle(2, 0xF0B85B, 0.9);
        graphics.strokeCircle(cell.x, cell.y, 15);
      }
    });

    this.renderSlots(snapshot);
  }

  private renderSlots(snapshot: GameSnapshot): void {
    const graphics = this.worldGraphics;
    if (!graphics) {
      return;
    }

    const occupiedSlotIds = new Set(snapshot.placedTowers.map(tower => tower.slotId).filter(Boolean));
    const selectedTower = [...snapshot.bench, ...snapshot.placedTowers].find(tower => tower.id === snapshot.selectedTowerId);

    snapshot.board.slots.forEach((slot) => {
      const isOccupied = occupiedSlotIds.has(slot.id);
      const isSelectedSlot = selectedTower?.slotId === slot.id;
      const isBenchSelection = selectedTower ? snapshot.bench.some(tower => tower.id === selectedTower.id) : false;
      const isValidTarget = selectedTower !== undefined && !slot.locked && (
        isBenchSelection
          ? (!isOccupied || snapshot.paused)
          : snapshot.paused
      );

      graphics.fillStyle(slot.locked ? 0x2B2E35 : isValidTarget ? 0x244B45 : 0x171A1E, slot.locked ? 0.55 : 0.85);
      graphics.fillCircle(slot.x, slot.y, slot.isCorner ? 14 : 11);
      graphics.lineStyle(
        isSelectedSlot ? 4 : isOccupied ? 3 : 2,
        isSelectedSlot ? 0xF6E27A : isValidTarget ? 0x61D6B5 : isOccupied ? 0xD8C18E : 0x5F6874,
        isValidTarget || isOccupied || isSelectedSlot ? 0.95 : 0.62,
      );
      graphics.strokeCircle(slot.x, slot.y, slot.isCorner ? 16 : 13);

      if (slot.isCorner) {
        graphics.lineStyle(2, isValidTarget ? 0x61D6B5 : 0xC79A55, 0.82);
        graphics.beginPath();
        graphics.moveTo(slot.x - 7, slot.y);
        graphics.lineTo(slot.x, slot.y - 7);
        graphics.lineTo(slot.x + 7, slot.y);
        graphics.lineTo(slot.x, slot.y + 7);
        graphics.closePath();
        graphics.strokePath();
      }
    });
  }

  private renderEffects(snapshot: GameSnapshot): void {
    const graphics = this.effectGraphics;
    if (!graphics) {
      return;
    }

    graphics.clear();

    snapshot.activeReactions.forEach((reaction) => {
      const cell = snapshot.board.pathCells[reaction.cellIndex];
      if (!cell) {
        return;
      }

      const pulse = 2 + Math.sin(snapshot.elapsedMs / 80 + reaction.cellIndex) * 2;

      if (reaction.ground) {
        renderGroundReaction(graphics, cell, reaction.ground, pulse);
      }

      if (reaction.air) {
        renderAirReaction(graphics, cell, reaction.air, pulse, snapshot.elapsedMs);
      }
    });
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
      }).setOrigin(0.5));
    }

    snapshot.livingEnemies.forEach((enemy, index) => {
      const position = getEnemyPosition(snapshot.board.pathCells, enemy);
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

    const position = getBossPosition(snapshot.board.pathCells, snapshot.boss);
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

  private renderTowers(towers: readonly TowerState[], slots: readonly BoardSlot[]): void {
    while (this.towerLabels.length < towers.length) {
      this.towerLabels.push(this.add.text(0, 0, "", {
        align: "center",
        color: "#f6f0df",
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        fontStyle: "700",
      }).setOrigin(0.5));
    }

    this.towerLabels.forEach((label, index) => {
      const tower = towers[index];
      if (!tower) {
        label.setVisible(false);
        return;
      }

      const position = getTowerPosition(tower, slots);
      label.setVisible(true);
      label.setPosition(position.x, position.y - 33);
      label.setText(getTowerFieldLabel(tower.emitterId));

      const graphics = this.worldGraphics;
      if (!graphics) {
        return;
      }

      const colors = getTowerColors(tower.emitterId);

      graphics.fillStyle(colors.fill, 1);
      graphics.fillCircle(position.x, position.y, 24);
      graphics.lineStyle(3, colors.stroke, 0.95);
      graphics.strokeCircle(position.x, position.y, 24);
      renderTowerGlyph(graphics, tower, position);
    });
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
