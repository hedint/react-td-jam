import type { GameSnapshot } from "@entities/game-session/model/types";
import { gameConfig } from "@entities/game-session/model/config";
import { assetGroups } from "@shared/assets/manifest";
import Phaser from "phaser";
import { getBoardCenter } from "./runSceneBoardRender";

const CORE_DISPLAY_SIZE = 204;
const CORE_LIQUID_MIN_FILL = 0.14;

export function renderCore(options: {
  readonly coreSprite: Phaser.GameObjects.Image | undefined
  readonly liquidGraphics: Phaser.GameObjects.Graphics | undefined
  readonly snapshot: GameSnapshot
  readonly visualMs: number
}): void {
  const center = getBoardCenter(options.snapshot.board.pathCells);

  options.coreSprite
    ?.setVisible(true)
    .setTexture(assetGroups.board.greatStillCore.key)
    .setPosition(center.x, center.y)
    .setDisplaySize(CORE_DISPLAY_SIZE, CORE_DISPLAY_SIZE);
  renderCoreLiquid(options.snapshot, options.liquidGraphics, center, options.visualMs);
}

function renderCoreLiquid(
  snapshot: GameSnapshot,
  graphics: Phaser.GameObjects.Graphics | undefined,
  center: { readonly x: number, readonly y: number },
  visualMs: number,
): void {
  if (!graphics) {
    return;
  }

  graphics.clear();

  const fillRatio = getCoreLiquidFillRatio(snapshot);
  const chamberTop = center.y - 29;
  const chamberBottom = center.y + 27;
  const chamberHalfTop = 33;
  const chamberHalfBottom = 44;
  const liquidTop = chamberBottom - (chamberBottom - chamberTop) * fillRatio;
  const topWave = Math.sin(visualMs / 260) * 2;
  const topHalfWidth = Phaser.Math.Linear(chamberHalfTop, chamberHalfBottom, fillRatio);

  graphics.fillStyle(0x20130D, 0.56);
  graphics.fillRoundedRect(center.x - chamberHalfBottom, chamberTop, chamberHalfBottom * 2, chamberBottom - chamberTop, 10);

  graphics.fillStyle(0x8E2D12, 0.76);
  graphics.beginPath();
  graphics.moveTo(center.x - chamberHalfBottom, chamberBottom);
  graphics.lineTo(center.x + chamberHalfBottom, chamberBottom);
  graphics.lineTo(center.x + topHalfWidth, liquidTop + topWave);
  graphics.lineTo(center.x, liquidTop - 2 - topWave);
  graphics.lineTo(center.x - topHalfWidth, liquidTop + topWave);
  graphics.closePath();
  graphics.fillPath();

  graphics.fillStyle(0xF07824, 0.7);
  graphics.fillEllipse(center.x, liquidTop + topWave, topHalfWidth * 1.82, 11);
  graphics.lineStyle(2, 0xFFB15E, 0.58);
  graphics.strokeEllipse(center.x, liquidTop + topWave, topHalfWidth * 1.78, 10);

  graphics.fillStyle(0xFFB15E, 0.28);
  graphics.fillEllipse(center.x - topHalfWidth * 0.28, (liquidTop + chamberBottom) / 2, topHalfWidth * 0.72, chamberBottom - liquidTop);
}

function getCoreLiquidFillRatio(snapshot: GameSnapshot): number {
  if (snapshot.phase === "boss" || snapshot.phase === "victory") {
    return 1;
  }

  const finalWaveIndex = Math.max(1, gameConfig.waves.length - 1);
  const waveProgress = Phaser.Math.Clamp(snapshot.waveIndex / finalWaveIndex, 0, 1);

  return Phaser.Math.Linear(CORE_LIQUID_MIN_FILL, 1, waveProgress);
}
