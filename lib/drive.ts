import { timingSafeEqual } from "node:crypto";

// Reads session folders from Google Drive with plain fetch (no googleapis package needed).
// Drive layout:  <DRIVE_ROOT_FOLDER_ID>/<session id>/{final.png, raw_1.jpg, ..., share_token.txt}

const API = "https://www.googleapis.com/drive/v3";
const ID = /^[A-Za-z0-9_-]{6,64}$/;                       // session id and token format (no quotes -> safe in Drive queries)
const SHOWN = /^(final\.png|raw_\d{1,2}\.jpg)$/;          // the ONLY files a visitor can ever see
const CACHE_MS = 5 * 60 * 1000;
const LIST = { supportsAllDrives: "true", includeItemsFromAllDrives: "true", pageSize: "100" };

export class SessionError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
const notFound = () => new SessionError(404, "We couldn't find photos for that code.");

function env(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[config] missing environment variable ${name}`);
    throw new SessionError(500, "The photo server isn't set up yet.");
  }
  return v;
}

// ---- Google login (refresh token -> short-lived access token, cached) ----
let access: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (access && access.exp > Date.now() + 60_000) return access.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      refresh_token: env("GOOGLE_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) {
    console.error("[google] token refresh failed:", j.error, j.error_description);   // invalid_grant = refresh token expired/revoked
    throw new SessionError(502, "The photo server couldn't sign in to Google. Please tell the organizers.");
  }
  access = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return access.token;
}

async function driveGet(path: string, params: Record<string, string>): Promise<Response> {
  const url = new URL(`${API}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken()}` }, cache: "no-store" });
  if (!res.ok) {
    console.error("[drive]", res.status, (await res.text().catch(() => "")).slice(0, 300));
    throw new SessionError(502, "Couldn't reach the photo storage. Please try again in a moment.");
  }
  return res;
}

// ---- one session ----
type Entry = { at: number; createdTime: string; secret: string; files: { id: string; name: string; label: string }[] };
const cache = new Map<string, Entry>();

const rank = (name: string) => (name === "final.png" ? 0 : Number(name.match(/\d+/)?.[0] ?? 99));
const labelOf = (name: string) => (name === "final.png" ? "Your photo strip" : `Photo ${name.match(/\d+/)?.[0]}`);

async function loadEntry(sid: string): Promise<Entry> {
  const q = `'${env("DRIVE_ROOT_FOLDER_ID")}' in parents and name = '${sid}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const found = await (await driveGet("files", { ...LIST, q, pageSize: "1", fields: "files(id,createdTime)" })).json();
  const folder = found.files?.[0];
  if (!folder) throw notFound();

  const listed = await (await driveGet("files", { ...LIST, q: `'${folder.id}' in parents and trashed = false`, fields: "files(id,name)" })).json();
  const all: { id: string; name: string }[] = listed.files ?? [];
  const tokenFile = all.find((f) => f.name === "share_token.txt");
  if (!tokenFile) throw notFound();                        // no secret uploaded -> never serve
  const secret = (await (await driveGet(`files/${tokenFile.id}`, { alt: "media", supportsAllDrives: "true" })).text()).trim();

  const files = all
    .filter((f) => SHOWN.test(f.name))
    .sort((a, b) => rank(a.name) - rank(b.name))
    .map((f) => ({ ...f, label: labelOf(f.name) }));
  if (!files.length) throw notFound();
  return { at: Date.now(), createdTime: folder.createdTime, secret, files };
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Checks the QR's session id + secret token and returns what the visitor may see. */
export async function loadSession(sid: string, token: string) {
  if (!ID.test(sid) || !ID.test(token)) throw new SessionError(400, "That link doesn't look right.");
  let entry = cache.get(sid);
  if (!entry || Date.now() - entry.at > CACHE_MS) {
    entry = await loadEntry(sid);
    cache.set(sid, entry);
  }
  if (!safeEqual(entry.secret, token)) throw notFound();   // same answer as "no such session": reveals nothing
  const days = Number(process.env.EXPIRE_DAYS ?? 7);
  const expiresAt = new Date(entry.createdTime).getTime() + days * 86_400_000;
  if (Date.now() > expiresAt) throw new SessionError(410, "These photos have expired and were removed.");
  return { expiresAt, files: entry.files };
}

export const openFile = (id: string) => driveGet(`files/${id}`, { alt: "media", supportsAllDrives: "true" });
