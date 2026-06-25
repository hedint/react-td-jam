# Boss Asset Prompt Spec

## Boss

Бочкоед: large pale deep-cave ogre with a heavy club and a small back-mounted glass vat/barrel. The vat sits below the back hump and is filled with red-orange liquid to about one quarter.

Approved seed:

- Draft source: `output/boss-drafts/barrel-eater-ogre-seed-draft-hybrid-02.png`
- Runtime seed: `public/assets/enemies/boss-ogre/boss-ogre-seed-approved-384.png`
- Runtime strips: `public/assets/enemies/boss-ogre/boss-ogre-<anim>-side.png`
- Preview sheet: `output/boss-sprites/boss-ogre-all-previews.png`

## Readability Rules

- Must be visibly larger and more important than normal enemies.
- Must still fit the existing rectangular path and not obscure core/path state.
- Needs obvious vulnerable/Reaction Break visual support.
- Renders above tower body/head layers because boss threat readability is higher priority than strict y-depth realism.
- Runtime shadow, HP bar, vulnerable ring, and ability telegraphs are Phaser-owned overlays; sprite art must not bake shadows.

## Animation Coverage

- `crawl`
- `hit`
- `vulnerable`
- `death`
- `leap-prepare`
- `leap-air`
- `smash`
- `blackout-cast`
- `summon-roar`

## Runtime Pairing

The boss remains driven by serializable simulation state. Visual state reads from boss HP, lap, vulnerable timers, and active ability state without adding asset objects to saved state.

Runtime uses `side + horizontal flip` for path movement. Bespoke set-piece strips cover exit smash, blackout cast, summon roar, vulnerable, hit, and death.

Current gameplay tuning: `gameConfig.boss.hp = 1000`.
