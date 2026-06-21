import type { EmitterId, TowerState } from "./types";
import { gameConfig } from "./config";

export function createTower(id: string, emitterId: EmitterId, slotId: string | null): TowerState {
  return {
    id,
    emitterId,
    displayName: getEmitterTowerDisplayName(emitterId),
    slotId,
  };
}

function getEmitterTowerDisplayName(emitterId: EmitterId): string {
  return gameConfig.emitters.find(emitter => emitter.id === emitterId)?.towerDisplayName ?? emitterId;
}
