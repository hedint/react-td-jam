import type { BoardSlot, GameAction, GameSnapshot, RuntimeSnapshot, TowerState } from "@entities/game-session/model/types";
import type { Unsubscribe } from "@shared/lib/event-bus/createTypedEventBus";
import { createFixedStepDriver } from "@entities/game-session/model/fixedStepDriver";
import { hasSavedRun, saveRun } from "@entities/game-session/model/persistence";
import { derivePresentationEvents } from "@entities/game-session/model/presentationEvents";
import { recordRunReplayAction } from "@entities/game-session/model/runReplayLog";
import { applyAction, createRun, createSnapshot, stepRun } from "@entities/game-session/model/simulation";
import { completeGuideStep, evaluateGuidedAction, getGuideStep, isGuideStepComplete, isGuideTargetAvailable, loadOnboardingProgress, resetGuideForNewRun, saveOnboardingProgress } from "@entities/onboarding/model";
import { assetGroups } from "@shared/assets/manifest";
import { gameEvents } from "@shared/lib/event-bus/gameEvents";
import Phaser from "phaser";
import { RunSceneBoardArtPresenter } from "./runSceneBoardArt";
import {
  renderBoardSlots,
  renderPlacementSlotFeedback,
} from "./runSceneBoardRender";
import { registerBossAnimations, RunSceneBossPresenter } from "./runSceneBossPresenter";
import { renderCore } from "./runSceneCoreRender";
import { registerEnemyAnimations, RunSceneEnemyPresenter } from "./runSceneEnemyPresenter";
import { RunSceneEntryIntro } from "./runSceneEntryIntro";
import { registerFieldShmygAnimations, RunSceneFieldShmygPresenter } from "./runSceneFieldShmygPresenter";
import { renderSceneGrounding } from "./runSceneGround";
import { RunSceneJuicePresenter } from "./runSceneJuicePresenter";
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from "./runSceneLayout";
import { renderPathFlow } from "./runScenePathFlow";
import { RunSceneReactionPresenter } from "./runSceneReactionPresenter";
import { RunSceneReagentPresenter } from "./runSceneReagentRender";
import {
  findSlotAtPoint,
  writeTowerPosition,
} from "./runSceneRender";
import {
  getTowerDirectionRotation,
  getTowerFieldLabel,
  getTowerHeadSwayRotation,
  getTowerSpriteRenderConfig,
  getTowerSpriteSize,
  renderTowerGrounding,
  TOWER_HEAD_ORIGIN_Y,
} from "./runSceneTowerRender";

export class RunScene extends Phaser.Scene {
  private readonly driver = createFixedStepDriver({
    initialState: createRun(),
    stepMs: 1000 / 30,
    step: stepRun,
  });

  private groundGraphics?: Phaser.GameObjects.Graphics;
  private worldGraphics?: Phaser.GameObjects.Graphics;
  private effectGraphics?: Phaser.GameObjects.Graphics;
  private enemyGraphics?: Phaser.GameObjects.Graphics;
  private placementGraphics?: Phaser.GameObjects.Graphics;
  private backdropFloor?: Phaser.GameObjects.Image;
  private coreSprite?: Phaser.GameObjects.Image;
  private coreLiquidGraphics?: Phaser.GameObjects.Graphics;
  private towerLabels: Phaser.GameObjects.Text[] = [];
  private towerSprites: Phaser.GameObjects.Image[] = [];
  private towerHeadSprites: Phaser.GameObjects.Image[] = [];
  private boardArtPresenter?: RunSceneBoardArtPresenter;
  private bossPresenter?: RunSceneBossPresenter;
  private enemyPresenter?: RunSceneEnemyPresenter;
  private reagentPresenter?: RunSceneReagentPresenter;
  private reactionPresenter?: RunSceneReactionPresenter;
  private juicePresenter?: RunSceneJuicePresenter;
  private fieldShmygPresenter?: RunSceneFieldShmygPresenter;
  private readonly towerPosition = { x: 0, y: 0 };
  private readonly entryIntro = new RunSceneEntryIntro();
  private unsubscribeAction?: Unsubscribe;
  private unsubscribeLoad?: Unsubscribe;
  private autosaveMs = 0;
  private autosaveEnabled = !hasSavedRun();
  private readonly debugBypassEnabled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";

