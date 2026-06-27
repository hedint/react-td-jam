import {
  getBoardRoadPiecePresentation,
  getEnemyLeakTargetPresentation,
  getEntranceMarkerPresentation,
  getExitMarkerPresentation,
} from "@app/phaser/scenes/runSceneBoardArt";
import {
  bossAnimationDirections,
  bossAnimationNames,
  bossSpritePresentation,
  getBossAnimationTextureKey,
  getBossPhaserAnimationKey,
} from "@app/phaser/scenes/runSceneBossPresenter";
import {
  enemyAnimationDirections,
  enemyAnimationNames,
  getEnemyAnimationTextureKey,
  getEnemyPhaserAnimationKey,
  getEnemySpritePresentation,
} from "@app/phaser/scenes/runSceneEnemyPresenter";
import { getEnemySideFacing, writeBossPosition, writeEnemyIntroPosition, writeEnemyPosition } from "@app/phaser/scenes/runSceneRender";
import { getCoreEntrancePathCell } from "@entities/game-session/model/boardGeometry";
import { createBossState } from "@entities/game-session/model/boss";
import { gameConfig } from "@entities/game-session/model/config";
import { createGrunt } from "@entities/game-session/model/simulation";
import { assetGroups, phaserPreloadAssets } from "@shared/assets/manifest";
import { describe, expect, it } from "vitest";

const publicBossAssets = import.meta.glob("../public/assets/enemies/boss-ogre/*.png", {
  eager: true,
  query: "?url",
});

