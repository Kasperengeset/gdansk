"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { createTeam, GameError, joinTeam } from "@/lib/game";
import { setPlayerSession } from "@/lib/session";

export type FormState = { error?: string } | undefined;

async function enter(fn: () => Promise<{ teamId: string; playerId: string }>): Promise<FormState> {
  try {
    await setPlayerSession(await fn());
  } catch (err) {
    if (err instanceof GameError) return { error: err.message };
    throw err;
  }
  redirect("/spill");
}

export async function createTeamAction(_prev: FormState, form: FormData): Promise<FormState> {
  const db = await getDb();
  return enter(() => createTeam(db, String(form.get("team") ?? ""), String(form.get("name") ?? "")));
}

export async function joinTeamAction(_prev: FormState, form: FormData): Promise<FormState> {
  const db = await getDb();
  return enter(() => joinTeam(db, String(form.get("code") ?? ""), String(form.get("name") ?? "")));
}
