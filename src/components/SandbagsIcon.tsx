import "./CardArt.css";
import sandbagsImage from "../assets/pieces/sandbags.webp";

/** A small wall of sandbags, drawn like the ones on the Fortificar card */
function SandbagsIcon({ size = 36 }: { size?: number }) {
  const bags = [
    // bottom row, then the row on top
    { cx: 7, cy: 21 },
    { cx: 18, cy: 21 },
    { cx: 29, cy: 21 },
    { cx: 12.5, cy: 13 },
    { cx: 23.5, cy: 13 },
  ];
  return (
    <svg width={size} height={(size * 28) / 36} viewBox="0 0 36 28" aria-hidden="true" style={{ flex: "none" }}>
      {bags.map(({ cx, cy }) => (
        <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx={6} ry={4.2} className="card-art__sandbag" />
      ))}
    </svg>
  );
}

/**
 * Sandbags on a hex of the SVG board: the sandbags piece, along the two top
 * edges of the hex, facing the enemy (each side sees it at the top of its map),
 * drawn over the token. Its image is the hex's box, with the piece where it sits.
 * `turned`: the sandbags of the side the map isn't seen from, whose enemy is at
 * the bottom, along the two bottom edges.
 */
export function SandbagsArt({ x, y, hexSize, turned = false }: { x: number; y: number; hexSize: number; turned?: boolean }) {
  const width = hexSize * Math.sqrt(3);
  const height = hexSize * 2;
  return (
    <image
      className="sandbags"
      href={sandbagsImage}
      x={x - width / 2}
      y={y - height / 2}
      width={width}
      height={height}
      preserveAspectRatio="none"
      transform={turned ? `rotate(180 ${x} ${y})` : undefined}
      pointerEvents="none"
      data-testid="sandbags"
    />
  );
}

export default SandbagsIcon;
