# Boss Asset Prompt Spec

## Boss

Бочкоед: large deep-cave potion-drinking titan-beast.

## Readability Rules

- Must be visibly larger and more important than normal enemies.
- Must still fit the existing rectangular path and not obscure core/path state.
- Needs obvious vulnerable/Reaction Break visual support.

## Animation Coverage Later

- crawl loop using approved Phase 7 boss facing decision;
- vulnerable animation or overlay-compatible frames;
- death animation.

## Runtime Pairing

The boss remains driven by serializable simulation state. Visual state should read from boss HP, lap, and vulnerable timers without adding asset objects to saved state.
