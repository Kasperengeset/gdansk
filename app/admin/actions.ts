"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { isCipherType, validateKey } from "@/lib/cipher";
import { getDb } from "@/lib/db";
import {
  addAdjustment,
  adminComplete,
  adminUnlock,
  COSTUME_THEMES,
  GameError,
  PROOF_TYPES,
  resetTeam,
  startTeams,
} from "@/lib/game";
import { checkAdminPassword, clearAdminSession, isAdmin, setAdminSession } from "@/lib/session";

export type ActionResult = { error?: string; ok?: boolean } | undefined;

/** Sjekker admin, kjører handlingen og gjør GameError om til en feilmelding i skjemaet. */
async function run(fn: () => Promise<void>): Promise<ActionResult> {
  if (!(await isAdmin())) return { error: "Du er ikke logget inn som admin." };
  try {
    await fn();
  } catch (err) {
    if (err instanceof GameError) return { error: err.message };
    throw err;
  }
  refresh();
  return { ok: true };
}

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

// ---------- Innlogging ----------

export async function adminLoginAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (!checkAdminPassword(String(form.get("password") ?? ""))) return { error: "Feil passord." };
  await setAdminSession();
  redirect("/admin");
}

export async function adminLogoutAction() {
  await clearAdminSession();
  redirect("/admin/login");
}

// ---------- Løpskontroll og lag ----------

export async function startAllAction() {
  return run(async () => startTeams(await getDb()));
}

export async function startTeamAction(teamId: string) {
  return run(async () => startTeams(await getDb(), teamId));
}

export async function unlockAction(teamId: string) {
  return run(async () => adminUnlock(await getDb(), teamId));
}

export async function completeAction(teamId: string) {
  return run(async () => adminComplete(await getDb(), teamId));
}

export async function resetTeamAction(teamId: string) {
  return run(async () => resetTeam(await getDb(), teamId));
}

export async function deleteTeamAction(teamId: string) {
  const result = await run(async () => {
    await (await getDb()).query("delete from teams where id = $1", [teamId]);
  });
  if (result?.error) return result;
  redirect("/admin");
}

export async function setThemeAction(teamId: string, _prev: ActionResult, form: FormData) {
  return run(async () => {
    const theme = str(form, "theme");
    if (!COSTUME_THEMES.includes(theme)) throw new GameError("Ukjent tema.");
    await (await getDb()).query("update teams set costume_theme = $2 where id = $1", [teamId, theme]);
  });
}

export async function addAdjustmentAction(teamId: string, _prev: ActionResult, form: FormData) {
  return run(async () => addAdjustment(await getDb(), teamId, Number(str(form, "minutes")), str(form, "reason")));
}

export async function addPresetAdjustmentAction(teamId: string, minutes: number, reason: string) {
  return run(async () => addAdjustment(await getDb(), teamId, minutes, reason));
}

export async function deleteAdjustmentAction(adjustmentId: string) {
  return run(async () => {
    await (await getDb()).query("delete from adjustments where id = $1", [adjustmentId]);
  });
}

export async function saveSettingsAction(_prev: ActionResult, form: FormData) {
  return run(async () => {
    const db = await getDb();
    for (const key of ["organizer_name", "organizer_phone"]) {
      await db.query(
        "insert into settings (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value",
        [key, str(form, key)],
      );
    }
  });
}

// ---------- Poster ----------

function parseCoord(value: string, max: number): number | null {
  if (!value) return null;
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n) || Math.abs(n) > max) throw new GameError("Ugyldig koordinat.");
  return n;
}

export async function savePostAction(postId: string | null, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  const result = await run(async () => {
    const title = str(form, "title");
    if (!title) throw new GameError("Posten må ha en tittel.");
    const cipherType = str(form, "cipher_type");
    if (!isCipherType(cipherType)) throw new GameError("Ukjent chiffertype.");
    const cipherKey = str(form, "cipher_key");
    const keyError = validateKey(cipherType, cipherKey);
    if (keyError) throw new GameError(keyError);
    const proofType = str(form, "proof_type");
    if (!Object.hasOwn(PROOF_TYPES, proofType)) throw new GameError("Ukjent bevistype.");
    const position = parseInt(str(form, "position"), 10);
    if (!Number.isFinite(position)) throw new GameError("Rekkefølge må være et tall.");
    const radius = parseInt(str(form, "radius_m"), 10);
    if (!(radius >= 10 && radius <= 2000)) throw new GameError("Radius må være mellom 10 og 2000 meter.");
    const penalty = parseInt(str(form, "emergency_penalty_min"), 10);
    if (!Number.isFinite(penalty)) throw new GameError("Straff for nødkonvolutt må være et tall.");
    const lat = parseCoord(str(form, "lat"), 90);
    const lng = parseCoord(str(form, "lng"), 180);
    if ((lat === null) !== (lng === null)) throw new GameError("Fyll inn både breddegrad og lengdegrad.");

    const values = [
      position,
      title,
      String(form.get("clue_text") ?? "").trim(),
      cipherType,
      cipherKey,
      str(form, "key_hint"),
      String(form.get("task_text") ?? "").trim(),
      lat,
      lng,
      radius,
      proofType,
      str(form, "emergency_text"),
      penalty,
      form.get("active") === "on",
      form.get("is_finale") === "on",
      String(form.get("admin_note") ?? "").trim(),
    ];
    const db = await getDb();
    const cols =
      "position, title, clue_text, cipher_type, cipher_key, key_hint, task_text, lat, lng, radius_m, proof_type, emergency_text, emergency_penalty_min, active, is_finale, admin_note";
    if (postId) {
      const sets = cols
        .split(", ")
        .map((c, i) => `${c} = $${i + 2}`)
        .join(", ");
      await db.query(`update posts set ${sets} where id = $1`, [postId, ...values]);
    } else {
      await db.query(`insert into posts (${cols}) values (${values.map((_, i) => `$${i + 1}`).join(", ")})`, values);
    }
  });
  if (result?.error) return result;
  redirect("/admin/poster");
}

export async function deletePostAction(postId: string) {
  const result = await run(async () => {
    await (await getDb()).query("delete from posts where id = $1", [postId]);
  });
  if (result?.error) return result;
  redirect("/admin/poster");
}

export async function toggleActiveAction(postId: string) {
  return run(async () => {
    await (await getDb()).query("update posts set active = not active where id = $1", [postId]);
  });
}

/** Bytter plass med naboposten over eller under. */
export async function movePostAction(postId: string, direction: -1 | 1) {
  return run(async () => {
    const db = await getDb();
    await db.tx(async (tx) => {
      const posts = await tx.query<{ id: string; position: number }>("select id, position from posts order by position, id");
      const i = posts.findIndex((p) => p.id === postId);
      const j = i + direction;
      if (i === -1 || j < 0 || j >= posts.length) return;
      // Renummerer alle først, så byttet blir entydig selv om to poster hadde samme nummer.
      posts.forEach((p, k) => (p.position = k + 1));
      [posts[i].position, posts[j].position] = [posts[j].position, posts[i].position];
      for (const p of posts) {
        await tx.query("update posts set position = $2 where id = $1", [p.id, p.position]);
      }
    });
  });
}
