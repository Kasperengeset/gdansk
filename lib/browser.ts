// Hjelpere som bare kjører i nettleseren.

import type { Position } from "./geo";

export class GeoError extends Error {}

/**
 * Henter posisjon og venter litt på en god GPS-fix: returnerer så snart nøyaktigheten
 * er god nok, ellers den beste målingen etter `maxWaitMs`.
 */
export function getBestPosition({ maxWaitMs = 10_000, goodEnoughM = 25 } = {}): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new GeoError("Denne nettleseren støtter ikke posisjon."));
      return;
    }
    let best: Position | null = null;
    let done = false;
    const finish = (err?: GeoError) => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      if (best) resolve(best);
      else reject(err ?? new GeoError("Fant ikke posisjonen. Gå ut i åpent område og prøv igjen."));
    };
    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        if (!best || pos.accuracy < best.accuracy) best = pos;
        if (pos.accuracy <= goodEnoughM) finish();
      },
      (e) => {
        if (e.code === e.PERMISSION_DENIED) {
          finish(
            new GeoError(
              "Appen har ikke lov til å bruke posisjon. Tillat posisjon for nettleseren i innstillingene og last inn siden på nytt.",
            ),
          );
        } else if (e.code === e.TIMEOUT) {
          finish();
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxWaitMs },
    );
    const timer = setTimeout(() => finish(), maxWaitMs);
  });
}

/** Skalerer ned og konverterer til JPEG, så opplasting går fort over mobildata. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.8): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Klarte ikke å lage bildet."))), "image/jpeg", quality),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** POST med JSON; kaster Error med serverens norske feilmelding. */
export async function postJson<T = unknown>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Noe gikk galt. Sjekk nettet og prøv igjen.");
  return data as T;
}
