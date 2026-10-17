// Genera src/lib/geo.ts a partir de los límites oficiales en data/.
//   - data/municipios.geojson: DANE (MGN) vía geoBoundaries, CC BY 4.0
//   - data/comunas-medellin.geojson: Alcaldía de Medellín (LimiteComunaCorregimiento)
// Uso: node scripts/build-geo.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, "data", f), "utf8"));
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// El índice de cada zona es su zoneId en el contrato (ver contracts/script/Deploy.s.sol).
const COMUNAS = [
  ["01", "Popular"], ["02", "Santa Cruz"], ["03", "Manrique"], ["04", "Aranjuez"], ["05", "Castilla"],
  ["06", "Doce de Octubre"], ["07", "Robledo"], ["08", "Villa Hermosa"], ["09", "Buenos Aires"],
  ["10", "La Candelaria"], ["11", "Laureles-Estadio"], ["12", "La América"], ["13", "San Javier"],
  ["14", "El Poblado"], ["15", "Guayabal"], ["16", "Belén"],
];
// Para los municipios, el clima se consulta en el casco urbano y no en el centro del polígono (que suele ser rural).
const MUNICIPIOS = [
  ["Bello", "Norte", [-75.5579, 6.3373]],
  ["Copacabana", "Norte", [-75.5089, 6.3486]],
  ["Girardota", "Norte", [-75.445, 6.377]],
  ["Barbosa", "Norte", [-75.333, 6.4384]],
  ["Envigado", "Sur", [-75.587, 6.17]],
  ["Itagüí", "Sur", [-75.5991, 6.1846]],
  ["Sabaneta", "Sur", [-75.6166, 6.1515]],
  ["La Estrella", "Sur", [-75.643, 6.1576]],
  ["Caldas", "Sur", [-75.6357, 6.0911]],
];

// ── Geometría ──
function outerRings(geom) {
  return geom.type === "Polygon" ? [geom.coordinates[0]] : geom.coordinates.map((p) => p[0]);
}

function simplify(points, tol) {
  if (points.length < 4) return points;
  const sq = tol * tol;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    let max = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const dx = bx - ax;
      const dy = by - ay;
      const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
      const ex = ax + t * dx - px;
      const ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > max) [max, idx] = [d, i];
    }
    if (max > sq) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const round = (ring) => ring.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]);

function inside([x, y], ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function edgeDist([x, y], ring) {
  let min = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j];
    const [bx, by] = ring[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0;
    min = Math.min(min, Math.hypot(ax + t * dx - x, ay + t * dy - y));
  }
  return min;
}

/** Punto interior más alejado de los bordes (búsqueda en rejilla): sirve para ubicar la etiqueta. */
function labelPoint(rings) {
  const ring = rings.reduce((a, b) => (b.length > a.length ? b : a));
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let best = [(x0 + x1) / 2, (y0 + y1) / 2];
  let bestD = -1;
  const N = 40;
  for (let i = 0; i <= N; i++)
    for (let j = 0; j <= N; j++) {
      const p = [x0 + ((x1 - x0) * i) / N, y0 + ((y1 - y0) * j) / N];
      if (!inside(p, ring)) continue;
      const d = edgeDist(p, ring);
      if (d > bestD) [best, bestD] = [p, d];
    }
  return [+best[0].toFixed(4), +best[1].toFixed(4)];
}

// ── Construcción ──
const comunasGeo = read("comunas-medellin.geojson").features;
const municipiosGeo = read("municipios.geojson").features;

const zones = [];
for (const [code, name] of COMUNAS) {
  const f = comunasGeo.find((x) => x.properties.codigo === code);
  if (!f) throw new Error(`Falta la comuna ${code}`);
  const rings = outerRings(f.geometry).map((r) => round(simplify(r, 0.00035))).filter((r) => r.length > 3);
  const label = labelPoint(rings);
  zones.push({ name, area: "Medellín", kind: `Comuna ${Number(code)}`, rings, label, weather: label });
}
for (const [name, area, weather] of MUNICIPIOS) {
  const f = municipiosGeo.find((x) => norm(x.properties.name) === norm(name));
  if (!f) throw new Error(`Falta el municipio ${name}`);
  const rings = outerRings(f.geometry).map((r) => round(simplify(r, 0.0007))).filter((r) => r.length > 3);
  zones.push({ name, area, kind: "Municipio", rings, label: labelPoint(rings), weather });
}

const rural = comunasGeo
  .filter((f) => f.properties.codigo.length === 2 && Number(f.properties.codigo) >= 50)
  .map((f) => ({
    name: f.properties.nombre.replace("Corregimiento de ", ""),
    rings: outerRings(f.geometry).map((r) => round(simplify(r, 0.0007))).filter((r) => r.length > 3),
  }));

const out = `// Generado con \`node scripts/build-geo.mjs\`. No editar a mano.
// Límites: DANE – Marco Geoestadístico Nacional (vía geoBoundaries, CC BY 4.0) y Alcaldía de Medellín (comunas).

export type Ring = [number, number][];

export type ZoneGeo = {
  id: number;
  name: string;
  area: "Medellín" | "Norte" | "Sur";
  kind: string;
  rings: Ring[];
  /** [lon, lat] donde se dibuja la etiqueta. */
  label: [number, number];
  /** [lon, lat] donde el oráculo consulta el clima. */
  weather: [number, number];
};

export const ZONE_GEO: ZoneGeo[] = ${JSON.stringify(zones.map((z, id) => ({ id, ...z })))};

/** Corregimientos de Medellín: zona rural sin cobertura. */
export const RURAL_GEO: { name: string; rings: Ring[] }[] = ${JSON.stringify(rural)};
`;
fs.writeFileSync(path.join(root, "src", "lib", "geo.ts"), out);
const pts = zones.reduce((n, z) => n + z.rings.flat().length, 0);
console.log(`geo.ts: ${zones.length} zonas, ${rural.length} corregimientos, ${pts} puntos, ${(out.length / 1024).toFixed(1)} KB`);
