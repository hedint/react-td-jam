import type { GamePresentationEvent } from "@entities/game-session/model/presentationEvents";
import type { GameAction, RunState, RuntimeSnapshot, StagePoint, ViewportSize } from "@entities/game-session/model/types";
import { createTypedEventBus } from "./createTypedEventBus";

export interface GameEventMap {
  "session:snapshot": RuntimeSnapshot
  "viewport:resize": ViewportSize
  "pointer:tap": StagePoint
  "audio:mute-changed": { readonly muted: boolean }
  "onboarding:action-blocked": { readonly stepId: string, readonly actionType: GameAction["type"], readonly reason: string }
  "run:action": GameAction
  "run:load": RunState
  "run:presentation-events": readonly GamePresentationEvent[]
}

export const gameEvents = createTypedEventBus<GameEventMap>();
