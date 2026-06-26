import { assetGroups, loadableAssets, phaserPreloadAssets, resolvePublicAssetUrl, visualSkin } from "@shared/assets/manifest";
import { describe, expect, it } from "vitest";

const publicAssets = import.meta.glob("../public/assets/**/*", {
  eager: true,
  query: "?url",
});

describe("asset manifest", () => {
  it("declares every Phase 0.5 asset category", () => {
    expect(Object.keys(assetGroups).sort()).toEqual(["board", "enemies", "guides", "reactions", "scene", "towers", "ui"]);
  });

  it("keeps load keys unique and stable-looking", () => {
    const keys = loadableAssets.map(asset => asset.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every(key => /^[a-z]+(?:[.-][a-z0-9]+)*$/.test(key))).toBe(true);
  });

  it("points loadable assets at committed public files", () => {
    loadableAssets.forEach((asset) => {
      const publicGlobPath = `../public${asset.src}`;

      expect(asset.src).toMatch(/^\/assets\//);
      expect(publicGlobPath in publicAssets).toBe(true);
    });
  });

  it("marks intentional placeholder fallback assets explicitly", () => {
    const placeholders = loadableAssets.filter(asset => asset.key.endsWith(".placeholder"));

    expect(placeholders.length).toBeGreaterThan(0);
    expect(placeholders.every(asset => "placeholder" in asset && asset.placeholder === true)).toBe(true);
  });

  it("keeps Phaser preload assets render-loadable", () => {
    expect(phaserPreloadAssets.every(asset => asset.usage === "phaser" || asset.usage === "both")).toBe(true);
    expect(phaserPreloadAssets.every((asset) => {
      if (asset.type !== "atlas") {
        return true;
      }

      return asset.atlasSrc.startsWith("/assets/");
    })).toBe(true);
  });

  it("preloads all field Шмыг companion strips through Phaser", () => {
    const fieldShmygAssets = Object.values(assetGroups.guides)
      .filter(asset => asset.key.startsWith("guides.shmyg.field."));

    expect(fieldShmygAssets).toHaveLength(12);
    expect(fieldShmygAssets.every(asset => asset.type === "spritesheet")).toBe(true);
    expect(fieldShmygAssets.every(asset => asset.usage === "phaser")).toBe(true);
    expect(fieldShmygAssets.every((asset) => {
      if (asset.type !== "spritesheet") {
        return false;
      }

      return asset.frame.width === 128 && asset.frame.height === 128;
    })).toBe(true);
  });

  it("resolves public asset URLs against the Vite base path", () => {
    expect(resolvePublicAssetUrl("/assets/board/road-straight.png", "/")).toBe("/assets/board/road-straight.png");
    expect(resolvePublicAssetUrl("/assets/board/road-straight.png", "/react-td-jam/")).toBe("/react-td-jam/assets/board/road-straight.png");
  });

  it("exposes the shared iron and brass skin tokens", () => {
    expect(visualSkin.colors).toMatchObject({
      brass: "#c8a76a",
      electric: "#61d6d6",
      magma: "#f08a28",
      panelIron: "#181a1d",
    });
    expect(visualSkin.radii.card).toBeLessThanOrEqual(8);
  });
});
