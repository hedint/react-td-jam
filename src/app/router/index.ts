import { createRouter, createWebHistory } from "vue-router";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "game",
      component: () => import("@pages/game/ui/GamePage.vue"),
    },
    {
      path: "/tower-demo",
      name: "tower-demo",
      component: () => import("@pages/tower-demo/ui/TowerDemoPage.vue"),
    },
  ],
});
