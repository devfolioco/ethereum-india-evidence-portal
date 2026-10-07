// One-off: rasterise India's official boundary (DataMeet india-composite) into a dot grid.
// Usage: node scripts/india-dots.mjs <india-composite.geojson> src/components/hero/india-dots.json 0.36
import fs from 'node:fs';
const [, , src, out, stepArg] = process.argv;
const STEP = Number(stepArg || 0.5);          // degrees per dot
const K = Math.cos((22 * Math.PI) / 180);     // equirectangular x-correction at India's mid-latitude

const geo = JSON.parse(fs.readFileSync(src, 'utf8'));
const polys = geo.features.flatMap((f) =>
  f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
);
const bbox = (ring) => ring.reduce((b, [x, y]) =>
  [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [1e9, 1e9, -1e9, -1e9]);
const P = polys.map((rings) => ({ rings, b: bbox(rings[0]) }));

const inRing = (x, y, r) => {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inPoly = (x, y, p) =>
  x >= p.b[0] && x <= p.b[2] && y >= p.b[1] && y <= p.b[3] &&
  inRing(x, y, p.rings[0]) && !p.rings.slice(1).some((h) => inRing(x, y, h));

const W = 68, E = 97.5, S = 6.5, N = 37.25;
const cols = Math.ceil(((E - W) * K) / STEP) + 1;
const rows = Math.ceil((N - S) / STEP) + 1;
const toLon = (c) => W + (c * STEP) / K;
const toLat = (r) => N - r * STEP;
const toCell = (lon, lat) => [Math.round(((lon - W) * K) / STEP), Math.round((N - lat) / STEP)];

const set = new Set();
for (let r = 0; r < rows; r++)
  for (let c = 0; c < cols; c++)
    if (P.some((p) => inPoly(toLon(c), toLat(r), p))) set.add(c + ',' + r);

// Islands smaller than a grid cell (Andaman & Nicobar, Lakshadweep) still get one dot each.
for (const p of P) {
  const [x0, y0, x1, y1] = p.b;
  if ((x1 - x0) * K < STEP * 1.5 && y1 - y0 < STEP * 1.5 && (x1 - x0) * (y1 - y0) > 0.0004)
    set.add(toCell((x0 + x1) / 2, (y0 + y1) / 2).join(','));
}

const dots = [...set].flatMap((k) => k.split(',').map(Number));
fs.writeFileSync(out, JSON.stringify({
  source: 'DataMeet india-composite.geojson (github.com/datameet/maps), CC BY 2.5 IN',
  step: STEP, cols, rows,
  mumbai: toCell(72.88, 19.07),
  dots,
}));
console.log({ cols, rows, dots: dots.length / 2, bytes: fs.statSync(out).size });
