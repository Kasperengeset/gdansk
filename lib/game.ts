import { randomInt } from "node:crypto";
import { encrypt, isCipherType } from "./cipher";
import { COSTUME_THEMES, type ProofType } from "./constants";
import type { Db } from "./db";
import { isAtPost, MAX_ACCEPTED_ACCURACY_M, type Position } from "./geo";
import { computeScore, type Score } from "./scoring";

export { COSTUME_THEMES, PROOF_TYPES } from "./constants";

export const CHECKIN_COOLDOWN_SEC = 20;
export const MAX_PHOTOS_PER_POST = 8;

export class GameError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export type PostRow = {
  id: string;
  position: number;
  title: string;
  clue_text: string;
  cipher_type: string;
  cipher_key: string;
  key_hint: string;
  task_text: string;
  lat: number | null;
  lng: number | null;
  radius_m: number;
  proof_type: ProofType;
  emergency_text: string;
  emergency_penalty_min: number;
  active: boolean;
  is_finale: boolean;
  admin_note: string;
};

export type TeamRow = {
  id: string;
  name: string;
  join_code: string;
  costume_theme: string;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  gps_tested_at: Date | null;
  last_checkin_attempt_at: Date | null;
};

export type ProgressRow = {
  team_id: string;
  post_id: string;
  status: "clue" | "arrived" | "done";
  clue_at: Date;
  arrived_at: Date | null;
  done_at: Date | null;
  emergency_opened_at: Date | null;
  manual_unlock: boolean;
  answer_text: string;
};

