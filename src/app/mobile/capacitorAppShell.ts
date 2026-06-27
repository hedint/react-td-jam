import type { Router } from "vue-router";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

let initialized = false;

export function initCapacitorAppShell(router: Router): void {
  if (initialized || Capacitor.getPlatform() !== "android") {
    return;
  }

  initialized = true;

  void CapacitorApp.addListener("backButton", async () => {
    if (router.currentRoute.value.path !== "/") {
      await router.replace("/");
      return;
    }

    await CapacitorApp.minimizeApp();
  });
}
