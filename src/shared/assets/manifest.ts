/* eslint-disable max-lines */

export type AssetGroup = "scene" | "board" | "towers" | "enemies" | "reactions" | "ui" | "guides";
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

type EnemySpriteAssetId = "grunt" | "swarm" | "tank" | "flyer" | "runner" | "insulated" | "flameproof";
type EnemySpriteAnim = "move" | "hit" | "death";
type BossSpriteAnim = "crawl" | "hit" | "vulnerable" | "death" | "leap-prepare" | "leap-air" | "smash" | "blackout-cast" | "summon-roar";
type ShmygSpriteAnim = "idle" | "talk" | "excited" | "angry";

function enemySpriteSheetAsset(
  enemyId: EnemySpriteAssetId,
  animationName: EnemySpriteAnim,
): SpriteSheetAsset & { readonly group: "enemies" } {
  return {
    type: "spritesheet",
    group: "enemies",
    key: `enemies.${enemyId}.${animationName}.side`,
    src: `/assets/enemies/${enemyId}/${enemyId}-${animationName}-side.png`,
    frame: {
      width: 256,
      height: 256,
    },
    usage: "phaser",
  };
}

function bossSpriteSheetAsset(animationName: BossSpriteAnim): SpriteSheetAsset & { readonly group: "enemies" } {
  return {
    type: "spritesheet",
    group: "enemies",
    key: `enemies.boss-ogre.${animationName}.side`,
    src: `/assets/enemies/boss-ogre/boss-ogre-${animationName}-side.png`,
    frame: {
      width: 384,
      height: 384,
    },
    usage: "phaser",
  };
}

function enemyHudPreviewAsset(enemyId: EnemySpriteAssetId | "boss-ogre"): ImageAsset & { readonly group: "enemies" } {
  return {
    type: "image",
    group: "enemies",
    key: `enemies.${enemyId}.hud-preview`,
    src: `/assets/enemies/hud/${enemyId}-preview.png`,
    usage: "css",
  };
}

function shmygSpriteSheetAsset(animationName: ShmygSpriteAnim): SpriteSheetAsset & { readonly group: "guides" } {
  return {
    type: "spritesheet",
    group: "guides",
    key: `guides.shmyg.${animationName}`,
    src: `/assets/guides/shmyg/shmyg-${animationName}-strip.png`,
    frame: {
      width: 384,
      height: 384,
    },
    usage: "css",
  };
}

