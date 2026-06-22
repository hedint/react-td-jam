import type { BoardState, CellReagentProjection, TowerState } from "@entities/game-session/model/types";
import type { LaneDefinition, LaneLayout, LanePlacement } from "./towerDemoSceneModel";
import { projectReagents, resolveReactions } from "@entities/game-session/model/reactions";
import { createTower } from "@entities/game-session/model/simulation";
import Phaser from "phaser";
import { getReactionSpritePresentation } from "./runSceneReactionRender";
import { getReagentAssetVisual, getVisibleReagentEmitterIds } from "./runSceneReagentRender";
import {
  getTowerDirectionRotation,
  getTowerHeadSwayRotation,
  getTowerSpriteRenderConfig,
  getTowerSpriteSize,
  TOWER_HEAD_ORIGIN_Y,
} from "./runSceneTowerRender";
import {
  createLaneLayout,
  createPlaceholderCells,
  createPlaceholderSlot,
  createPositionedLaneBoard,
  getEmitterColor,
  getFrame,
  getSlotId,
  LANE_DEFINITIONS,
} from "./towerDemoSceneModel";

interface TowerView {
  readonly tower: TowerState
  readonly placement: LanePlacement
  readonly base: Phaser.GameObjects.Image
  readonly heads: readonly Phaser.GameObjects.Image[]
}

interface LaneView {
  readonly definition: LaneDefinition
  readonly towers: readonly TowerView[]
  readonly reagentSprites: readonly Phaser.GameObjects.Image[]
  readonly reactionSprites: readonly Phaser.GameObjects.Image[]
  readonly titleText: Phaser.GameObjects.Text
}

const TILE_SIZE = 44;
const MAX_REAGENT_SPRITES_PER_LANE = 10;
const MAX_REACTION_SPRITES_PER_LANE = 10;

export class TowerDemoScene extends Phaser.Scene {
  private backgroundGraphics?: Phaser.GameObjects.Graphics;
  private laneGraphics?: Phaser.GameObjects.Graphics;
  private titleText?: Phaser.GameObjects.Text;
  private subtitleText?: Phaser.GameObjects.Text;
  private lanes: LaneView[] = [];

  constructor() {
    super("TowerDemoScene");
  }

  create(): void {
    this.backgroundGraphics = this.add.graphics().setDepth(0);
    this.laneGraphics = this.add.graphics().setDepth(2);
    this.titleText = this.add.text(0, 0, "Tower Demo", createTextStyle(22, "#f3ead8", "700")).setOrigin(0.5);
    this.subtitleText = this.add.text(0, 0, "Реальные мини-дороги: башни -> реагенты -> итоговые реакции", createTextStyle(12, "#b9aa91", "600")).setOrigin(0.5);
    this.lanes = LANE_DEFINITIONS.map(definition => this.createLane(definition));
  }

  update(time: number): void {
    this.renderBackground();
    this.layoutLanes(time);
  }

