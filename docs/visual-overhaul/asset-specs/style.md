# Phase 0.5 Style Prompt Spec

## Goal

Create original top-down 2D bitmap assets for the current `540x960` portrait game without changing P0 gameplay geometry.

## Direction

- Chunky industrial gremlin fortress.
- Dark iron, soot-black rock, brass/copper, magma orange, electric cyan, steam white.
- Top-down gameplay read; depth comes from bevels, painted shadows, grounding, local glow, and material texture.
- Shapes must remain readable at phone scale.
- Reactions use both color and shape/pattern; never rely on color alone.

## Negative Constraints

- No isometric camera.
- No 3D render look.
- No baked gameplay path, slots, checkpoint, or Великий Куб in static background layers.
- No generic fantasy castle UI.
- No copied composition from the React TD reference screenshot.

## Output Expectations

- Shipping assets should be optimized PNG or WebP.
- Source prompts and approved source frames should be kept; failed generations should not be committed.
- Transparent sprites use clean alpha edges and bottom-center anchors where applicable.
