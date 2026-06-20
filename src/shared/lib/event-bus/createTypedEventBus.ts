export type EventMap = object;
export type EventHandler<Payload> = (payload: Payload) => void;
export type Unsubscribe = () => void;

export interface TypedEventBus<Events extends EventMap> {
  emit: <Key extends keyof Events>(eventName: Key, payload: Events[Key]) => void
  on: <Key extends keyof Events>(eventName: Key, handler: EventHandler<Events[Key]>) => Unsubscribe
}

export function createTypedEventBus<Events extends EventMap>(): TypedEventBus<Events> {
  const listeners = new Map<keyof Events, Set<EventHandler<Events[keyof Events]>>>();

  return {
    emit(eventName, payload) {
      listeners.get(eventName)?.forEach((handler) => {
        handler(payload);
      });
    },
    on(eventName, handler) {
      const handlers = listeners.get(eventName) ?? new Set<EventHandler<Events[keyof Events]>>();
      handlers.add(handler as EventHandler<Events[keyof Events]>);
      listeners.set(eventName, handlers);

      return () => {
        handlers.delete(handler as EventHandler<Events[keyof Events]>);

        if (handlers.size === 0) {
          listeners.delete(eventName);
        }
      };
    },
  };
}
