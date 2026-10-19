import { useContext, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import FactionInsignia from "./FactionInsignia";
import GameIcon from "./GameIcon";
import { VictoryContext, VictoryInfo } from "./VictoryContext";
import { FACTIONS, Faction } from "../types/faction";
import { includesPosition } from "../game-core/position";
import { defineMessages, useLabels, useMessages, useTr } from "../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    label: (allies: number, axis: number, medals: number) => `Medallas: Aliados ${allies}, Eje ${axis}, de ${medals} para ganar`,
    title: "Medallas",
    goal: (medals: number) =>
      `Gana el primero que llegue a ${medals} medallas al final de un turno; si los dos llegan, el que tenga más, y con las mismas se sigue jugando. Un bando sin unidades pierde.`,
    destroyed: "Unidades enemigas destruidas",
    objectives: "Objetivos que ocupa",
    total: "Total",
    objectiveList: "Objetivos",
    held: (count: number, of: number) => `ocupa ${count} de ${of}`,
    objectiveRule: "Cada casilla objetivo es una medalla para su bando mientras una de sus unidades esté en ella al final del turno.",
    close: "Cerrar",
  },
  en: {
    label: (allies: number, axis: number, medals: number) => `Medals: Allies ${allies}, Axis ${axis}, of ${medals} to win`,
    title: "Medals",
    goal: (medals: number) =>
      `The first side to ${medals} medals at the end of a turn wins; if both get there, the one with more, and with as many each the game goes on. A side with no units left loses.`,
    destroyed: "Enemy units destroyed",
    objectives: "Objectives held",
    total: "Total",
    objectiveList: "Objectives",
    held: (count: number, of: number) => `holds ${count} of ${of}`,
    objectiveRule: "Each objective hex is a medal for its side while one of its units stands on it at the end of the turn.",
    close: "Close",
  },
});

/** The medals each side has and how many win; the breakdown in a dialog */
export function MedalBreakdown({ victory }: { victory: VictoryInfo }) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const rows: [string, (side: Faction) => number][] = [
    [t.destroyed, (side) => victory.standing[side].destroyed],
    [t.objectives, (side) => victory.standing[side].objectives],
    [t.total, (side) => victory.standing[side].total],
  ];
  return (
    <Stack spacing={2}>
      <Typography variant="body1">{t.goal(victory.medals)}</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell />
            {FACTIONS.map((side) => (
              <TableCell key={side} align="center">
                <Stack direction="row" sx={{ alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                  <FactionInsignia faction={side} size={22} decorative />
                  {labels.factions[side]}
                </Stack>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(([label, value]) => (
            <TableRow key={label}>
              <TableCell>{label}</TableCell>
              {FACTIONS.map((side) => (
                <TableCell key={side} align="center" sx={{ fontWeight: label === t.total ? 700 : 400 }}>
                  {value(side)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {victory.objectives.length > 0 && (
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">{t.objectiveList}</Typography>
          {victory.objectives.map((objective, i) => {
            const held = objective.hexes.filter((hex) => includesPosition(victory.held[objective.faction], hex)).length;
            return (
              <Stack key={i} direction="row" sx={{ alignItems: "center", gap: 1 }}>
                <FactionInsignia faction={objective.faction} size={20} decorative />
                <Typography variant="body2">
                  {tr(objective.name)} · {t.held(held, objective.hexes.length)}
                </Typography>
              </Stack>
            );
          })}
          <Typography variant="body2" color="text.secondary">
            {t.objectiveRule}
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}

/**
 * Pass and play: the medals each side has, out of the scenario's, as a button that opens the
 * breakdown. Nothing outside a match with victory conditions
 */
function MedalTally() {
  const victory = useContext(VictoryContext);
  const t = useMessages(TEXT);
  const [open, setOpen] = useState(false);
  if (!victory) return null;
  const { Allies, Axis } = victory.standing;
  return (
    <>
      <Button
        variant="outlined"
        color="inherit"
        onClick={() => setOpen(true)}
        aria-label={t.label(Allies.total, Axis.total, victory.medals)}
        data-testid="medal-tally"
        sx={{ gap: 0.75, px: 1, minWidth: 0 }}
      >
        <GameIcon name="medal" size={24} />
        {FACTIONS.map((side) => (
          <Box key={side} component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, fontWeight: 700 }}>
            <FactionInsignia faction={side} size={18} decorative />
            {victory.standing[side].total}
          </Box>
        ))}
        <Box component="span" sx={{ color: "text.secondary" }}>
          /{victory.medals}
        </Box>
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t.title}</DialogTitle>
        <DialogContent>
          <MedalBreakdown victory={victory} />
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setOpen(false)}>
            {t.close}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default MedalTally;
