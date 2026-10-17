"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RURAL_GEO, ZONE_GEO, type Ring } from "./geo";
import type { MapPoint } from "@/components/ValleyMap";

export type LocationMode = "off" | "gps" | "sim";
export type GpsStatus = "idle" | "requesting" | "ok" | "denied" | "unavailable" | "error";

function inRing(lon: number, lat: number, ring: Ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Zona asegurable que contiene el punto, o null si está fuera (o en zona rural). */
export function zoneAt(lon: number, lat: number): { zoneId: number | null; rural: string | null } {
  const zone = ZONE_GEO.find((z) => z.rings.some((r) => inRing(lon, lat, r)));
  if (zone) return { zoneId: zone.id, rural: null };
  const rural = RURAL_GEO.find((r) => r.rings.some((ring) => inRing(lon, lat, ring)));
  return { zoneId: null, rural: rural?.name ?? null };
}

const at = (id: number): [number, number] => ZONE_GEO[id].label;

/** Recorridos de demostración: un repartidor que cruza varias zonas. */
export const DEMO_ROUTES = [
  { id: "sur", name: "Laureles → Itagüí", stops: [10, 11, 15, 14, 21].map(at) },
  { id: "norte", name: "Centro → Bello", stops: [9, 4, 5, 16].map(at) },
  { id: "oriente", name: "El Poblado → Envigado → Sabaneta", stops: [13, 20, 22].map(at) },
];

const STORE = "llovera.location";

export function useLocation() {
  const [mode, setMode] = useState<LocationMode>("off");
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [routeProgress, setRouteProgress] = useState<number | null>(null);
  const watchId = useRef<number | null>(null);
  const routeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRoute = useCallback(() => {
    if (routeTimer.current) clearInterval(routeTimer.current);
    routeTimer.current = null;
    setRouteProgress(null);
  }, []);

  const stopGps = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }, []);

  useEffect(() => () => {
    stopGps();
    stopRoute();
  }, [stopGps, stopRoute]);

  /** Pide permiso al navegador y sigue la posición real. */
  const startGps = useCallback(() => {
    stopRoute();
    setMode("gps");
    if (!("geolocation" in navigator)) {
      setGpsStatus("unavailable");
      return;
    }
    setGpsStatus("requesting");
    stopGps();
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsStatus("ok");
        setAccuracy(pos.coords.accuracy);
        setPoint({ lon: pos.coords.longitude, lat: pos.coords.latitude });
      },
      (err) => {
        setGpsStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error");
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
  }, [stopGps, stopRoute]);

  /** Modo simulación: la ubicación la define la demo (clic en el mapa o recorrido). */
  const startSim = useCallback(
    (initial?: MapPoint) => {
      stopGps();
      setMode("sim");
      setAccuracy(null);
      if (initial) setPoint({ ...initial, simulated: true });
    },
    [stopGps],
  );

  const setSimPoint = useCallback(
    (p: MapPoint) => {
      stopRoute();
      setMode("sim");
      setPoint({ ...p, simulated: true });
    },
    [stopRoute],
  );

  /** Recorre los puntos de la ruta durante `seconds` segundos. */
  const playRoute = useCallback(
    (stops: [number, number][], seconds = 24) => {
      stopGps();
      stopRoute();
      setMode("sim");
      const legs = stops.length - 1;
      const t0 = Date.now();
      routeTimer.current = setInterval(() => {
        const k = Math.min(1, (Date.now() - t0) / (seconds * 1000));
        const pos = k * legs;
        const i = Math.min(legs - 1, Math.floor(pos));
        const f = pos - i;
        const [a, b] = [stops[i], stops[i + 1]];
        setPoint({ lon: a[0] + (b[0] - a[0]) * f, lat: a[1] + (b[1] - a[1]) * f, simulated: true });
        setRouteProgress(k);
        if (k >= 1) stopRoute();
      }, 80);
    },
    [stopGps, stopRoute],
  );

  const off = useCallback(() => {
    stopGps();
    stopRoute();
    setMode("off");
    setPoint(null);
    setGpsStatus("idle");
  }, [stopGps, stopRoute]);

  // Recordar la ubicación al cambiar de página (p. ej. ir al oráculo y volver).
  const restored = useRef(false);
  useEffect(() => {
    restored.current = true;
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE) ?? "null") as { mode: LocationMode; point: MapPoint | null } | null;
      if (saved?.mode === "gps") startGps();
      else if (saved?.mode === "sim") {
        setMode("sim");
        if (saved.point) setPoint({ ...saved.point, simulated: true });
      }
    } catch {}
  }, [startGps]);
  useEffect(() => {
    if (!restored.current) return;
    try {
      if (mode === "off") sessionStorage.removeItem(STORE);
      else sessionStorage.setItem(STORE, JSON.stringify({ mode, point: mode === "sim" ? point : null }));
    } catch {}
  }, [mode, point]);

  const where = point ? zoneAt(point.lon, point.lat) : { zoneId: null, rural: null };

  return { mode, gpsStatus, point, accuracy, routeProgress, ...where, startGps, startSim, setSimPoint, playRoute, stopRoute, off };
}
