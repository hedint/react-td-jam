import { assets } from "@shared/assets/manifest";
import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    this.load.svg(assets.placeholder.key, assets.placeholder.src, {
      width: assets.placeholder.width,
      height: assets.placeholder.height,
    });
  }

  create(): void {
    this.scene.start("RunScene");
  }
}
