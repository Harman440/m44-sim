import { Box, Chip, Stack, Typography } from "@mui/material";
import { motion } from "motion/react";
import { DieFace, countFaces } from "../game-core/dice";
import { UnitType } from "../game-core/unit";
import { Faction } from "../types/faction";
import { unitSprite } from "./UnitComponent";
import { DIE_FACE_LABELS } from "../labels";
import "./DiceResult.css";

/** The outline of an 8-sided die, drawn as an octagon so it can't be mistaken for the normal die */
const OCTAGON = "16,2 32,2 46,16 46,32 32,46 16,46 2,32 2,16";

/** One die showing `face`; infantry and tank faces reuse the player's unit art */
export function DieFaceIcon({ face, faction, eightSided = false }: { face: DieFace; faction: Faction; eightSided?: boolean }) {
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
      case DieFace.STAR:
        return (
          <polygon
            points="24,7 28.9,18.6 41.5,19.5 31.9,27.7 34.9,40 24,33.3 13.1,40 16.1,27.7 6.5,19.5 19.1,18.6"
            fill="#d4a017"
          />
        );
      case DieFace.FLAG:
        return (
          <g>
            <rect x="14" y="8" width="3" height="32" fill="#333" />
            <path d="M17 9 L38 15 L17 22 Z" fill="#c62828" />
          </g>
        );
      case DieFace.MISS:
        // A blank side: only a faint dash
        return <rect x="16" y="22.5" width="16" height="3" rx="1.5" fill="#333" opacity="0.35" />;
    }
  })();

  return (
    <svg viewBox="0 0 48 48" className="die" role="img" aria-label={DIE_FACE_LABELS[face]}>
      {eightSided ? (
        <polygon className="die__face" points={OCTAGON} strokeLinejoin="round" />
      ) : (
        <rect className="die__face" x="2" y="2" width="44" height="44" rx="9" />
      )}
      {symbol}
    </svg>
  );
}

export interface DiceRoll {
  faces: DieFace[];
  /** Changes on every roll so the dice animate again */
  id: number;
}

interface DiceResultProps {
  roll: DiceRoll;
  faction: Faction;
  /** The dice whose results are applied (indexes into the faces); the rest show as discarded. Null: all */
  kept?: readonly number[] | null;
  /** Rolled on the 8-sided long-range die */
  eightSided?: boolean;
  /** Picking the dice to apply: every die is a toggle button */
  picking?: { selected: readonly number[]; onToggle: (index: number) => void };
}

/** The faces of a roll, plus how many of each symbol are applied */
function DiceResult({ roll, faction, kept = null, eightSided = false, picking }: DiceResultProps) {
  const applied = (i: number) => (picking ? picking.selected.includes(i) : kept === null || kept.includes(i));
  const counts = countFaces(roll.faces.filter((_, i) => applied(i)));

  return (
    <Box sx={{ mt: 2 }}>
      {/* Keyed by roll so every roll replays the animation */}
      <div key={roll.id} className="dice-result" data-testid="dice-result">
        {roll.faces.map((face, i) => {
          return (
            <motion.div
              key={i}
              className={`dice-result__die${applied(i) ? "" : " dice-result__die--discarded"}`}
              initial={{ rotate: -220, y: -36, scale: 0.4, opacity: 0 }}
              animate={{ rotate: 0, y: 0, scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 18, delay: i * 0.08 }}
            >
              {picking ? (
                <button
                  type="button"
                  className="dice-result__pick"
                  aria-pressed={applied(i)}
                  aria-label={`Dado ${i + 1}: ${DIE_FACE_LABELS[face]}`}
                  onClick={() => picking.onToggle(i)}
                >
                  <DieFaceIcon face={face} faction={faction} eightSided={eightSided} />
                </button>
              ) : (
                <DieFaceIcon face={face} faction={faction} eightSided={eightSided} />
              )}
              <Typography variant="caption">
                {DIE_FACE_LABELS[face]}
                {!applied(i) && <span className="dice-result__discarded"> (descartado)</span>}
              </Typography>
            </motion.div>
          );
        })}
      </div>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mt: 1.5 }}>
        {Object.values(DieFace)
          .filter((face) => counts[face] > 0)
          .map((face) => (
            <Chip key={face} label={`${counts[face]} × ${DIE_FACE_LABELS[face]}`} />
          ))}
      </Stack>
    </Box>
  );
}

export default DiceResult;
