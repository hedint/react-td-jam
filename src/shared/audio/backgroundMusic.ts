import type { Unsubscribe } from "@shared/lib/event-bus/createTypedEventBus";
import { resolvePublicAssetUrl } from "@shared/assets/manifest";
import { gameEvents } from "@shared/lib/event-bus/gameEvents";

export const AUDIO_MUTE_STORAGE_KEY = "jam-td:muted";

const MAIN_THEME_SRC = "/assets/sounds/main-theme.mp3";
const MUSIC_VOLUME = 0.315;

export interface BackgroundMusicController {
  readonly muted: boolean
  destroy: () => void
  setMuted: (muted: boolean) => void
}

interface BackgroundMusicDependencies {
  readonly audio: HTMLAudioElement
  readonly document: Document
  readonly localStorage: Storage
}

let activeController: BackgroundMusicController | null = null;

export function initBackgroundMusic(): BackgroundMusicController {
  if (activeController) {
    return activeController;
  }

  activeController = createBackgroundMusicController({
    audio: createMainThemeAudio(),
    document,
    localStorage: window.localStorage,
  });

  return activeController;
}

function createBackgroundMusicController(dependencies: BackgroundMusicDependencies): BackgroundMusicController {
  const audio = dependencies.audio;
  let muted = dependencies.localStorage.getItem(AUDIO_MUTE_STORAGE_KEY) === "1";
  let unlocked = false;
  let destroyed = false;
  let unsubscribeMute: Unsubscribe = () => {};
  const controller: BackgroundMusicController = {
    get muted() {
      return muted;
    },
    destroy() {
      destroyed = true;
      removeUnlockListeners();
      dependencies.document.removeEventListener("visibilitychange", handleVisibilityChange);
      unsubscribeMute();
      audio.pause();
      activeController = null;
    },
    setMuted(nextMuted) {
      muted = nextMuted;
      dependencies.localStorage.setItem(AUDIO_MUTE_STORAGE_KEY, muted ? "1" : "0");
      void syncPlayback();
    },
  };

  function tryUnlock(): void {
    if (destroyed || unlocked) {
      return;
    }

    unlocked = true;
    removeUnlockListeners();
    void syncPlayback();
  }

  function handleVisibilityChange(): void {
    void syncPlayback();
  }

  function addUnlockListeners(): void {
    dependencies.document.addEventListener("pointerdown", tryUnlock, { capture: true });
    dependencies.document.addEventListener("touchstart", tryUnlock, { capture: true });
    dependencies.document.addEventListener("keydown", tryUnlock, { capture: true });
  }

  function removeUnlockListeners(): void {
    dependencies.document.removeEventListener("pointerdown", tryUnlock, { capture: true });
    dependencies.document.removeEventListener("touchstart", tryUnlock, { capture: true });
    dependencies.document.removeEventListener("keydown", tryUnlock, { capture: true });
  }

  async function syncPlayback(): Promise<void> {
    audio.muted = muted;

    if (destroyed || muted || dependencies.document.visibilityState === "hidden" || !unlocked) {
      audio.pause();
      return;
    }

    if (!audio.paused) {
      return;
    }

    try {
      await audio.play();
    } catch {
      unlocked = false;
      addUnlockListeners();
    }
  }

  unsubscribeMute = gameEvents.on("audio:mute-changed", (event) => {
    controller.setMuted(event.muted);
  });

  audio.loop = true;
  audio.preload = "auto";
  audio.volume = MUSIC_VOLUME;
  audio.muted = muted;
  addUnlockListeners();
  dependencies.document.addEventListener("visibilitychange", handleVisibilityChange);

  return controller;
}

function createMainThemeAudio(): HTMLAudioElement {
  return new Audio(resolvePublicAssetUrl(MAIN_THEME_SRC));
}
