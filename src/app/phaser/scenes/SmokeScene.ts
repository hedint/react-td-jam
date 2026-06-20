import { createGameSession, createSnapshot, stepGameSession } from "@entities/game-session/model/simulation";
import { assets } from "@shared/assets/manifest";
import { gameEvents } from "@shared/lib/event-bus/gameEvents";
import Phaser from "phaser";

const TICK_STEP_MS = 1000 / 30;

export class SmokeScene extends Phaser.Scene {
  private session = createGameSession();
  private accumulatorMs = 0;
  private placeholder?: Phaser.GameObjects.Image;

  constructor() {
    super("SmokeScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#151923");
    this.placeholder = this.add.image(640, 360, assets.placeholder.key);
    this.placeholder.setDepth(1);

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const tap = {
        x: Math.round(pointer.worldX),
        y: Math.round(pointer.worldY),
      };

      this.session = {
        ...this.session,
        lastTap: tap,
      };
      gameEvents.emit("pointer:tap", tap);
      this.publishSnapshot();
    });

    this.scale.on("resize", this.handleResize, this);
    this.handleResize();
    this.publishSnapshot();
  }

  update(_time: number, deltaMs: number): void {
    this.accumulatorMs += deltaMs;

    while (this.accumulatorMs >= TICK_STEP_MS) {
      this.session = stepGameSession(this.session, TICK_STEP_MS);
      this.accumulatorMs -= TICK_STEP_MS;
    }

    if (this.placeholder) {
      this.placeholder.rotation = this.session.elapsedMs / 1800;
    }

    this.publishSnapshot();
  }

  private handleResize(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.cameras.main.setViewport(0, 0, width, height);
    this.cameras.main.setZoom(Math.min(width / 1280, height / 720));
    this.cameras.main.centerOn(640, 360);

    gameEvents.emit("viewport:resize", { width, height });
  }

  private publishSnapshot(): void {
    gameEvents.emit("session:snapshot", {
      ...createSnapshot(this.session),
      fps: Math.round(this.game.loop.actualFps),
      viewport: {
        width: this.scale.width,
        height: this.scale.height,
      },
    });
  }
}
