import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { ago, clock, osmLink } from "@/lib/format";
import { COSTUME_THEMES, getActivePosts, type ProgressRow, type TeamRow } from "@/lib/game";
import { computeScore, formatDuration, formatMinutes } from "@/lib/scoring";
import {
  addAdjustmentAction,
  addPresetAdjustmentAction,
  completeAction,
  deleteAdjustmentAction,
  deleteTeamAction,
  resetTeamAction,
  setThemeAction,
  startTeamAction,
  unlockAction,
} from "../../../actions";
import { ActionButton, ActionForm, AutoRefresh } from "../../controls";

// Straff og bonus fra PDF-en (Del C), som hurtigknapper.
const PRESETS: [number, string][] = [
  [10, "Bilde uten hele laget"],
  [5, "Rester i kebabpapiret"],
  [30, "Mobil ute av flymodus / brukt kart"],
  [-2, "Bestilling på polsk"],
  [-15, "Sykkeletappen: 1. plass"],
  [-10, "Sykkeletappen: 2. plass"],
  [-5, "Sykkeletappen: 3. plass"],
  [-15, "Beste kostyme"],
  [-10, "Polsk drikkesang i finalen"],
  [-10, "Beste propagandaplakat"],
];

const STATUS: Record<ProgressRow["status"], string> = { clue: "Leter", arrived: "På posten", done: "Fullført" };

