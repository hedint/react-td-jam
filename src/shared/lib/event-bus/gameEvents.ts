import type { RuntimeSnapshot, StagePoint, ViewportSize } from "@entities/game-session/model/types";
import { createTypedEventBus } from "./createTypedEventBus";

export interface GameEventMap {
  "session:snapshot": RuntimeSnapshot
  "viewport:resize": ViewportSize
  "pointer:tap": StagePoint
}

export const gameEvents = createTypedEventBus<GameEventMap>();
