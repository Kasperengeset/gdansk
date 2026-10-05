export type Position = { lat: number; lng: number; accuracy: number };

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Avstand i meter mellom to punkter (haversine). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Vi gir inntil 50 m slack for GPS-unøyaktighet, men ikke mer. */
export const MAX_ACCURACY_SLACK_M = 50;
/** Dårligere nøyaktighet enn dette avvises – be laget prøve igjen ute i åpent område. */
export const MAX_ACCEPTED_ACCURACY_M = 200;

export function isAtPost(pos: Position, post: { lat: number; lng: number; radius_m: number }): boolean {
  return distanceM(pos, post) <= post.radius_m + Math.min(pos.accuracy, MAX_ACCURACY_SLACK_M);
}

export function isValidPosition(p: unknown): p is Position {
  if (typeof p !== "object" || p === null) return false;
  const { lat, lng, accuracy } = p as Record<string, unknown>;
  return (
    typeof lat === "number" && typeof lng === "number" && typeof accuracy === "number" &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && accuracy >= 0 && Number.isFinite(accuracy)
  );
}