describe("board art render helpers", () => {
  it("uses road corner assets only on the four loop turns", () => {
    const pieces = gameConfig.board.pathCells.map(cell => getBoardRoadPiecePresentation(gameConfig.board.pathCells, cell));

    expect(pieces.map(piece => piece.key).filter(key => key === assetGroups.board.roadCorner.key)).toHaveLength(4);
    expect(pieces[0]?.key).toBe(assetGroups.board.roadCorner.key);
    expect(pieces[5]?.key).toBe(assetGroups.board.roadCorner.key);
    expect(pieces[9]?.key).toBe(assetGroups.board.roadCorner.key);
    expect(pieces[14]?.key).toBe(assetGroups.board.roadCorner.key);
    expect(pieces[1]?.key).toBe(assetGroups.board.roadStraight.key);
    expect(pieces[6]?.key).toBe(assetGroups.board.roadStraight.key);
  });

  it("rotates straight road pieces by their path axis", () => {
    const vertical = getBoardRoadPiecePresentation(gameConfig.board.pathCells, gameConfig.board.pathCells[1]!);
    const horizontal = getBoardRoadPiecePresentation(gameConfig.board.pathCells, gameConfig.board.pathCells[6]!);

    expect(vertical.rotation).toBe(0);
    expect(horizontal.rotation).toBeCloseTo(Math.PI / 2);
  });

  it("draws road pieces with a small overlap to hide seams between PNG tiles", () => {
    const cell = gameConfig.board.pathCells[1]!;
    const nextCell = gameConfig.board.pathCells[2]!;
    const piece = getBoardRoadPiecePresentation(gameConfig.board.pathCells, cell);
    const cellStep = Math.hypot(nextCell.x - cell.x, nextCell.y - cell.y);

    expect(piece.width).toBeGreaterThan(cellStep);
    expect(piece.height).toBeGreaterThan(cellStep);
  });

  it("rotates corner road pieces from the source up-right orientation", () => {
    const bottomLeft = getBoardRoadPiecePresentation(gameConfig.board.pathCells, gameConfig.board.pathCells[0]!);
    const topLeft = getBoardRoadPiecePresentation(gameConfig.board.pathCells, gameConfig.board.pathCells[5]!);
    const topRight = getBoardRoadPiecePresentation(gameConfig.board.pathCells, gameConfig.board.pathCells[9]!);
    const bottomRight = getBoardRoadPiecePresentation(gameConfig.board.pathCells, gameConfig.board.pathCells[14]!);

    expect(bottomLeft.rotation).toBe(0);
    expect(topLeft.rotation).toBeCloseTo(Math.PI / 2);
    expect(topRight.rotation).toBeCloseTo(Math.PI);
    expect(bottomRight.rotation).toBeCloseTo(-Math.PI / 2);
  });

  it("places entrance outside the loop and exit inside the first corner", () => {
    const entrance = getEntranceMarkerPresentation(gameConfig.board.pathCells);
    const exit = getExitMarkerPresentation(gameConfig.board.pathCells);

    expect(entrance).toMatchObject({
      x: gameConfig.board.pathCells[0]?.x,
      y: 725,
      rotation: 0,
    });
    expect(exit).toMatchObject({
      x: 186,
      y: 613,
      rotation: 0,
    });
  });

  it("uses the next bottom path cell as the core entrance run-in", () => {
    const coreEntrance = getCoreEntrancePathCell(gameConfig.board.pathCells);
    const leakTarget = getEnemyLeakTargetPresentation(gameConfig.board.pathCells);

    expect(coreEntrance).toMatchObject({
      index: 17,
      x: 186,
      y: 669,
    });
    expect(leakTarget).toMatchObject({
      x: 186,
      y: 550,
    });
  });

  it("blends enemy presentation from the external entrance into runtime path position", () => {
    const enemy = createGrunt({ pathProgress: 0.5 });
    const intro = { x: 0, y: 0 };
    const runtime = { x: 0, y: 0 };

    writeEnemyIntroPosition(gameConfig.board.pathCells, enemy, 0, intro);
    writeEnemyPosition(gameConfig.board.pathCells, enemy, runtime);

    expect(intro).toMatchObject({ x: 102, y: 725 });
    expect(runtime).toMatchObject({ x: 102, y: 627 });

    writeEnemyIntroPosition(gameConfig.board.pathCells, enemy, 1, intro);

    expect(intro).toEqual(runtime);
  });

  it("renders exit smash impact from the road cell before the exit", () => {
    const exitSmashPoint = { x: 0, y: 0 };
    const lapStartPoint = { x: 0, y: 0 };
    const exitRoadCell = gameConfig.board.pathCells.at(-1)!;

    writeBossPosition(gameConfig.board.pathCells, createBossState({
      pathProgress: gameConfig.board.pathCells.length - 1,
      activeAbility: { id: "exitSmash", elapsedMs: 2200, impactApplied: true },
    }), exitSmashPoint);
    writeBossPosition(gameConfig.board.pathCells, createBossState({
      pathProgress: gameConfig.board.pathCells.length,
      activeAbility: null,
    }), lapStartPoint);

    expect(exitSmashPoint).toMatchObject({
      x: exitRoadCell.x,
      y: exitRoadCell.y,
    });
    expect(lapStartPoint).toMatchObject({
      x: gameConfig.board.pathCells[0]?.x,
      y: gameConfig.board.pathCells[0]?.y,
    });
  });

  it("uses side-facing plus horizontal flip across vertical and horizontal loop segments", () => {
    const cells = gameConfig.board.pathCells;

    expect(getEnemySideFacing(cells, 0.5)).toBe("right");
    expect(getEnemySideFacing(cells, 7.25)).toBe("right");
    expect(getEnemySideFacing(cells, 10.25)).toBe("left");
    expect(getEnemySideFacing(cells, 15.25)).toBe("left");
  });

  it("preloads move, hit, and death spritesheets for every normal enemy", () => {
    const preloadKeys = new Set(phaserPreloadAssets.map(asset => asset.key));

    gameConfig.enemies.forEach((enemy) => {
      enemyAnimationNames.forEach((animationName) => {
        enemyAnimationDirections.forEach((direction) => {
          const textureKey = getEnemyAnimationTextureKey(enemy.id, animationName, direction);

          expect(textureKey).toBe(`enemies.${enemy.id}.${animationName}.${direction}`);
          expect(getEnemyPhaserAnimationKey(enemy.id, animationName, direction)).toBe(`${textureKey}.anim`);
          expect(preloadKeys.has(textureKey)).toBe(true);
        });
      });
    });
  });

  it("preloads every boss spritesheet from existing public files", () => {
    const preloadKeys = new Set(phaserPreloadAssets.map(asset => asset.key));

    bossAnimationNames.forEach((animationName) => {
      bossAnimationDirections.forEach((direction) => {
        const textureKey = getBossAnimationTextureKey(animationName, direction);
        const asset = phaserPreloadAssets.find(candidate => candidate.key === textureKey);

        expect(textureKey).toBe(`enemies.boss-ogre.${animationName}.${direction}`);
        expect(getBossPhaserAnimationKey(animationName, direction)).toBe(`${textureKey}.anim`);
        expect(preloadKeys.has(textureKey)).toBe(true);
        expect(asset?.type).toBe("spritesheet");
        expect(asset && `../public${asset.src}` in publicBossAssets).toBe(true);
      });
    });
  });

  it("keeps boss animation keys collision-free", () => {
    const bossKeys = bossAnimationNames.map(animationName => getBossPhaserAnimationKey(animationName));
    const enemyKeys = gameConfig.enemies.flatMap(enemy => (
      enemyAnimationNames.map(animationName => getEnemyPhaserAnimationKey(enemy.id, animationName))
    ));

    expect(new Set(bossKeys).size).toBe(bossKeys.length);
    bossKeys.forEach((key) => {
      expect(enemyKeys).not.toContain(key);
    });
  });

  it("keeps the boss sprite above tower body layers", () => {
    expect(bossSpritePresentation.spriteDepth).toBeGreaterThan(27);
    expect(bossSpritePresentation.overlayDepth).toBeGreaterThan(bossSpritePresentation.spriteDepth);
  });

  it("applies the small road and enemy scale pass without resizing the boss", () => {
    const firstCell = gameConfig.board.pathCells[0]!;
    const nextCell = gameConfig.board.pathCells[1]!;
    const roadStep = Math.hypot(nextCell.x - firstCell.x, nextCell.y - firstCell.y);

    expect(roadStep).toBe(84);
    expect(getEnemySpritePresentation("grunt").displaySize).toBe(Math.round(44 * 1.1));
    expect(getEnemySpritePresentation("runner").displaySize).toBe(Math.round(76 * 1.1));
    expect(bossSpritePresentation.displaySize).toBe(132);
  });
});
