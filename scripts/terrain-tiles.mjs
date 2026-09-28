// Hex tiles for terrain the Forêt d'Écouves art has no example of (hills, rivers, hedgerows),
// drawn as SVG in the Memoir '44 board style: top-down, painted, lit from the top left.
// Every tile is an SVG in a viewBox centred on the hex, radius R (pointy-top), clipped to the
// hex with the board's hex line; compose-board.mjs renders them at the board's size.
// A seed gives each hex its own rocks and bushes.
export const R = 100;
const W = R * Math.sqrt(3);
const f = (n) => Math.round(n * 10) / 10;

export const rng = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const corners = (r = R) => [...Array(6)].map((_, i) => {
  const a = ((i * 60 - 90) * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
});
const hexPoints = (r = R) => corners(r).map(([x, y]) => `${f(x)},${f(y)}`).join(" ");
// Edge d (0 = east, then clockwise every 60°): its midpoint and outward direction
export const edgeDir = (d) => { const a = (d * 60 * Math.PI) / 180; return [Math.cos(a), Math.sin(a)]; };
const edgeMid = (d, k = 1) => { const [x, y] = edgeDir(d); return [x * (W / 2) * k, y * (W / 2) * k]; };

// A smooth closed shape through points (Catmull-Rom as cubic Béziers)
const smoothClosed = (pts) => {
  const n = pts.length;
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + "Z";
};
const smoothOpen = (pts) => {
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
};
// An irregular round blob; `shape(a)` scales the radius by angle (e.g. to follow the hex)
const blob = (cx, cy, r, wobble, rand, n = 14, shape = () => 1) =>
  smoothClosed([...Array(n)].map((_, i) => {
    const a = (i / n) * Math.PI * 2;
    const rr = r * shape(a) * (1 + (rand() - 0.5) * wobble);
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  }));
// How far the hex boundary is at angle a, relative to the inscribed circle (1 at edge midpoints)
// Light a shape as a raised surface: its blurred alpha is the height map, lit from the top left
const relief = (id, blur = 10, scale = 7) =>
  `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="h"/>` +
  `<feDiffuseLighting in="h" surfaceScale="${scale}" diffuseConstant="1.25" lighting-color="#fff" result="l"><feDistantLight azimuth="225" elevation="42"/></feDiffuseLighting>` +
  `<feComposite in="l" in2="SourceAlpha" operator="in" result="lc"/><feBlend in="SourceGraphic" in2="lc" mode="multiply"/></filter>`;
const hexShape = (a) => { const s = ((((a * 180) / Math.PI) % 60) + 60) % 60; return 1 / Math.cos(((s - 30) * Math.PI) / 180) ** 0.55; };

// Mottled ground: base colour plus two noise layers of lighter and darker patches
const mottle = (id, seed, freq, [r, g, b], strength) =>
  `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="${seed}"/>` +
  `<feColorMatrix type="matrix" values="0 0 0 0 ${r / 255} 0 0 0 0 ${g / 255} 0 0 0 0 ${b / 255} 0 0 0 ${-strength} ${strength * 0.52}"/></filter>`;
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const ground = (base, light, dark, seed, freq = 0.03) =>
  `<defs>${mottle(`gl${seed}`, seed, freq, rgb(light), 3.2)}${mottle(`gd${seed}`, seed + 7, freq * 1.8, rgb(dark), 3)}</defs>` +
  `<rect x="-100" y="-100" width="200" height="200" fill="${base}"/>` +
  `<rect x="-100" y="-100" width="200" height="200" filter="url(#gl${seed})" opacity=".55"/>` +
  `<rect x="-100" y="-100" width="200" height="200" filter="url(#gd${seed})" opacity=".6"/>` +
  `<defs>${mottle(`gg${seed}`, seed + 13, 0.22, rgb(dark), 2.4)}</defs><rect x="-100" y="-100" width="200" height="200" filter="url(#gg${seed})" opacity=".35"/>`;

// Fine grass strokes, like the brush texture on the plains art
const grass = (rand, n, color, opacity = 0.35, area = 90) => {
  let s = `<g stroke="${color}" stroke-width="1.1" stroke-linecap="round" opacity="${opacity}" fill="none">`;
  for (let i = 0; i < n; i++) {
    const x = (rand() - 0.5) * 2 * area, y = (rand() - 0.5) * 2 * area;
    for (let k = -1; k <= 1; k++) s += `<path d="M${f(x + k * 2)},${f(y)}q${f(k * 1.5 + rand())},-3 ${f(k * 2.5)},-${f(4 + rand() * 3)}"/>`;
  }
  return s + "</g>";
};

// Leafy bushes and trees, like the forest art: a shadow, a gradient crown and light leaf dabs
export const PALETTES = {
  forest: ["#2f5a1c", "#5d9230", "#a8d253"],
  hedge: ["#23461a", "#46752a", "#86b447"],
  olive: ["#3f4f1d", "#6c7d33", "#b3bb62"],
  scrub: ["#4a5324", "#7a8a3a", "#c1c46c"],
};
const bushDefs = () =>
  Object.entries(PALETTES).map(([k, [d, m, l]]) =>
    `<radialGradient id="b-${k}" cx=".42" cy=".4" r=".62" fx=".35" fy=".3"><stop offset="0" stop-color="${l}"/><stop offset=".55" stop-color="${m}"/><stop offset="1" stop-color="${d}"/></radialGradient>`).join("") +
  `<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>`;
const bush = (x, y, r, pal, rand, shadow = 0.35) => {
  const [d, , l] = PALETTES[pal];
  let s = shadow ? `<circle cx="${f(x + r * 0.35)}" cy="${f(y + r * 0.4)}" r="${f(r * 1.05)}" fill="#0d1a05" opacity="${shadow}" filter="url(#soft)"/>` : "";
  s += `<path d="${blob(x, y, r, 0.22, rand, 9)}" fill="url(#b-${pal})" stroke="${d}" stroke-width=".8"/>`;
  const dabs = Math.round(r / 3);
  for (let i = 0; i < dabs; i++) {
    const a = rand() * Math.PI * 2, rr = r * (0.3 + rand() * 0.5);
    s += `<circle cx="${f(x + Math.cos(a) * rr - r * 0.15)}" cy="${f(y + Math.sin(a) * rr - r * 0.15)}" r="${f(r * (0.12 + rand() * 0.12))}" fill="${l}" opacity=".55"/>`;
  }
  return s;
};
const rock = (x, y, r, rand, [dark, mid, light] = ["#5f5a50", "#8f887a", "#c9c2b0"]) => {
  const pts = [...Array(7)].map((_, i) => { const a = (i / 7) * Math.PI * 2 + rand() * 0.4; const rr = r * (0.7 + rand() * 0.4); return [x + rr * Math.cos(a), y + rr * Math.sin(a) * 0.8]; });
  const poly = pts.map(([a, b]) => `${f(a)},${f(b)}`).join(" ");
  const top = pts.map(([a, b]) => `${f(x + (a - x) * 0.55 - r * 0.2)},${f(y + (b - y) * 0.55 - r * 0.25)}`).join(" ");
  return `<polygon points="${pts.map(([a, b]) => `${f(a + r * 0.3)},${f(b + r * 0.35)}`).join(" ")}" fill="#1a1a0a" opacity=".35" filter="url(#soft)"/>` +
    `<polygon points="${poly}" fill="${mid}" stroke="${dark}" stroke-width=".9" stroke-linejoin="round"/><polygon points="${top}" fill="${light}" opacity=".8"/>`;
};

// The tile frame: clipped to the hex, with the lighter bevel of the printed terrain tiles and the board's hex line
const frame = (body, rim = "#8f8e58", extraDefs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(-W / 2)} -100 ${f(W)} 200" width="${f(W * 2)}" height="400">` +
  `<defs><clipPath id="hex"><polygon points="${hexPoints()}"/></clipPath>${bushDefs()}${extraDefs}</defs>` +
  `<g clip-path="url(#hex)">${body}` +
  `<polygon points="${hexPoints(R - 2.5)}" fill="none" stroke="${rim}" stroke-width="5" opacity=".75"/>` +
  `<polygon points="${hexPoints(R - 5.5)}" fill="none" stroke="#fffbe0" stroke-width="1" opacity=".22"/></g>` +
  `<polygon points="${hexPoints()}" fill="none" stroke="#6f7a48" stroke-width="2.2"/></svg>`;

// ---------- HILLS ----------
// Dense downhill strokes in the steep band round the foot of the hill: dark on the shaded
// (bottom-right) side, light on the lit side, like the hachures on an old staff map
const hachures = (rand, cx, cy, r, dark, light = "#f6f2b8", n = 150, from = 0.8, to = 1.0) => {
  let s = `<g stroke-linecap="round" fill="none">`;
  for (let i = 0; i < n; i++) {
    const a = ((i + rand() * 0.8) / n) * Math.PI * 2, k = hexShape(a);
    const r0 = r * k * (from + rand() * 0.05), r1 = r * k * (to - rand() * 0.06);
    const lit = Math.cos(a - (Math.PI * 5) / 4);
    const [c, o] = lit > 0.15 ? [light, 0.12 + lit * 0.22] : [dark, 0.3 + Math.max(0, -lit) * 0.5];
    s += `<path d="M${f(cx + Math.cos(a) * r0)},${f(cy + Math.sin(a) * r0)}L${f(cx + Math.cos(a) * r1)},${f(cy + Math.sin(a) * r1)}" stroke="${c}" stroke-width="${f(0.9 + rand() * 0.8)}" opacity="${f(o)}"/>`;
  }
  return s + "</g>";
};
// A steep hill's slope: sharp relief on a narrow blur, so the top stays flat and only the sides are lit and shaded
const steepRelief = (id) => relief(id, 4.5, 16);
// A dry, rocky hill with steep sides: khaki earth, stone outcrops and scrub
export function hill(seed = 37) {
  const rand = rng(seed);
  let b = ground("#8a9a4a", "#b0b566", "#6a7a32", seed, 0.03);
  b += `<defs><radialGradient id="rmound" cx=".42" cy=".38" r=".62"><stop offset="0" stop-color="#f2e6b0"/><stop offset=".65" stop-color="#dccc8e"/><stop offset=".88" stop-color="#bfae74"/><stop offset="1" stop-color="#7d8a42"/></radialGradient>` +
    `${mottle("rk", seed + 3, 0.06, rgb("#8c7a52"), 3)}</defs>`;
  const m = blob(0, 0, 78, 0.14, rand, 16, hexShape);
  b += `<defs><filter id="cast" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5"/></filter></defs>`;
  b += `<path d="${m}" fill="#23260c" opacity=".6" filter="url(#cast)" transform="translate(6 8)"/>`;
  b += `<defs>${steepRelief("rr")}</defs><path d="${m}" fill="url(#rmound)" filter="url(#rr)"/><clipPath id="mc"><path d="${m}"/></clipPath>`;
  b += `<g clip-path="url(#mc)"><rect x="-100" y="-100" width="200" height="200" filter="url(#rk)" opacity=".6"/></g>`;
  b += hachures(rand, 0, 0, 78, "#4a3f22", "#fbf0c4");
  b += grass(rand, 20, "#6d6a3a", 0.3, 65);
  // An outcrop of three or four stones on the top, a few loose ones, and scrub round the rim
  const stones = [];
  const [ox, oy] = [(rand() - 0.5) * 50, (rand() - 0.5) * 44];
  for (let i = 3 + Math.floor(rand() * 2); i > 0; i--) stones.push([ox + (rand() - 0.5) * 30, oy + (rand() - 0.5) * 22, 6.5 + rand() * 5]);
  for (let i = 2 + Math.floor(rand() * 3); i > 0; i--) {
    const a = rand() * Math.PI * 2, d = 20 + rand() * 30;
    stones.push([Math.cos(a) * d, Math.sin(a) * d, 4.5 + rand() * 2.5]);
  }
  stones.sort((p, q) => p[1] - q[1]).forEach(([x, y, r]) => (b += rock(x, y, r, rand, ["#5a5243", "#9a9180", "#d8d0bb"])));
  const start = rand() * Math.PI * 2;
  for (let i = 0, n = 4 + Math.floor(rand() * 3); i < n; i++) {
    const a = start + ((i + rand() * 0.6) / n) * Math.PI * 2, d = (50 + rand() * 8) * hexShape(a);
    b += bush(Math.cos(a) * d, Math.sin(a) * d, 8 + rand() * 4, "scrub", rand);
  }
  return frame(b, "#a9a25e");
}

// ---------- RIVERS ----------
// The river's centre line from edge `a` to edge `b`, as sample points; continuous across tiles
// (it leaves every edge midpoint square to the edge, and its width tapers back to the same value there)
const riverLine = (a, b, n = 48) => {
  const p0 = edgeMid(a, 1.12), p3 = edgeMid(b, 1.12);
  const opposite = (a - b + 6) % 6 === 3;
  const k = opposite ? 40 : Math.abs(((a - b + 6) % 6) - 3) === 1 ? 55 : 42;
  const [ax, ay] = edgeDir(a), [bx, by] = edgeDir(b);
  const p1 = [p0[0] - ax * k, p0[1] - ay * k], p2 = [p3[0] - bx * k, p3[1] - by * k];
  return [...Array(n + 1)].map((_, i) => {
    const t = i / n, u = 1 - t;
    return [u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0], u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]];
  });
};
// A band around the line, its half-width varying but back to `w` at both ends
const band = (line, w, amp, rand) => {
  const phase = rand() * 6, phase2 = rand() * 6;
  const left = [], right = [];
  line.forEach((p, i) => {
    const q = line[Math.min(i + 1, line.length - 1)], o = line[Math.max(i - 1, 0)];
    let nx = -(q[1] - o[1]), ny = q[0] - o[0];
    const len = Math.hypot(nx, ny); nx /= len; ny /= len;
    const t = i / (line.length - 1), taper = Math.sin(Math.PI * t);
    const wl = w + amp * taper * Math.sin(t * 9 + phase), wr = w + amp * taper * Math.sin(t * 7 + phase2);
    left.push([p[0] + nx * wl, p[1] + ny * wl]);
    right.push([p[0] - nx * wr, p[1] - ny * wr]);
  });
  return smoothOpen(left) + "L" + smoothOpen(right.reverse()).slice(1) + "Z";
};
// Deep, dark water between grey pebble banks
const RIVER = { ground: ["#94ab5e", "#b6c282", "#728b40"], bankOuter: ["#5f7a32", 31], bank: ["#a8a390", 25], water: ["#28586f", "#4f8aa5", 19], reeds: 6, stones: 110 };
// Short light streaks that follow the current
const ripples = (line, w, rand) => {
  let r = `<g fill="none" stroke="#e4f4fb" stroke-linecap="round">`;
  for (let i = 0; i < 26; i++) {
    const idx = 1 + Math.floor(rand() * (line.length - 6)), len = 2 + Math.floor(rand() * 3);
    const off = (rand() - 0.5) * 1.5 * w;
    const pts = line.slice(idx, idx + len + 1).map((p, j, a) => {
      const q = line[idx + j + 1] ?? p, o = line[idx + j - 1] ?? p;
      let nx = -(q[1] - o[1]), ny = q[0] - o[0]; const l = Math.hypot(nx, ny) || 1;
      return [p[0] + (nx / l) * off, p[1] + (ny / l) * off];
    });
    r += `<path d="${smoothOpen(pts)}" stroke-width="${f(0.6 + rand() * 0.9)}" opacity="${f(0.25 + rand() * 0.4)}"/>`;
  }
  return r + "</g>";
};
export function river(a, b, seed = 5) {
  const s = RIVER;
  const rand = rng(seed * 31 + a * 7 + b);
  const line = riverLine(a, b);
  let body = ground(...s.ground, seed, 0.03) + grass(rand, 24, "#5a7430", 0.3);
  const defs = `<linearGradient id="wg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${s.water[1]}"/><stop offset="1" stop-color="${s.water[0]}"/></linearGradient>` +
    `<filter id="rip" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="2" seed="${seed}"/><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 -3 1.35"/></filter>` +
    `<filter id="blur3" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>`;
  body += `<path d="${band(line, s.bankOuter[1], 3, rand)}" fill="${s.bankOuter[0]}" opacity=".85" filter="url(#blur3)"/>`;
  body += `<path d="${band(line, s.bank[1], 3, rand)}" fill="${s.bank[0]}"/>`;
  if (s.stones) {
    for (let i = 0; i < s.stones; i++) {
      const p = line[2 + Math.floor(rand() * (line.length - 4))], side = rand() < 0.5 ? -1 : 1;
      const q = line[line.indexOf(p) + 1];
      let nx = -(q[1] - p[1]), ny = q[0] - p[0]; const len = Math.hypot(nx, ny); nx /= len; ny /= len;
      const d = side * (s.water[2] + 1 + rand() * 4);
      const tone = ["#7d786b", "#a19c8c", "#c4bfae", "#8c8779"][Math.floor(rand() * 4)];
      body += `<ellipse cx="${f(p[0] + nx * d)}" cy="${f(p[1] + ny * d)}" rx="${f(1.5 + rand() * 2)}" ry="${f(1.2 + rand() * 1.5)}" fill="${tone}" stroke="#5a564c" stroke-width=".4"/>`;
    }
  }
  const water = band(line, s.water[2], 2.2, rand);
  body += `<path d="${water}" fill="#1c3d52" opacity=".5" transform="translate(1.2 1.6)"/>`;
  body += `<path d="${water}" fill="url(#wg)"/><clipPath id="wc"><path d="${water}"/></clipPath>`;
  body += `<g clip-path="url(#wc)"><rect x="-100" y="-100" width="200" height="200" filter="url(#rip)" opacity=".18"/>` +
    ripples(line, s.water[2], rand) +
    `<path d="${water}" fill="none" stroke="#173447" stroke-width="3" opacity=".35" transform="translate(1.5 2)"/></g>`;
  body += `<path d="${water}" fill="none" stroke="#e9f6fb" stroke-width=".8" opacity=".5" transform="translate(-.6 -.8)"/>`;
  for (let i = 0; i < s.reeds; i++) {
    const idx = 3 + Math.floor(rand() * (line.length - 6)), p = line[idx], q = line[idx + 1];
    let nx = -(q[1] - p[1]), ny = q[0] - p[0]; const len = Math.hypot(nx, ny); nx /= len; ny /= len;
    const side = rand() < 0.5 ? -1 : 1, d = side * (s.water[2] + 2 + rand() * 3);
    const x = p[0] + nx * d, y = p[1] + ny * d;
    body += `<g stroke="#4d6a22" stroke-width="1.1" stroke-linecap="round" fill="none">` +
      [-3, -1, 1, 3].map((k) => `<path d="M${f(x)},${f(y)}q${f(k * 0.6)},-4 ${f(k * 1.3)},-${f(6 + rand() * 3)}"/>`).join("") + `</g>`;
  }
  return frame(body, "#8f9a52", defs);
}

