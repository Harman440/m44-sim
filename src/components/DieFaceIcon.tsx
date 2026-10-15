// components/DieFaceIcon.tsx
// A die showing one face, drawn in 2D: the dice rolled when there's no WebGL, and wherever a
// face is named. Kept apart from DiceResult, so the screens that only show a face don't load the
// 3D dice.
import { useId } from "react";
import { DieFace } from "../game-core/dice";
import { UnitType } from "../game-core/unit";
import { Faction } from "../types/faction";
import { unitSprite } from "./UnitComponent";
import { iconUrl } from "./GameIcon";
import { useLabels } from "../i18n/useI18n";
import "./DieFaceIcon.css";

/** The outline of an 8-sided die, drawn as an octagon so it can't be mistaken for the normal die */
export const OCTAGON = "16,2 32,2 46,16 46,32 32,46 16,46 2,32 2,16";

/** One die showing `face`; infantry and tank faces reuse the player's unit art */
function DieFaceIcon({ face, faction, eightSided = false }: { face: DieFace; faction: Faction; eightSided?: boolean }) {
  const maskId = useId();
  const labels = useLabels();
  const symbol = (() => {
    switch (face) {
      case DieFace.INFANTRY:
        return <image href={unitSprite(faction, UnitType.INFANTRY)} x="8" y="6" width="32" height="36" />;
      case DieFace.TANK:
        return <image href={unitSprite(faction, UnitType.TANK)} x="6" y="6" width="36" height="36" />;
      case DieFace.GRENADE:
        return (
          <g>
            <ellipse cx="24" cy="29" rx="10" ry="12" fill="#4b5320" />
            <rect x="20" y="12" width="8" height="6" rx="1" fill="#333" />
            <path d="M28 14 q9 -3 6 9" stroke="#333" strokeWidth="3" fill="none" />
          </g>
        );
      case DieFace.SUPPLY:
        // The supply crate, the same icon as the counter
        return (
          <>
            <mask id={maskId} style={{ maskType: "alpha" }}>
              <image href={iconUrl("coins")} x="9" y="9" width="30" height="30" />
            </mask>
            <rect x="9" y="9" width="30" height="30" mask={`url(#${maskId})`} fill="#8d5a2b" />
          </>
        );
      case DieFace.FLAG:
        return (
          <g>
            <rect x="14" y="8" width="3" height="32" fill="#333" />
            <path d="M17 9 L38 15 L17 22 Z" fill="#c62828" />
          </g>
        );
    }
  })();

  return (
    <svg viewBox="0 0 48 48" className={eightSided ? "die die--d8" : "die"} role="img" aria-label={labels.dieFaces[face]}>
      {eightSided ? (
        <>
          <polygon className="die__face" points={OCTAGON} strokeLinejoin="round" />
          {/* "8" in the corner, so the long-range die reads as its own die */}
          <text x="40" y="44" className="die__d8-mark" textAnchor="middle">
            8
          </text>
        </>
      ) : (
        <rect className="die__face" x="2" y="2" width="44" height="44" rx="9" />
      )}
      {symbol}
    </svg>
  );
}

export default DieFaceIcon;
