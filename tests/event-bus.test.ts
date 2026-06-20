import { createTypedEventBus } from "@shared/lib/event-bus/createTypedEventBus";
import { describe, expect, it } from "vitest";

interface TestEvents {
  "counter:update": number
}

describe("createTypedEventBus", () => {
  it("emits payloads to subscribed handlers", () => {
    const bus = createTypedEventBus<TestEvents>();
    const values: number[] = [];

    bus.on("counter:update", value => values.push(value));
    bus.emit("counter:update", 3);
    bus.emit("counter:update", 7);

    expect(values).toEqual([3, 7]);
  });

  it("unsubscribes handlers", () => {
    const bus = createTypedEventBus<TestEvents>();
    const values: number[] = [];
    const unsubscribe = bus.on("counter:update", value => values.push(value));

    unsubscribe();
    bus.emit("counter:update", 1);

    expect(values).toEqual([]);
  });
});
