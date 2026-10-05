"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createTeamAction, joinTeamAction, type FormState } from "./actions";

/**
 * Sender skjemaet via onSubmit i stedet for `action`-propen, slik at React ikke
 * tømmer feltene når serveren svarer med en feilmelding (f.eks. feil lagkode).
 */
function useEntryAction(action: (prev: FormState, form: FormData) => Promise<FormState>) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => setState(await action(undefined, data)));
  };
  return [state, onSubmit, pending] as const;
}

export function EntryForms({ initialCode }: { initialCode: string }) {
  const [mode, setMode] = useState<"join" | "create">(initialCode ? "join" : "create");
  const [createState, onCreate, creating] = useEntryAction(createTeamAction);
  const [joinState, onJoin, joining] = useEntryAction(joinTeamAction);

  return (
    <div className="mt-8">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-paper p-1">
        {(["create", "join"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg py-2 text-sm font-semibold ${mode === m ? "bg-white shadow-sm" : "text-muted"}`}
          >
            {m === "create" ? "Opprett lag" : "Bli med i lag"}
          </button>
        ))}
      </div>

      {mode === "create" ? (
        <form onSubmit={onCreate} className="card space-y-4">
          <div>
            <label className="label" htmlFor="team">
              Lagnavn
            </label>
            <input className="input" id="team" name="team" required maxLength={40} autoComplete="off" />
          </div>
          <div>
            <label className="label" htmlFor="name-create">
              Ditt navn
            </label>
            <input className="input" id="name-create" name="name" required maxLength={40} autoComplete="given-name" />
          </div>
          {createState?.error && <p className="error">{createState.error}</p>}
          <button className="btn btn-primary w-full" disabled={creating}>
            {creating ? "Oppretter …" : "Opprett lag"}
          </button>
          <p className="text-sm text-muted">Du får en lagkode som de andre på laget bruker for å bli med.</p>
        </form>
      ) : (
        <form onSubmit={onJoin} className="card space-y-4">
          <div>
            <label className="label" htmlFor="code">
              Lagkode
            </label>
            <input
              className="input font-mono text-xl tracking-[0.3em] uppercase"
              id="code"
              name="code"
              required
              maxLength={5}
              defaultValue={initialCode}
              autoComplete="off"
              autoCapitalize="characters"
            />
          </div>
          <div>
            <label className="label" htmlFor="name-join">
              Ditt navn
            </label>
            <input className="input" id="name-join" name="name" required maxLength={40} autoComplete="given-name" />
          </div>
          {joinState?.error && <p className="error">{joinState.error}</p>}
          <button className="btn btn-primary w-full" disabled={joining}>
            {joining ? "Blir med …" : "Bli med"}
          </button>
          <p className="text-sm text-muted">Har du vært logget inn før? Skriv samme navn, så kommer du tilbake.</p>
        </form>
      )}
    </div>
  );
}
