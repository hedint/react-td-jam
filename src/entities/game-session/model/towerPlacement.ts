import type { RunState, TowerState } from "./types";
import { resolveReactions } from "./reactions";

export function placeSelectedTower(state: RunState, slotId: string): RunState {
  const slot = state.board.slots.find(candidate => candidate.id === slotId);
  const selectedTower = findSelectedTower(state);

  if (!selectedTower || !slot || slot.locked) {
    return state;
  }

  if (state.bench.some(tower => tower.id === selectedTower.id)) {
    return placeBenchTower(state, selectedTower, slotId);
  }

  if (!canEditPlacedTowers(state)) {
    return state;
  }

  return movePlacedTower(state, selectedTower, slotId);
}

export function selectTower(state: RunState, towerId: string | null): RunState {
  if (towerId === null) {
    return { ...state, selectedTowerId: null };
  }

  return [...state.bench, ...state.placedTowers].some(tower => tower.id === towerId)
    ? { ...state, selectedTowerId: towerId }
    : state;
}

export function tapSlot(state: RunState, slotId: string): RunState {
  const slot = state.board.slots.find(candidate => candidate.id === slotId);

  if (!slot || slot.locked) {
    return state;
  }

  const occupiedTower = state.placedTowers.find(tower => tower.slotId === slotId);

  if (!state.selectedTowerId) {
    return occupiedTower && canEditPlacedTowers(state)
      ? removePlacedTower(state, occupiedTower)
      : state;
  }

  return placeSelectedTower(state, slotId);
}

function placeBenchTower(state: RunState, selectedTower: TowerState, slotId: string): RunState {
  const occupiedTower = state.placedTowers.find(tower => tower.slotId === slotId);

  if (occupiedTower && !canEditPlacedTowers(state)) {
    return state;
  }

  const placedTower = {
    ...selectedTower,
    slotId,
  };
  const placedTowers = occupiedTower
    ? [
        ...state.placedTowers
          .filter(tower => tower.id !== occupiedTower.id)
          .map(tower => tower.id === selectedTower.id ? placedTower : tower),
        placedTower,
      ]
    : [...state.placedTowers, placedTower];
  const bench = occupiedTower
    ? [
        ...state.bench.filter(tower => tower.id !== selectedTower.id),
        { ...occupiedTower, slotId: null },
      ]
    : state.bench.filter(tower => tower.id !== selectedTower.id);

  return {
    ...state,
    bench,
    placedTowers,
    selectedTowerId: null,
    reactions: resolveReactions(state.board, placedTowers, state.upgrades),
  };
}

function movePlacedTower(state: RunState, selectedTower: TowerState, slotId: string): RunState {
  const occupiedTower = state.placedTowers.find(tower => tower.slotId === slotId);

  if (occupiedTower?.id === selectedTower.id) {
    return removePlacedTower(state, selectedTower);
  }

  const placedTowers = state.placedTowers.map((tower) => {
    if (tower.id === selectedTower.id) {
      return { ...tower, slotId };
    }

    if (tower.id === occupiedTower?.id) {
      return { ...tower, slotId: selectedTower.slotId };
    }

    return tower;
  });

  return {
    ...state,
    placedTowers,
    selectedTowerId: null,
    reactions: resolveReactions(state.board, placedTowers, state.upgrades),
  };
}

function removePlacedTower(state: RunState, towerToRemove: TowerState): RunState {
  const placedTowers = state.placedTowers.filter(tower => tower.id !== towerToRemove.id);

  return {
    ...state,
    bench: [...state.bench, { ...towerToRemove, slotId: null }],
    placedTowers,
    selectedTowerId: null,
    reactions: resolveReactions(state.board, placedTowers, state.upgrades),
  };
}

function findSelectedTower(state: RunState): TowerState | undefined {
  return [...state.bench, ...state.placedTowers].find(tower => tower.id === state.selectedTowerId);
}

function canEditPlacedTowers(state: RunState): boolean {
  return state.paused || state.phase === "ready";
}
