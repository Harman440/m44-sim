import "./CardArt.css";

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
 * Sandbags on a hex of the SVG board: a low wall of bags curving round the
 * front of the unit token (or of the empty hex, for the enemy's), drawn over
 * the token so it shows. Sized for a 50-unit hex and scaled to `hexSize`.
 */
export function SandbagsArt({ x, y, hexSize }: { x: number; y: number; hexSize: number }) {
  const bags = 7;
  const radius = 34;
  return (
    <g className="sandbags" transform={`translate(${x} ${y}) scale(${hexSize / 50})`} pointerEvents="none" data-testid="sandbags">
      {Array.from({ length: bags }, (_, i) => {
        // From lower right to lower left, round the bottom of the token
        const angle = 25 + (130 * i) / (bags - 1);
        const rad = (angle * Math.PI) / 180;
        const cx = radius * Math.cos(rad);
        const cy = radius * Math.sin(rad);
        return (
          <ellipse
            key={i}
            cx={cx.toFixed(1)}
            cy={cy.toFixed(1)}
            rx={8}
            ry={5.2}
            transform={`rotate(${(angle - 90).toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})`}
            className="card-art__sandbag"
          />
        );
      })}
    </g>
  );
}

export default SandbagsIcon;
