import type { ReactNode } from "react";
import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, ToggleButton, Typography } from "@mui/material";
import FactionInsignia from "../FactionInsignia";
import GameIcon, { GameIconName } from "../GameIcon";
import InfoButton from "../InfoButton";
import { Scenario } from "../../types/scenario";
import { FACTIONS, Faction } from "../../types/faction";
import { FACTION_LABELS } from "../../labels";

const sideKey = (faction: Faction) => (faction === "Axis" ? "axis" : "allies");

interface ScenarioDetailsProps {
  scenario: Scenario;
  /** The side this device plays, or null before one is picked */
  faction: Faction | null;
  onPickFaction: (faction: Faction) => void;
}

/** An icon with a count beside it, e.g. the cards in the starting hand */
function IconCount({ icon, count, label, size = 26 }: { icon: GameIconName; count: number; label: string; size?: number }) {
  return (
    <Box component="span" aria-label={label} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, whiteSpace: "nowrap" }}>
      <GameIcon name={icon} size={size} />
      <Box component="span" aria-hidden sx={{ fontWeight: 700, fontSize: "1.1rem" }}>
        {count}
      </Box>
    </Box>
  );
}

const No = () => (
  <Typography variant="body2" color="text.secondary" component="span">
    No
  </Typography>
);

interface DetailRow {
  label: string;
  /** What the row means, behind an "i" */
  info: ReactNode;
  value: (faction: Faction) => ReactNode;
}

function detailRows(scenario: Scenario): DetailRow[] {
  return [
    {
      label: "Papel",
      info: (
        <Typography variant="body1">
          El bando que <strong>ataca</strong> juega un turno extra al empezar, antes de que el rival pueda
          responder. El que <strong>defiende</strong> espera ese turno y empieza en el turno 2.
        </Typography>
      ),
      value: (faction) => (
        <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
          {scenario.attacker === faction ? "Ataca" : "Defiende"}
        </Typography>
      ),
    },
    {
      label: "Cartas de mando",
      info: (
        <Typography variant="body1">
          Las cartas de mando que tiene en la mano al empezar. Cada turno juega una y en la fase final roba
          otra.
          {scenario.extraDraws &&
            ` En este escenario, ${FACTION_LABELS[scenario.extraDraws.faction]} roba 2 en vez de 1 en sus ${scenario.extraDraws.turns} primeros turnos.`}
        </Typography>
      ),
      value: (faction) => {
        const count = scenario.initialHandSize[sideKey(faction)];
        const extra = scenario.extraDraws?.faction === faction ? scenario.extraDraws : null;
        return (
          <Stack spacing={0.25} sx={{ alignItems: "center" }}>
            <IconCount icon="cards" count={count} label={`${count} cartas`} />
            {extra && (
              <Typography variant="caption" color="text.secondary">
                roba 2 en sus {extra.turns} primeros turnos
              </Typography>
            )}
          </Stack>
        );
      },
    },
    {
      label: "Artillería pesada",
      info: (
        <Typography variant="body1">
          Un bando con artillería pesada tiene en su mazo de combate la carta <strong>Cortina de Fuego</strong>:
          4 dados de ataque contra una casilla.
        </Typography>
      ),
      value: (faction) =>
        (scenario.bigGuns?.includes(faction) ?? true) ? (
          <Box component="span" aria-label="Sí" sx={{ display: "inline-flex" }}>
            <GameIcon name="bigGuns" size={40} />
          </Box>
        ) : (
          <No />
        ),
    },
    {
      label: "Aviación",
      info: (
        <Stack spacing={1}>
          <Typography variant="body1">
            Las cartas aéreas que entran en el mazo de combate, de cada una:
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <GameIcon name="strafe" size={36} />
            <Typography variant="body1">
              <strong>Poder aéreo</strong>: un ametrallamiento, 1 dado contra cada casilla de una cadena de 4.
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <GameIcon name="bomb" size={28} />
            <Typography variant="body1">
              <strong>Bombardeo aéreo</strong>: 2 dados en cada una de 2 casillas.
            </Typography>
          </Stack>
          <Typography variant="body1">Sin aviación, el enemigo domina el cielo.</Typography>
        </Stack>
      ),
      value: (faction) => {
        const air = scenario.airPower?.[sideKey(faction)] ?? 1;
        if (air === 0) return <No />;
        return (
          <Stack direction="row" spacing={1.5} sx={{ justifyContent: "center", flexWrap: "wrap" }}>
            <IconCount icon="strafe" count={air} label={`${air} Poder aéreo`} size={36} />
            <IconCount icon="bomb" count={air} label={`${air} Bombardeo aéreo`} size={30} />
          </Stack>
        );
      },
    },
  ];
}

/**
 * The chosen scenario's sides side by side: the column headers pick the side this
 * device plays, and the rows show what each starts with
 */
function ScenarioDetails({ scenario, faction, onPickFaction }: ScenarioDetailsProps) {
  const picked = (f: Faction) => (f === faction ? { bgcolor: "action.selected" } : {});
  return (
    <Table size="small" aria-label={`Bandos de ${scenario.name}`} sx={{ tableLayout: "fixed", "& td, & th": { px: 0.75 } }}>
      <TableHead>
        <TableRow>
          <TableCell sx={{ width: "34%" }} />
          {FACTIONS.map((f) => (
            <TableCell key={f} align="center" sx={{ ...picked(f), pb: 1 }}>
              <ToggleButton
                value={f}
                selected={f === faction}
                onChange={() => onPickFaction(f)}
                sx={{ width: "100%", minHeight: 56, fontSize: "1.05rem", gap: 1, flexWrap: "wrap" }}
              >
                <FactionInsignia faction={f} size={28} decorative />
                {FACTION_LABELS[f]}
              </ToggleButton>
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {detailRows(scenario).map((row) => (
          <TableRow key={row.label}>
            <TableCell component="th" scope="row">
              <Stack direction="row" sx={{ alignItems: "center" }}>
                <Typography variant="body2" color="text.secondary" component="span" sx={{ minWidth: 0 }}>
                  {row.label}
                </Typography>
                <InfoButton title={row.label}>{row.info}</InfoButton>
              </Stack>
            </TableCell>
            {FACTIONS.map((f) => (
              <TableCell key={f} align="center" sx={picked(f)}>
                {row.value(f)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default ScenarioDetails;
