"use client";

import { useState, useTransition } from "react";
import { getBestPosition } from "@/lib/browser";
import { CIPHER_TYPES, encrypt, isCipherType, validateKey, type CipherType } from "@/lib/cipher";
import { PROOF_TYPES } from "@/lib/constants";
import type { PostRow } from "@/lib/game";
import type { ActionResult } from "../../actions";
import type { MapPoint } from "./MapPicker";
import { MapPicker } from "./maps";

type Props = {
  post: Omit<PostRow, "id"> & { id: string | null };
  others: MapPoint[];
  save: (prev: ActionResult, form: FormData) => Promise<ActionResult>;
  remove?: () => Promise<ActionResult>;
};

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export function PostForm({ post, others, save, remove }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [clue, setClue] = useState(post.clue_text);
  const [cipher, setCipher] = useState<CipherType>(isCipherType(post.cipher_type) ? post.cipher_type : "none");
  const [cipherKey, setCipherKey] = useState(post.cipher_key);
  const [lat, setLat] = useState(post.lat === null ? "" : String(post.lat));
  const [lng, setLng] = useState(post.lng === null ? "" : String(post.lng));
  const [radius, setRadius] = useState(String(post.radius_m));
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ display_name: string; lat: string; lon: string }[]>([]);

  const keyError = validateKey(cipher, cipherKey);
  const preview = keyError ? null : encrypt(clue, cipher, cipherKey);
  const latNum = lat === "" ? null : Number(lat.replace(",", "."));
  const lngNum = lng === "" ? null : Number(lng.replace(",", "."));
  const validPos = latNum !== null && lngNum !== null && Number.isFinite(latNum) && Number.isFinite(lngNum);

  function setPos(a: number, b: number) {
    setLat(String(round(a)));
    setLng(String(round(b)));
  }

  async function useMyPosition() {
    setLocMsg("Henter posisjon …");
    try {
      const p = await getBestPosition({ maxWaitMs: 15_000, goodEnoughM: 10 });
      setPos(p.lat, p.lng);
      setLocMsg(`Satt til din posisjon (± ${Math.round(p.accuracy)} m).`);
    } catch (err) {
      setLocMsg(err instanceof Error ? err.message : "Fant ikke posisjonen.");
    }
  }

  function pasteCoords(text: string) {
    // Godtar «54.3485, 18.6533» som kopiert fra Google Maps.
    const m = text.match(/(-?\d+[.,]\d+)\s*[,;\s]\s*(-?\d+[.,]\d+)/);
    if (m) setPos(Number(m[1].replace(",", ".")), Number(m[2].replace(",", ".")));
  }

  async function searchAddress() {
    if (!search.trim()) return;
    setLocMsg("Søker …");
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=pl&q=${encodeURIComponent(search)}`;
    try {
      const res = await fetch(url, { headers: { "accept-language": "nb,pl,en" } });
      const data = await res.json();
      setResults(data);
      setLocMsg(data.length ? null : "Fant ingenting. Prøv f.eks. «Bułońska 10E, Gdańsk».");
    } catch {
      setLocMsg("Søket feilet.");
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(async () => setError((await save(undefined, data))?.error));
      }}
    >
      <section className="card grid gap-4 sm:grid-cols-[6rem_1fr]">
        <div>
          <label className="label" htmlFor="position">
            Rekkefølge
          </label>
          <input className="input" id="position" name="position" type="number" defaultValue={post.position} required />
        </div>
        <div>
          <label className="label" htmlFor="title">
            Tittel (bare for deg)
          </label>
          <input className="input" id="title" name="title" defaultValue={post.title} required />
        </div>
        <div className="flex flex-wrap gap-5 sm:col-span-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="active" defaultChecked={post.active} className="size-5 accent-brand" />
            Aktiv (ikke reserve)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_finale" defaultChecked={post.is_finale} className="size-5 accent-brand" />
            Finale (klokka stopper ved innsjekk)
          </label>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-bold">Ledetråd</h2>
        <div>
          <label className="label" htmlFor="clue_text">
            Gåten i klartekst
          </label>
          <textarea
            className="input min-h-24"
            id="clue_text"
            name="clue_text"
            value={clue}
            onChange={(e) => setClue(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="cipher_type">
              Chiffer
            </label>
            <select
              className="input"
              id="cipher_type"
              name="cipher_type"
              value={cipher}
              onChange={(e) => setCipher(e.target.value as CipherType)}
            >
              {Object.entries(CIPHER_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          {(cipher === "caesar" || cipher === "vigenere") && (
            <div>
              <label className="label" htmlFor="cipher_key">
                {cipher === "caesar" ? "Forskyvning (tall)" : "Nøkkelord"}
              </label>
              <input
                className="input"
                id="cipher_key"
                name="cipher_key"
                value={cipherKey}
                onChange={(e) => setCipherKey(e.target.value)}
              />
            </div>
          )}
        </div>
        <div>
          <label className="label" htmlFor="key_hint">
            Hint som vises sammen med chifferet
          </label>
          <input className="input" id="key_hint" name="key_hint" defaultValue={post.key_hint} />
        </div>
        <div className="paper">
          <p className="eyebrow">Slik ser lagene den</p>
          {keyError ? (
            <p className="error mt-2">{keyError}</p>
          ) : (
            <p className="mt-2 font-mono break-words whitespace-pre-wrap">{preview || "–"}</p>
          )}
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-bold">Oppgave (vises når laget er fremme)</h2>
        <textarea className="input min-h-36" name="task_text" defaultValue={post.task_text} aria-label="Oppgavetekst" />
        <div>
          <label className="label" htmlFor="proof_type">
            Bevis
          </label>
          <select className="input" id="proof_type" name="proof_type" defaultValue={post.proof_type}>
            {Object.entries(PROOF_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-bold">Sted</h2>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Søk adresse, f.eks. Chlebnicka 2, Gdańsk"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                searchAddress();
              }
            }}
          />
          <button type="button" className="btn" onClick={searchAddress}>
            Søk
          </button>
        </div>
        {results.length > 0 && (
          <ul className="space-y-1 text-sm">
            {results.map((r) => (
              <li key={`${r.lat},${r.lon}`}>
                <button
                  type="button"
                  className="text-left underline"
                  onClick={() => {
                    setPos(Number(r.lat), Number(r.lon));
                    setResults([]);
                  }}
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <MapPicker lat={validPos ? latNum : null} lng={validPos ? lngNum : null} radius={Number(radius) || 0} others={others} onChange={setPos} />
        <p className="text-xs text-muted">Klikk på kartet eller dra pinnen. Sirkelen viser hvor nærme laget må være.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="lat">
              Breddegrad
            </label>
            <input
              className="input"
              id="lat"
              name="lat"
              inputMode="decimal"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (text.includes(",") || text.includes(" ")) {
                  e.preventDefault();
                  pasteCoords(text);
                }
              }}
            />
          </div>
          <div>
            <label className="label" htmlFor="lng">
              Lengdegrad
            </label>
            <input className="input" id="lng" name="lng" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="radius_m">
              Radius (m)
            </label>
            <input
              className="input"
              id="radius_m"
              name="radius_m"
              type="number"
              min={10}
              max={2000}
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-small" onClick={useMyPosition}>
            Bruk min posisjon
          </button>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              setLat("");
              setLng("");
            }}
          >
            Fjern posisjon
          </button>
          {locMsg && <span className="text-sm text-muted">{locMsg}</span>}
        </div>
        <p className="text-xs text-muted">
          Tips: lim inn «54.3485, 18.6533» fra Google Maps i breddegrad-feltet. Står du på stedet, trykk «Bruk min
          posisjon».
        </p>
      </section>

      <section className="card grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div>
          <label className="label" htmlFor="emergency_text">
            Nødkonvolutt (stedsnavn)
          </label>
          <input className="input" id="emergency_text" name="emergency_text" defaultValue={post.emergency_text} />
        </div>
        <div>
          <label className="label" htmlFor="emergency_penalty_min">
            Straff (min)
          </label>
          <input
            className="input"
            id="emergency_penalty_min"
            name="emergency_penalty_min"
            type="number"
            defaultValue={post.emergency_penalty_min}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="admin_note">
            Arrangørnotat (bare for deg)
          </label>
          <textarea className="input min-h-20" id="admin_note" name="admin_note" defaultValue={post.admin_note} />
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Lagrer …" : "Lagre"}
        </button>
        {remove && (
          <button
            type="button"
            className="btn text-brand"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Slette «${post.title}» for godt? Fremgang og bilder for posten slettes også.`)) return;
              startTransition(async () => setError((await remove())?.error));
            }}
          >
            Slett post
          </button>
        )}
      </div>
    </form>
  );
}
