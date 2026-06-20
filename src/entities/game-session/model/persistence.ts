import type { RunState } from "./types";
import { deserializeRun, serializeRun } from "./simulation";

export const RUN_SAVE_KEY = "jam-td.run.v1";

export interface RunStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export function saveRun(state: RunState, storage = getBrowserStorage()): void {
  storage?.setItem(RUN_SAVE_KEY, serializeRun(state));
}

export function loadSavedRun(storage = getBrowserStorage()): RunState | null {
  const payload = storage?.getItem(RUN_SAVE_KEY);

  if (!payload) {
    return null;
  }

  try {
    return deserializeRun(payload);
  } catch {
    return null;
  }
}

export function hasSavedRun(storage = getBrowserStorage()): boolean {
  return loadSavedRun(storage) !== null;
}

export function clearSavedRun(storage = getBrowserStorage()): void {
  storage?.removeItem(RUN_SAVE_KEY);
}

function getBrowserStorage(): RunStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}
