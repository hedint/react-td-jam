import type { BoardSlot } from "@entities/game-session/model/types";

export type SlotFeedback = "idle" | "valid" | "selected";

export function getSlotFeedback(options: {
  readonly hasSelectedTower: boolean
  readonly isSelectedSlot: boolean
  readonly isValidTarget: boolean
  readonly slot: BoardSlot
}): SlotFeedback {
  if (options.isSelectedSlot) {
    return "selected";
  }

  if (options.hasSelectedTower && options.isValidTarget) {
    return "valid";
  }

  return "idle";
}
