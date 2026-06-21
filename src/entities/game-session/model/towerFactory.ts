import type { EmitterId, GameConfig, TowerState } from "./types";
import { gameConfig } from "./config";

export function createTower(id: string, emitterId: EmitterId, slotId: string | null, config: GameConfig = gameConfig): TowerState {
  return {
    id,
    emitterId,
    displayName: getEmitterTowerDisplayName(emitterId, config),
    slotId,
  };
}

function getEmitterTowerDisplayName(emitterId: EmitterId, config: GameConfig): string {
  return config.emitters.find(emitter => emitter.id === emitterId)?.towerDisplayName ?? emitterId;
}
