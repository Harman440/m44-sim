/** The camouflage blotches, in a 0–24 box */
const BLOTCHES = [
  { d: "M3 9c2-4 7-5 9-2s-1 6-4 6-6-1-5-4z", fill: "#3f5a2a" },
  { d: "M12 4c3-2 8 0 9 3s-3 4-5 3-6-3-4-6z", fill: "#7a5a32" },
  { d: "M13 13c3-1 7 0 8 3s-2 5-5 5-5-2-5-4 0-3 2-4z", fill: "#2f4420" },
  { d: "M3 16c2-2 6-1 7 1s-1 4-3 4-5-3-4-5z", fill: "#8a7a45" },
];

/** The camouflage token: a round badge with blotches of green and brown (the Camouflage card) */
function CamouflageIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none" }}>
      <CamouflageBadge x={12} y={12} r={11} />
    </svg>
  );
}

/** The badge drawn inside an SVG: a disc of radius `r` centred on (x, y) */
export function CamouflageBadge({ x, y, r }: { x: number; y: number; r: number }) {
  const scale = (r * 2) / 24;
  const id = `camo-${Math.round(x)}-${Math.round(y)}`;
  return (
    <g className="camouflage-badge">
      <clipPath id={id}>
        <circle cx={x} cy={y} r={r} />
      </clipPath>
      <circle cx={x} cy={y} r={r} fill="#5f7a3a" />
      {/* Clipped outside the transform: a clip path is read in the coordinates of the group that uses it */}
      <g clipPath={`url(#${id})`}>
        <g transform={`translate(${x - r} ${y - r}) scale(${scale})`}>
          {BLOTCHES.map(({ d, fill }) => (
            <path key={d} d={d} fill={fill} />
          ))}
        </g>
      </g>
      <circle cx={x} cy={y} r={r} fill="none" stroke="#f1ead6" strokeWidth={Math.max(1, r / 6)} />
    </g>
  );
}

export default CamouflageIcon;
