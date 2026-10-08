import { lazy, ReactNode, Suspense, useState } from "react";
import { Box, Button, Stack, Table, TableBody, TableCell, TableHead, TableRow, ToggleButton, Typography } from "@mui/material";
import FactionInsignia from "../FactionInsignia";
import GameIcon, { GameIconName } from "../GameIcon";
import InfoButton from "../InfoButton";
import { Scenario } from "../../types/scenario";
import { FACTIONS, Faction } from "../../types/faction";
import { STARTING_COMBAT_CARDS, combatDeckEntries } from "../../data/combatCards";
import { defineMessages, useLabels, useMessages } from "../../i18n/useI18n";
import type { Labels } from "../../labels";

const TEXT = defineMessages({
  es: {
    role: "Papel",
    roleInfo: (
      <>
        El bando que <strong>ataca</strong> juega un turno extra al empezar, antes de que el rival pueda
        responder. El que <strong>defiende</strong> espera ese turno y empieza en el turno 2.
      </>
    ),
    attacks: "Ataca",
    defends: "Defiende",
    commandCards: "Cartas de mando",
    commandCardsInfo: "Las cartas de mando que tiene en la mano al empezar. Cada turno juega una y en la fase final roba otra.",
    extraDrawsInfo: (faction: string, turns: number) =>
      ` En este escenario, ${faction} roba 2 en vez de 1 en sus ${turns} primeros turnos.`,
    cards: (count: number) => `${count} cartas`,
    extraDraws: (turns: number) => `roba 2 en sus ${turns} primeros turnos`,
    combatCards: "Cartas de combate",
    combatCardsInfo: (starting: number) =>
      `Cada bando tiene su mazo de cartas de combate, que se pagan con suministros, y empieza con ${starting} en la mano. ` +
      "Unas cartas las tienen los dos bandos; otras dependen del escenario: de si ataca o defiende, de sus unidades " +
      "y las del enemigo, del mapa, de su artillería pesada y de su aviación. Toca el número de un bando para ver " +
      "sus cartas y por qué las tiene.",
    bigGunsInfo: "Tiene artillería pesada: la carta Cortina de Fuego.",
    airInfo: "Tiene aviación: Poder aéreo y Bombardeo aéreo.",
    bigGuns: "artillería pesada",
    air: "aviación",
    and: " y ",
    seeDeck: (count: number, faction: string, extras: string) =>
      `Ver las ${count} cartas de combate de ${faction}${extras && `, con ${extras}`}`,
    sides: (scenario: string) => `Bandos de ${scenario}`,
  },
  en: {
    role: "Role",
    roleInfo: (
      <>
        The side that <strong>attacks</strong> plays an extra turn at the start, before the enemy can
        answer. The side that <strong>defends</strong> waits out that turn and starts on turn 2.
      </>
    ),
    attacks: "Attacks",
    defends: "Defends",
    commandCards: "Command cards",
    commandCardsInfo: "The command cards in its hand at the start. Each turn it plays one and draws another in the final phase.",
    extraDrawsInfo: (faction: string, turns: number) =>
      ` In this scenario, the ${faction} draw 2 instead of 1 in their first ${turns} turns.`,
    cards: (count: number) => (count === 1 ? "1 card" : `${count} cards`),
    extraDraws: (turns: number) => `draws 2 in its first ${turns} turns`,
    combatCards: "Combat cards",
    combatCardsInfo: (starting: number) =>
      `Each side has its own deck of combat cards, paid for with supplies, and starts with ${starting} in its hand. ` +
      "Some cards both sides have; others depend on the scenario: whether the side attacks or defends, its units " +
      "and the enemy's, the map, its heavy guns and its air power. Tap a side's number to see its cards and why it has them.",
    bigGunsInfo: "Has heavy guns: the Barrage card.",
    airInfo: "Has air power: Air Power and Air Bombardment.",
    bigGuns: "heavy guns",
    air: "air power",
    and: " and ",
    seeDeck: (count: number, faction: string, extras: string) =>
      `See the ${count} combat cards of the ${faction}${extras && `, with ${extras}`}`,
    sides: (scenario: string) => `Sides in ${scenario}`,
  },
});

type Text = (typeof TEXT)["es"];

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

function detailRows(scenario: Scenario, onShowDeck: (faction: Faction) => void, t: Text, labels: Labels): DetailRow[] {
  return [
    {
      label: t.role,
      info: <Typography variant="body1">{t.roleInfo}</Typography>,
      value: (faction) => (
        <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
          {scenario.attacker === faction ? t.attacks : t.defends}
        </Typography>
      ),
    },
    {
      label: t.commandCards,
      info: (
        <Typography variant="body1">
          {t.commandCardsInfo}
          {scenario.extraDraws && t.extraDrawsInfo(labels.factions[scenario.extraDraws.faction], scenario.extraDraws.turns)}
        </Typography>
      ),
      value: (faction) => {
        const count = scenario.initialHandSize[sideKey(faction)];
        const extra = scenario.extraDraws?.faction === faction ? scenario.extraDraws : null;
        return (
          <Stack spacing={0.25} sx={{ alignItems: "center" }}>
            <IconCount icon="cards" count={count} label={t.cards(count)} />
            {extra && (
              <Typography variant="caption" color="text.secondary">
                {t.extraDraws(extra.turns)}
              </Typography>
            )}
          </Stack>
        );
      },
    },
    {
      label: t.combatCards,
      info: (
        <Stack spacing={1}>
          <Typography variant="body1">{t.combatCardsInfo(STARTING_COMBAT_CARDS)}</Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <GameIcon name="bigGuns" size={32} />
            <Typography variant="body1">{t.bigGunsInfo}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <GameIcon name="strafe" size={32} />
            <Typography variant="body1">{t.airInfo}</Typography>
          </Stack>
        </Stack>
      ),
      value: (faction) => {
        const entries = combatDeckEntries(scenario, faction);
        const count = entries.reduce((sum, { copies }) => sum + copies, 0);
        // At a glance: whether the deck has the big guns' and the air cards
        const bigGuns = entries.some(({ reason }) => reason === "bigGuns");
        const air = entries.some(({ reason }) => reason === "air");
        const extras = [bigGuns && t.bigGuns, air && t.air].filter(Boolean).join(t.and);
        return (
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => onShowDeck(faction)}
            aria-label={t.seeDeck(count, labels.factions[faction], extras)}
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
  const t = useMessages(TEXT);
  const labels = useLabels();
  const [deckShown, setDeckShown] = useState<Faction | null>(null);
  const picked = (f: Faction) => (f === faction ? { bgcolor: "action.selected" } : {});
  return (
    <>
      <Table size="small" aria-label={t.sides(scenario.name)} sx={{ tableLayout: "fixed", "& td, & th": { px: 0.75 } }}>
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
                  {labels.factions[f]}
                </ToggleButton>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {detailRows(scenario, setDeckShown, t, labels).map((row) => (
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
