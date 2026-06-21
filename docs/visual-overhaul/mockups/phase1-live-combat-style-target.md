# Phase 1 Live-Combat Style Target

## Output

- Source generated image: `docs/visual-overhaul/mockups/phase1-live-combat-style-target.png`
- Normalized scale-check image: `docs/visual-overhaul/mockups/phase1-live-combat-style-target-540x960.png`
- Generation mode: built-in `image_gen`
- Date: 2026-06-21

## Prompt

Use case: ui-mockup
Asset type: 540x960 portrait in-game visual style target for a top-down 2D browser tower defense game

Primary request: Create one polished live-combat style frame for React TD: a chunky industrial gremlin fortress under siege, with the same top-down geometry as the current game. The image must read as an in-game screenshot mockup, not a poster.

Scene/backdrop: dark soot-black cavern fortress workshop, brass and copper machinery, magma orange furnace light, worn iron panels, rivets, grime, rock cracks, small debris, controlled steam.

Composition/framing: exact portrait game-frame composition, 540x960 aspect ratio. Top compact HUD strip from y=80 to y=130. Central playable field from about y=145 to y=705. Lower tower tray/cards from about y=715 to y=815. Keep the center playfield clear and usable. Top-down rectangular loop path roughly bounded by left x=132, top y=304, right x=408, bottom y=664, wrapped around a central Great Distillation Cube at x=270 y=484. Do not use isometric perspective.

Gameplay elements: dynamic-looking rectangular siege gallery path around the central copper Great Distillation Cube; visible gate/checkpoint marker; inner and outer tower slots aligned around the loop; four tower contraptions: water cannon/tank/nozzle, oil pump/barrel/hose, lightning coil/prongs, magma tap/crucible/valve; at least two enemy types on the path: small goblin grunt, bat/flying enemy or swarm; two or three reactions visible: electric puddle on ground with water shape and cyan arcs, steam plume above path, oil fire or storm cloud, with ground and air layers clearly separated.

UI: compact iron/brass control panels, not generic web dashboard. Top HUD shows core HP, wave/phase, enemy type/threat, speed, start/pause button as game UI shapes. Lower tray has four tower cards/items reusing tower art, dense workshop rail style, readable hierarchy, no large center overlay.

Style/medium: high quality painted 2D game concept mockup, production-style mobile game screenshot, chunky readable silhouettes, clean gameplay readability, not photorealistic, not 3D render, no isometric camera.

Color palette: dark iron and soot black base, brass/copper frames, magma orange core glow, electric cyan reactions, steam white, limited warning red. Use color plus shape/pattern; avoid one-note monochrome.

Materials/textures: riveted iron, worn brass, copper boiler, soot, scorched rock, oily wet ground, glowing magma seams, painted shadows and bevels.

Text constraints: if text appears, use short Russian labels only, but do not rely on text for readability. Avoid garbled large text; icons and silhouettes should carry the design.

Constraints: Must preserve the existing game geometry and portrait phone layout; path, slots, gate, and cube should look like dynamic gameplay objects rather than baked background illustration; no new mechanics; no marketing hero page; no copied composition from any reference screenshot; no watermark.

## Approved-Direction Candidate

This style frame should be reviewed as a direction candidate, not as a runtime-accurate layout export.

- Palette: soot-black cavern and iron base, worn brass frames, copper Куб, magma orange focal light, electric cyan reaction accents, steam white air effects, sparse danger red.
- Material language: riveted iron panels, heavy brass edges, copper boilers, scorched rock, oily wet floor, visible pipes and workshop machinery.
- Line and shape language: chunky readable silhouettes with beveled painted edges and strong contact shadows; small details stay secondary to tower/reaction/enemy read.
- Shadow style: painted contact shadows under towers, enemies, slots, path curbs, and Куб; no post-processing dependency.
- Glow intensity: Куб and Жар can carry warm local glow; Искра/Электролужа can carry sharper cyan glow; reaction glows should remain bounded to keep enemies readable.
- Tower silhouettes: Водомёт reads by tank plus cannon nozzle; Маслонасос by dark barrel and hose; Разрядник by coil tower and lightning crown; Магмовый кран by hot crucible and orange core.
- Reaction readability: ground reactions use floor decals and irregular shapes; air reactions use elevated cloud/plume/vortex masses with visible separation from path tiles and enemies.
- UI hierarchy: top HUD prioritizes Куб HP, wave/phase, enemy pressure, speed, and pause/start; lower tray uses four large tower cards with art-first identity and compact cost/status chips.

## Scale Check

- `phase1-live-combat-style-target.png`: generated at `941x1672`, near 9:16.
- `phase1-live-combat-style-target-540x960.png`: resized to exact `540x960` for mobile portrait scale review.
- Desktop phone-frame review uses the same `540x960` normalized image centered as the target phone canvas.

## Known Deviations Before Runtime Production

- The generated path is top-down and loop-shaped, but its exact path width and bounds are not pixel-accurate to the current Phaser geometry.
- The generated Куб is larger and more detailed than the current runtime footprint. Phase 3 should translate the visual importance into layered runtime sprites without changing hit targets or path positions.
- Some UI text is concept-level and should not be copied verbatim into Vue. Phase 5 should implement real Russian UI text from game state.
- This mockup includes production-style tower card art, but Phase 2/3 still need manifest-backed real assets and shared skin tokens before integration.
