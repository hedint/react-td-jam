# Tower Asset Prompt Spec

## Tower Set

Produce static tower source frames for:

- Водомёт;
- Маслонасос;
- Разрядник;
- Магмовый кран.

## Readability Rules

- Each tower must be identifiable by silhouette at phone scale without relying on label text.
- Use distinct profiles:
  - Водомёт: tank/nozzle/pump mass.
  - Маслонасос: barrel, tar hose, heavy pump.
  - Разрядник: coil, prongs, captured lightning shape.
  - Магмовый кран: crucible, pipe, hot valve.
- Include a grounded base/shadow compatible with both inner and outer slots.

## Runtime Pairing

- Cards and lower tray items reuse tower art.
- Activation feedback remains procedural: recoil, glow, steam, sparks, or heat pulse.
- Inner-corner junction slots are a separate runtime state: one tower affects two adjacent straight path cells.
- Directional tower silhouettes must account for junction placement. Preferred follow-up asset path: generate dedicated corner/junction variants per tower type rather than composing two nozzle overlays at runtime.
- Junction variants should read as one grounded tower with dual-output intent, not two stacked towers.

## Phase 3 Generated Tower Set

- Source sheet: `public/assets/towers/source/phase3-tower-set-source-01.png`.
- Runtime stills:
  - `public/assets/towers/water-cannon.png` for Водомёт;
  - `public/assets/towers/oil-pump.png` for Маслонасос;
  - `public/assets/towers/spark-discharger.png` for Разрядник;
  - `public/assets/towers/magma-crane.png` for Магмовый кран.
- Generation path: built-in `imagegen` produced one 2x2 chroma-key tower sheet; the sheet was copied into the workspace and locally chroma-keyed/cropped into 192x192 transparent PNG runtime stills.

Prompt summary:

```text
Create a 2x2 sprite sheet of four distinct top-down static tower sprites for a chunky industrial goblin fortress tower defense game: water cannon, oil pump, spark discharger, and magma crane. Use dark iron, rock, soot, brass/copper, magma orange, electric cyan, and steam white accents. Put exactly one isolated sprite per quadrant, centered on an invisible 256x256 cell, on a perfectly flat #00ff00 chroma-key background. No text, labels, UI frame, watermark, characters, or path tiles.
```

## Phase 5 Layered Directional Tower Set

- Approved source sheet: `public/assets/towers/source/phase5-layered-tower-set-source-01.png`.
- Runtime stills:
  - `public/assets/towers/water-cannon-base.png` and `public/assets/towers/water-cannon-head.png`;
  - `public/assets/towers/oil-pump-base.png` and `public/assets/towers/oil-pump-head.png`;
  - `public/assets/towers/spark-discharger-base.png` and `public/assets/towers/spark-discharger-head.png`;
  - `public/assets/towers/magma-crane-base.png` and `public/assets/towers/magma-crane-head.png`.
- Runtime convention:
  - `base` sprites stay unrotated and centered on the slot.
  - `head` sprites use a base direction pointing right and rotate around their mounting hub.
  - Straight slots render one head; corner slots render two heads on the same base.
  - Phaser derives head directions from `BoardSlot.cellIndexes` and current `PathCell` centers.
  - Direction is presentation-only and is not stored in `TowerState` or serialized run state.

Prompt summary:

```text
Create a 4 rows x 2 columns sprite sheet for a modular tower rendering system matching the existing chunky industrial goblin fortress PNG tower style. Rows are water cannon, oil pump, spark discharger, and magma crane. Column 1 is the stationary base layer with circular stone-and-dark-iron tower body and no directional output. Column 2 is the rotating head/output layer only, built around the same invisible center pivot and pointing exactly right. Use brass/copper details, water/oil/electric/magma accents, and a flat #00ff00 chroma-key background. No labels, UI, scenery, path tiles, shadows on the background, or diagonal/ambiguous output directions.
```