  private createLane(definition: LaneDefinition): LaneView {
    const towers = definition.placements.map((placement, index) => {
      const tower = createTower(`${definition.id}-${placement.emitterId}-${index}`, placement.emitterId, getSlotId(definition.id, index));
      const config = getTowerSpriteRenderConfig(tower, createPlaceholderSlot(getSlotId(definition.id, index), placement), createPlaceholderCells(definition.cellCount));
      const base = this.add.image(0, 0, config.baseKey).setOrigin(0.5).setDepth(24);
      const heads = config.directions.map(() =>
        this.add.image(0, 0, config.headKey)
          .setOrigin(config.headOriginX, TOWER_HEAD_ORIGIN_Y)
          .setDepth(25),
      );

      return { tower, placement, base, heads };
    });

    return {
      definition,
      towers,
      reagentSprites: Array.from({ length: MAX_REAGENT_SPRITES_PER_LANE }, () =>
        this.add.image(0, 0, "").setOrigin(0.5).setDepth(10).setVisible(false)),
      reactionSprites: Array.from({ length: MAX_REACTION_SPRITES_PER_LANE }, () =>
        this.add.image(0, 0, "").setOrigin(0.5).setDepth(16).setVisible(false)),
      titleText: this.add.text(0, 0, definition.title, createTextStyle(12, "#f3ead8", "700")).setOrigin(0.5).setDepth(30),
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
    graphics.lineStyle(1, 0xFFFFFF, 0.04);

    for (let x = 0; x <= width; x += 32) {
      graphics.lineBetween(x, 0, x, height);
    }

    for (let y = 0; y <= height; y += 32) {
      graphics.lineBetween(0, y, width, y);
    }

    graphics.lineStyle(1, 0xC8A76A, 0.22);
    graphics.strokeRoundedRect(16, 16, Math.max(1, width - 32), Math.max(1, height - 32), 10);
  }

  private layoutLanes(time: number): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const columnCount = width >= 860 ? 3 : width >= 620 ? 2 : 1;
    const rowCount = Math.ceil(this.lanes.length / columnCount);
    const margin = 24;
    const top = 66;
    const gap = 12;
    const laneWidth = (width - margin * 2 - gap * (columnCount - 1)) / columnCount;
    const laneHeight = (height - top - margin - gap * (rowCount - 1)) / rowCount;

    this.laneGraphics?.clear();
    this.titleText?.setPosition(width / 2, 26);
    this.subtitleText?.setPosition(width / 2, 49);

    this.lanes.forEach((lane, index) => {
      const column = index % columnCount;
      const row = Math.floor(index / columnCount);
      const layout = createLaneLayout(
        margin + column * (laneWidth + gap),
        top + row * (laneHeight + gap),
        laneWidth,
        laneHeight,
        lane.definition.cellCount,
      );
      const board = createPositionedLaneBoard(lane.definition, layout);
      const reactions = resolveReactions(board, lane.towers.map(tower => tower.tower));
      const projections = projectReagents(board, lane.towers.map(tower => tower.tower));

      this.drawLaneFrame(layout);
      this.drawLanePath(board);
      this.drawLaneInfluence(board, lane);
      this.layoutTowerViews(board, lane, time);
      this.layoutReagentViews(board, lane, projections, reactions, time);
      this.layoutReactionViews(board, lane, reactions, time);

      lane.titleText.setPosition(layout.x + layout.width / 2, layout.y + 18);
    });
  }

  private drawLaneFrame(layout: LaneLayout): void {
    const graphics = this.laneGraphics;

    if (!graphics) {
      return;
    }

    graphics.fillStyle(0x090B0F, 0.34);
    graphics.fillRoundedRect(layout.x, layout.y, layout.width, layout.height, 8);
    graphics.lineStyle(1, 0xC8A76A, 0.18);
    graphics.strokeRoundedRect(layout.x, layout.y, layout.width, layout.height, 8);
  }

