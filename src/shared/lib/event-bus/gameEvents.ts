import type { GameAction, RunState, RuntimeSnapshot, StagePoint, ViewportSize } from "@entities/game-session/model/types";
import { createTypedEventBus } from "./createTypedEventBus";

export interface GameEventMap {
  "session:snapshot": RuntimeSnapshot
  "viewport:resize": ViewportSize
  "pointer:tap": StagePoint
  "run:action": GameAction
  "run:load": RunState
}

export const gameEvents = createTypedEventBus<GameEventMap>();
