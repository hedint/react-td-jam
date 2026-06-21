export type AssetGroup = "scene" | "towers" | "enemies" | "reactions" | "ui";
export type AssetUsage = "phaser" | "css" | "both";

interface BaseAsset {
  readonly group: AssetGroup
  readonly key: string
  readonly src: string
  readonly usage: AssetUsage
  readonly placeholder?: true
}

export interface ImageAsset extends BaseAsset {
  readonly type: "image"
}

export interface SvgAsset extends BaseAsset {
  readonly type: "svg"
  readonly width: number
  readonly height: number
}

export interface SpriteSheetAsset extends BaseAsset {
  readonly type: "spritesheet"
  readonly frame: {
    readonly width: number
    readonly height: number
    readonly margin?: number
    readonly spacing?: number
  }
}

export interface AtlasAsset extends BaseAsset {
  readonly type: "atlas"
  readonly atlasSrc: string
}

export type AssetDefinition = ImageAsset | SvgAsset | SpriteSheetAsset | AtlasAsset;

type ManifestGroups = {
  readonly [Group in AssetGroup]: Readonly<Record<string, AssetDefinition & { readonly group: Group }>>
};

export const assetGroups = {
  scene: {
    cavernFortressFloor: {
      type: "svg",
      group: "scene",
      key: "scene.cavern-fortress.floor",
      src: "/assets/scene/cavern-fortress-floor.svg",
      width: 540,
      height: 960,
      usage: "phaser",
    },
    cavernFortressAtmosphere: {
      type: "svg",
      group: "scene",
      key: "scene.cavern-fortress.atmosphere",
      src: "/assets/scene/cavern-fortress-atmosphere.svg",
      width: 540,
      height: 960,
      usage: "phaser",
    },
    cavernBackdropPlaceholder: {
      type: "svg",
      group: "scene",
      key: "scene.cavern-backdrop.placeholder",
      src: "/assets/scene/placeholder-backdrop.svg",
      width: 540,
      height: 960,
      usage: "phaser",
      placeholder: true,
    },
  },
  towers: {
    waterCannon: {
      type: "image",
      group: "towers",
      key: "towers.water-cannon",
      src: "/assets/towers/water-cannon.png",
      usage: "phaser",
    },
    oilPump: {
      type: "image",
      group: "towers",
      key: "towers.oil-pump",
      src: "/assets/towers/oil-pump.png",
      usage: "phaser",
    },
    sparkDischarger: {
      type: "image",
      group: "towers",
      key: "towers.spark-discharger",
      src: "/assets/towers/spark-discharger.png",
      usage: "phaser",
    },
    magmaCrane: {
      type: "image",
      group: "towers",
      key: "towers.magma-crane",
      src: "/assets/towers/magma-crane.png",
      usage: "phaser",
    },
    towerSpritePlaceholder: {
      type: "svg",
      group: "towers",
      key: "towers.sprite.placeholder",
      src: "/assets/towers/placeholder-tower.svg",
      width: 96,
      height: 96,
      usage: "phaser",
      placeholder: true,
    },
  },
  enemies: {
    enemySpritePlaceholder: {
      type: "svg",
      group: "enemies",
      key: "enemies.sprite.placeholder",
      src: "/assets/enemies/placeholder-enemy.svg",
      width: 96,
      height: 96,
      usage: "phaser",
      placeholder: true,
    },
  },
  reactions: {
    reagentWaterPuddle: {
      type: "svg",
      group: "reactions",
      key: "reactions.reagent-water.puddle",
      src: "/assets/reactions/reagent-water-puddle.svg",
      width: 160,
      height: 160,
      usage: "phaser",
    },
    reagentOilSlick: {
      type: "svg",
      group: "reactions",
      key: "reactions.reagent-oil.slick",
      src: "/assets/reactions/reagent-oil-slick.svg",
      width: 160,
      height: 160,
      usage: "phaser",
    },
    reagentSparkCharge: {
      type: "svg",
      group: "reactions",
      key: "reactions.reagent-spark.charge",
      src: "/assets/reactions/reagent-spark-charge.svg",
      width: 160,
      height: 160,
      usage: "phaser",
    },
    reagentHeatScorch: {
      type: "svg",
      group: "reactions",
      key: "reactions.reagent-heat.scorch",
      src: "/assets/reactions/reagent-heat-scorch.svg",
      width: 160,
      height: 160,
      usage: "phaser",
    },
    electroPuddle: {
      type: "svg",
      group: "reactions",
      key: "reactions.electro-puddle.decal",
      src: "/assets/reactions/electro-puddle.svg",
      width: 160,
      height: 96,
      usage: "phaser",
    },
    steam: {
      type: "svg",
      group: "reactions",
      key: "reactions.steam.plume",
      src: "/assets/reactions/steam-plume.svg",
      width: 160,
      height: 128,
      usage: "phaser",
    },
    fire: {
      type: "svg",
      group: "reactions",
      key: "reactions.fire.decal",
      src: "/assets/reactions/fire-decal.svg",
      width: 160,
      height: 96,
      usage: "phaser",
    },
    stormCloud: {
      type: "svg",
      group: "reactions",
      key: "reactions.storm-cloud.plume",
      src: "/assets/reactions/storm-cloud.svg",
      width: 160,
      height: 128,
      usage: "phaser",
    },
    fireVortex: {
      type: "svg",
      group: "reactions",
      key: "reactions.fire-vortex.plume",
      src: "/assets/reactions/fire-vortex.svg",
      width: 160,
      height: 128,
      usage: "phaser",
    },
    fireStorm: {
      type: "svg",
      group: "reactions",
      key: "reactions.fire-storm.plume",
      src: "/assets/reactions/fire-storm.svg",
      width: 192,
      height: 160,
      usage: "phaser",
    },
    reactionDecalPlaceholder: {
      type: "svg",
      group: "reactions",
      key: "reactions.decal.placeholder",
      src: "/assets/reactions/placeholder-reaction.svg",
      width: 128,
      height: 96,
      usage: "phaser",
      placeholder: true,
    },
  },
  ui: {
    placeholder: {
      type: "svg",
      group: "ui",
      key: "ui.placeholder",
      src: "/assets/ui/placeholder.svg",
      width: 96,
      height: 96,
      usage: "both",
      placeholder: true,
    },
    ironPanel: {
      type: "svg",
      group: "ui",
      key: "ui.panel.iron",
      src: "/assets/ui/panel-iron-plate.svg",
      width: 192,
      height: 96,
      usage: "both",
    },
    brassCardFrame: {
      type: "svg",
      group: "ui",
      key: "ui.card.brass-frame",
      src: "/assets/ui/card-brass-frame.svg",
      width: 160,
      height: 220,
      usage: "both",
    },
    rivetChip: {
      type: "svg",
      group: "ui",
      key: "ui.chip.rivet",
      src: "/assets/ui/chip-rivet-frame.svg",
      width: 96,
      height: 40,
      usage: "both",
    },
  },
} as const satisfies ManifestGroups;