export default async function TeamPage({ params }: PageProps<"/admin/lag/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [team] = await db.query<TeamRow>("select * from teams where id = $1", [id]);
  if (!team) notFound();

  const [players, posts, progressRows, photos, adjustments, positions] = await Promise.all([
    db.query<{ name: string }>("select name from players where team_id = $1 order by created_at", [id]),
    getActivePosts(db),
    db.query<ProgressRow>("select * from progress where team_id = $1", [id]),
    db.query<{ id: string; post_id: string }>("select id, post_id from photos where team_id = $1 order by created_at", [id]),
    db.query<{ id: string; minutes: number; reason: string; created_at: Date }>(
      "select id, minutes, reason, created_at from adjustments where team_id = $1 order by created_at",
      [id],
    ),
    db.query<{ lat: number; lng: number; accuracy: number; created_at: Date }>(
      "select lat, lng, accuracy, created_at from positions where team_id = $1 order by created_at desc limit 5",
      [id],
    ),
  ]);
  const progress = new Map(progressRows.map((p) => [p.post_id, p]));
  const score = computeScore({
    startedAt: team.started_at,
    finishedAt: team.finished_at,
    adjustmentMinutes: adjustments.map((a) => a.minutes),
  });
  const currentIndex = posts.findIndex((p) => progress.get(p.id)?.status !== "done");
  const current = team.started_at && !team.finished_at && currentIndex >= 0 ? posts[currentIndex] : null;
  const currentStatus = current ? (progress.get(current.id)?.status ?? "clue") : null;

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={15} />
      <Link href="/admin" className="text-sm text-muted">
        ← Oversikt
      </Link>

      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">{team.name}</h1>
          <p className="text-muted">
            Kode <b className="font-mono">{team.join_code}</b> · {players.map((p) => p.name).join(", ")}
          </p>
          <p className="text-sm text-muted">
            Start {clock(team.started_at)} · mål {clock(team.finished_at)}
          </p>
        </div>
        <div className="text-right font-mono tabular-nums">
          <p className="text-2xl font-bold">{formatDuration(score.elapsedSec)}</p>
          <p className="text-sm text-muted">
            {formatMinutes(score.adjustmentMin)} → {formatDuration(score.totalSec)}
          </p>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold">Styring</h2>
        <div className="flex flex-wrap gap-2">
          {!team.started_at && (
            <ActionButton action={startTeamAction.bind(null, id)} className="btn btn-primary" confirm={`Starte ${team.name} nå?`}>
              Start laget
            </ActionButton>
          )}
          {current && currentStatus === "clue" && (
            <ActionButton
              action={unlockAction.bind(null, id)}
              className="btn btn-primary"
              confirm={`Låse opp post ${currentIndex + 1} (${current.title}) uten GPS?`}
            >
              Lås opp post {currentIndex + 1}
            </ActionButton>
          )}
          {current && (
            <ActionButton
              action={completeAction.bind(null, id)}
              confirm={`Markere post ${currentIndex + 1} (${current.title}) som fullført, uten bevis?`}
            >
              Marker post {currentIndex + 1} fullført
            </ActionButton>
          )}
          <ActionButton
            action={resetTeamAction.bind(null, id)}
            confirm="Nullstille laget? All fremgang, bilder og straff slettes. Spillerne beholdes."
          >
            Nullstill
          </ActionButton>
          <ActionButton
            action={deleteTeamAction.bind(null, id)}
            className="btn text-brand"
            confirm={`Slette laget ${team.name} for godt?`}
          >
            Slett lag
          </ActionButton>
        </div>
        <ActionForm action={setThemeAction.bind(null, id)} className="flex items-end gap-2">
          <div className="flex-1">
            <label className="label" htmlFor="theme">
              Kostymetema
            </label>
            <select className="input" id="theme" name="theme" defaultValue={team.costume_theme}>
              {COSTUME_THEMES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <button className="btn">Lagre</button>
        </ActionForm>
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold">Straff og bonus</h2>
        {adjustments.length > 0 ? (
          <ul className="divide-y divide-line">
            {adjustments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span>
                  {a.reason} <span className="text-muted">· {clock(a.created_at)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={`font-mono ${a.minutes > 0 ? "text-brand" : "text-ok"}`}>{formatMinutes(a.minutes)}</span>
                  <ActionButton
                    action={deleteAdjustmentAction.bind(null, a.id)}
                    className="btn btn-small"
                    confirm={`Fjerne «${a.reason}»?`}
                  >
                    ✕
                  </ActionButton>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Ingen ennå.</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(([min, reason]) => (
            <ActionButton
              key={reason}
              action={addPresetAdjustmentAction.bind(null, id, min, reason)}
              className={`btn btn-small ${min > 0 ? "text-brand" : "text-ok"}`}
              confirm={`${reason}: ${formatMinutes(min)} til ${team.name}?`}
            >
              {reason} {formatMinutes(min)}
            </ActionButton>
          ))}
        </div>
        <ActionForm action={addAdjustmentAction.bind(null, id)} resetOnSuccess className="flex flex-wrap items-end gap-2">
          <div className="w-24">
            <label className="label" htmlFor="minutes">
              Minutter
            </label>
            <input className="input" id="minutes" name="minutes" type="number" step="1" required placeholder="+5 / −5" />
          </div>
          <div className="min-w-40 flex-1">
            <label className="label" htmlFor="reason">
              Begrunnelse
            </label>
            <input className="input" id="reason" name="reason" required />
          </div>
          <button className="btn">Legg til</button>
        </ActionForm>
        <p className="text-xs text-muted">Positive minutter er straff, negative er bonus.</p>
      </section>

      <section className="card">
        <h2 className="mb-2 font-bold">Siste posisjoner</h2>
        {positions.length ? (
          <ul className="space-y-1 text-sm">
            {positions.map((p, i) => (
              <li key={i}>
                <a className="underline" href={osmLink(p.lat, p.lng)} target="_blank" rel="noreferrer">
                  {clock(p.created_at)} ({ago(p.created_at)})
                </a>{" "}
                <span className="text-muted">± {Math.round(p.accuracy)} m</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Ingen posisjon mottatt.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">Poster</h2>
        {posts.map((post, i) => {
          const p = progress.get(post.id);
          const postPhotos = photos.filter((ph) => ph.post_id === post.id);
          return (
            <div key={post.id} className={`card ${p ? "" : "opacity-50"}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">
                  {i + 1}. {post.title}
                </h3>
                <span className="text-sm text-muted">
                  {p ? STATUS[p.status] : "Ikke nådd"}
                  {p?.manual_unlock && " · låst opp manuelt"}
                  {p?.emergency_opened_at && <span className="text-brand"> · nødkonvolutt {clock(p.emergency_opened_at)}</span>}
                </span>
              </div>
              {p && (
                <p className="text-xs text-muted">
                  Ledetråd {clock(p.clue_at)} · fremme {clock(p.arrived_at)} · ferdig {clock(p.done_at)}
                </p>
              )}
              {p?.answer_text && <p className="paper mt-2 text-sm whitespace-pre-line">{p.answer_text}</p>}
              {postPhotos.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {postPhotos.map((ph) => (
                    <a key={ph.id} href={`/api/photos/${ph.id}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/photos/${ph.id}`} alt="" className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
