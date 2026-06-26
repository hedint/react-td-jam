import type { AssetDefinition } from "@shared/assets/manifest";
import { phaserPreloadAssets, resolvePublicAssetUrl } from "@shared/assets/manifest";
import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor(private readonly targetScene = "RunScene") {
    super("BootScene");
  }

  preload(): void {
    phaserPreloadAssets.forEach(asset => loadAsset(this.load, asset));
  }

  create(): void {
    this.scene.start(this.targetScene);
  }
}

function loadAsset(loader: Phaser.Loader.LoaderPlugin, asset: AssetDefinition): void {
  const assetSrc = resolvePublicAssetUrl(asset.src);

  switch (asset.type) {
    case "svg":
      loader.svg(asset.key, assetSrc, {
        width: asset.width,
        height: asset.height,
      });
      return;
    case "image":
      loader.image(asset.key, assetSrc);
      return;
    case "spritesheet":
      loader.spritesheet(asset.key, assetSrc, {
        frameWidth: asset.frame.width,
        frameHeight: asset.frame.height,
        margin: asset.frame.margin,
        spacing: asset.frame.spacing,
      });
      return;
    case "atlas":
      loader.atlas(asset.key, assetSrc, resolvePublicAssetUrl(asset.atlasSrc));
      return;
    default:
      return asset satisfies never;
  }
}
