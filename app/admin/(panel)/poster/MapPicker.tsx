"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

export type MapPoint = { lat: number; lng: number; label: string; active?: boolean };

const GDANSK: L.LatLngTuple = [54.372, 18.638];

const pinIcon = L.divIcon({
  className: "",
  html: '<div style="width:22px;height:22px;border-radius:50%;background:#b3261e;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function baseMap(el: HTMLDivElement) {
  // Uten scrollhjul-zoom, så siden kan scrolles forbi kartet. Zoom med +/− eller knip.
  const map = L.map(el, { scrollWheelZoom: false }).setView(GDANSK, 12);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  return map;
}

function addPoints(map: L.Map, points: MapPoint[]) {
  for (const p of points) {
    L.circleMarker([p.lat, p.lng], {
      radius: 7,
      color: p.active === false ? "#999" : "#555",
      fillColor: p.active === false ? "#ddd" : "#f2ede6",
      fillOpacity: 1,
      weight: 2,
    })
      .bindTooltip(p.label, { permanent: true, direction: "right", offset: [6, 0], className: "text-xs" })
      .addTo(map);
  }
}

/** Kart der admin klikker eller drar pinnen for å plassere en post. */
export function MapPicker({
  lat,
  lng,
  radius,
  others,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  radius: number;
  others: MapPoint[];
  onChange: (lat: number, lng: number) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const circle = useRef<L.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const m = baseMap(el.current!);
    addPoints(m, others);
    m.on("click", (e: L.LeafletMouseEvent) => onChangeRef.current(e.latlng.lat, e.latlng.lng));
    map.current = m;
    return () => {
      m.remove();
      map.current = marker.current = circle.current = null;
    };
    // Kartet lages én gang; posisjonen oppdateres i effekten under.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (lat === null || lng === null) {
      marker.current?.remove();
      circle.current?.remove();
      marker.current = circle.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = L.marker([lat, lng], { icon: pinIcon, draggable: true })
        .on("dragend", (e) => {
          const p = (e.target as L.Marker).getLatLng();
          onChangeRef.current(p.lat, p.lng);
        })
        .addTo(m);
      circle.current = L.circle([lat, lng], { radius, color: "#b3261e", weight: 1, fillOpacity: 0.12 }).addTo(m);
      m.setView([lat, lng], Math.max(m.getZoom(), 16));
    } else {
      marker.current.setLatLng([lat, lng]);
      circle.current!.setLatLng([lat, lng]).setRadius(radius);
    }
  }, [lat, lng, radius]);

  return <div ref={el} className="h-80 w-full overflow-hidden rounded-lg border border-line" />;
}

/** Oversiktskart over alle poster. */
export function PostsMap({ points }: { points: MapPoint[] }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const m = baseMap(el.current!);
    addPoints(m, points);
    const active = points.filter((p) => p.active !== false);
    if (active.length) m.fitBounds(L.latLngBounds(active.map((p) => [p.lat, p.lng])), { padding: [30, 30] });
    return () => {
      m.remove();
    };
  }, [points]);
  return <div ref={el} className="h-96 w-full overflow-hidden rounded-lg border border-line" />;
}
