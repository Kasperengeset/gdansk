const TZ = "Europe/Warsaw";

/** Klokkeslett i Gdańsk-tid, f.eks. «14:05». */
export function clock(d: Date | string | null | undefined): string {
  if (!d) return "–";
  return new Date(d).toLocaleTimeString("nb-NO", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

/** «nå», «for 3 min siden», «for 2 t siden». */
export function ago(d: Date | string | null | undefined, now = new Date()): string {
  if (!d) return "aldri";
  const sec = Math.round((now.getTime() - new Date(d).getTime()) / 1000);
  if (sec < 60) return "nå";
  if (sec < 3600) return `for ${Math.floor(sec / 60)} min siden`;
  return `for ${Math.floor(sec / 3600)} t siden`;
}

export function osmLink(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}
