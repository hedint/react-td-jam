import type { GameSnapshot, PathCell, ReactionId } from "@entities/game-session/model/types";
import type Phaser from "phaser";
import { assetGroups } from "@shared/assets/manifest";
import {
  drawReactionPoolUnderlay,
  getReactionConnectedPools,
  getSupportedReactionPoolUnderlayIds,
} from "./runSceneReactionPoolUnderlay";
import {
  getReactionDisplayName,
  getReactionSpritePresentation,
  getReactionVfxDefinition,
} from "./runSceneReactionRender";
import { writeBossPosition } from "./runSceneRender";

const LOGICAL_WIDTH = 540;
const MAX_FIELD_CALLOUTS = 2;
const FIELD_CALLOUT_TTL_MS = 1900;

interface FieldCallout {
  readonly text: Phaser.GameObjects.Text
  readonly createdAt: number
  readonly ttlMs: number
  readonly startY: number
}

export class RunSceneReactionPresenter {
  private reactionSprites: Phaser.GameObjects.Image[] = [];
  private readonly airUnderlayGraphics: Phaser.GameObjects.Graphics;
  private fieldCallouts: FieldCallout[] = [];
  private readonly announcedReactionIds = new Set<ReactionId>();
  private readonly bossPosition = { x: 0, y: 0 };
  private previousBossVulnerable = false;
  private lastCalloutAt = Number.NEGATIVE_INFINITY;
  private lastCoreDangerAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly scene: Phaser.Scene) {
    this.airUnderlayGraphics = scene.add.graphics().setDepth(17.4);
  }

  render(graphics: Phaser.GameObjects.Graphics, snapshot: GameSnapshot, visualMs: number): void {
    graphics.clear();
    this.airUnderlayGraphics.clear();
    this.renderReactionPoolUnderlays(graphics, snapshot, visualMs);

    let spriteIndex = 0;

    snapshot.activeReactions.forEach((reaction) => {
      const cell = snapshot.board.pathCells[reaction.cellIndex];
      if (!cell) {
        return;
      }

      if (reaction.ground) {
        this.renderReactionSprite(spriteIndex, snapshot.board.pathCells, cell, reaction.ground, visualMs);
        spriteIndex += 1;
      }

      if (reaction.air) {
        this.renderReactionSprite(spriteIndex, snapshot.board.pathCells, cell, reaction.air, visualMs);
        spriteIndex += 1;
      }
    });

    this.reactionSprites.slice(spriteIndex).forEach((sprite) => {
      sprite.setVisible(false);
    });

    this.renderFieldCallouts(snapshot);
  }

  private renderReactionPoolUnderlays(
    groundGraphics: Phaser.GameObjects.Graphics,
    snapshot: GameSnapshot,
    visualMs: number,
  ): void {
    getSupportedReactionPoolUnderlayIds().forEach((reactionId) => {
      const definition = getReactionVfxDefinition(reactionId);
      const targetGraphics = definition.layer === "air" ? this.airUnderlayGraphics : groundGraphics;

      getReactionConnectedPools(snapshot.activeReactions, snapshot.board.pathCells.length, reactionId, definition.layer)
        .filter(pool => pool.length > 1)
        .forEach(pool => drawReactionPoolUnderlay(targetGraphics, snapshot.board.pathCells, pool, reactionId, visualMs));
    });
  }

  private renderReactionSprite(
    index: number,
    cells: readonly PathCell[],
    cell: PathCell,
    reactionId: ReactionId,
    visualMs: number,
  ): void {
    while (this.reactionSprites.length <= index) {
      this.reactionSprites.push(this.scene.add.image(0, 0, assetGroups.reactions.reactionDecalPlaceholder.key)
        .setOrigin(0.5)
        .setDepth(8));
    }

    const sprite = this.reactionSprites[index];
    const presentation = getReactionSpritePresentation(cells, cell, reactionId, visualMs);

    if (!sprite) {
      return;
    }

    sprite.setVisible(true).setTexture(presentation.key);

    if (presentation.frame !== null) {
      sprite.setFrame(presentation.frame);
    }

    sprite
      .setPosition(presentation.x, presentation.y)
      .setDisplaySize(presentation.width, presentation.height)
      .setAlpha(presentation.alpha)
      .setRotation(presentation.rotation)
      .setDepth(presentation.depth);
  }

  private renderFieldCallouts(snapshot: GameSnapshot): void {
    this.queueReactionCallouts(snapshot);
    this.queueBossBreakCallout(snapshot);
    this.queueCoreDangerCallout(snapshot);
    this.updateFieldCalloutObjects(this.scene.time.now);
  }

  private queueReactionCallouts(snapshot: GameSnapshot): void {
    snapshot.activeReactions.forEach((reaction) => {
      const cell = snapshot.board.pathCells[reaction.cellIndex];
      if (!cell) {
        return;
      }

      ([reaction.ground, reaction.air] as const).forEach((reactionId) => {
        if (!reactionId || this.announcedReactionIds.has(reactionId)) {
          return;
        }

        const definition = getReactionVfxDefinition(reactionId);
        this.announcedReactionIds.add(reactionId);
        this.queueFieldCallout(
          definition.tier === 1 ? getReactionDisplayName(reactionId) : definition.callout,
          cell.x,
          cell.y + definition.yOffset - definition.height * 0.42,
          definition.tier === 3 ? "#fff2a8" : "#d7ffff",
        );
      });
    });
  }

  private queueBossBreakCallout(snapshot: GameSnapshot): void {
    const bossVulnerable = snapshot.phase === "boss" && (snapshot.boss?.vulnerableMs ?? 0) > 0;

    if (!bossVulnerable || this.previousBossVulnerable) {
      this.previousBossVulnerable = bossVulnerable;
      return;
    }

    if (snapshot.boss) {
      const position = writeBossPosition(snapshot.board.pathCells, snapshot.boss, this.bossPosition);
      this.queueFieldCallout("Разлом реакции", position.x, position.y - 70, "#fff2a8");
    }

    this.previousBossVulnerable = bossVulnerable;
  }

  private queueCoreDangerCallout(snapshot: GameSnapshot): void {
    const now = this.scene.time.now;
    const coreInDanger = snapshot.coreHp <= 4 && (snapshot.phase === "wave" || snapshot.phase === "boss");

    if (!coreInDanger || now - this.lastCoreDangerAt < 8000) {
      return;
    }

    this.lastCoreDangerAt = now;
    this.queueFieldCallout("Куб трещит", LOGICAL_WIDTH / 2, 428, "#ffb15e");
  }

  private queueFieldCallout(text: string, x: number, y: number, color: string): void {
    const now = this.scene.time.now;
    const activeCount = this.fieldCallouts.filter(callout => callout.text.visible).length;

    if (activeCount >= MAX_FIELD_CALLOUTS || now - this.lastCalloutAt < 850) {
      return;
    }

    this.lastCalloutAt = now;

    const label = this.scene.add.text(x, y, text, {
      align: "center",
      backgroundColor: "rgba(16, 18, 23, 0.72)",
      color,
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "700",
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(44);

    this.fieldCallouts.push({
      text: label,
      createdAt: now,
      ttlMs: FIELD_CALLOUT_TTL_MS,
      startY: y,
    });
  }

  private updateFieldCalloutObjects(now: number): void {
    this.fieldCallouts = this.fieldCallouts.filter((callout) => {
      const age = now - callout.createdAt;

      if (age >= callout.ttlMs) {
        callout.text.destroy();
        return false;
      }

      const progress = age / callout.ttlMs;
      callout.text
        .setAlpha(progress < 0.72 ? 1 : 1 - (progress - 0.72) / 0.28)
        .setY(callout.startY - progress * 16);
      return true;
    });
  }
}