// ---------- HEDGEROWS ----------
// A line of hedge along a path: overlapping small bushes with a few taller trees
const hedgeLine = (pts, rand, { r = 6.5, trees = 0.12, pal = "hedge" } = {}) => {
  const spots = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(len / (r * 0.7));
    const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
    for (let k = 0; k < n; k++) {
      const t = (k + rand() * 0.6) / n, side = (rand() - 0.5) * r * 1.1;
      const tree = rand() < trees;
      spots.push([x0 + (x1 - x0) * t + nx * side, y0 + (y1 - y0) * t + ny * side, tree ? r * (1.5 + rand() * 0.4) : r * (0.6 + rand() * 0.55), tree ? "forest" : rand() < 0.3 ? "olive" : pal]);
    }
  }
  const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${f(x)},${f(y)}`).join("");
  let s = `<path d="${path}" fill="none" stroke="#0d1a05" stroke-width="${f(r * 2.6)}" stroke-linejoin="round" stroke-linecap="round" opacity=".35" filter="url(#soft)" transform="translate(${f(r * 0.4)} ${f(r * 0.5)})"/>`;
  s += `<path d="${path}" fill="none" stroke="#2a4a1a" stroke-width="${f(r * 1.9)}" stroke-linejoin="round" stroke-linecap="round"/>`;
  spots.sort((a, b) => a[2] - b[2]).forEach(([x, y, rr, p]) => (s += bush(x, y, rr, p, rand, p === "forest" ? 0.35 : 0)));
  return s;
};
// Fields: filled polygons with furrow patterns at different angles
const FIELDS = {
  wheat: ["#d2c27e", "#b5a45e"], pasture: ["#9ab65a", "#86a24a"], plough: ["#b49a68", "#8f7650"], hay: ["#c5c97a", "#a5aa58"],
};
const fieldDefs = (seed) => Object.entries(FIELDS).map(([k, [, line]], i) =>
  `<pattern id="fur-${k}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(${[20, -35, 65, -10][i] + seed})"><rect width="6" height="${k === "pasture" ? 0.6 : 1.5}" fill="${line}" opacity="${k === "pasture" ? 0.4 : 0.7}"/></pattern>`).join("");
const field = (pts, kind) => {
  const poly = pts.map(([x, y]) => `${f(x)},${f(y)}`).join(" ");
  return `<polygon points="${poly}" fill="${FIELDS[kind][0]}"/><polygon points="${poly}" fill="url(#fur-${kind})"/>`;
};
const inset = (k) => corners(R * k);
// Hedges crossing the hex between three fields, meeting a hedge along the top edges
export function hedgerow(seed = 53) {
  const rand = rng(seed);
  let b = ground("#8fa652", "#aebd6c", "#6f8a38", seed, 0.03);
  const k = inset(1.3), m = [6, -4];
  b += field([m, k[5], k[0], k[1]], "wheat") + field([m, k[1], k[2], k[3]], "pasture") + field([m, k[3], k[4], k[5]], "plough");
  b += `<g filter="url(#gl${seed})" opacity=".35"><rect x="-100" y="-100" width="200" height="200"/></g>`;
  const e = inset(0.9);
  b += hedgeLine([m, e[1].map((v) => v * 1.05)], rand, { r: 7 });
  b += hedgeLine([m, e[3].map((v) => v * 1.05)], rand, { r: 7 });
  b += hedgeLine([m, e[5].map((v) => v * 1.05)], rand, { r: 7 });
  const ring = inset(0.8);
  b += hedgeLine([ring[4], ring[5], ring[0], ring[1]], rand, { r: 7, trees: 0.15 });
  return frame(b, "#7f9a45", fieldDefs(seed));
}
export const TILES = { hill, river, hedgerow };
