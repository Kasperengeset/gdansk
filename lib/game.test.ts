import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryDb, type Db } from "./db";
import {
  addAdjustment,
  addPhoto,
  adminComplete,
  adminUnlock,
  checkIn,
  createTeam,
  getOverview,
  getTeamState,
  joinTeam,
  openEmergency,
  rankTeams,
  resetTeam,
  startTeams,
  submitProof,
} from "./game";

const HERE = { lat: 54.3485, lng: 18.6533 };
const AWAY = { lat: 54.3685, lng: 18.6533, accuracy: 10 }; // ~2,2 km nord
const at = { ...HERE, accuracy: 10 };

let db: Db;

/** Tre aktive poster med posisjon: bilde, tekst, finale. */
async function setupPosts() {
  await db.query("delete from posts");
  await db.query(
    `insert into posts (position, title, clue_text, cipher_type, cipher_key, task_text, lat, lng, proof_type, emergency_text, is_finale) values
     (1, 'En', 'Gå til fontenen', 'caesar', '1', 'Ta bilde', $1, $2, 'photo', 'Neptunfontenen', false),
     (2, 'To', 'Ved fontenen igjen', 'none', '', 'Skriv svar', $1, $2, 'text', 'Samme sted', false),
     (3, 'Finale', 'Pub', 'none', '', 'Skål!', $1, $2, 'none', 'No To Cyk', true),
     (4, 'Reserve', 'x', 'none', '', 'x', $1, $2, 'none', 'x', false)`,
    [HERE.lat, HERE.lng],
  );
  await db.query("update posts set active = false where title = 'Reserve'");
}

/** Lar innsjekk-sperren utløpe uten å vente 20 sekunder. */
async function skipCooldown(teamId: string) {
  await db.query("update teams set last_checkin_attempt_at = null where id = $1", [teamId]);
}

beforeEach(async () => {
  db = await createMemoryDb();
  await setupPosts();
});

describe("lag", () => {
  it("oppretter lag med kode og lar andre bli med, også på nytt med samme navn", async () => {
    const a = await createTeam(db, "Sjøulkene", "Kasper");
    const state = await getTeamState(db, a.teamId, a.playerId);
    expect(state.team.joinCode).toMatch(/^[A-Z2-9]{5}$/);

    const b = await joinTeam(db, state.team.joinCode.toLowerCase(), "Ola");
    const again = await joinTeam(db, state.team.joinCode, " ola ");
    expect(b.teamId).toBe(a.teamId);
    expect(again.playerId).toBe(b.playerId);
    expect((await getTeamState(db, a.teamId, a.playerId)).players).toEqual(["Kasper", "Ola"]);

    await expect(joinTeam(db, "XXXXX", "Per")).rejects.toThrow("Fant ikke");
  });

  it("fordeler kostymetemaene jevnt", async () => {
    const themes = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const t = await createTeam(db, `Lag ${i}`, "x");
      themes.add((await getTeamState(db, t.teamId, t.playerId)).team.costumeTheme);
    }
    expect(themes.size).toBe(4);
  });
});