  constructor() {
    super("RunScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#101217");
    registerEnemyAnimations(this);
    registerBossAnimations(this);
    registerFieldShmygAnimations(this);
    this.backdropFloor = this.add.image(0, 0, assetGroups.scene.cavernFortressFloor.key)
      .setOrigin(0)
      .setDepth(-30);
    this.groundGraphics = this.add.graphics().setDepth(-28);
    renderSceneGrounding(this.groundGraphics, this.driver.state.board);
    this.worldGraphics = this.add.graphics().setDepth(5);
    this.effectGraphics = this.add.graphics().setDepth(10);
    this.enemyGraphics = this.add.graphics().setDepth(20);
    this.placementGraphics = this.add.graphics().setDepth(35);
    this.boardArtPresenter = new RunSceneBoardArtPresenter(this);
    this.bossPresenter = new RunSceneBossPresenter(this);
    this.enemyPresenter = new RunSceneEnemyPresenter(this);
    this.reagentPresenter = new RunSceneReagentPresenter(this);
    this.reactionPresenter = new RunSceneReactionPresenter(this);
    this.juicePresenter = new RunSceneJuicePresenter(this);
    this.fieldShmygPresenter = new RunSceneFieldShmygPresenter(this);

    this.coreSprite = this.add.image(0, 0, assetGroups.board.greatStillCore.key)
      .setOrigin(0.5)
      .setDepth(8);
    this.coreLiquidGraphics = this.add.graphics().setDepth(7.9);

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const tap = {
        x: Math.round(pointer.worldX),
        y: Math.round(pointer.worldY),
      };
      const slot = findSlotAtPoint(this.driver.state.board.slots, tap.x, tap.y);

      this.applyActionWithGuide({ type: "tap", point: tap }, { autosave: false });
      if (slot) {
        this.applyActionWithGuide({ type: "tapSlot", slotId: slot.id });
      }
      gameEvents.emit("pointer:tap", tap);
    });

    this.unsubscribeAction = gameEvents.on("run:action", (action) => {
      this.applyActionWithGuide(action);
    });
    this.unsubscribeLoad = gameEvents.on("run:load", (state) => {
      const previousSnapshot = createSnapshot(this.driver.state);
      this.driver.replaceState(state);
      this.autosaveEnabled = true;
      this.saveCurrentRun();
      const nextSnapshot = createSnapshot(this.driver.state);
      this.emitPresentationEvents(previousSnapshot, nextSnapshot, { reactionCallouts: false });
      this.renderSnapshot(nextSnapshot);
      this.publishSnapshot();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeAction?.();
      this.unsubscribeLoad?.();
    });

    this.scale.on("resize", this.handleResize, this);
    this.handleResize();
    this.renderSnapshot(createSnapshot(this.driver.state));
    this.publishSnapshot();
  }

  update(_time: number, deltaMs: number): void {
    const previousSnapshot = createSnapshot(this.driver.state);
    const state = this.shouldHoldRuntimeForGuide()
      ? this.driver.state
      : this.driver.stepFrame(deltaMs);
    const snapshot = createSnapshot(state);

    this.emitPresentationEvents(previousSnapshot, snapshot);
    this.renderSnapshot(snapshot);
    this.publishSnapshot(snapshot);
    this.autosaveMs += deltaMs;

    if (this.autosaveMs >= 1000) {
      this.saveCurrentRun();
      this.autosaveMs = 0;
    }
  }

  private handleResize(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const zoom = Math.min(width / LOGICAL_WIDTH, height / LOGICAL_HEIGHT);

    this.cameras.main.setViewport(0, 0, width, height);
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);

    gameEvents.emit("viewport:resize", { width, height });
  }

  private renderSnapshot(snapshot: GameSnapshot): void {
    const visualMs = this.time.now;

    this.renderBoard(snapshot, visualMs);
    this.renderReagents(snapshot, visualMs);
    this.renderEffects(snapshot, visualMs);
    this.renderEnemies(snapshot);
    this.renderBoss(snapshot, visualMs);
    this.renderTowers(snapshot.placedTowers, snapshot.board.slots, snapshot.board.pathCells, snapshot.selectedTowerId, visualMs);
    this.renderPlacementFeedback(snapshot);
    this.juicePresenter?.render(visualMs);
    this.fieldShmygPresenter?.render(this.withRuntimeFields(snapshot), loadOnboardingProgress(), visualMs);
  }

  private emitPresentationEvents(
    previous: GameSnapshot,
    next: GameSnapshot,
    options: { readonly reactionCallouts?: boolean } = {},
  ): void {
    const events = derivePresentationEvents(previous, next);

    if (events.length === 0) {
      return;
    }

    gameEvents.emit("run:presentation-events", events);
    if (options.reactionCallouts !== false) {
      this.reactionPresenter?.queue(events, next, this.time.now);
    }
    this.enemyPresenter?.queue(events, next, this.time.now);
    this.bossPresenter?.queue(events, this.time.now);
    this.juicePresenter?.queue(events, next, this.time.now);
  }

  private applyActionWithGuide(action: GameAction, options: { readonly autosave?: boolean } = {}): boolean {
    const previousSnapshot = this.createRuntimeSnapshot();
    const progress = loadOnboardingProgress();
    let nextProgress = action.type === "restart"
      ? resetGuideForNewRun(progress)
      : progress;
    const decision = evaluateGuidedAction(nextProgress, previousSnapshot, action, {
      debugBypass: this.debugBypassEnabled,
    });

    if (decision.type === "block") {
      gameEvents.emit("onboarding:action-blocked", {
        stepId: decision.stepId,
        actionType: action.type,
        reason: decision.reason,
      });
      return false;
    }

    if (decision.type === "completeStepThenAllow" && isGuideStepComplete(getGuideStep(decision.stepId), previousSnapshot)) {
      nextProgress = completeGuideStep(nextProgress, decision.stepId);
    }

    this.driver.replaceState(applyAction(this.driver.state, action));

    if (options.autosave !== false) {
      this.autosaveEnabled = true;
      this.saveCurrentRun();
    }

    const nextSnapshot = this.createRuntimeSnapshot();

    if (
      decision.type === "completeStepThenAllow"
      && !nextProgress.guide.completedStepIds.includes(decision.stepId)
      && isGuideStepComplete(getGuideStep(decision.stepId), nextSnapshot)
    ) {
      nextProgress = completeGuideStep(nextProgress, decision.stepId);
    }

    if (nextProgress !== progress) {
      saveOnboardingProgress(nextProgress);
    }

    recordRunReplayAction(previousSnapshot, action, nextSnapshot);
    this.emitPresentationEvents(previousSnapshot, nextSnapshot);
    this.renderSnapshot(nextSnapshot);
    this.publishSnapshot(nextSnapshot);

    return true;
  }

  private createRuntimeSnapshot(): RuntimeSnapshot {
    return this.withRuntimeFields(createSnapshot(this.driver.state));
  }

  private shouldHoldRuntimeForGuide(): boolean {
    const progress = loadOnboardingProgress();

    if (progress.guide.status !== "inProgress") {
      return false;
    }

    const step = getGuideStep(progress.guide.stepId);

    return step.blocksGameplay && isGuideTargetAvailable(step, this.createRuntimeSnapshot());
  }

  private withRuntimeFields(snapshot: GameSnapshot): RuntimeSnapshot {
    return {
      ...snapshot,
      fps: Math.round(this.game.loop.actualFps),
      viewport: {
        width: this.scale.width,
        height: this.scale.height,
      },
    };
  }

  private renderBoard(snapshot: GameSnapshot, visualMs: number): void {
    const graphics = this.worldGraphics;
    if (!graphics) {
      return;
    }

    graphics.clear();

    this.boardArtPresenter?.render(snapshot);
    renderPathFlow(graphics, snapshot, visualMs);
    renderCore({
      coreSprite: this.coreSprite,
      liquidGraphics: this.coreLiquidGraphics,
      snapshot,
      visualMs,
    });
    renderBoardSlots(graphics, snapshot);
  }

  private renderEffects(snapshot: GameSnapshot, visualMs: number): void {
    const graphics = this.effectGraphics;
    if (!graphics) {
      return;
    }

    this.reactionPresenter?.render(graphics, snapshot, visualMs);
  }

  private renderReagents(snapshot: GameSnapshot, visualMs: number): void {
    this.reagentPresenter?.render(snapshot, visualMs);
  }

  private renderPlacementFeedback(snapshot: GameSnapshot): void {
    const graphics = this.placementGraphics;
    if (!graphics) {
      return;
    }

    graphics.clear();
    renderPlacementSlotFeedback(graphics, snapshot, this.time.now);
  }

  private renderEnemies(snapshot: GameSnapshot): void {
    const graphics = this.enemyGraphics;
    if (!graphics) {
      return;
    }

    graphics.clear();
    this.enemyPresenter?.render(graphics, snapshot, this.time.now, this.entryIntro);
  }

  private renderBoss(snapshot: GameSnapshot, visualMs: number): void {
    const graphics = this.enemyGraphics;

    if (!graphics) {
      return;
    }

    this.bossPresenter?.render(graphics, snapshot, visualMs, this.entryIntro);
  }

  private renderTowers(
    towers: readonly TowerState[],
    slots: readonly BoardSlot[],
    cells: GameSnapshot["board"]["pathCells"],
    selectedTowerId: string | null,
    visualMs: number,
  ): void {
    while (this.towerLabels.length < towers.length) {
      this.towerLabels.push(this.add.text(0, 0, "", {
        align: "center",
        color: "#f6f0df",
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        fontStyle: "700",
      }).setOrigin(0.5).setDepth(42));
    }
    while (this.towerSprites.length < towers.length) {
      this.towerSprites.push(this.add.image(0, 0, assetGroups.towers.towerSpritePlaceholder.key)
        .setOrigin(0.5)
        .setDepth(26));
    }
    while (this.towerHeadSprites.length < towers.length * 2) {
      this.towerHeadSprites.push(this.add.image(0, 0, assetGroups.towers.towerSpritePlaceholder.key).setOrigin(0.31, TOWER_HEAD_ORIGIN_Y).setDepth(27));
    }

    this.towerLabels.forEach((label, index) => {
      const tower = towers[index];
      if (!tower) {
        label.setVisible(false);
        this.towerSprites[index]?.setVisible(false);
        return;
      }

      const position = writeTowerPosition(tower, slots, this.towerPosition);
      const slot = slots.find(candidate => candidate.id === tower.slotId);
      const isSelected = tower.id === selectedTowerId;
      const sprite = this.towerSprites[index];

      const graphics = this.worldGraphics;
      if (!graphics || !slot || !sprite) {
        label.setVisible(false);
        sprite?.setVisible(false);
        return;
      }

      const spriteSize = getTowerSpriteSize(slot);
      const headSize = spriteSize * 1.14;
      const renderConfig = getTowerSpriteRenderConfig(tower, slot, cells);

      renderTowerGrounding(graphics, tower, slot, position, isSelected, visualMs);
      sprite
        .setVisible(true)
        .setTexture(renderConfig.baseKey)
        .setPosition(position.x, position.y)
        .setDisplaySize(spriteSize, spriteSize)
        .setRotation(0)
        .setDepth(26 + position.y / 10000);
      sprite.setAlpha(isSelected ? 1 : 0.96);
      for (let directionIndex = 0; directionIndex < 2; directionIndex += 1) {
        const headSprite = this.towerHeadSprites[index * 2 + directionIndex];
        const direction = renderConfig.directions[directionIndex];

        if (!headSprite || !direction) {
          headSprite?.setVisible(false);
          continue;
        }

        headSprite
          .setVisible(true)
          .setTexture(renderConfig.headKey)
          .setOrigin(renderConfig.headOriginX, TOWER_HEAD_ORIGIN_Y)
          .setPosition(position.x, position.y)
          .setDisplaySize(headSize, headSize)
          .setRotation(getTowerDirectionRotation(direction) + getTowerHeadSwayRotation(tower, slot, directionIndex, visualMs))
          .setDepth(27 + position.y / 10000)
          .setAlpha(isSelected ? 1 : 0.98);
      }

      label.setVisible(isSelected);
      label.setPosition(position.x, position.y - spriteSize * 0.52);
      label.setText(getTowerFieldLabel(tower.emitterId));
    });

    this.towerSprites.slice(towers.length).forEach(sprite => sprite.setVisible(false));
    this.towerHeadSprites.slice(towers.length * 2).forEach(sprite => sprite.setVisible(false));
  }

  private publishSnapshot(snapshot: GameSnapshot | RuntimeSnapshot = this.createRuntimeSnapshot()): void {
    gameEvents.emit("session:snapshot", this.withRuntimeFields(snapshot));
  }

  private saveCurrentRun(): void {
    if (!this.autosaveEnabled) {
      return;
    }

    saveRun(this.driver.state);
  }
}
