import { getArenaFootprint, renderSceneGrounding } from "@app/phaser/scenes/runSceneGround";
import { getPathChevronPresentation, renderPathFlow } from "@app/phaser/scenes/runScenePathFlow";
import { gameConfig } from "@entities/game-session/model/config";
import { createRun, createSnapshot } from "@entities/game-session/model/simulation";
import { describe, expect, it } from "vitest";

function createGraphicsStub(): {
  readonly graphics: Parameters<typeof renderSceneGrounding>[0]
  callCount: () => number
} {
  let calls = 0;
  const record = (): void => {
    calls++;
  };
  const graphics = {
    clear: record,
    fillStyle: record,
    lineStyle: record,
    fillRoundedRect: record,
    strokeRoundedRect: record,
    beginPath: record,
    moveTo: record,
    lineTo: record,
    strokePath: record,
    fillCircle: record,
    strokeCircle: record,
  };

  return {
    graphics: graphics as unknown as Parameters<typeof renderSceneGrounding>[0],
    callCount: () => calls,
  };
}

describe("scene grounding render helpers", () => {
  it("encloses every slot and path cell within the padded arena footprint", () => {
    const footprint = getArenaFootprint(gameConfig.board);
    const points = [...gameConfig.board.slots, ...gameConfig.board.pathCells];

    points.forEach((point) => {
      expect(point.x).toBeGreaterThanOrEqual(footprint.x);
      expect(point.x).toBeLessThanOrEqual(footprint.x + footprint.width);
      expect(point.y).toBeGreaterThanOrEqual(footprint.y);
      expect(point.y).toBeLessThanOrEqual(footprint.y + footprint.height);
    });

    expect(footprint.x).toBeLessThan(Math.min(...points.map(point => point.x)));
    expect(footprint.y).toBeLessThan(Math.min(...points.map(point => point.y)));
  });

  it("renders scene grounding without throwing", () => {
    const { graphics, callCount } = createGraphicsStub();

    expect(() => renderSceneGrounding(graphics, gameConfig.board)).not.toThrow();
    expect(callCount()).toBeGreaterThan(0);
  });
});

describe("path flow render helpers", () => {
  it("orients chevrons along the travel direction toward the next path cell", () => {
    const cells = gameConfig.board.pathCells;
    const cell = cells[1]!;
    const next = cells[2]!;
    const chevron = getPathChevronPresentation(cells, cell, 0);

    expect(chevron).toMatchObject({ x: cell.x, y: cell.y });
    expect(chevron.rotation).toBeCloseTo(Math.atan2(next.y - cell.y, next.x - cell.x));
  });

  it("orients the core entrance chevron into the central cube", () => {
    const cells = gameConfig.board.pathCells;
    const cell = cells[17]!;
    const chevron = getPathChevronPresentation(cells, cell, 0);

    expect(chevron).toMatchObject({ x: 190, y: 659 });
    expect(chevron.rotation).toBeCloseTo(-Math.PI / 2);
  });

  it("renders a chevron for every path cell without throwing", () => {
    const snapshot = createSnapshot(createRun());
    const { graphics, callCount } = createGraphicsStub();

    expect(() => renderPathFlow(graphics, snapshot, 0)).not.toThrow();
    expect(callCount()).toBeGreaterThan(snapshot.board.pathCells.length);
  });
});
