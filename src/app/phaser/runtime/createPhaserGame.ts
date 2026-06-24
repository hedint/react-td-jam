import { BootScene } from "@app/phaser/scenes/BootScene";
import { EnemyDemoScene } from "@app/phaser/scenes/EnemyDemoScene";
import { RunScene } from "@app/phaser/scenes/RunScene";
import { TowerDemoScene } from "@app/phaser/scenes/TowerDemoScene";
import Phaser from "phaser";

export type PhaserTargetScene = "RunScene" | "TowerDemoScene" | "EnemyDemoScene";

export function createPhaserGame(parent: HTMLElement, targetScene: PhaserTargetScene = "RunScene"): Phaser.Game {
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
    scene: [new BootScene(targetScene), RunScene, TowerDemoScene, EnemyDemoScene],
  });
}
