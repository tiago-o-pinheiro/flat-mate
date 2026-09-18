import { describe, expect, it, vi } from "vitest";
import { createCommunity } from "../../src/lib/domain/seed";
import {
  googleEventId,
  googlePayload,
  pushGoogleEvent,
} from "../../src/lib/server/google";
import type { HouseEvent } from "../../src/lib/domain/types";
const state = createCommunity("Casa", "owner", "Ana");
state.google.calendarId = "shared@example.com";
const event: HouseEvent = {
  id: "my-event",
  calendarId: "away",
  title: "Viaje",
  start: "2026-10-25",
  end: "2026-11-02",
  allDay: true,
  kind: "absence",
  authorId: state.members[0].id,
  completed: false,
  version: 1,
  syncedVersion: 0,
};
describe("salida de Google Calendar", () => {
  it("convierte el fin inclusivo de las ausencias al fin exclusivo de Google", () => {
    expect(googlePayload(state, event).end).toEqual({ date: "2026-11-03" });
  });
  it("IDs estables compatibles con Google", () => {
    expect(googleEventId(event.id)).toMatch(/^[0-9a-v]{5,1024}$/);
    expect(googleEventId(event.id)).toBe(googleEventId(event.id));
  });
  it("reintentar un insert duplicado actualiza el mismo evento", async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    await pushGoogleEvent(state, event, "test-token", transport);
    expect(transport.mock.calls.map((c) => c[1].method)).toEqual([
      "PUT",
      "POST",
      "PUT",
    ]);
    expect(transport.mock.calls[0][0]).toBe(transport.mock.calls[2][0]);
  });
  it("borrar un evento ya borrado es idempotente", async () => {
    await expect(
      pushGoogleEvent(
        state,
        { ...event, deleted: true },
        "token",
        vi.fn().mockResolvedValue(new Response(null, { status: 410 })),
      ),
    ).resolves.toBeUndefined();
  });
  it("los fallos se propagan para conservar el trabajo pendiente", async () => {
    await expect(
      pushGoogleEvent(
        state,
        event,
        "token",
        vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
      ),
    ).rejects.toThrow("503");
  });
});