export const assetGroups = {
  scene: {
    cavernFortressFloor: {
      type: "image",
      group: "scene",
      key: "scene.cavern-fortress.floor",
      src: "/assets/scene/cavern-fortress-backdrop-v1.png",
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
  board: {
    roadStraight: {
      type: "image",
      group: "board",
      key: "board.road.straight",
      src: "/assets/board/road-straight.png",
      usage: "phaser",
    },
    roadCorner: {
      type: "image",
      group: "board",
      key: "board.road.corner",
      src: "/assets/board/road-corner.png",
      usage: "phaser",
    },
    slotSocket: {
      type: "image",
      group: "board",
      key: "board.slot.socket",
      src: "/assets/board/slot-socket.png",
      usage: "phaser",
    },
    slotSocketCorner: {
      type: "image",
      group: "board",
      key: "board.slot.socket-corner",
      src: "/assets/board/slot-socket-corner.png",
      usage: "phaser",
    },
    markerEntrance: {
      type: "image",
      group: "board",
      key: "board.marker.entrance",
      src: "/assets/board/marker-entrance.png",
      usage: "phaser",
    },
    markerExit: {
      type: "image",
      group: "board",
      key: "board.marker.exit",
      src: "/assets/board/marker-exit.png",
      usage: "phaser",
    },
    greatStillCore: {
      type: "image",
      group: "board",
      key: "board.core.great-still",
      src: "/assets/board/great-still-core-v2.png",
      usage: "phaser",
    },
  },
  towers: {
    waterCannonBase: {
      type: "image",
      group: "towers",
      key: "towers.water-cannon.base",
      src: "/assets/towers/water-cannon-base.png",
      usage: "phaser",
    },
    waterCannonHead: {
      type: "image",
      group: "towers",
      key: "towers.water-cannon.head",
      src: "/assets/towers/water-cannon-head.png",
      usage: "phaser",
    },
    oilPumpBase: {
      type: "image",
      group: "towers",
      key: "towers.oil-pump.base",
      src: "/assets/towers/oil-pump-base.png",
      usage: "phaser",
    },
    oilPumpHead: {
      type: "image",
      group: "towers",
      key: "towers.oil-pump.head",
      src: "/assets/towers/oil-pump-head.png",
      usage: "phaser",
    },
    sparkDischargerBase: {
      type: "image",
      group: "towers",
      key: "towers.spark-discharger.base",
      src: "/assets/towers/spark-discharger-base.png",
      usage: "phaser",
    },
    sparkDischargerHead: {
      type: "image",
      group: "towers",
      key: "towers.spark-discharger.head",
      src: "/assets/towers/spark-discharger-head.png",
      usage: "phaser",
    },
    magmaCraneBase: {
      type: "image",
      group: "towers",
      key: "towers.magma-crane.base",
      src: "/assets/towers/magma-crane-base.png",
      usage: "phaser",
    },
    magmaCraneHead: {
      type: "image",
      group: "towers",
      key: "towers.magma-crane.head",
      src: "/assets/towers/magma-crane-head.png",
      usage: "phaser",
    },
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
    gruntMoveSide: enemySpriteSheetAsset("grunt", "move"),
    gruntHitSide: enemySpriteSheetAsset("grunt", "hit"),
    gruntDeathSide: enemySpriteSheetAsset("grunt", "death"),
    swarmMoveSide: enemySpriteSheetAsset("swarm", "move"),
    swarmHitSide: enemySpriteSheetAsset("swarm", "hit"),
    swarmDeathSide: enemySpriteSheetAsset("swarm", "death"),
    tankMoveSide: enemySpriteSheetAsset("tank", "move"),
    tankHitSide: enemySpriteSheetAsset("tank", "hit"),
    tankDeathSide: enemySpriteSheetAsset("tank", "death"),
    flyerMoveSide: enemySpriteSheetAsset("flyer", "move"),
    flyerHitSide: enemySpriteSheetAsset("flyer", "hit"),
    flyerDeathSide: enemySpriteSheetAsset("flyer", "death"),
    runnerMoveSide: enemySpriteSheetAsset("runner", "move"),
    runnerHitSide: enemySpriteSheetAsset("runner", "hit"),
    runnerDeathSide: enemySpriteSheetAsset("runner", "death"),
    insulatedMoveSide: enemySpriteSheetAsset("insulated", "move"),
    insulatedHitSide: enemySpriteSheetAsset("insulated", "hit"),
    insulatedDeathSide: enemySpriteSheetAsset("insulated", "death"),
    flameproofMoveSide: enemySpriteSheetAsset("flameproof", "move"),
    flameproofHitSide: enemySpriteSheetAsset("flameproof", "hit"),
    flameproofDeathSide: enemySpriteSheetAsset("flameproof", "death"),
    gruntHudPreview: enemyHudPreviewAsset("grunt"),
    swarmHudPreview: enemyHudPreviewAsset("swarm"),
    tankHudPreview: enemyHudPreviewAsset("tank"),
    flyerHudPreview: enemyHudPreviewAsset("flyer"),
    runnerHudPreview: enemyHudPreviewAsset("runner"),
    insulatedHudPreview: enemyHudPreviewAsset("insulated"),
    flameproofHudPreview: enemyHudPreviewAsset("flameproof"),
    bossOgreHudPreview: enemyHudPreviewAsset("boss-ogre"),
    bossOgreCrawlSide: bossSpriteSheetAsset("crawl"),
    bossOgreHitSide: bossSpriteSheetAsset("hit"),
    bossOgreVulnerableSide: bossSpriteSheetAsset("vulnerable"),
    bossOgreDeathSide: bossSpriteSheetAsset("death"),
    bossOgreLeapPrepareSide: bossSpriteSheetAsset("leap-prepare"),
    bossOgreLeapAirSide: bossSpriteSheetAsset("leap-air"),
    bossOgreSmashSide: bossSpriteSheetAsset("smash"),
    bossOgreBlackoutCastSide: bossSpriteSheetAsset("blackout-cast"),
    bossOgreSummonRoarSide: bossSpriteSheetAsset("summon-roar"),
    bossOgrePlaceholder: {
      type: "svg",
      group: "enemies",
      key: "enemies.boss-ogre.placeholder",
      src: "/assets/enemies/boss-ogre-placeholder.svg",
      width: 384,
      height: 384,
      usage: "phaser",
      placeholder: true,
    },
    runnerSeedSide: {
      type: "image",
      group: "enemies",
      key: "enemies.runner.seed.side",
      src: "/assets/enemies/runner/runner-seed-side-01.png",
      usage: "phaser",
    },
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
    reagentWaterRipple: {
      type: "spritesheet",
      group: "reactions",
      key: "reactions.reagent-water.ripple",
      src: "/assets/reactions/reagent-water-ripple-sheet.png",
      frame: {
        width: 192,
        height: 192,
      },
      usage: "phaser",
    },
    reagentOilSlick: {
      type: "spritesheet",
      group: "reactions",
      key: "reactions.reagent-oil.slick",
      src: "/assets/reactions/reagent-oil-slick-sheet.png",
      frame: {
        width: 192,
        height: 192,
      },
      usage: "phaser",
    },
    reagentSparkCharge: {
      type: "spritesheet",
      group: "reactions",
      key: "reactions.reagent-spark.charge",
      src: "/assets/reactions/reagent-spark-charge-sheet.png",
      frame: {
        width: 192,
        height: 192,
      },
      usage: "phaser",
    },
    reagentHeatScorch: {
      type: "spritesheet",
      group: "reactions",
      key: "reactions.reagent-heat.scorch",
      src: "/assets/reactions/reagent-heat-scorch-sheet.png",
      frame: {
        width: 192,
        height: 192,
      },
      usage: "phaser",
    },
    electroPuddle: {
      type: "spritesheet",
      group: "reactions",
      key: "reactions.electro-puddle.decal",
      src: "/assets/reactions/electro-puddle-sheet.png",
      frame: {
        width: 192,
        height: 192,
      },
      usage: "phaser",
    },
    steam: {
      type: "spritesheet",
      group: "reactions",
      key: "reactions.steam.plume",
      src: "/assets/reactions/steam-plume-sheet.png",
      frame: {
        width: 192,
        height: 192,
      },
      usage: "phaser",
    },
    fire: {
      type: "spritesheet",
      group: "reactions",
      key: "reactions.fire.decal",
      src: "/assets/reactions/fire-decal-sheet.png",
      frame: {
        width: 192,
        height: 192,
      },
      usage: "phaser",
    },
    stormCloud: {
      type: "spritesheet",
      group: "reactions",
      key: "reactions.storm-cloud.plume",
      src: "/assets/reactions/storm-cloud-sheet.png",
      frame: {
        width: 192,
        height: 192,
      },
      usage: "phaser",
    },
    fireVortex: {
      type: "spritesheet",
      group: "reactions",
      key: "reactions.fire-vortex.plume",
      src: "/assets/reactions/fire-vortex-sheet.png",
      frame: {
        width: 192,
        height: 192,
      },
      usage: "phaser",
    },
    fireStorm: {
      type: "spritesheet",
      group: "reactions",
      key: "reactions.fire-storm.plume",
      src: "/assets/reactions/fire-storm-sheet.png",
      frame: {
        width: 192,
        height: 192,
      },
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
  guides: {
    shmygSeedApproved: {
      type: "image",
      group: "guides",
      key: "guides.shmyg.seed-approved",
      src: "/assets/guides/shmyg/shmyg-seed-approved-384.png",
      usage: "css",
    },
    shmygIdle: shmygSpriteSheetAsset("idle"),
    shmygTalk: shmygSpriteSheetAsset("talk"),
    shmygExcited: shmygSpriteSheetAsset("excited"),
    shmygAngry: shmygSpriteSheetAsset("angry"),
  },
} as const satisfies ManifestGroups;

export const loadableAssets = [
  ...Object.values(assetGroups.scene),
  ...Object.values(assetGroups.board),
  ...Object.values(assetGroups.towers),
  ...Object.values(assetGroups.enemies),
  ...Object.values(assetGroups.reactions),
  ...Object.values(assetGroups.ui),
  ...Object.values(assetGroups.guides),
] satisfies readonly AssetDefinition[];

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

export function resolvePublicAssetUrl(src: string, baseUrl = import.meta.env.BASE_URL): string {
  if (!src.startsWith("/")) {
    return src;
  }

  return `${baseUrl.replace(/\/$/, "")}${src}`;
}
