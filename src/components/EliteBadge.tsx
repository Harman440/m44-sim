import React from "react";

interface EliteBadgeProps {
  /** Centre of the badge when drawn inside the board SVG */
  x?: number;
  y?: number;
  size?: number;
  title: string;
}

/** A compact dark medallion with a bright star, legible over both terrain and unit art. */
function EliteBadge({ x = 0, y = 0, size = 22, title }: EliteBadgeProps) {
  const half = size / 2;
  const star = Array.from({ length: 10 }, (_, i) => {
    const radius = (i % 2 === 0 ? 0.34 : 0.15) * size;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(half + radius * Math.cos(angle)).toFixed(2)},${(half + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");

  return (
    <svg
      x={x - half}
      y={y - half}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={title}
      focusable="false"
      data-testid="elite-badge"
    >
      <title>{title}</title>
      <circle cx={half} cy={half} r={half - 1} fill="#211d16" stroke="#f7f0dc" strokeWidth={1.6} />
      <circle cx={half} cy={half} r={half - 3} fill="#a87312" stroke="#211d16" strokeWidth={0.8} />
      <polygon points={star} fill="#fff1a6" stroke="#33240b" strokeWidth={1} strokeLinejoin="round" />
    </svg>
  );
}

export default EliteBadge;
