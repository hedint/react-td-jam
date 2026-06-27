import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import { initCapacitorAppShell } from "./mobile/capacitorAppShell";
import { router } from "./router";
import "./styles/global.css";

const app = createApp(App)
  .use(createPinia())
  .use(router);

initCapacitorAppShell(router);

app.mount("#app");
