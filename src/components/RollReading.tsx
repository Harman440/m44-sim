import { Box, Paper, Typography } from "@mui/material";
import { DieFace } from "../game-core/dice";
import { readRoll } from "../game-core/rollResult";
import { ShotTarget } from "../data/hitRules";
import { describeFaces, describeTarget } from "../labels";

interface RollReadingProps {
  faces: readonly DieFace[];
  target: ShotTarget;
  /** The turn earns coins (not in the attacker's extra first turn) */
  withCoins: boolean;
}

function Tally({ label, value, detail, testId }: { label: string; value: string; detail?: string; testId: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, flex: "1 1 120px", textAlign: "center" }} data-testid={testId}>
      <Typography variant="h4" component="p">
        {value}
      </Typography>
      <Typography variant="body2">{label}</Typography>
      {detail && (
        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
      )}
    </Paper>
  );
}

/** What a roll means on the table: hits, retreats and coins, by the rules in data/hitRules.ts */
function RollReading({ faces, target, withCoins }: RollReadingProps) {
  const { hits, retreats, coins, hitFaces } = readRoll(faces, target);

  return (
    <Box sx={{ mt: 1.5 }} data-testid="roll-reading">
      <Typography variant="body2" color="text.secondary">
        {describeTarget(target)}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
        <Tally
          label={hits === 1 ? "Impacto" : "Impactos"}
          value={String(hits)}
          detail={hits > 0 ? describeFaces(hitFaces) : undefined}
          testId="roll-hits"
        />
        <Tally label={retreats === 1 ? "Retirada" : "Retiradas"} value={String(retreats)} testId="roll-retreats" />
        {withCoins && (
          <Tally label={coins === 1 ? "Moneda" : "Monedas"} value={`+${coins}`} testId="roll-coins" />
        )}
      </Box>
    </Box>
  );
}

export default RollReading;