  private drawLanePath(board: BoardState): void {
    const graphics = this.laneGraphics;

    if (!graphics) {
      return;
    }

    board.pathCells.forEach((cell, index) => {
      const next = board.pathCells[index + 1];

      if (next) {
        graphics.lineStyle(18, 0x2A2520, 0.88);
        graphics.lineBetween(cell.x, cell.y, next.x, next.y);
        graphics.lineStyle(2, 0x6D5944, 0.72);
        graphics.lineBetween(cell.x, cell.y, next.x, next.y);
      }
    });

    board.pathCells.forEach((cell) => {
      graphics.fillStyle(0x1C1A17, 0.9);
      graphics.fillRect(cell.x - TILE_SIZE / 2, cell.y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
      graphics.lineStyle(1, 0xE05B3F, 0.58);
      graphics.strokeRect(cell.x - TILE_SIZE / 2, cell.y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
    });
  }

  private drawLaneInfluence(board: BoardState, lane: LaneView): void {
    const graphics = this.laneGraphics;

    if (!graphics) {
      return;
    }

    lane.towers.forEach((tower) => {
      const slot = board.slots.find(candidate => candidate.id === tower.tower.slotId);

      slot?.cellIndexes.forEach((cellIndex) => {
        const cell = board.pathCells[cellIndex];

        if (!cell) {
          return;
        }

        graphics.lineStyle(1, getEmitterColor(tower.placement.emitterId), 0.42);
        graphics.lineBetween(slot.x, slot.y, cell.x, cell.y);
      });
    });
  }

  private layoutTowerViews(board: BoardState, lane: LaneView, time: number): void {
    lane.towers.forEach((tower) => {
      const slot = board.slots.find(candidate => candidate.id === tower.tower.slotId);

      if (!slot) {
        return;
      }

      const config = getTowerSpriteRenderConfig(tower.tower, slot, board.pathCells);
      const size = Math.min(40, getTowerSpriteSize(slot) * 0.68);

      tower.base
        .setPosition(slot.x, slot.y)
        .setDisplaySize(size, size)
        .setVisible(true);
      tower.heads.forEach((head, directionIndex) => {
        const direction = config.directions[directionIndex] ?? "right";

        head
          .setPosition(slot.x, slot.y)
          .setDisplaySize(size, size)
          .setRotation(getTowerDirectionRotation(direction) + getTowerHeadSwayRotation(tower.tower, slot, directionIndex, time))
          .setVisible(true);
      });
    });
  }

  private layoutReagentViews(
    board: BoardState,
    lane: LaneView,
    projections: readonly CellReagentProjection[],
    reactions: ReturnType<typeof resolveReactions>,
    time: number,
  ): void {
    let spriteIndex = 0;

    projections.forEach((projection) => {
      const cell = board.pathCells[projection.cellIndex];
      const emitterIds = getVisibleReagentEmitterIds(projection, reactions[projection.cellIndex]);

      if (!cell || emitterIds.length === 0) {
        return;
      }

      emitterIds.forEach((emitterId, index) => {
        const sprite = lane.reagentSprites[spriteIndex];

        if (!sprite) {
          return;
        }

        const visual = getReagentAssetVisual(emitterId);
        const offset = (index - (emitterIds.length - 1) / 2) * 12;
        const frame = getFrame(visual.frameCount ?? 1, visual.frameDurationMs ?? 500, time);

        sprite
          .setTexture(visual.key)
          .setFrame(frame)
          .setPosition(cell.x, cell.y + offset)
          .setDisplaySize(TILE_SIZE * visual.scale * 0.9, TILE_SIZE * visual.scale * 0.9)
          .setAlpha(visual.alpha)
          .setRotation(0)
          .setVisible(true);
        spriteIndex += 1;
      });
    });

    lane.reagentSprites.slice(spriteIndex).forEach(sprite => sprite.setVisible(false));
  }

  private layoutReactionViews(board: BoardState, lane: LaneView, reactions: ReturnType<typeof resolveReactions>, time: number): void {
    let spriteIndex = 0;

    reactions.forEach((reaction) => {
      const cell = board.pathCells[reaction.cellIndex];

      if (!cell) {
        return;
      }

      ([reaction.ground, reaction.air] as const).forEach((reactionId) => {
        const sprite = lane.reactionSprites[spriteIndex];

        if (!reactionId || !sprite) {
          return;
        }

        const presentation = getReactionSpritePresentation(board.pathCells, cell, reactionId, time);
        const scale = reactionId === "fireStorm" ? 0.78 : 0.86;

        sprite
          .setTexture(presentation.key)
          .setFrame(presentation.frame ?? 0)
          .setPosition(presentation.x, presentation.y)
          .setDisplaySize(presentation.width * scale, presentation.height * scale)
          .setAlpha(presentation.alpha)
          .setRotation(presentation.rotation)
          .setDepth(presentation.depth + 12)
          .setVisible(true);
        spriteIndex += 1;
      });
    });

    lane.reactionSprites.slice(spriteIndex).forEach(sprite => sprite.setVisible(false));
  }
}

function createTextStyle(size: number, color: string, fontWeight: string): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: "Inter, Segoe UI, Arial, sans-serif",
    fontSize: `${size}px`,
    fontStyle: fontWeight,
    color,
    stroke: "#070707",
    strokeThickness: 3,
    align: "center",
  };
}
