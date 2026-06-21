import type { AssetDefinition } from "@shared/assets/manifest";
import { phaserPreloadAssets } from "@shared/assets/manifest";
import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    phaserPreloadAssets.forEach(asset => loadAsset(this.load, asset));
  }

  create(): void {
    this.scene.start("RunScene");
  }
}

function loadAsset(loader: Phaser.Loader.LoaderPlugin, asset: AssetDefinition): void {
  switch (asset.type) {
    case "svg":
      loader.svg(asset.key, asset.src, {
        width: asset.width,
        height: asset.height,
      });
      return;
    case "image":
      loader.image(asset.key, asset.src);
      return;
    case "spritesheet":
      loader.spritesheet(asset.key, asset.src, {
        frameWidth: asset.frame.width,
        frameHeight: asset.frame.height,
        margin: asset.frame.margin,
        spacing: asset.frame.spacing,
      });
      return;
    case "atlas":
      loader.atlas(asset.key, asset.src, asset.atlasSrc);
      return;
    default:
      return asset satisfies never;
  }
}