// ---------- Lag og spillere ----------

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeJoinCode(): string {
  return Array.from({ length: 5 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");
}

function cleanName(name: string, what: string): string {
  const n = name.trim().replace(/\s+/g, " ");
  if (n.length < 1) throw new GameError(`${what} mangler.`);
  if (n.length > 40) throw new GameError(`${what} er for langt (maks 40 tegn).`);
  return n;
}

export async function createTeam(db: Db, teamName: string, playerName: string) {
  const name = cleanName(teamName, "Lagnavn");
  const player = cleanName(playerName, "Navn");
  return db.tx(async (tx) => {
    // Fordel kostymetemaene jevnt: velg et av de minst brukte.
    const used = await tx.query<{ costume_theme: string; n: number }>(
      "select costume_theme, count(*)::int as n from teams group by costume_theme",
    );
    const counts = COSTUME_THEMES.map((t) => used.find((u) => u.costume_theme === t)?.n ?? 0);
    const min = Math.min(...counts);
    const candidates = COSTUME_THEMES.filter((_, i) => counts[i] === min);
    const theme = candidates[randomInt(candidates.length)];

    for (let attempt = 0; attempt < 10; attempt++) {
      const code = makeJoinCode();
      const taken = await tx.query("select 1 from teams where join_code = $1", [code]);
      if (taken.length) continue;
      const [team] = await tx.query<{ id: string }>(
        "insert into teams (name, join_code, costume_theme) values ($1, $2, $3) returning id",
        [name, code, theme],
      );
      const [p] = await tx.query<{ id: string }>("insert into players (team_id, name) values ($1, $2) returning id", [
        team.id,
        player,
      ]);
      return { teamId: team.id, playerId: p.id };
    }
    throw new GameError("Klarte ikke å lage lagkode, prøv igjen.", 500);
  });
}

/** Blir med i et lag. Finnes navnet allerede på laget, logges man inn som den spilleren igjen. */
export async function joinTeam(db: Db, joinCode: string, playerName: string) {
  const code = joinCode.trim().toUpperCase();
  const player = cleanName(playerName, "Navn");
  const [team] = await db.query<{ id: string }>("select id from teams where join_code = $1", [code]);
  if (!team) throw new GameError("Fant ikke noe lag med den koden.", 404);
  const [existing] = await db.query<{ id: string }>(
    "select id from players where team_id = $1 and lower(name) = lower($2)",
    [team.id, player],
  );
  if (existing) return { teamId: team.id, playerId: existing.id };
  const [p] = await db.query<{ id: string }>("insert into players (team_id, name) values ($1, $2) returning id", [
    team.id,
    player,
  ]);
  return { teamId: team.id, playerId: p.id };
}

// ---------- Hjelpere ----------

async function getTeam(db: Db, teamId: string): Promise<TeamRow> {
  const [team] = await db.query<TeamRow>("select * from teams where id = $1", [teamId]);
  if (!team) throw new GameError("Laget finnes ikke lenger.", 404);
  return team;
}

export async function getActivePosts(db: Db): Promise<PostRow[]> {
  return db.query<PostRow>("select * from posts where active order by position, id");
}

async function getProgress(db: Db, teamId: string): Promise<Map<string, ProgressRow>> {
  const rows = await db.query<ProgressRow>("select * from progress where team_id = $1", [teamId]);
  return new Map(rows.map((r) => [r.post_id, r]));
}

type Current = { post: PostRow; index: number; progress: ProgressRow };

/** Nåværende post = første aktive post laget ikke har fullført. Oppretter progress-raden ved behov. */
async function getCurrent(db: Db, team: TeamRow, posts?: PostRow[]): Promise<Current | null> {
  if (!team.started_at || team.finished_at) return null;
  posts ??= await getActivePosts(db);
  const progress = await getProgress(db, team.id);
  const index = posts.findIndex((p) => progress.get(p.id)?.status !== "done");
  if (index === -1) return null;
  const post = posts[index];
  let row = progress.get(post.id);
  if (!row) {
    await db.query("insert into progress (team_id, post_id) values ($1, $2) on conflict do nothing", [team.id, post.id]);
    [row] = await db.query<ProgressRow>("select * from progress where team_id = $1 and post_id = $2", [
      team.id,
      post.id,
    ]);
  }
  return { post, index, progress: row };
}

async function requireCurrent(db: Db, teamId: string, status?: ProgressRow["status"]): Promise<Current> {
  const team = await getTeam(db, teamId);
  if (!team.started_at) throw new GameError("Løpet har ikke startet ennå.");
  if (team.finished_at) throw new GameError("Dere er allerede i mål!");
  const current = await getCurrent(db, team);
  if (!current) throw new GameError("Ingen aktiv post.");
  if (status && current.progress.status !== status) {
    throw new GameError(status === "arrived" ? "Dere må sjekke inn på posten først." : "Dere har allerede sjekket inn.");
  }
  return current;
}

async function markDone(db: Db, teamId: string, postId: string, answerText?: string) {
  await db.query(
    `update progress set status = 'done', done_at = now(), arrived_at = coalesce(arrived_at, now()),
       answer_text = coalesce($3, answer_text)
     where team_id = $1 and post_id = $2`,
    [teamId, postId, answerText ?? null],
  );
  // I mål når det ikke finnes flere aktive poster igjen.
  const team = await getTeam(db, teamId);
  if (!(await getCurrent(db, team))) {
    await db.query("update teams set finished_at = now() where id = $1 and finished_at is null", [teamId]);
  }
}

/** Låser opp oppgaven. Finalen fullføres med en gang – klokka stopper ved ankomst. */
async function markArrived(db: Db, teamId: string, current: Current, manual: boolean) {
  await db.query(
    `update progress set status = 'arrived', arrived_at = now(), manual_unlock = $3
     where team_id = $1 and post_id = $2 and status = 'clue'`,
    [teamId, current.post.id, manual],
  );
  if (current.post.is_finale) await markDone(db, teamId, current.post.id);
}

// ---------- Spillerhandlinger ----------

export type CheckInResult =
  | { ok: true }
  | { ok: false; reason: "not_here" | "accuracy" | "no_location" }
  | { ok: false; reason: "rate"; retryInSec: number };

export async function recordPosition(db: Db, teamId: string, pos: Position, gpsTest = false) {
  await db.query("insert into positions (team_id, lat, lng, accuracy) values ($1, $2, $3, $4)", [
    teamId,
    pos.lat,
    pos.lng,
    pos.accuracy,
  ]);
  if (gpsTest) await db.query("update teams set gps_tested_at = now() where id = $1", [teamId]);
}

export async function checkIn(db: Db, teamId: string, pos: Position): Promise<CheckInResult> {
  return db.tx(async (tx) => {
    const current = await requireCurrent(tx, teamId);
    if (current.progress.status !== "clue") return { ok: true };
    await recordPosition(tx, teamId, pos);

    const { lat, lng, radius_m } = current.post;
    if (lat === null || lng === null) return { ok: false, reason: "no_location" };
    if (pos.accuracy > MAX_ACCEPTED_ACCURACY_M) return { ok: false, reason: "accuracy" };

    // Maks ett forsøk hvert CHECKIN_COOLDOWN_SEC sekund, så appen ikke kan brukes som «varmere/kaldere».
    const allowed = await tx.query(
      `update teams set last_checkin_attempt_at = now()
       where id = $1 and (last_checkin_attempt_at is null or last_checkin_attempt_at <= now() - make_interval(secs => $2))
       returning id`,
      [teamId, CHECKIN_COOLDOWN_SEC],
    );
    if (!allowed.length) {
      const [{ wait }] = await tx.query<{ wait: number }>(
        `select ceil(extract(epoch from (last_checkin_attempt_at + make_interval(secs => $2) - now())))::int as wait
         from teams where id = $1`,
        [teamId, CHECKIN_COOLDOWN_SEC],
      );
      return { ok: false, reason: "rate", retryInSec: Math.max(1, wait) };
    }

    if (!isAtPost(pos, { lat, lng, radius_m })) return { ok: false, reason: "not_here" };
    await markArrived(tx, teamId, current, false);
    return { ok: true };
  });
}

export async function openEmergency(db: Db, teamId: string) {
  return db.tx(async (tx) => {
    const current = await requireCurrent(tx, teamId);
    if (current.progress.emergency_opened_at) return;
    const { post, index } = current;
    await tx.query("update progress set emergency_opened_at = now() where team_id = $1 and post_id = $2", [
      teamId,
      post.id,
    ]);
    if (post.emergency_penalty_min !== 0) {
      await tx.query("insert into adjustments (team_id, minutes, reason) values ($1, $2, $3)", [
        teamId,
        post.emergency_penalty_min,
        `Nødkonvolutt ${post.is_finale ? "finalen" : `post ${index + 1}`}`,
      ]);
    }
  });
}

export async function addPhoto(db: Db, teamId: string, mime: string, data: Uint8Array) {
  return db.tx(async (tx) => {
    const { post } = await requireCurrent(tx, teamId, "arrived");
    const [{ n }] = await tx.query<{ n: number }>(
      "select count(*)::int as n from photos where team_id = $1 and post_id = $2",
      [teamId, post.id],
    );
    if (n >= MAX_PHOTOS_PER_POST) throw new GameError(`Maks ${MAX_PHOTOS_PER_POST} bilder per post.`);
    const [photo] = await tx.query<{ id: string }>(
      "insert into photos (team_id, post_id, mime, data) values ($1, $2, $3, $4) returning id",
      [teamId, post.id, mime, data],
    );
    return photo.id;
  });
}

/** Sletter et bilde fra nåværende post, før beviset er sendt inn. */
export async function deletePhoto(db: Db, teamId: string, photoId: string) {
  const { post } = await requireCurrent(db, teamId, "arrived");
  await db.query("delete from photos where id = $1 and team_id = $2 and post_id = $3", [photoId, teamId, post.id]);
}

export async function submitProof(db: Db, teamId: string, answerText: string) {
  return db.tx(async (tx) => {
    const { post } = await requireCurrent(tx, teamId, "arrived");
    const text = answerText.trim().slice(0, 2000);
    const [{ n }] = await tx.query<{ n: number }>(
      "select count(*)::int as n from photos where team_id = $1 and post_id = $2",
      [teamId, post.id],
    );
    const needsPhoto = post.proof_type === "photo" || post.proof_type === "photo_text";
    const needsText = post.proof_type === "text" || post.proof_type === "photo_text";
    if (needsPhoto && n === 0) throw new GameError("Last opp minst ett bilde først.");
    if (needsText && !text) throw new GameError("Skriv inn svaret først.");
    await markDone(tx, teamId, post.id, text);
  });
}

// ---------- Tilstand til deltakerne ----------

export type TeamState = {
  serverNow: string;
  me: { id: string; name: string };
  team: {
    name: string;
    joinCode: string;
    costumeTheme: string;
    startedAt: string | null;
    finishedAt: string | null;
    gpsTested: boolean;
  };
  players: string[];
  organizer: { name: string; phone: string };
  totalPosts: number;
  completedCount: number;
  current: null | {
    number: number;
    isFinale: boolean;
    status: "clue" | "arrived";
    clue: string;
    keyHint: string;
    emergency: { opened: boolean; text: string | null; penaltyMin: number };
    task: null | { text: string; proofType: ProofType; photoIds: string[] };
  };
  finaleTask: string | null;
  adjustments: { minutes: number; reason: string }[];
  score: Score;
};

export async function getSettings(db: Db): Promise<Record<string, string>> {
  const rows = await db.query<{ key: string; value: string }>("select key, value from settings");
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** Alt laget får se. Oppgavetekst, nødtekst og koordinater sendes bare når de er låst opp. */
export async function getTeamState(db: Db, teamId: string, playerId: string): Promise<TeamState> {
  const team = await getTeam(db, teamId);
  const [players, posts, adjustments, settings] = await Promise.all([
    db.query<{ id: string; name: string }>("select id, name from players where team_id = $1 order by created_at", [
      teamId,
    ]),
    getActivePosts(db),
    db.query<{ minutes: number; reason: string }>(
      "select minutes, reason from adjustments where team_id = $1 order by created_at",
      [teamId],
    ),
    getSettings(db),
  ]);
  const me = players.find((p) => p.id === playerId);
  if (!me) throw new GameError("Du er ikke lenger med på laget.", 401);

  const current = await getCurrent(db, team, posts);
  const progress = await getProgress(db, teamId);
  const completedCount = posts.filter((p) => progress.get(p.id)?.status === "done").length;

  let currentState: TeamState["current"] = null;
  if (current) {
    const { post, index, progress: prog } = current;
    const arrived = prog.status === "arrived";
    const photoIds = arrived
      ? (
          await db.query<{ id: string }>(
            "select id from photos where team_id = $1 and post_id = $2 order by created_at",
            [teamId, post.id],
          )
        ).map((r) => r.id)
      : [];
    currentState = {
      number: index + 1,
      isFinale: post.is_finale,
      status: arrived ? "arrived" : "clue",
      clue: isCipherType(post.cipher_type) ? encrypt(post.clue_text, post.cipher_type, post.cipher_key) : post.clue_text,
      keyHint: post.key_hint,
      emergency: {
        opened: !!prog.emergency_opened_at,
        text: prog.emergency_opened_at ? post.emergency_text : null,
        penaltyMin: post.emergency_penalty_min,
      },
      task: arrived ? { text: post.task_text, proofType: post.proof_type, photoIds } : null,
    };
  }

  const finale = team.finished_at ? posts.find((p) => p.is_finale) : undefined;

  return {
    serverNow: new Date().toISOString(),
    me,
    team: {
      name: team.name,
      joinCode: team.join_code,
      costumeTheme: team.costume_theme,
      startedAt: team.started_at?.toISOString() ?? null,
      finishedAt: team.finished_at?.toISOString() ?? null,
      gpsTested: !!team.gps_tested_at,
    },
    players: players.map((p) => p.name),
    organizer: { name: settings.organizer_name ?? "", phone: settings.organizer_phone ?? "" },
    totalPosts: posts.length,
    completedCount,
    current: currentState,
    finaleTask: finale?.task_text ?? null,
    adjustments,
    score: computeScore({
      startedAt: team.started_at,
      finishedAt: team.finished_at,
      adjustmentMinutes: adjustments.map((a) => a.minutes),
    }),
  };
}

// ---------- Admin ----------

export async function startTeams(db: Db, teamId?: string) {
  if (teamId) {
    await db.query("update teams set started_at = now() where id = $1 and started_at is null", [teamId]);
  } else {
    await db.query("update teams set started_at = now() where started_at is null");
  }
}

export async function adminUnlock(db: Db, teamId: string) {
  await db.tx(async (tx) => {
    const current = await requireCurrent(tx, teamId, "clue");
    await markArrived(tx, teamId, current, true);
  });
}

export async function adminComplete(db: Db, teamId: string) {
  await db.tx(async (tx) => {
    const current = await requireCurrent(tx, teamId);
    await tx.query(
      "update progress set manual_unlock = manual_unlock or status = 'clue' where team_id = $1 and post_id = $2",
      [teamId, current.post.id],
    );
    await markDone(tx, teamId, current.post.id);
  });
}

/** Nullstiller laget til før start (for testløp). Spillerne beholdes. */
export async function resetTeam(db: Db, teamId: string) {
  await db.tx(async (tx) => {
    for (const table of ["progress", "photos", "adjustments", "positions"]) {
      await tx.query(`delete from ${table} where team_id = $1`, [teamId]);
    }
    await tx.query(
      `update teams set started_at = null, finished_at = null, gps_tested_at = null, last_checkin_attempt_at = null
       where id = $1`,
      [teamId],
    );
  });
}

export async function addAdjustment(db: Db, teamId: string, minutes: number, reason: string) {
  if (!Number.isInteger(minutes) || minutes === 0) throw new GameError("Minutter må være et heltall ulikt 0.");
  const r = reason.trim();
  if (!r) throw new GameError("Skriv en begrunnelse.");
  await db.query("insert into adjustments (team_id, minutes, reason) values ($1, $2, $3)", [teamId, minutes, r]);
}

export type TeamOverview = {
  team: TeamRow;
  players: string[];
  completedCount: number;
  current: null | { number: number; title: string; status: ProgressRow["status"]; emergencyOpened: boolean };
  score: Score;
  lastPosition: null | { lat: number; lng: number; accuracy: number; created_at: Date };
};

export async function getOverview(db: Db): Promise<{ totalPosts: number; teams: TeamOverview[] }> {
  const [teams, players, posts, progress, adjustments, positions] = await Promise.all([
    db.query<TeamRow>("select * from teams order by created_at"),
    db.query<{ team_id: string; name: string }>("select team_id, name from players order by created_at"),
    getActivePosts(db),
    db.query<ProgressRow>("select * from progress"),
    db.query<{ team_id: string; minutes: number }>("select team_id, minutes from adjustments"),
    db.query<{ team_id: string; lat: number; lng: number; accuracy: number; created_at: Date }>(
      "select distinct on (team_id) team_id, lat, lng, accuracy, created_at from positions order by team_id, created_at desc",
    ),
  ]);

  const now = new Date();
  const overview = teams.map((team): TeamOverview => {
    const prog = new Map(progress.filter((p) => p.team_id === team.id).map((p) => [p.post_id, p]));
    const index = posts.findIndex((p) => prog.get(p.id)?.status !== "done");
    const post = posts[index];
    const cur = post ? prog.get(post.id) : undefined;
    return {
      team,
      players: players.filter((p) => p.team_id === team.id).map((p) => p.name),
      completedCount: posts.filter((p) => prog.get(p.id)?.status === "done").length,
      current:
        team.started_at && !team.finished_at && post
          ? {
              number: index + 1,
              title: post.title,
              status: cur?.status ?? "clue",
              emergencyOpened: !!cur?.emergency_opened_at,
            }
          : null,
      score: computeScore(
        {
          startedAt: team.started_at,
          finishedAt: team.finished_at,
          adjustmentMinutes: adjustments.filter((a) => a.team_id === team.id).map((a) => a.minutes),
        },
        now,
      ),
      lastPosition: positions.find((p) => p.team_id === team.id) ?? null,
    };
  });
  return { totalPosts: posts.length, teams: overview };
}

/** Resultatliste: lag i mål sortert på sluttid, deretter lag underveis etter antall poster. */
export function rankTeams(teams: TeamOverview[]): TeamOverview[] {
  return [...teams].sort((a, b) => {
    const af = a.team.finished_at ? 0 : 1;
    const bf = b.team.finished_at ? 0 : 1;
    if (af !== bf) return af - bf;
    if (!a.team.finished_at && a.completedCount !== b.completedCount) return b.completedCount - a.completedCount;
    return a.score.totalSec - b.score.totalSec;
  });
}