export const loadableAssets = [
  assetGroups.scene.cavernFortressFloor,
  assetGroups.scene.cavernFortressAtmosphere,
  assetGroups.scene.cavernBackdropPlaceholder,
  assetGroups.towers.waterCannon,
  assetGroups.towers.oilPump,
  assetGroups.towers.sparkDischarger,
  assetGroups.towers.magmaCrane,
  assetGroups.towers.towerSpritePlaceholder,
  assetGroups.enemies.enemySpritePlaceholder,
  assetGroups.reactions.reagentWaterPuddle,
  assetGroups.reactions.reagentOilSlick,
  assetGroups.reactions.reagentSparkCharge,
  assetGroups.reactions.reagentHeatScorch,
  assetGroups.reactions.electroPuddle,
  assetGroups.reactions.steam,
  assetGroups.reactions.fire,
  assetGroups.reactions.stormCloud,
  assetGroups.reactions.fireVortex,
  assetGroups.reactions.fireStorm,
  assetGroups.reactions.reactionDecalPlaceholder,
  assetGroups.ui.placeholder,
  assetGroups.ui.ironPanel,
  assetGroups.ui.brassCardFrame,
  assetGroups.ui.rivetChip,
] as const satisfies readonly AssetDefinition[];

export const phaserPreloadAssets = (loadableAssets as readonly AssetDefinition[])
  .filter(asset => asset.usage === "phaser" || asset.usage === "both");

export const visualSkin = {
  colors: {
    page: "#101217",
    fieldIron: "#1c1a17",
    fieldStone: "#2a2520",
    panelIron: "#181a1d",
    panelIronLight: "#2a2d31",
    panelBorder: "#6d5944",
    brass: "#c8a76a",
    copper: "#b66f3b",
    magma: "#f08a28",
    electric: "#61d6d6",
    steam: "#d7eff0",
    text: "#f3ead8",
    textMuted: "#b9aa91",
    danger: "#e05b3f",
  },
  radii: {
    panel: 8,
    chip: 6,
    card: 8,
  },
} as const;

export type LoadableAsset = typeof loadableAssets[number];
export type AssetKey = LoadableAsset["key"];

export const assets = assetGroups.ui;
