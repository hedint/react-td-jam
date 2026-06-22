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

## Phase 6A Runtime Board Assets

Generated with built-in `imagegen` as one 3x2 chroma-key sheet, then locally keyed, cropped, normalized, and saved as transparent PNGs.

- Initial source sheet: `public/assets/board/source/phase6a-board-sheet-source-01.png`.
- Square road source sheet: `public/assets/board/source/phase6a-road-square-sheet-source-01.png`.
- Derived square corner source: `public/assets/board/source/phase6a-road-corner-derived-from-straight-01.png`.
- Preview sheet: `public/assets/board/source/phase6a-board-assets-preview-01.png`.
- Runtime road straight: `public/assets/board/road-straight.png`.
- Runtime road corner: `public/assets/board/road-corner.png`.
- Runtime regular tower socket: `public/assets/board/slot-socket.png`.
- Runtime corner tower socket: `public/assets/board/slot-socket-corner.png`.
- Runtime monster entrance marker: `public/assets/board/marker-entrance.png`.
- Runtime leak/exit marker: `public/assets/board/marker-exit.png`.

Runtime placement:

- Road pieces are placed from `BoardState.pathCells`; corners use the corner PNG, straight cells use the straight PNG, and both are rotated from neighbor directions.
- The current corner PNG is a derived full-square road plaza from the approved straight road tile. This avoids transparent holes and guarantees edge-to-edge contact with neighboring straight road cells.
- Tower sockets are placed at exact `BoardSlot.x/y`; visual sprites do not alter pointer hit targets.
- Entrance marker is placed at `pathCells[0]`.
- Exit/leak marker is placed on the final path cell before the loop returns to `pathCells[0]`.
- Static scene background remains decorative only.

Final generation prompt:

```text
Create six isolated board field assets for a chunky industrial gremlin fortress tower defense game. Arrange them in a clean 3 columns x 2 rows sprite sheet, exactly one centered asset per cell, with generous padding and no overlap.
Cell 1: straight road tile, raised stone-and-dark-iron monster walkway, rectangular top-down segment, beveled side curbs, brass rivets, soot wear.
Cell 2: corner road tile, same material, 90 degree L-turn segment, raised walkway with beveled outer and inner curbs, brass rivets, soot wear.
Cell 3: empty tower slot socket, circular brass-rimmed industrial build pad, dark iron inner plate, bolts, readable as empty and buildable.
Cell 4: corner tower slot socket, slightly larger circular/diamond hybrid brass-rimmed build pad, reads as a special corner socket, dark iron inner plate, bolts.
Cell 5: monster entrance marker, top-down tunnel gate / hatch mouth in dark iron and stone, warm warning glow, distinct from road and sockets.
Cell 6: monster exit / leak marker, top-down breach/drain/spill channel toward the central cube, copper-orange danger glow, distinct from the entrance.
Style: polished bitmap game sprites, top-down 2D, hand-painted industrial fantasy, dark metal, rock, soot, worn brass/copper, magma orange highlights.
Constraints: perfectly flat solid #00ff00 chroma-key background; no text, labels, UI, monsters, towers, reactions, grid lines, watermark, or scenery.
```

Square road replacement prompt:

```text
Create exactly two isolated square path-cell road tiles for a chunky industrial gremlin fortress tower defense game, arranged side by side in a 2 columns x 1 row sprite sheet.
Frame 1: straight road tile. The visible road surface fills the entire square tile footprint, edge to edge, with a vertical straight monster walkway that connects seamlessly at the top and bottom edges. Square top-down tile, no inner padding. Raised dark stone and iron plates, beveled side curbs, brass rivets, soot wear.
Frame 2: corner road tile. The visible road surface fills the entire square tile footprint, with a 90 degree L-shaped walkway connecting seamlessly to the top edge and right edge. Square top-down tile, no inner padding. Same material, raised stone and dark iron plates, beveled curbs, brass rivets, soot wear.
Constraints: perfectly flat solid #00ff00 chroma-key background outside the tile art only; no text, labels, UI, monsters, towers, reactions, grid lines, watermark, or scenery.
```
