import {
  getBoardRoadPiecePresentation,
  getEnemyLeakTargetPresentation,
  getEntranceMarkerPresentation,
  getExitMarkerPresentation,
} from "@app/phaser/scenes/runSceneBoardArt";
import { writeEnemyIntroPosition, writeEnemyPosition } from "@app/phaser/scenes/runSceneRender";
import { getCoreEntrancePathCell } from "@entities/game-session/model/boardGeometry";
import { gameConfig } from "@entities/game-session/model/config";
import { createGrunt } from "@entities/game-session/model/simulation";
import { assetGroups } from "@shared/assets/manifest";
import { describe, expect, it } from "vitest";

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
      y: (gameConfig.board.pathCells[0]?.y ?? 0) + 51,
      rotation: 0,
    });
    expect(exit).toMatchObject({
      x: 186,
      y: 608,
      rotation: 0,
    });
  });

  it("uses the next bottom path cell as the core entrance run-in", () => {
    const coreEntrance = getCoreEntrancePathCell(gameConfig.board.pathCells);
    const leakTarget = getEnemyLeakTargetPresentation(gameConfig.board.pathCells);

    expect(coreEntrance).toMatchObject({
      index: 17,
      x: 190,
      y: 659,
    });
    expect(leakTarget).toMatchObject({
      x: 190,
      y: 551,
    });
  });

  it("blends enemy presentation from the external entrance into runtime path position", () => {
    const enemy = createGrunt({ pathProgress: 0.5 });
    const intro = { x: 0, y: 0 };
    const runtime = { x: 0, y: 0 };

    writeEnemyIntroPosition(gameConfig.board.pathCells, enemy, 0, intro);
    writeEnemyPosition(gameConfig.board.pathCells, enemy, runtime);

    expect(intro).toMatchObject({ x: 110, y: 710 });
    expect(runtime).toMatchObject({ x: 110, y: 619 });

    writeEnemyIntroPosition(gameConfig.board.pathCells, enemy, 1, intro);

    expect(intro).toEqual(runtime);
  });
});
