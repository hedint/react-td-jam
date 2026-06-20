import { BootScene } from "@app/phaser/scenes/BootScene";
import { RunScene } from "@app/phaser/scenes/RunScene";
import Phaser from "phaser";

export function createPhaserGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#151923",
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: 540,
      height: 960,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      pixelArt: false,
    },
    scene: [BootScene, RunScene],
  });
}
