# UI Asset Prompt Spec

## Scope

Shared UI skin for Vue DOM and Phaser field chrome:

- panel textures;
- frame slices;
- card frames;
- small element icons;
- button/chip materials.

## Direction

- Compact iron/brass control panel.
- Rivets, dark metal, worn brass edges, restrained glow.
- Dense and readable, not a marketing card layout.
- Field remains the hero during normal play.

## Shared Consumption

- CSS should be able to consume panel assets through background images or border-image style slices.
- Phaser should be able to consume equivalent atlas frames or NineSlice-style assets.
- Palette tokens must stay shared between DOM HUD and canvas chrome.
