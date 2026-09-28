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

export default SandbagsIcon;
