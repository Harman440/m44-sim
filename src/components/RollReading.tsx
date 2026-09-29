import { ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import { motion, useReducedMotion } from "motion/react";
import { DieFace } from "../game-core/dice";
import { readRoll } from "../game-core/rollResult";
import { ShotTarget } from "../data/hitRules";
import { describeFaces } from "../labels";
import GameIcon from "./GameIcon";

interface RollReadingProps {
  faces: readonly DieFace[];
  target: ShotTarget;
  /** The turn earns coins (not in the attacker's extra first turn) */
  withCoins: boolean;
  /** Seconds to wait before showing, while the dice are still landing */
  delay?: number;
}

/** An explosion: a hit */
function HitIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
      <polygon
        points="12,1 14.5,7.5 21,4.5 17.5,10.5 23,13 16.5,14.5 18.5,21.5 12,17 5.5,21.5 7.5,14.5 1,13 6.5,10.5 3,4.5 9.5,7.5"
        fill="currentColor"
      />
    </svg>
  );
}

/** A flag: a retreat */
function RetreatIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
      <rect x="5" y="2" width="2" height="20" fill="currentColor" />
      <path d="M7 3 L20 7 L7 12 Z" fill="currentColor" />
    </svg>
  );
}

function Tally({
  icon,
  value,
  label,
  color,
  testId,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  color: string;
  testId: string;
}) {
  const none = value === "0" || value === "+0";
  return (
    <Box
      data-testid={testId}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        minHeight: 40,
        px: 1.25,
        border: "2px solid",
        borderColor: none ? "divider" : color,
        borderRadius: "var(--m44-radius)",
        color: none ? "text.secondary" : color,
        opacity: none ? 0.7 : 1,
      }}
    >
      {icon}
      <Typography component="span" sx={{ fontFamily: "var(--m44-font-display)", fontSize: 26, lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography component="span" variant="body2" sx={{ color: "text.primary" }}>
        {label}
      </Typography>
    </Box>
  );
}

/** What a roll means on the table: hits, retreats and coins, by the rules in data/hitRules.ts */
function RollReading({ faces, target, withCoins, delay: rollingDelay = 0 }: RollReadingProps) {
  const { hits, retreats, coins, hitFaces } = readRoll(faces, target);
  const delay = useReducedMotion() ? 0 : rollingDelay;

  return (
    <motion.div
      initial={delay > 0 ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
    >
      <Box
        sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5 }}
        data-testid="roll-reading"
        // The faces that hit are marked on the dice; read them out here
        aria-label={hits > 0 ? `Impactos: ${describeFaces(hitFaces)}` : undefined}
        role={hits > 0 ? "group" : undefined}
      >
        <Tally
          icon={<HitIcon />}
          value={String(hits)}
          label={hits === 1 ? "impacto" : "impactos"}
          color="error.main"
          testId="roll-hits"
        />
        <Tally
          icon={<RetreatIcon />}
          value={String(retreats)}
          label={retreats === 1 ? "retirada" : "retiradas"}
          color="primary.main"
          testId="roll-retreats"
        />
        {withCoins && (
          <Tally
            icon={<GameIcon name="coins" size={22} />}
            value={`+${coins}`}
            label={coins === 1 ? "moneda" : "monedas"}
            color="warning.main"
            testId="roll-coins"
          />
        )}
      </Box>
    </motion.div>
  );
}

export default RollReading;
