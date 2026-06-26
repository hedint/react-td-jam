# Reaction Asset Prompt Spec

## Reaction Set

P0 reactions:

- Электролужа;
- Пар;
- Пожар;
- Грозовое облако;
- Огненный вихрь;
- Огненный Шторм.

## Layer Rules

- Ground reactions sit on the path and can use decals/scorch/water shapes.
- Air reactions hover above the path and must not permanently hide enemies, HP bars, slots, or tower silhouettes.

## Readability Rules

- Электролужа: water pool shape plus electric arcs.
- Пар: soft plume, white/gray, vertical wisps.
- Пожар: oil burn shape, embers, scorch edge.
- Грозовое облако: cloud mass plus lightning strokes.
- Огненный вихрь: rotating flame funnel form.
- Огненный Шторм: T3 climax, larger presence, bounded opacity.

## Runtime Pairing

Use animated bitmap sheets for reaction identity and motion. Field callouts remain procedural text; generated reaction sheets should not receive extra procedural pulse, rotation, or per-cell frame offsets unless a later review explicitly asks for it.

## Generated Animated Reagent Pass

- Вода source: `asset-sources/public-assets/reactions/source/reagent-water-ripple-source-01.png`.
- Вода alpha source: `asset-sources/public-assets/reactions/source/reagent-water-ripple-alpha-01.png`.
- Вода runtime sheet: `public/assets/reactions/reagent-water-ripple-sheet.png`.
- Вода preview: `asset-sources/public-assets/reactions/source/reagent-water-ripple-preview-01.png`.
- Sheet format: 4 columns x 2 rows, 8 frames, 192x192 px per frame, centered top-down puddle anchor.
- Runtime loop: 500 ms per frame on one shared global frame clock in `RunSceneReagentPresenter`.
- Family rules:
  - Вода and Электролужа share the same glossy teal liquid shape language; Электролужа adds a clear cyan lightning web across the surface.
  - Нефть and Пожар share the same dark viscous slick shape language; Пожар adds flame tongues, ember edges, and scorch glow.
  - Искра and Грозовое облако share the same cyan lightning stroke language.
  - Жар, Пожар, Огненный вихрь, and Огненный Шторм share the same magma-orange fire language, scaled by reaction tier.

Generated runtime sheets:

| Effect | Runtime sheet | Source | Alpha source | Preview |
| --- | --- | --- | --- | --- |
| Вода | `public/assets/reactions/reagent-water-ripple-sheet.png` | `asset-sources/public-assets/reactions/source/reagent-water-ripple-source-01.png` | `asset-sources/public-assets/reactions/source/reagent-water-ripple-alpha-01.png` | `asset-sources/public-assets/reactions/source/reagent-water-ripple-preview-01.png` |
| Нефть | `public/assets/reactions/reagent-oil-slick-sheet.png` | `asset-sources/public-assets/reactions/source/reagent-oil-slick-source-01.png` | `asset-sources/public-assets/reactions/source/reagent-oil-slick-alpha-01.png` | `asset-sources/public-assets/reactions/source/reagent-oil-slick-preview-01.png` |
| Искра | `public/assets/reactions/reagent-spark-charge-sheet.png` | `asset-sources/public-assets/reactions/source/reagent-spark-charge-source-01.png` | `asset-sources/public-assets/reactions/source/reagent-spark-charge-alpha-01.png` | `asset-sources/public-assets/reactions/source/reagent-spark-charge-preview-01.png` |
| Жар | `public/assets/reactions/reagent-heat-scorch-sheet.png` | `asset-sources/public-assets/reactions/source/reagent-heat-scorch-source-01.png` | `asset-sources/public-assets/reactions/source/reagent-heat-scorch-alpha-01.png` | `asset-sources/public-assets/reactions/source/reagent-heat-scorch-preview-01.png` |
| Электролужа | `public/assets/reactions/electro-puddle-sheet.png` | `asset-sources/public-assets/reactions/source/electro-puddle-ripple-source-01.png` | `asset-sources/public-assets/reactions/source/electro-puddle-ripple-alpha-01.png` | `asset-sources/public-assets/reactions/source/electro-puddle-ripple-preview-01.png` |
| Пар | `public/assets/reactions/steam-plume-sheet.png` | `asset-sources/public-assets/reactions/source/steam-plume-loop-source-01.png` | `asset-sources/public-assets/reactions/source/steam-plume-loop-alpha-01.png` | `asset-sources/public-assets/reactions/source/steam-plume-loop-preview-01.png` |
| Пожар | `public/assets/reactions/fire-decal-sheet.png` | `asset-sources/public-assets/reactions/source/fire-decal-loop-source-01.png` | `asset-sources/public-assets/reactions/source/fire-decal-loop-alpha-01.png` | `asset-sources/public-assets/reactions/source/fire-decal-loop-preview-01.png` |
| Грозовое облако | `public/assets/reactions/storm-cloud-sheet.png` | `asset-sources/public-assets/reactions/source/storm-cloud-loop-source-01.png` | `asset-sources/public-assets/reactions/source/storm-cloud-loop-alpha-01.png` | `asset-sources/public-assets/reactions/source/storm-cloud-loop-preview-01.png` |
| Огненный вихрь | `public/assets/reactions/fire-vortex-sheet.png` | `asset-sources/public-assets/reactions/source/fire-vortex-loop-source-01.png` | `asset-sources/public-assets/reactions/source/fire-vortex-loop-alpha-01.png` | `asset-sources/public-assets/reactions/source/fire-vortex-loop-preview-01.png` |
| Огненный Шторм | `public/assets/reactions/fire-storm-sheet.png` | `asset-sources/public-assets/reactions/source/fire-storm-loop-source-01.png` | `asset-sources/public-assets/reactions/source/fire-storm-loop-alpha-01.png` | `asset-sources/public-assets/reactions/source/fire-storm-loop-preview-01.png` |

Combined preview: `asset-sources/public-assets/reactions/source/reaction-animation-preview-contact-01.png`.

Water prompt summary:

Generate a polished top-down 2D browser-game sprite sheet for a looping water reagent puddle emitted by an industrial water cannon tower. Use a 4x2 layout with 8 equal slots, one centered puddle per slot, consistent scale and anchor, deep cyan/teal water, pale foam highlights, faint electric-cyan rim glow, and a seamless calm-to-ripple-to-calm loop. Use a flat `#ff00ff` chroma-key background, no text, no path tile, no tower, no enemies, no frame borders, no shadows, and no scenery.
