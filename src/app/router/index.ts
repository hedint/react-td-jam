import { createRouter, createWebHistory } from "vue-router";

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
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
    {
      path: "/enemy-demo",
      name: "enemy-demo",
      component: () => import("@pages/enemy-demo/ui/EnemyDemoPage.vue"),
    },
    {
      path: "/onboarding-guide-demo",
      name: "onboarding-guide-demo",
      component: () => import("@pages/onboarding-guide-demo/ui/OnboardingGuideDemoPage.vue"),
    },
    {
      path: "/field-shmyg-demo",
      name: "field-shmyg-demo",
      component: () => import("@pages/field-shmyg-demo/ui/FieldShmygDemoPage.vue"),
    },
  ],
});
