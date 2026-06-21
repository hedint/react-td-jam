import type { EmitterId, GameSnapshot, PathCell } from "@entities/game-session/model/types";
import type Phaser from "phaser";
import { projectReagents } from "@entities/game-session/model/reactions";
import { assetGroups } from "@shared/assets/manifest";
import { getPathTilePresentation } from "./runScenePathTiles";

interface ReagentAssetVisual {
  readonly key: string
  readonly alpha: number
  readonly scale: number
  readonly depth: number
  readonly jitter: number
}

export class RunSceneReagentPresenter {
  private sprites: Phaser.GameObjects.Image[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  render(snapshot: GameSnapshot): void {
    const projections = projectReagents(snapshot.board, snapshot.placedTowers, snapshot.upgrades);
    let spriteIndex = 0;

    projections.forEach((projection) => {
      const cell = snapshot.board.pathCells[projection.cellIndex];
      if (!cell) {
        return;
      }

      projection.substances.forEach((emitterId, index) => {
        this.renderSprite(spriteIndex, snapshot.board.pathCells, cell, emitterId, index, projection.substances.length, snapshot.elapsedMs);
        spriteIndex += 1;
      });

      const energyIds = projection.energy.length > 0 ? projection.energy : projection.directEnergy;
      energyIds.forEach((emitterId, index) => {
        this.renderSprite(spriteIndex, snapshot.board.pathCells, cell, emitterId, index, energyIds.length, snapshot.elapsedMs);
        spriteIndex += 1;
      });
    });

    this.sprites.slice(spriteIndex).forEach((sprite) => {
      sprite.setVisible(false);
    });
  }

  private renderSprite(
    index: number,
    cells: readonly PathCell[],
    cell: PathCell,
    emitterId: EmitterId,
    overlapIndex: number,
    overlapCount: number,
    elapsedMs: number,
  ): void {
    while (this.sprites.length <= index) {
      this.sprites.push(this.scene.add.image(0, 0, assetGroups.reactions.reagentWaterPuddle.key)
        .setOrigin(0.5)
        .setDepth(6));
    }

    const visual = getReagentAssetVisual(emitterId);
    const tile = getPathTilePresentation(cells, cell);
    const pulse = Math.sin(elapsedMs / 260 + cell.index + overlapIndex) * 0.035;
    const offset = overlapCount > 1 ? (overlapIndex - (overlapCount - 1) / 2) * visual.jitter : 0;
    const sprite = this.sprites[index];

    sprite
      ?.setVisible(true)
      .setTexture(visual.key)
      .setPosition(cell.x + Math.cos(tile.rotation + Math.PI / 2) * offset, cell.y + Math.sin(tile.rotation + Math.PI / 2) * offset)
      .setDisplaySize(tile.effectSize * visual.scale * (1 + pulse), tile.effectSize * visual.scale * (1 + pulse))
      .setAlpha(visual.alpha + pulse)
      .setRotation(tile.rotation + Math.sin(elapsedMs / 480 + cell.index) * 0.035)
      .setDepth(visual.depth + cell.y / 10000);
  }
}

function getReagentAssetVisual(emitterId: EmitterId): ReagentAssetVisual {
  switch (emitterId) {
    case "water":
      return { key: assetGroups.reactions.reagentWaterPuddle.key, alpha: 0.72, scale: 1.08, depth: 6, jitter: 7 };
    case "oil":
      return { key: assetGroups.reactions.reagentOilSlick.key, alpha: 0.8, scale: 1.1, depth: 6, jitter: 7 };
    case "spark":
      return { key: assetGroups.reactions.reagentSparkCharge.key, alpha: 0.66, scale: 0.92, depth: 7, jitter: 8 };
    case "heat":
      return { key: assetGroups.reactions.reagentHeatScorch.key, alpha: 0.68, scale: 1.02, depth: 6.5, jitter: 8 };
    default:
      return emitterId satisfies never;
  }
}
