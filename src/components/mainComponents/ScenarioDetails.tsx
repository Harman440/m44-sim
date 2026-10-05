import { lazy, ReactNode, Suspense, useState } from "react";
import { Box, Button, Stack, Table, TableBody, TableCell, TableHead, TableRow, ToggleButton, Typography } from "@mui/material";
import FactionInsignia from "../FactionInsignia";
import GameIcon, { GameIconName } from "../GameIcon";
import InfoButton from "../InfoButton";
import { Scenario } from "../../types/scenario";
import { FACTIONS, Faction } from "../../types/faction";
import { FACTION_LABELS } from "../../labels";
import { STARTING_COMBAT_CARDS, combatDeckEntries } from "../../data/combatCards";

// The card art is the game screen's code, left out of the menu's first download
const CombatDeckDialog = lazy(() => import("./CombatDeckDialog"));

const sideKey = (faction: Faction) => (faction === "Axis" ? "axis" : "allies");

interface ScenarioDetailsProps {
  scenario: Scenario;
  /** The side this device plays, or null before one is picked */
  faction: Faction | null;
  onPickFaction: (faction: Faction) => void;
}

/** An icon with a count beside it, e.g. the cards in the starting hand */
function IconCount({ icon, count, label, size = 26 }: { icon: GameIconName; count: number; label?: string; size?: number }) {
  return (
    <Box component="span" aria-label={label} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, whiteSpace: "nowrap" }}>
      <GameIcon name={icon} size={size} />
      <Box component="span" aria-hidden sx={{ fontWeight: 700, fontSize: "1.1rem" }}>
        {count}
      </Box>
    </Box>
  );
}

interface DetailRow {
  label: string;
  /** What the row means, behind an "i" */
  info: ReactNode;
  value: (faction: Faction) => ReactNode;
}

function detailRows(scenario: Scenario, onShowDeck: (faction: Faction) => void): DetailRow[] {
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
      label: "Cartas de combate",
      info: (
        <Stack spacing={1}>
          <Typography variant="body1">
            Cada bando tiene su mazo de cartas de combate, que se pagan con suministros, y empieza con{" "}
            {STARTING_COMBAT_CARDS} en la mano. Unas cartas las tienen los dos bandos; otras dependen del escenario:
            de si ataca o defiende, de sus unidades y las del enemigo, del mapa, de su artillería pesada y de su
            aviación. Toca el número de un bando para ver sus cartas y por qué las tiene.
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <GameIcon name="bigGuns" size={32} />
            <Typography variant="body1">Tiene artillería pesada: la carta Cortina de Fuego.</Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <GameIcon name="strafe" size={32} />
            <Typography variant="body1">Tiene aviación: Poder aéreo y Bombardeo aéreo.</Typography>
          </Stack>
        </Stack>
      ),
      value: (faction) => {
        const entries = combatDeckEntries(scenario, faction);
        const count = entries.reduce((sum, { copies }) => sum + copies, 0);
        // At a glance: whether the deck has the big guns' and the air cards
        const bigGuns = entries.some(({ reason }) => reason === "bigGuns");
        const air = entries.some(({ reason }) => reason === "air");
        const extras = [bigGuns && "artillería pesada", air && "aviación"].filter(Boolean).join(" y ");
        return (
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => onShowDeck(faction)}
            aria-label={`Ver las ${count} cartas de combate de ${FACTION_LABELS[faction]}${extras && `, con ${extras}`}`}
            sx={{ minWidth: 0, px: 1.5, gap: 1, flexWrap: "wrap" }}
          >
            <IconCount icon="cards" count={count} />
            {bigGuns && <GameIcon name="bigGuns" size={34} />}
            {air && <GameIcon name="strafe" size={34} />}
          </Button>
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
  const [deckShown, setDeckShown] = useState<Faction | null>(null);
  const picked = (f: Faction) => (f === faction ? { bgcolor: "action.selected" } : {});
  return (
    <>
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
          {detailRows(scenario, setDeckShown).map((row) => (
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
      {deckShown && (
        <Suspense fallback={null}>
          <CombatDeckDialog
            open
            onClose={() => setDeckShown(null)}
            faction={deckShown}
            entries={combatDeckEntries(scenario, deckShown)}
          />
        </Suspense>
      )}
    </>
  );
}

export default ScenarioDetails;
