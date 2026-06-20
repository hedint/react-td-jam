import { gameEvents } from "@shared/lib/event-bus/gameEvents";
import { onBeforeUnmount, onMounted } from "vue";
import { useGameSessionStore } from "./store";

export function useGameSessionBridge(): void {
  const store = useGameSessionStore();

  onMounted(() => {
    const unsubscribeSnapshot = gameEvents.on("session:snapshot", store.applySnapshot);
    const unsubscribeResize = gameEvents.on("viewport:resize", store.applyViewport);

    onBeforeUnmount(() => {
      unsubscribeSnapshot();
      unsubscribeResize();
    });
  });
}
