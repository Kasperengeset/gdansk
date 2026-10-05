"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { compressImage, GeoError, getBestPosition, postJson } from "@/lib/browser";
import type { CheckInResult, TeamState } from "@/lib/game";
import { formatDuration, formatMinutes } from "@/lib/scoring";

type Current = NonNullable<TeamState["current"]>;

const TRACKING_INTERVAL_MS = 90_000;

export function Game({ initialState }: { initialState: TeamState }) {
  const [state, setState] = useState(initialState);
  const [banner, setBanner] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const lastCompleted = useRef(initialState.completedCount);

  const phase = !state.team.startedAt ? "lobby" : state.team.finishedAt ? "finished" : "running";

  const refresh = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" }).catch(() => null);
    if (!res) return;
    if (res.status === 401 || res.status === 404) {
      // /logg-ut er en route handler som sletter cookien, så vi trenger full navigasjon.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/logg-ut";
      return;
    }
    if (res.ok) setState(await res.json());
  }, []);

  // Hold tilstanden oppdatert: ofte i lobbyen (venter på start), sjeldnere underveis.
  useEffect(() => {
    const ms = phase === "lobby" ? 5_000 : phase === "running" ? 15_000 : 60_000;
    const id = setInterval(refresh, ms);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [phase, refresh]);

  // Vis en kort beskjed når en post er fullført.
  useEffect(() => {
    if (state.completedCount > lastCompleted.current && !state.team.finishedAt) {
      setBanner(`Post ${state.completedCount} fullført! Her er neste ledetråd.`);
      const id = setTimeout(() => setBanner(null), 6_000);
      lastCompleted.current = state.completedCount;
      return () => clearTimeout(id);
    }
    lastCompleted.current = state.completedCount;
  }, [state.completedCount, state.team.finishedAt]);

  // Siste kjente posisjon til arrangøren, når laget først har gitt tilgang til GPS.
  useEffect(() => {
    if (!tracking || phase !== "running") return;
    const id = setInterval(async () => {
      try {
        await postJson("/api/position", await getBestPosition({ maxWaitMs: 8_000, goodEnoughM: 50 }));
      } catch {
        // Ikke kritisk – prøver igjen neste runde.
      }
    }, TRACKING_INTERVAL_MS);
    return () => clearInterval(id);
  }, [tracking, phase]);

  const onPosition = useCallback(() => setTracking(true), []);

  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 py-5">
      <Header state={state} phase={phase} />
      {banner && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-ok">{banner}</p>}
      {phase === "lobby" && <Lobby state={state} onChanged={refresh} onPosition={onPosition} />}
      {phase === "running" && state.current && (
        state.current.status === "clue" ? (
          <ClueView key={state.current.number} state={state} current={state.current} onChanged={refresh} onPosition={onPosition} />
        ) : (
          <TaskView key={state.current.number} state={state} current={state.current} onChanged={refresh} />
        )
      )}
      {phase === "running" && !state.current && (
        <p className="card">Ingen poster er klare ennå. Kontakt arrangøren.</p>
      )}
      {phase === "finished" && <Finished state={state} />}
      <Footer state={state} />
    </main>
  );
}

// ---------- Topp ----------

