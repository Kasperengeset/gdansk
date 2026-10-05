import Link from "next/link";
import { getRequestDb } from "@/lib/request-db";
import { ago } from "@/lib/format";
import { getOverview, getSettings } from "@/lib/game";
import { formatDuration, formatMinutes } from "@/lib/scoring";
import { saveSettingsAction, startAllAction, startTeamAction } from "../actions";
import { ActionButton, ActionForm, AutoRefresh } from "./controls";

const STATUS = { clue: "leter", arrived: "på posten", done: "ferdig" } as const;

export default async function AdminOverview() {
  const db = await getRequestDb();
  const [{ teams, totalPosts }, settings, [{ missing }]] = await Promise.all([
    getOverview(db),
    getSettings(db),
    db.query<{ missing: number }>("select count(*)::int as missing from posts where active and lat is null"),
  ]);
  const notStarted = teams.filter((t) => !t.team.started_at).length;
  const now = new Date();

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={10} />

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Oversikt</h1>
          <p className="text-sm text-muted">
            {teams.length} lag · {totalPosts} aktive poster · oppdateres hvert 10. sekund
          </p>
        </div>
        {notStarted > 0 && (
          <ActionButton
            action={startAllAction}
            className="btn btn-primary"
            confirm={`Starte løpet for ${notStarted} lag nå? Klokka begynner å gå.`}
          >
            Start alle ({notStarted})
          </ActionButton>
        )}
      </section>

      {missing > 0 && (
        <p className="error">
          {missing} aktive poster mangler posisjon. <Link href="/admin/poster" className="underline">Plasser dem på kartet</Link>.
        </p>
      )}

      {teams.length === 0 && <p className="card text-muted">Ingen lag ennå. Deltakerne oppretter lag på forsiden.</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {teams.map(({ team, players, current, completedCount, score, lastPosition }) => (
          <div key={team.id} className="card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/admin/lag/${team.id}`} className="block truncate text-lg font-bold underline-offset-2 hover:underline">
                  {team.name}
                </Link>
                <p className="text-xs text-muted">
                  {team.join_code} · {team.costume_theme} · {players.length} {players.length === 1 ? "spiller" : "spillere"}
                </p>
              </div>
              {team.started_at && (
                <div className="text-right font-mono text-sm tabular-nums">
                  <p className="font-bold">{formatDuration(score.elapsedSec)}</p>
                  {score.adjustmentMin !== 0 && <p className="text-muted">{formatMinutes(score.adjustmentMin)}</p>}
                </div>
              )}
            </div>

            {!team.started_at ? (
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm ${team.gps_tested_at ? "text-ok" : "text-brand"}`}>
                  {team.gps_tested_at ? "GPS testet" : "GPS ikke testet"}
                </span>
                <ActionButton
                  action={startTeamAction.bind(null, team.id)}
                  className="btn btn-small"
                  confirm={`Starte ${team.name} nå?`}
                >
                  Start
                </ActionButton>
              </div>
            ) : team.finished_at ? (
              <p className="font-semibold text-ok">I mål · sluttid {formatDuration(score.totalSec)}</p>
            ) : current ? (
              <p className="text-sm">
                <b>
                  {current.number}/{totalPosts} {current.title}
                </b>{" "}
                – {STATUS[current.status]}
                {current.emergencyOpened && <span className="text-brand"> · nødkonvolutt åpnet</span>}
              </p>
            ) : null}

            <p className="text-xs text-muted">
              {completedCount}/{totalPosts} fullført · posisjon {ago(lastPosition?.created_at, now)}
              {lastPosition && ` (± ${Math.round(lastPosition.accuracy)} m)`}
            </p>
          </div>
        ))}
      </div>

      <section className="card">
        <h2 className="mb-3 font-bold">Kontaktinfo til lagene</h2>
        <ActionForm action={saveSettingsAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="organizer_name">
              Navn
            </label>
            <input className="input" id="organizer_name" name="organizer_name" defaultValue={settings.organizer_name} />
          </div>
          <div>
            <label className="label" htmlFor="organizer_phone">
              Telefon
            </label>
            <input
              className="input"
              id="organizer_phone"
              name="organizer_phone"
              type="tel"
              placeholder="+47 …"
              defaultValue={settings.organizer_phone}
            />
          </div>
          <button className="btn">Lagre</button>
        </ActionForm>
        <p className="mt-2 text-xs text-muted">Vises som «Ring arrangøren»-knapp i appen, f.eks. når GPS ikke virker innendørs.</p>
      </section>
    </div>
  );
}
