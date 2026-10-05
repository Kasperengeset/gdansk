import Link from "next/link";
import { getDb } from "@/lib/db";
import { getOverview, rankTeams } from "@/lib/game";
import { formatDuration, formatMinutes } from "@/lib/scoring";
import { AutoRefresh } from "../controls";

export default async function ResultsPage() {
  const { teams, totalPosts } = await getOverview(await getDb());
  const ranked = rankTeams(teams.filter((t) => t.team.started_at));

  return (
    <div className="space-y-5">
      <AutoRefresh seconds={20} />
      <div>
        <h1 className="text-3xl font-extrabold">Resultat</h1>
        <p className="text-sm text-muted">Sluttid = faktisk tid + straff − bonus. Lavest sluttid vinner.</p>
      </div>

      {ranked.length === 0 && <p className="card text-muted">Ingen lag har startet ennå.</p>}

      <ol className="space-y-3">
        {ranked.map(({ team, score, completedCount }, i) => (
          <li key={team.id} className={`card flex items-center gap-4 ${i === 0 && team.finished_at ? "border-brand" : ""}`}>
            <span className="w-10 text-center text-3xl font-extrabold text-brand">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <Link href={`/admin/lag/${team.id}`} className="block truncate text-xl font-bold">
                {team.name}
              </Link>
              <p className="text-sm text-muted">
                {team.costume_theme}
                {!team.finished_at && ` · underveis, ${completedCount}/${totalPosts} poster`}
              </p>
            </div>
            <div className="text-right font-mono tabular-nums">
              <p className="text-2xl font-bold">{formatDuration(score.totalSec)}</p>
              <p className="text-xs text-muted">
                faktisk {formatDuration(score.elapsedSec)}
                {score.adjustmentMin !== 0 && ` · ${formatMinutes(score.adjustmentMin)}`}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
