import { Side } from "../types/hex";

/** Which of the three sections each side lights up; a border hex lights two */
const LIT: Record<Side, readonly [boolean, boolean, boolean]> = {
  [Side.LEFT]: [true, false, false],
  [Side.LEFT_CENTER]: [true, true, false],
  [Side.CENTER]: [false, true, false],
  [Side.RIGHT_CENTER]: [false, true, true],
  [Side.RIGHT]: [false, false, true],
};

/** The board's three sections as small blocks, with the unit's section lit */
function SectionIcon({ side, label }: { side: Side; /** Read out instead of the picture */ label?: string }) {
  return (
    <svg
      width="30"
      height="14"
      viewBox="0 0 30 14"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      className="section-icon"
    >
      {LIT[side].map((lit, i) => (
        <rect
          key={i}
          x={i * 10.5}
          y={2}
          width={9}
          height={10}
          rx={1}
          fill={lit ? "var(--m44-primary)" : "var(--m44-paper-alt)"}
          stroke="var(--m44-border)"
          strokeWidth={0.5}
        />
      ))}
    </svg>
  );
}

export default SectionIcon;