function useServerNow(serverNow: string) {
  const offset = useRef(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    offset.current = new Date(serverNow).getTime() - Date.now();
  }, [serverNow]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset.current), 1_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Header({ state, phase }: { state: TeamState; phase: string }) {
  const now = useServerNow(state.serverNow);
  const { startedAt, finishedAt } = state.team;
  const elapsedSec = startedAt
    ? Math.max(0, ((finishedAt ? new Date(finishedAt).getTime() : now) - new Date(startedAt).getTime()) / 1000)
    : 0;

  return (
    <header>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Gdańsk uten kart</p>
          <h1 className="truncate text-2xl font-extrabold">{state.team.name}</h1>
          <p className="text-sm text-muted">Kostyme: {state.team.costumeTheme}</p>
        </div>
        {phase !== "lobby" && (
          <div className="text-right">
            <p className="font-mono text-2xl font-bold tabular-nums">{formatDuration(elapsedSec)}</p>
            {state.score.adjustmentMin !== 0 && (
              <p className="text-sm text-muted">{formatMinutes(state.score.adjustmentMin)}</p>
            )}
          </div>
        )}
      </div>
      {phase === "running" && (
        <div className="mt-3 flex gap-1" aria-label={`${state.completedCount} av ${state.totalPosts} poster fullført`}>
          {Array.from({ length: state.totalPosts }, (_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i < state.completedCount ? "bg-brand" : "bg-line"}`} />
          ))}
        </div>
      )}
    </header>
  );
}

// ---------- Lobby ----------

function Lobby({ state, onChanged, onPosition }: { state: TeamState; onChanged: () => void; onPosition: () => void }) {
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function testGps() {
    setTesting(true);
    setGpsMsg(null);
    try {
      const pos = await getBestPosition();
      await postJson("/api/position", { ...pos, test: true });
      onPosition();
      setGpsMsg(`GPS virker! Nøyaktighet ± ${Math.round(pos.accuracy)} m.`);
      onChanged();
    } catch (err) {
      setGpsMsg(err instanceof Error ? err.message : "GPS-testen feilet.");
    } finally {
      setTesting(false);
    }
  }

  async function share() {
    const url = `${window.location.origin}/?kode=${state.team.joinCode}`;
    const text = `Bli med på laget «${state.team.name}» i rebusløpet: ${url}`;
    if (navigator.share) {
      await navigator.share({ text }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    }
  }

  return (
    <>
      <section className="card">
        <p className="label">Lagkode</p>
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-4xl font-bold tracking-[0.25em]">{state.team.joinCode}</p>
          <button className="btn btn-small" onClick={share}>
            {copied ? "Kopiert!" : "Del"}
          </button>
        </div>
        <p className="mt-3 label">På laget ({state.players.length})</p>
        <ul className="flex flex-wrap gap-2">
          {state.players.map((p) => (
            <li key={p} className="rounded-full bg-paper px-3 py-1 text-sm">
              {p}
              {p === state.me.name && " (deg)"}
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3">
        <p className="label">1. Test GPS på lagmobilen</p>
        <p className="text-sm text-muted">
          Gjør dette på mobilen dere skal bruke under løpet. Trykk «Tillat» når nettleseren spør om posisjon.
        </p>
        <button className="btn w-full" onClick={testGps} disabled={testing}>
          {testing ? "Henter posisjon …" : state.team.gpsTested ? "Test GPS på nytt" : "Test GPS"}
        </button>
        {gpsMsg && <p className="text-sm">{gpsMsg}</p>}
        {state.team.gpsTested && !gpsMsg && <p className="text-sm text-ok">GPS er testet og virker.</p>}
      </section>

      <section className="paper space-y-2 text-sm">
        <p className="label">2. Reglene</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Én lagmobil med mobildata – <b>bare denne appen</b> er lov. Kart, Google og andre apper er forbudt (+30 min
            eller diskvalifisering). Andre telefoner ligger avslått i sekken.
          </li>
          <li>Hver post starter med en kodet ledetråd. Knekk koden på papir, og spør lokale om veien.</li>
          <li>Når dere er fremme, trykker dere «Vi er her!». Appen sjekker posisjonen og viser oppgaven.</li>
          <li>Hele laget skal være med på alle bilder, i kostyme (+10 min hvis noen mangler).</li>
          <li>Nødkonvolutten avslører stedet, men koster +15 min.</li>
          <li>Laget med lavest sluttid vinner: faktisk tid + straff − bonus.</li>
          <li>Nødnummer: 112.</li>
        </ul>
      </section>

      <p className="py-4 text-center font-semibold text-muted">Venter på at arrangøren starter løpet …</p>
    </>
  );
}

// ---------- Ledetråd ----------

function checkInMessage(result: CheckInResult, accuracy: number): string {
  if (result.ok) return "";
  switch (result.reason) {
    case "not_here":
      return "Dette er ikke stedet. Spør dere fram!";
    case "rate":
      return `Vent ${result.retryInSec} sekunder før dere prøver igjen.`;
    case "accuracy":
      return `GPS-en er for unøyaktig (± ${Math.round(accuracy)} m). Gå ut i åpent område og prøv igjen.`;
    case "no_location":
      return "Denne posten mangler posisjon. Ring arrangøren for å få den låst opp.";
  }
}

function ClueView({
  state,
  current,
  onChanged,
  onPosition,
}: {
  state: TeamState;
  current: Current;
  onChanged: () => void;
  onPosition: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function checkIn() {
    setMessage(null);
    try {
      setBusy("Henter posisjon …");
      const pos = await getBestPosition();
      onPosition();
      setBusy("Sjekker …");
      const result = await postJson<CheckInResult>("/api/checkin", pos);
      if (result.ok) onChanged();
      else setMessage(checkInMessage(result, pos.accuracy));
    } catch (err) {
      setMessage(err instanceof GeoError || err instanceof Error ? err.message : "Noe gikk galt.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <section className="paper">
        <p className="eyebrow">{current.isFinale ? "Finale" : `Post ${current.number} av ${state.totalPosts}`} · ledetråd</p>
        <p className="mt-3 font-mono text-xl leading-relaxed break-words whitespace-pre-wrap select-all">{current.clue}</p>
        {current.keyHint && (
          <p className="mt-4 border-t border-line pt-3 text-sm">
            <b>Hint:</b> {current.keyHint}
          </p>
        )}
      </section>

      <button className="btn btn-primary btn-big" onClick={checkIn} disabled={!!busy}>
        {busy ?? "Vi er her!"}
      </button>
      {message && <p className="error text-base">{message}</p>}

      <Emergency current={current} onChanged={onChanged} />
    </>
  );
}

function Emergency({ current, onChanged }: { current: Current; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { opened, text, penaltyMin } = current.emergency;

  if (opened) {
    return (
      <section className="card border-brand">
        <p className="eyebrow">Nødkonvolutt (åpnet)</p>
        <p className="mt-2 text-lg font-semibold">{text || "Ingen tekst – ring arrangøren."}</p>
      </section>
    );
  }

  async function open() {
    if (!confirm(`Åpne nødkonvolutten? Dere får vite stedet, men får ${penaltyMin} minutter straff.`)) return;
    setBusy(true);
    try {
      await postJson("/api/emergency");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="card">
      <summary className="cursor-pointer font-semibold">Står dere fast?</summary>
      <p className="mt-2 text-sm text-muted">
        Nødkonvolutten forteller hvor posten er, men koster {formatMinutes(penaltyMin)}.
      </p>
      <button className="btn mt-3 w-full" onClick={open} disabled={busy}>
        Åpne nødkonvolutten ({formatMinutes(penaltyMin)})
      </button>
      {error && <p className="error mt-2">{error}</p>}
    </details>
  );
}

// ---------- Oppgave og bevis ----------

function TaskView({ state, current, onChanged }: { state: TeamState; current: Current; onChanged: () => void }) {
  const task = current.task!;
  const needsPhoto = task.proofType === "photo" || task.proofType === "photo_text";
  const needsText = task.proofType === "text" || task.proofType === "photo_text";
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    try {
      const list = Array.from(files);
      for (const [i, file] of list.entries()) {
        setBusy(list.length > 1 ? `Laster opp ${i + 1} av ${list.length} …` : "Laster opp …");
        const form = new FormData();
        form.append("photo", await compressImage(file), "bilde.jpg");
        const res = await fetch("/api/photos", { method: "POST", body: form });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Opplastingen feilet.");
        onChanged();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opplastingen feilet.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Slette bildet?")) return;
    await fetch(`/api/photos/${id}`, { method: "DELETE" });
    onChanged();
  }

  async function submit() {
    setError(null);
    if (task.proofType !== "none" && !confirm("Sende inn? Dere kan ikke endre beviset etterpå.")) return;
    setBusy("Sender …");
    try {
      await postJson("/api/submit", { answer });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt.");
    } finally {
      setBusy(null);
    }
  }

  const ready = (!needsPhoto || task.photoIds.length > 0) && (!needsText || answer.trim().length > 0);

  return (
    <>
      <section className="paper">
        <p className="eyebrow">{current.isFinale ? "Finale" : `Post ${current.number} av ${state.totalPosts}`} · oppgave</p>
        <p className="mt-3 text-lg leading-relaxed whitespace-pre-line">{task.text}</p>
      </section>

      {needsPhoto && (
        <section className="card space-y-3">
          <p className="label">Bildebevis</p>
          {task.photoIds.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {task.photoIds.map((id) => (
                <div key={id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/photos/${id}`} alt="" className="aspect-square w-full rounded-lg object-cover" />
                  <button
                    onClick={() => remove(id)}
                    className="absolute top-1 right-1 rounded-full bg-black/60 px-2 text-sm text-white"
                    aria-label="Slett bildet"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className={`btn w-full ${busy ? "pointer-events-none opacity-50" : ""}`}>
            {busy?.startsWith("Laster") ? busy : task.photoIds.length ? "Legg til flere bilder" : "Ta eller velg bilde"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                upload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <p className="text-xs text-muted">Hele laget skal være med på bildet.</p>
        </section>
      )}

      {needsText && (
        <section className="card">
          <label className="label" htmlFor="answer">
            Skriftlig svar
          </label>
          <textarea
            id="answer"
            className="input min-h-28"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            maxLength={2000}
          />
        </section>
      )}

      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary btn-big" onClick={submit} disabled={!!busy || !ready}>
        {busy === "Sender …" ? busy : task.proofType === "none" ? "Fullført – neste post" : "Send inn og gå videre"}
      </button>
    </>
  );
}

// ---------- Mål ----------

function Finished({ state }: { state: TeamState }) {
  return (
    <>
      <section className="paper text-center">
        <p className="eyebrow">I mål!</p>
        <p className="mt-2 font-mono text-5xl font-extrabold tabular-nums">{formatDuration(state.score.elapsedSec)}</p>
        {state.score.adjustmentMin !== 0 && (
          <p className="mt-2 text-muted">
            {formatMinutes(state.score.adjustmentMin)} gir sluttid <b>{formatDuration(state.score.totalSec)}</b>
          </p>
        )}
      </section>
      {state.finaleTask && (
        <section className="card">
          <p className="eyebrow">Finalen</p>
          <p className="mt-2 leading-relaxed whitespace-pre-line">{state.finaleTask}</p>
        </section>
      )}
    </>
  );
}

// ---------- Bunn ----------

function Footer({ state }: { state: TeamState }) {
  const { organizer } = state;
  return (
    <footer className="space-y-4 pt-4 text-sm">
      {state.adjustments.length > 0 && (
        <section className="card">
          <p className="label">Straff og bonus</p>
          <ul className="space-y-1">
            {state.adjustments.map((a, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>{a.reason}</span>
                <span className={`font-mono ${a.minutes > 0 ? "text-brand" : "text-ok"}`}>{formatMinutes(a.minutes)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {organizer.phone && (
        <a className="btn w-full" href={`tel:${organizer.phone.replace(/\s/g, "")}`}>
          Problemer? Ring {organizer.name || "arrangøren"} ({organizer.phone})
        </a>
      )}
      <form
        action="/logg-ut"
        method="post"
        onSubmit={(e) => {
          if (!confirm("Logge ut? Du kan komme tilbake med lagkoden og samme navn.")) e.preventDefault();
        }}
        className="text-center"
      >
        <span className="text-muted">
          Logget inn som {state.me.name} ·{" "}
        </span>
        <button className="text-muted underline">Logg ut</button>
      </form>
    </footer>
  );
}
