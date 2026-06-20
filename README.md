# Jam TD Template

Шаблон для mobile-first browser game jam проекта на Phaser 3, Vue 3 и TypeScript. Сейчас это архитектурная заготовка без Tower Defense геймплея: есть только smoke-сцена, один placeholder asset, typed bridge между Phaser и Vue, Pinia store и compact debug HUD.

## Команды

```bash
npm install
npm run dev
npm run lint:fix
npm run typecheck
npm test
npm run build
```

## Технический baseline

- Phaser `3.90.0`
- Vue `3.5.38`
- Vite `8.0.16`
- TypeScript `5.9.3`
- Pinia `3.0.4`
- ESLint Antfu config
- npm, exact-pinned dependencies

## Архитектура

Проект использует pragmatic FSD:

- `src/app` - bootstrap Vue, global styles, providers, Phaser runtime adapter и сцены.
- `src/pages` - сборка экранов приложения. Сейчас есть только game screen.
- `src/widgets` - самостоятельные UI-блоки поверх игры, например debug HUD.
- `src/features` - будущие пользовательские действия и сценарии.
- `src/entities` - доменные модели и состояние. Сейчас здесь `game-session`.
- `src/shared` - общие библиотеки, typed event bus, asset manifest и базовые типы.

Phaser не является источником истины для правил игры. Сцены должны оставаться тонкими: загрузить ассеты, отрисовать состояние, принять pointer input и отправить typed event или action наружу. Будущие TD-правила, баланс, карта, волны, башни и враги должны появляться в `entities`/`features`, а не внутри Phaser scene callbacks.

## Phaser и Vue boundary

Canvas отвечает за игровое поле и renderer-facing объекты. Vue отвечает за HUD, меню, настройки и debug UI. Связь идет через typed event bus:

1. Phaser scene публикует `session:snapshot`, `viewport:resize` и `pointer:tap`.
2. Vue composable подписывается на события.
3. Pinia store хранит UI-facing snapshot.
4. HUD читает Pinia store и не импортирует Phaser scene objects.

## Mobile-first stage

Базовая игровая область - landscape `16:9`. Canvas размещается внутри stage, а дополнительные области viewport используются только как фон. HUD закреплен внутри safe edges stage. Стартовый input - single pointer/tap, без клавиатурных hotkeys, drag-pan, gestures и TD-specific действий.

## Где добавлять будущий TD-геймплей

Геймплей намеренно вынесен за рамки этого шаблона. Когда ресерч TD-модели будет готов:

- serializable state и deterministic systems добавлять в `src/entities`;
- user-facing действия вроде placement mode или upgrade flow добавлять в `src/features`;
- визуальные Phaser adapters для новых сущностей добавлять в `src/app/phaser`;
- HUD-компоненты и панели добавлять в `src/widgets`;
- stable asset keys добавлять в `src/shared/assets/manifest.ts`.

Не добавляйте правила волн, pathfinding, урон или экономику напрямую в `update()` Phaser scenes.