describe("spillflyt", () => {
  it("går gjennom alle postene og stopper klokka på finalen", async () => {
    const { teamId, playerId } = await createTeam(db, "Lag", "Kasper");
    let s = await getTeamState(db, teamId, playerId);
    expect(s.current).toBeNull();
    await expect(checkIn(db, teamId, at)).rejects.toThrow("ikke startet");

    await startTeams(db);
    s = await getTeamState(db, teamId, playerId);
    expect(s.totalPosts).toBe(3);
    expect(s.current).toMatchObject({ number: 1, status: "clue", clue: "Ha ujm gpoufofo", task: null });
    // Hemmeligheter skal ikke lekke før de er låst opp.
    expect(JSON.stringify(s)).not.toContain("Ta bilde");
    expect(JSON.stringify(s)).not.toContain("Neptunfontenen");
    expect(JSON.stringify(s)).not.toContain(String(HERE.lat));

    // Feil sted, så sperre, så riktig sted.
    expect(await checkIn(db, teamId, AWAY)).toEqual({ ok: false, reason: "not_here" });
    expect(await checkIn(db, teamId, at)).toMatchObject({ ok: false, reason: "rate" });
    expect(await checkIn(db, teamId, { ...at, accuracy: 500 })).toEqual({ ok: false, reason: "accuracy" });
    await skipCooldown(teamId);
    expect(await checkIn(db, teamId, at)).toEqual({ ok: true });

    s = await getTeamState(db, teamId, playerId);
    expect(s.current?.task).toEqual({ text: "Ta bilde", proofType: "photo", photoIds: [] });

    // Bilde kreves før innsending.
    await expect(submitProof(db, teamId, "")).rejects.toThrow("bilde");
    const photoId = await addPhoto(db, teamId, "image/jpeg", new Uint8Array([1, 2, 3]));
    expect((await getTeamState(db, teamId, playerId)).current?.task?.photoIds).toEqual([photoId]);
    await submitProof(db, teamId, "");

    // Post 2: nødkonvolutt gir straff og viser stedet.
    s = await getTeamState(db, teamId, playerId);
    expect(s.current).toMatchObject({ number: 2, status: "clue" });
    await openEmergency(db, teamId);
    await openEmergency(db, teamId); // to ganger gir bare én straff
    s = await getTeamState(db, teamId, playerId);
    expect(s.current?.emergency).toEqual({ opened: true, text: "Samme sted", penaltyMin: 15 });
    expect(s.adjustments).toEqual([{ minutes: 15, reason: "Nødkonvolutt post 2" }]);

    await skipCooldown(teamId);
    await checkIn(db, teamId, at);
    await expect(submitProof(db, teamId, "  ")).rejects.toThrow("svaret");
    await submitProof(db, teamId, "Wajdelota var en prest");

    // Finale: innsjekk = i mål.
    s = await getTeamState(db, teamId, playerId);
    expect(s.current).toMatchObject({ number: 3, isFinale: true });
    await skipCooldown(teamId);
    await checkIn(db, teamId, at);
    s = await getTeamState(db, teamId, playerId);
    expect(s.team.finishedAt).not.toBeNull();
    expect(s.current).toBeNull();
    expect(s.finaleTask).toBe("Skål!");
    expect(s.completedCount).toBe(3);
    expect(s.score.adjustmentMin).toBe(15);
  });

  it("admin kan låse opp, fullføre, gi straff/bonus og nullstille", async () => {
    const a = await createTeam(db, "A", "a");
    const b = await createTeam(db, "B", "b");
    await startTeams(db, a.teamId);
    expect((await getTeamState(db, b.teamId, b.playerId)).team.startedAt).toBeNull();
    await startTeams(db);

    await adminUnlock(db, a.teamId);
    let s = await getTeamState(db, a.teamId, a.playerId);
    expect(s.current?.status).toBe("arrived");
    await expect(adminUnlock(db, a.teamId)).rejects.toThrow();

    await adminComplete(db, a.teamId);
    await adminComplete(db, a.teamId);
    await adminComplete(db, a.teamId);
    s = await getTeamState(db, a.teamId, a.playerId);
    expect(s.team.finishedAt).not.toBeNull();

    await addAdjustment(db, a.teamId, -15, "Beste kostyme");
    await expect(addAdjustment(db, a.teamId, 0, "x")).rejects.toThrow();

    const { teams, totalPosts } = await getOverview(db);
    expect(totalPosts).toBe(3);
    const ranked = rankTeams(teams);
    expect(ranked[0].team.name).toBe("A"); // i mål kommer først
    expect(ranked[0].score.adjustmentMin).toBe(-15);
    expect(ranked[1].current).toMatchObject({ number: 1, status: "clue" });

    await resetTeam(db, a.teamId);
    s = await getTeamState(db, a.teamId, a.playerId);
    expect(s.team.startedAt).toBeNull();
    expect(s.completedCount).toBe(0);
    expect(s.adjustments).toEqual([]);
  });

  it("poster uten posisjon må låses opp av admin", async () => {
    await db.query("update posts set lat = null, lng = null where position = 1");
    const { teamId } = await createTeam(db, "A", "a");
    await startTeams(db);
    expect(await checkIn(db, teamId, at)).toEqual({ ok: false, reason: "no_location" });
  });
});

describe("startinnhold", () => {
  it("seed fra PDF-en har 11 aktive poster med finale til slutt", async () => {
    const fresh = await createMemoryDb();
    const posts = await fresh.query<{ title: string; is_finale: boolean }>(
      "select title, is_finale from posts where active order by position",
    );
    expect(posts).toHaveLength(11);
    expect(posts.at(-1)).toMatchObject({ is_finale: true });
  });
});
