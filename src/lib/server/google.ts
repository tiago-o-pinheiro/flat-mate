import { PublicError } from "../domain/errors";
import { addDays } from "../domain/dates";
import type { Community, HouseEvent } from "../domain/types";
import { decrypt, encrypt, hashToken } from "./crypto";
import { mutateCommunity, readCommunity } from "./repository";
type Tokens = {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
};
export const googleEventId = (eventId: string) =>
  `fm${hashToken(eventId).slice(0, 48)}`;
const fetchGoogle: typeof fetch = (url, options = {}) =>
  fetch(url, {
    ...options,
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
export async function storeGoogleTokens(
  communityId: string,
  tokens: { access_token: string; refresh_token?: string; expires_in: number },
) {
  await mutateCommunity(communityId, (state) => {
    const previous: Tokens | undefined = state.google.encryptedToken
      ? JSON.parse(decrypt(state.google.encryptedToken))
      : undefined;
    const refresh_token = tokens.refresh_token ?? previous?.refresh_token;
    if (!refresh_token)
      throw new PublicError(
        "Google no concedió acceso sin conexión. Vuelve a conectar la cuenta.",
      );
    state.google.encryptedToken = encrypt(
      JSON.stringify({
        access_token: tokens.access_token,
        refresh_token,
        expires_at: Date.now() + tokens.expires_in * 1000,
      }),
    );
    state.google.reconnect = false;
  });
}
async function accessToken(state: Community) {
  if (!state.google.encryptedToken)
    throw new PublicError("Conecta Google Calendar primero.");
  const token = JSON.parse(decrypt(state.google.encryptedToken)) as Tokens;
  if (token.expires_at > Date.now() + 60000) return token.access_token;
  const response = await fetchGoogle("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      grant_type: "refresh_token",
      refresh_token: token.refresh_token!,
    }),
  });
  if (!response.ok) {
    if (response.status === 400 || response.status === 401)
      await mutateCommunity(state.id, (s) => {
        s.google.reconnect = true;
      });
    throw new PublicError("No se pudo renovar la conexión de Google.");
  }
  const updated = await response.json();
  await storeGoogleTokens(state.id, updated);
  return updated.access_token as string;
}
export async function googleCalendars(communityId: string) {
  const state = await readCommunity(communityId);
  if (!state) throw new PublicError("Comunidad no encontrada.");
  const token = await accessToken(state),
    calendars: { id: string; summary: string }[] = [];
  let page: string | undefined;
  do {
    const response = await fetchGoogle(
      `https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer${page ? `&pageToken=${encodeURIComponent(page)}` : ""}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok)
      throw new PublicError("No se pudieron cargar tus calendarios.");
    const data = await response.json();
    calendars.push(
      ...(data.items ?? []).map((c: { id: string; summary: string }) => ({
        id: c.id,
        summary: c.summary,
      })),
    );
    page = data.nextPageToken;
  } while (page);
  return calendars;
}
export function googlePayload(state: Community, event: HouseEvent) {
  const calendar = state.calendars.find((c) => c.id === event.calendarId);
  const assignee = state.members.find((m) => m.id === event.assigneeId);
  return {
    id: googleEventId(event.id),
    summary: `${event.completed ? "✓ " : ""}${event.title}${assignee ? ` · ${assignee.name}` : ""}`,
    description: `Flat Mate · ${state.name} · ${calendar?.name ?? "Casa"}\nGestiona este evento desde Flat Mate.`,
    start: event.allDay
      ? { date: event.start }
      : { dateTime: event.start, timeZone: "Europe/Madrid" },
    end: event.allDay
      ? { date: addDays(event.end, 1) }
      : { dateTime: event.end, timeZone: "Europe/Madrid" },
    extendedProperties: {
      private: { flatmateEventId: event.id, flatmateCommunityId: state.id },
    },
  };
}
export async function pushGoogleEvent(
  state: Community,
  event: HouseEvent,
  token: string,
  transport: typeof fetch = fetchGoogle,
) {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(state.google.calendarId!)}/events`;
  const url = `${base}/${googleEventId(event.id)}`,
    headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  if (event.deleted) {
    const response = await transport(url, { method: "DELETE", headers });
    if (!response.ok && response.status !== 404 && response.status !== 410)
      throw new PublicError(
        `Google no pudo borrar el evento (${response.status}).`,
      );
    return;
  }
  const body = JSON.stringify(googlePayload(state, event));
  let response = await transport(url, { method: "PUT", headers, body });
  if (response.status === 404 || response.status === 410) {
    response = await transport(base, { method: "POST", headers, body });
    if (response.status === 409)
      response = await transport(url, { method: "PUT", headers, body });
  }
  if (!response.ok)
    throw new PublicError(
      `Google no pudo sincronizar el evento (${response.status}).`,
    );
}
export async function syncCommunity(id: string, deadline = Date.now() + 20000) {
  const snapshot = await mutateCommunity(id, (state) => {
    if (
      !state.google.calendarId ||
      !state.google.encryptedToken ||
      state.google.reconnect ||
      (state.google.leaseUntil &&
        Date.parse(state.google.leaseUntil) > Date.now())
    )
      return null;
    state.google.leaseUntil = new Date(Date.now() + 120000).toISOString();
    return structuredClone(state);
  });
  if (!snapshot) return;
  try {
    const token = await accessToken(snapshot);
    const pending = snapshot.events
      .filter((e) => e.version !== e.syncedVersion)
      .sort(
        (a, b) =>
          Number(!!b.deleted) - Number(!!a.deleted) ||
          a.start.localeCompare(b.start),
      )
      .slice(0, 12);
    for (const event of pending) {
      if (Date.now() >= deadline) break;
      let error: string | undefined;
      try {
        await pushGoogleEvent(snapshot, event, token);
      } catch (e) {
        error =
          e instanceof PublicError ? e.message : "No se pudo sincronizar.";
      }
      await mutateCommunity(id, (state) => {
        const live = state.events.find((e) => e.id === event.id);
        if (!live || state.google.calendarId !== snapshot.google.calendarId)
          return;
        if (live.version === event.version) {
          live.syncError = error;
          if (!error) live.syncedVersion = event.version;
        }
      });
    }
    await mutateCommunity(id, (state) => {
      state.google.lastSync = new Date().toISOString();
    });
  } catch (e) {
    await mutateCommunity(id, (state) => {
      for (const event of state.events.filter(
        (e) => e.version !== e.syncedVersion,
      ))
        event.syncError =
          e instanceof PublicError ? e.message : "Error de conexión.";
    });
  } finally {
    await mutateCommunity(id, (state) => {
      delete state.google.leaseUntil;
    });
  }
}
