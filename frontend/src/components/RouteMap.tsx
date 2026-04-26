import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

import type { PlanResponse, SegmentDTO } from "../lib/types";
import { formatClock, formatHoursMinutes, shortLocation } from "../lib/format";


const iconBase = "https://unpkg.com/leaflet@1.9.4/dist/images";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: `${iconBase}/marker-icon-2x.png`,
  iconUrl: `${iconBase}/marker-icon.png`,
  shadowUrl: `${iconBase}/marker-shadow.png`,
});

function coloredPinIcon(color: string, letter: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 44" width="32" height="44">
      <path fill="${color}" stroke="#ffffff" stroke-width="2"
        d="M16 2a14 14 0 0 0-14 14c0 10 14 26 14 26s14-16 14-26A14 14 0 0 0 16 2z"/>
      <circle cx="16" cy="16" r="6" fill="#ffffff"/>
      <text x="16" y="19.5" text-anchor="middle" font-family="Inter,system-ui,sans-serif"
        font-size="9" font-weight="700" fill="${color}">${letter}</text>
    </svg>`;
  return L.divIcon({
    className: "pin-icon",
    html: svg,
    iconSize: [32, 44],
    iconAnchor: [16, 42],
    popupAnchor: [0, -36],
  });
}

const iconStart = coloredPinIcon("#0ea5e9", "S");
const iconPickup = coloredPinIcon("#16a34a", "P");
const iconDropoff = coloredPinIcon("#dc2626", "D");
const iconFuel = coloredPinIcon("#f59e0b", "F");
const iconRest = coloredPinIcon("#6366f1", "R");
const iconBreak = coloredPinIcon("#0f172a", "B");

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [bounds, map]);
  return null;
}

interface Props {
  data: PlanResponse;
}

interface Stop {
  kind: "start" | "pickup" | "dropoff" | "fuel" | "rest" | "break";
  icon: L.DivIcon;
  lat: number;
  lon: number;
  title: string;
  subtitle: string;
  start: string;
  duration_seconds: number;
}

export function RouteMap({ data }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const polylines = useMemo(() => {
    return data.legs
      .map((leg) => leg.geometry ?? [])
      .map((coords) => coords.map(([lon, lat]) => [lat, lon] as LatLngExpression));
  }, [data]);

  const stops = useMemo<Stop[]>(() => {
    const out: Stop[] = [];
    const g = data.geocoded;
    out.push({
      kind: "start",
      icon: iconStart,
      lat: g.current.lat,
      lon: g.current.lon,
      title: "Start",
      subtitle: shortLocation(g.current.label),
      start: data.totals.trip_start ?? "",
      duration_seconds: 0,
    });
    out.push({
      kind: "pickup",
      icon: iconPickup,
      lat: g.pickup.lat,
      lon: g.pickup.lon,
      title: "Pickup",
      subtitle: shortLocation(g.pickup.label),
      start: "",
      duration_seconds: 3600,
    });
    out.push({
      kind: "dropoff",
      icon: iconDropoff,
      lat: g.dropoff.lat,
      lon: g.dropoff.lon,
      title: "Drop-off",
      subtitle: shortLocation(g.dropoff.label),
      start: data.totals.trip_end ?? "",
      duration_seconds: 3600,
    });

    for (const seg of data.segments) {
      if (seg.location_lat == null || seg.location_lon == null) continue;
      const s = seg as SegmentDTO;
      if (s.note === "Fuel stop") {
        out.push({
          kind: "fuel",
          icon: iconFuel,
          lat: s.location_lat!,
          lon: s.location_lon!,
          title: "Fuel stop",
          subtitle: shortLocation(s.location_label),
          start: s.start,
          duration_seconds: s.duration_seconds,
        });
      } else if (s.status === "sleeper" && s.note.includes("10-hour")) {
        out.push({
          kind: "rest",
          icon: iconRest,
          lat: s.location_lat!,
          lon: s.location_lon!,
          title: "10-hour rest (sleeper)",
          subtitle: shortLocation(s.location_label),
          start: s.start,
          duration_seconds: s.duration_seconds,
        });
      } else if (s.status === "off_duty" && s.note.includes("30-minute")) {
        out.push({
          kind: "break",
          icon: iconBreak,
          lat: s.location_lat!,
          lon: s.location_lon!,
          title: "30-minute break",
          subtitle: shortLocation(s.location_label),
          start: s.start,
          duration_seconds: s.duration_seconds,
        });
      }
    }
    return out;
  }, [data]);

  const bounds = useMemo<LatLngBoundsExpression | null>(() => {
    const all: LatLngExpression[] = [];
    polylines.forEach((p) => all.push(...p));
    stops.forEach((s) => all.push([s.lat, s.lon]));
    if (all.length === 0) return null;
    return L.latLngBounds(all as L.LatLngTuple[]);
  }, [polylines, stops]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-ink dark:text-slate-100">Route &amp; stops</h2>
        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <LegendDot color="#0ea5e9" label="Start" />
          <LegendDot color="#16a34a" label="Pickup" />
          <LegendDot color="#dc2626" label="Drop-off" />
          <LegendDot color="#f59e0b" label="Fuel" />
          <LegendDot color="#6366f1" label="Rest" />
          <LegendDot color="#0f172a" label="Break" />
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_320px]">
        <div ref={containerRef} className="h-[460px] md:h-[520px]">
          <MapContainer
            center={[39.5, -98]}
            zoom={4}
            style={{ width: "100%", height: "100%" }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {polylines.map((p, i) => (
              <Polyline
                key={`pl-${i}`}
                positions={p}
                pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.85 }}
              />
            ))}
            {stops.map((s, i) => (
              <Marker key={`m-${i}`} position={[s.lat, s.lon]} icon={s.icon}>
                <Popup>
                  <div className="text-sm">
                    <div className="font-semibold text-ink">{s.title}</div>
                    <div className="text-slate-600">{s.subtitle}</div>
                    {s.start && (
                      <div className="text-slate-500 text-xs mt-1">
                        {formatClock(s.start)}
                        {s.duration_seconds > 0 &&
                          ` · ${formatHoursMinutes(s.duration_seconds)}`}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
            <FitBounds bounds={bounds} />
          </MapContainer>
        </div>

        <div className="border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 max-h-[520px] overflow-auto scroll-inner">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {stops.map((s, i) => (
              <li key={`lst-${i}`} className="px-4 py-3 flex items-start gap-3 text-sm">
                <StopDot kind={s.kind} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink dark:text-slate-100">{s.title}</div>
                  <div className="text-slate-500 dark:text-slate-400 text-xs truncate">{s.subtitle}</div>
                  {s.start && (
                    <div className="text-slate-400 dark:text-slate-500 text-[11px] mt-0.5">
                      {formatClock(s.start)}
                      {s.duration_seconds > 0 &&
                        ` · ${formatHoursMinutes(s.duration_seconds)}`}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block w-2.5 h-2.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function StopDot({ kind }: { kind: Stop["kind"] }) {
  const color = {
    start: "#0ea5e9",
    pickup: "#16a34a",
    dropoff: "#dc2626",
    fuel: "#f59e0b",
    rest: "#6366f1",
    break: "#0f172a",
  }[kind];
  return (
    <span
      className="mt-1 inline-block w-2.5 h-2.5 rounded-full shrink-0"
      style={{ background: color }}
    />
  );
}
