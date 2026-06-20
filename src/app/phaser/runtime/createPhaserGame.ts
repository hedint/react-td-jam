import { BootScene } from "@app/phaser/scenes/BootScene";
import { SmokeScene } from "@app/phaser/scenes/SmokeScene";
import Phaser from "phaser";

export function createPhaserGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#151923",
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: 1280,
      height: 720,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      pixelArt: false,
    },
    scene: [BootScene, SmokeScene],
  });
}
