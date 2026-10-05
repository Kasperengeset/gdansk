import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Enkle signerte cookies: base64url(JSON) + "." + HMAC-SHA256.

const PLAYER_COOKIE = "rebus_player";
const ADMIN_COOKIE = "rebus_admin";
const MAX_AGE = 60 * 60 * 24 * 30;

export type PlayerSession = { playerId: string; teamId: string };

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET mangler");
  return "lokal-utvikling-ikke-hemmelig";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(data: object): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode<T>(value: string | undefined): T | null {
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};

export async function getPlayerSession(): Promise<PlayerSession | null> {
  return decode<PlayerSession>((await cookies()).get(PLAYER_COOKIE)?.value);
}

export async function setPlayerSession(session: PlayerSession) {
  (await cookies()).set(PLAYER_COOKIE, encode(session), cookieOptions);
}

export async function clearPlayerSession() {
  (await cookies()).delete(PLAYER_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  return decode<{ admin: true }>((await cookies()).get(ADMIN_COOKIE)?.value)?.admin === true;
}

export function checkAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? (process.env.NODE_ENV === "production" ? "" : "admin");
  if (!expected) return false;
  const a = createHmac("sha256", "pw").update(password).digest();
  const b = createHmac("sha256", "pw").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function setAdminSession() {
  (await cookies()).set(ADMIN_COOKIE, encode({ admin: true }), cookieOptions);
}

export async function clearAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}
