# Осадная галерея

Mobile-first браузерная tower defense игра на Phaser 3, Vue 3 и TypeScript. Игрок строит реакционный контур вокруг Великого Перегонного Куба: ставит башни-эмиттеры на 16-клеточное кольцо, собирает реакции вроде Электролужи, Грозового облака и Огненного Шторма, переживает 10 волн и финальный бой с Бочкоедом.

P0 реализован как конечный single-run: live placement из скамейки во время волн, move/remove/swap только на паузе, двухшаговый draft между волнами, save/resume через `localStorage`, победа/поражение и итоговая статистика.

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
- `src/pages` - сборка экранов приложения. Сейчас есть game screen.
- `src/widgets` - самостоятельные UI-блоки поверх игры: run HUD, draft/result overlays и debug HUD.
- `src/features` - зарезервировано для пользовательских сценариев, если они перерастут текущие границы.
- `src/entities` - доменные модели и состояние. Основная игра живет в `game-session`.
- `src/shared` - общие библиотеки, typed event bus, asset manifest и базовые типы.

Phaser не является источником истины для правил игры. Сцены остаются тонкими: загрузить ассеты, отрисовать snapshot, принять pointer input и отправить typed action наружу. Правила волн, реакции, урон, draft, save/resume, босс и статистика находятся в serializable TypeScript simulation code внутри `src/entities/game-session/model`.

## Phaser и Vue boundary

Canvas отвечает за игровое поле и renderer-facing объекты. Vue отвечает за HUD, меню, настройки и debug UI. Связь идет через typed event bus:

1. Phaser scene публикует `session:snapshot`, `viewport:resize` и `pointer:tap`.
2. Vue composable подписывается на события.
3. Pinia store хранит UI-facing snapshot.
4. HUD читает Pinia store и не импортирует Phaser scene objects.

## Mobile-first stage

Базовая игровая область - portrait `540x960`. На desktop игра центрируется в phone-frame layout; на mobile занимает портретный viewport с safe-area учетом. Input - tap-select, затем tap slot. Скамейка размещает новые башни во время волн; редактирование уже поставленных башен разрешено только на паузе.

## Gameplay systems

- `createRun(seed, { config })` создает детерминированный run с board и стартовой скамейкой из переданного или дефолтного конфига.
- `stepRun(state, deltaMs, config)` двигает симуляцию fixed-step способом; тот же код используется Phaser scene и headless tests.
- `applyAction(state, action, config)` обрабатывает run control, placement, draft, pause/speed, restart и debug toggles.
- `serializeRun` / `deserializeRun` сохраняют только simulation state, без Phaser/Vue объектов.
- Баланс и контент хранятся в typed config: emitters, reactions, enemies, waves, boss, upgrades и runtime constants.

## Current P0 scope

- Реализованы P0 реакции: Электролужа, Пар, Пожар, Грозовое облако, Огненный вихрь, Огненный Шторм.
- Реализованы 10 волн, flying/ground targeting, strong resistance enemies, leaks/core HP и Бочкоед с Reaction Break.
- Draft между волнами выдает tower pick и upgrade pick; Жар и Нефть гарантированно пере-предлагаются после нужных milestones, пока не взяты.
- Есть headless scripted strategy tests для expected-win и weak strategy.
- Исключенные P1 системы не реализованы: Холод, глобальный `DMG xN`, opposite bonus и adaptive boss resistance.

Не добавляйте правила волн, pathfinding, урон или экономику напрямую в `update()` Phaser scenes.
