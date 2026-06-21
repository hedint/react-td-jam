# Board Asset Prompt Spec

## Scope

Non-gameplay background layers only:

- cavern floor;
- fortress wall edges;
- soot, cracks, debris;
- decorative magma and workshop lighting;
- atmospheric depth below dynamic gameplay objects.

## Must Stay Dynamic

The following must be rendered from board/core geometry at runtime, not baked into the background:

- осадная галерея path;
- inner and outer tower slots;
- gate/checkpoint;
- Великий Перегонный Куб;
- selected/valid placement feedback.

## Scale Notes

- Base canvas target: `540x960`.
- Current path bounds: left `132`, top `304`, right `408`, bottom `664`.
- Current core center: `270,484`.
- Background should leave the center field usable and avoid high-contrast detail under future dynamic path/slot art.
