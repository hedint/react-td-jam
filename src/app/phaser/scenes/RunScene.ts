import type { BoardSlot, CellReactionState, EnemyState, GameSnapshot, PathCell, ReactionId, TowerState } from "@entities/game-session/model/types";
import type { Unsubscribe } from "@shared/lib/event-bus/createTypedEventBus";
import { gameConfig } from "@entities/game-session/model/config";
import { createFixedStepDriver } from "@entities/game-session/model/fixedStepDriver";
import { hasSavedRun, saveRun } from "@entities/game-session/model/persistence";
import { applyAction, createGameSession, createSnapshot, stepGameSession } from "@entities/game-session/model/simulation";
import { gameEvents } from "@shared/lib/event-bus/gameEvents";
import Phaser from "phaser";

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

    graphics.lineStyle(2, 0x9A7F59, 0.72);
    cells.forEach((cell) => {
      graphics.fillStyle(0x2D2925, 1);
      graphics.fillCircle(cell.x, cell.y, 20);
      graphics.strokeCircle(cell.x, cell.y, 20);

      if (cell.isCorner) {
        graphics.lineStyle(2, 0xC79A55, 0.95);
        graphics.strokeCircle(cell.x, cell.y, 25);
        graphics.lineStyle(2, 0x9A7F59, 0.72);
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

      graphics.fillStyle(0x715640, 1);
      graphics.fillCircle(position.x, position.y, 18);
      graphics.lineStyle(3, 0xE6D3A5, 0.9);
      graphics.strokeCircle(position.x, position.y, 18);
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

  private renderTowers(towers: readonly TowerState[], slots: readonly BoardSlot[]): void {
    while (this.towerLabels.length < towers.length) {
      this.towerLabels.push(this.add.text(0, 0, "", {
        align: "center",
        color: "#f6f0df",
        fontFamily: "Arial, sans-serif",
        fontSize: "13px",
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
      label.setPosition(position.x, position.y + 34);
      label.setText(tower.displayName);

      const graphics = this.worldGraphics;
      if (!graphics) {
        return;
      }

      const colors = getTowerColors(tower.emitterId);

      graphics.fillStyle(colors.fill, 1);
      graphics.fillCircle(position.x, position.y, 24);
      graphics.lineStyle(3, colors.stroke, 0.95);
      graphics.strokeCircle(position.x, position.y, 24);
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

function getEnemyPosition(cells: readonly PathCell[], enemy: EnemyState): Phaser.Math.Vector2 {
  const currentIndex = Math.floor(enemy.pathProgress) % cells.length;
  const nextIndex = (currentIndex + 1) % cells.length;
  const current = cells[currentIndex] ?? cells[0];
  const next = cells[nextIndex] ?? current;
  const amount = enemy.pathProgress - Math.floor(enemy.pathProgress);

  return new Phaser.Math.Vector2(
    Phaser.Math.Linear(current.x, next.x, amount),
    Phaser.Math.Linear(current.y, next.y, amount),
  );
}

function getTowerPosition(tower: TowerState, slots: readonly BoardSlot[]): Phaser.Math.Vector2 {
  const slot = slots.find(candidate => candidate.id === tower.slotId);

  return new Phaser.Math.Vector2(slot?.x ?? 0, slot?.y ?? 0);
}

function findSlotAtPoint(slots: readonly BoardSlot[], x: number, y: number): BoardSlot | undefined {
  return slots.find(slot => Phaser.Math.Distance.Between(slot.x, slot.y, x, y) <= 24);
}

function getTowerColors(emitterId: TowerState["emitterId"]): { readonly fill: number, readonly stroke: number } {
  switch (emitterId) {
    case "water":
      return { fill: 0x287BB8, stroke: 0x9DDCFF };
    case "oil":
      return { fill: 0x2E2A1F, stroke: 0xA8844F };
    case "spark":
      return { fill: 0xF3C24D, stroke: 0xFFF1A8 };
    case "heat":
      return { fill: 0xC84C26, stroke: 0xFFB05B };
    default:
      return emitterId satisfies never;
  }
}

function renderGroundReaction(
  graphics: Phaser.GameObjects.Graphics,
  cell: PathCell,
  reactionId: ReactionId,
  pulse: number,
): void {
  switch (reactionId) {
    case "electroPuddle":
      graphics.fillStyle(0x1B9BD0, 0.58);
      graphics.fillEllipse(cell.x, cell.y + 6, 78 + pulse, 38 + pulse);
      graphics.lineStyle(3, 0x9FF7FF, 0.9);
      graphics.strokeEllipse(cell.x, cell.y + 6, 78 + pulse, 38 + pulse);
      graphics.lineStyle(2, 0xE9FFFF, 0.9);
      graphics.beginPath();
      graphics.moveTo(cell.x - 22, cell.y + 2);
      graphics.lineTo(cell.x - 6, cell.y - 8);
      graphics.lineTo(cell.x + 2, cell.y + 4);
      graphics.lineTo(cell.x + 20, cell.y - 6);
      graphics.strokePath();
      break;
    case "fire":
      graphics.fillStyle(0xA53716, 0.62);
      graphics.fillEllipse(cell.x, cell.y + 7, 82 + pulse, 42 + pulse);
      graphics.lineStyle(3, 0xFFB15E, 0.92);
      graphics.strokeEllipse(cell.x, cell.y + 7, 82 + pulse, 42 + pulse);
      graphics.fillStyle(0xFFDB77, 0.86);
      graphics.beginPath();
      graphics.moveTo(cell.x - 16, cell.y + 16);
      graphics.lineTo(cell.x - 3, cell.y - 16 - pulse);
      graphics.lineTo(cell.x + 9, cell.y + 14);
      graphics.lineTo(cell.x + 20, cell.y - 5);
      graphics.lineTo(cell.x + 24, cell.y + 18);
      graphics.closePath();
      graphics.fillPath();
      break;
    default:
      break;
  }
}

function renderAirReaction(
  graphics: Phaser.GameObjects.Graphics,
  cell: PathCell,
  reactionId: ReactionId,
  pulse: number,
  elapsedMs: number,
): void {
  const y = cell.y - 42;

  switch (reactionId) {
    case "steam":
      graphics.fillStyle(0xD7EFF0, 0.44);
      graphics.fillCircle(cell.x - 18, y + 2, 18 + pulse);
      graphics.fillCircle(cell.x + 2, y - 8, 22 + pulse);
      graphics.fillCircle(cell.x + 23, y + 4, 16 + pulse);
      graphics.lineStyle(2, 0xFFFFFF, 0.62);
      graphics.strokeEllipse(cell.x, y + 4, 76 + pulse, 34 + pulse);
      break;
    case "stormCloud":
      graphics.fillStyle(0x284E64, 0.74);
      graphics.fillCircle(cell.x - 20, y, 21 + pulse);
      graphics.fillCircle(cell.x + 4, y - 9, 25 + pulse);
      graphics.fillCircle(cell.x + 28, y + 2, 18 + pulse);
      graphics.lineStyle(3, 0x9FF7FF, 0.92);
      graphics.beginPath();
      graphics.moveTo(cell.x - 4, y + 12);
      graphics.lineTo(cell.x - 15, y + 34);
      graphics.lineTo(cell.x + 1, y + 29);
      graphics.lineTo(cell.x - 8, y + 50);
      graphics.strokePath();
      break;
    case "fireVortex": {
      const spin = elapsedMs / 130 + cell.index;

      graphics.lineStyle(5, 0xFF813D, 0.88);
      graphics.strokeCircle(cell.x, y + 8, 24 + pulse);
      graphics.lineStyle(3, 0xFFE0A0, 0.84);
      graphics.beginPath();
      graphics.moveTo(cell.x + Math.cos(spin) * 32, y + 8 + Math.sin(spin) * 12);
      graphics.lineTo(cell.x + Math.cos(spin + 2.1) * 20, y + 8 + Math.sin(spin + 2.1) * 24);
      graphics.lineTo(cell.x + Math.cos(spin + 4.2) * 8, y + 8 + Math.sin(spin + 4.2) * 10);
      graphics.strokePath();
      break;
    }
    case "fireStorm":
      graphics.fillStyle(0x4B183F, 0.5);
      graphics.fillCircle(cell.x, y + 8, 42 + pulse);
      graphics.lineStyle(5, 0xFFCD62, 0.95);
      graphics.strokeCircle(cell.x, y + 8, 42 + pulse);
      graphics.lineStyle(3, 0x9FF7FF, 0.92);
      graphics.strokeCircle(cell.x, y + 8, 24 + pulse);
      graphics.fillStyle(0xFFFFFF, 0.9);
      graphics.fillCircle(cell.x, y + 8, 5 + pulse / 2);
      break;
    default:
      break;
  }
}

function getActiveReactionLabel(reactions: readonly CellReactionState[]): string {
  const reactionIds = new Set<ReactionId>();

  reactions.forEach((reaction) => {
    if (reaction.ground) {
      reactionIds.add(reaction.ground);
    }

    if (reaction.air) {
      reactionIds.add(reaction.air);
    }
  });

  return [...reactionIds]
    .map(reactionId => gameConfig.reactions.find(reaction => reaction.id === reactionId))
    .filter(reaction => reaction !== undefined)
    .sort((left, right) => right.tier - left.tier || right.dps - left.dps)
    .map(reaction => reaction.displayName)
    .map((displayName, index, names) => index === 0 && names.length > 1 ? `${displayName} +${names.length - 1}` : displayName)[0] ?? "";
}
