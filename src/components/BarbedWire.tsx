// Barbed wire, drawn on the board over the hex art (it can be removed, so it
// isn't part of the scenario's board image) and as a small icon in the UI.

/**
 * A concertina coil from x0 to x1 along y: a prolate cycloid, whose loops
 * overlap like the coils of a wire roll seen from above.
 */
function coilPath(x0: number, x1: number, y: number, loops: number, radius: number): string {
  const steps = loops * 16;
  const a = (x1 - x0) / (2 * Math.PI * loops);
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI * loops;
    points.push(`${(x0 + a * t - radius * Math.sin(t)).toFixed(1)},${(y - radius * Math.cos(t) * 0.8).toFixed(1)}`);
  }
  return `M${points.join("L")}`;
}

/** A wooden cross stake holding the end of a coil */
function Stake({ x, y, size }: { x: number; y: number; size: number }) {
  const w = size * 0.75;
  const d = `M${x - w},${y - size}L${x + w},${y + size}M${x + w},${y - size}L${x - w},${y + size}`;
  return (
    <g strokeLinecap="round">
      <path d={d} stroke="#2b1c0e" strokeWidth={size * 0.6} />
      <path d={d} stroke="#9a6c3c" strokeWidth={size * 0.36} />
    </g>
  );
}

interface CoilProps {
  x0: number;
  x1: number;
  y: number;
  loops: number;
  /** The coil's radius; the strokes, barbs and stakes scale with it */
  radius: number;
  color?: string;
  /** A band of trampled earth under the coil, so it reads on light ground */
  ground?: boolean;
}

/** One coil between two stakes, with its shadow and the barbs along the wire */
function Coil({ x0, x1, y, loops, radius, color = "#2f2d28", ground = false }: CoilProps) {
  const d = coilPath(x0, x1, y, loops, radius);
  const k = radius / 7;
  const barbs: string[] = [];
  for (let x = x0 + 6 * k; x < x1 - 3 * k; x += 8 * k) {
    const b = 2.2 * k;
    barbs.push(`M${x - b},${y - b}l${2 * b},${2 * b}M${x + b},${y - b}l${-2 * b},${2 * b}`);
  }
  return (
    <g fill="none" strokeLinejoin="round">
      {ground && (
        <rect x={x0 - 4} y={y - radius * 1.1} width={x1 - x0 + 8} height={radius * 2.2} rx={radius} fill="#5b4a2c" opacity={0.35} />
      )}
      <path d={d} stroke="#000" strokeWidth={2.6 * k} opacity={0.35} transform={`translate(${1.6 * k} ${2.2 * k})`} />
      <path d={d} stroke={color} strokeWidth={2.2 * k} />
      <path d={d} stroke="#e2ddcf" strokeWidth={0.8 * k} opacity={0.85} transform={`translate(${-0.5 * k} ${-0.6 * k})`} />
      <path d={barbs.join("")} stroke={color} strokeWidth={1.3 * k} strokeLinecap="round" />
      <Stake x={x0} y={y} size={radius * 1.2} />
      <Stake x={x1} y={y} size={radius * 1.2} />
    </g>
  );
}

/**
 * Barbed wire on a hex of the SVG board: a coil along the top and one along
 * the bottom of the hex, so it still shows round a unit standing on it.
 */
export function BarbedWireArt({ x, y, hexSize }: { x: number; y: number; hexSize: number }) {
  return (
    <g className="barbed-wire" transform={`translate(${x} ${y}) scale(${hexSize / 100})`} pointerEvents="none">
      <Coil x0={-56} x1={56} y={-50} loops={6} radius={11} ground />
      <Coil x0={-56} x1={56} y={50} loops={6} radius={11} ground />
    </g>
  );
}

/** A short coil between two stakes, for the fire dialog and the map controls; the wire follows the text colour */
export function BarbedWireIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 26) / 60} viewBox="-30 -13 60 26" aria-hidden="true" style={{ flex: "none" }}>
      <Coil x0={-21} x1={21} y={0} loops={4} radius={7} color="currentColor" />
    </svg>
  );
}
