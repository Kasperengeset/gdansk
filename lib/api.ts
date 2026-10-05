import { NextResponse } from "next/server";
import { GameError } from "./game";
import { getPlayerSession, type PlayerSession } from "./session";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

/** Kjører en route handler og gjør GameError om til JSON-feil med norsk melding. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof GameError) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: "Noe gikk galt på serveren. Prøv igjen." }, 500);
  }
}

export async function requirePlayer(): Promise<PlayerSession> {
  const session = await getPlayerSession();
  if (!session) throw new GameError("Du er ikke logget inn.", 401);
  return session;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return typeof body === "object" && body !== null ? body : {};
  } catch {
    return {};
  }
}
