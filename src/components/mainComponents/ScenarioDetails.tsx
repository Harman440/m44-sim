import { ReactNode } from "react";
import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, ToggleButton, Typography } from "@mui/material";
import FactionInsignia from "../FactionInsignia";
import GameIcon, { GameIconName } from "../GameIcon";
import InfoButton from "../InfoButton";
import { Scenario } from "../../types/scenario";
import type { Localized } from "../../i18n/lang";
import { FACTIONS, Faction } from "../../types/faction";
import { cardsOf } from "../../game-core/actionCard";
import { defineMessages, useLabels, useMessages, useTr } from "../../i18n/useI18n";
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
    commandCardsInfo:
      "Cada bando tiene todas sus cartas de mando desde el principio y no roba ninguna: juega una por turno, o ninguna, " +
      "pagándola con suministros. Unas las tienen los dos bandos; las de la artillería pesada y la aviación dependen del escenario.",
    bigGunsInfo: "Tiene artillería pesada: la carta Cortina de Fuego.",
    airInfo: "Tiene aviación: Poder aéreo y Bombardeo aéreo.",
    cards: (count: number, extras: string) => `${count} cartas${extras && `, con ${extras}`}`,
    bigGuns: "artillería pesada",
    air: "aviación",
    and: " y ",
    sides: (scenario: string) => (scenario ? `Bandos de ${scenario}` : "Bandos"),
    victory: (medals: number) => `Victoria: ${medals} medallas`,
    victoryInfo: (medals: number) =>
      `En Pasar y jugar y contra el ordenador gana el primero que llegue a ${medals} medallas al final de un turno ` +
      "(con las mismas, se sigue jugando). Cada unidad enemiga destruida es una medalla, y cada casilla objetivo de un " +
      "bando, una medalla para él mientras una de sus unidades esté en ella al final del turno. Un bando sin unidades pierde. " +
      "En tablets propias las medallas se cuentan en la mesa.",
    destroyedOnly: "Unidades destruidas",
    fordable: "Ríos vadeables",
    fordableInfo:
      "Cualquier unidad puede entrar en un río y se para ahí; puede disparar, con un dado menos, y retirarse a él. Se dispara a ella como en campo abierto.",
    fordableValue: "Sí",
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
    commandCardsInfo:
      "Each side holds all its command cards from the start and never draws: it plays one a turn, or none, " +
      "paying for it with supplies. Some both sides have; the heavy guns' and the air cards depend on the scenario.",
    bigGunsInfo: "Has heavy guns: the Barrage card.",
    airInfo: "Has air power: Air Power and Air Bombardment.",
    cards: (count: number, extras: string) => `${count === 1 ? "1 card" : `${count} cards`}${extras && `, with ${extras}`}`,
    bigGuns: "heavy guns",
    air: "air power",
    and: " and ",
    sides: (scenario: string) => (scenario ? `Sides in ${scenario}` : "Sides"),
    victory: (medals: number) => `Victory: ${medals} medals`,
    victoryInfo: (medals: number) =>
      `In pass and play and against the computer, the first side to ${medals} medals at the end of a turn wins ` +
      "(with as many each, the game goes on). Each enemy unit destroyed is a medal, and each of a side's objective " +
      "hexes a medal for it while one of its units stands there at the end of the turn. A side with no units left loses. " +
      "On own tablets the medals are counted at the table.",
    destroyedOnly: "Units destroyed",
    fordable: "Fordable rivers",
    fordableInfo:
      "Any unit may enter a river and stops there; it may still fire, with a die fewer, and may retreat into it. It's fired at as on open ground.",
    fordableValue: "Yes",
  },
});

type Text = (typeof TEXT)["es"];

interface ScenarioDetailsProps {
  scenario: Scenario;
  /** The side this device plays, or null before one is picked */
  faction: Faction | null;
  /** Pick a side by its column header; without it the headers only name the sides (the map editor) */
  onPickFaction?: (faction: Faction) => void;
}

/** An icon with a count beside it, e.g. the cards a side holds */
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

function detailRows(
  scenario: Scenario,
  t: Text,
  labels: Labels,
  tr: (text: Localized) => string
): DetailRow[] {
  const victory = scenario.victory;
  // The medals to win, and each side's objectives besides the enemy units it destroys
  const victoryRow: DetailRow[] = victory
    ? [
        {
          label: t.victory(victory.medals),
          info: <Typography variant="body1">{t.victoryInfo(victory.medals)}</Typography>,
          value: (faction) => {
            const objectives = (victory.objectives ?? []).filter((objective) => objective.faction === faction);
            return (
              <Stack spacing={0.25} sx={{ alignItems: "center" }}>
                <Typography variant="caption" color="text.secondary">
                  {t.destroyedOnly}
                </Typography>
                {objectives.map((objective, i) => (
                  <Stack key={i} direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
                    <GameIcon name="medal" size={20} />
                    <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
                      {tr(objective.name)}
                      {objective.hexes.length > 1 && ` ×${objective.hexes.length}`}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            );
          },
        },
      ]
    : [];
  // A map-wide rule: the same for both sides
  const fordableRow: DetailRow[] = scenario.fordableRivers
    ? [
        {
          label: t.fordable,
          info: <Typography variant="body1">{t.fordableInfo}</Typography>,
          value: () => (
            <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
              {t.fordableValue}
            </Typography>
          ),
        },
      ]
    : [];
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
        <Stack spacing={1}>
          <Typography variant="body1">{t.commandCardsInfo}</Typography>
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
        const held = cardsOf(scenario, faction);
        // At a glance: whether the side has the big guns' and the air cards
        const bigGuns = held.some(({ card }) => card.needs === "bigGuns");
        const air = held.some(({ card }) => card.needs === "air");
        const extras = [bigGuns && t.bigGuns, air && t.air].filter(Boolean).join(t.and);
        return (
          <Stack
            direction="row"
            aria-label={t.cards(held.length, extras)}
            sx={{ justifyContent: "center", alignItems: "center", gap: 1, flexWrap: "wrap" }}
          >
            <IconCount icon="cards" count={held.length} />
            {bigGuns && <GameIcon name="bigGuns" size={34} />}
            {air && <GameIcon name="strafe" size={34} />}
          </Stack>
        );
      },
    },
    ...victoryRow,
    ...fordableRow,
  ];
}

/**
 * The chosen scenario's sides side by side: the column headers pick the side this
 * device plays, and the rows show what each starts with
 */
function ScenarioDetails({ scenario, faction, onPickFaction }: ScenarioDetailsProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const picked = (f: Faction) => (f === faction ? { bgcolor: "action.selected" } : {});
  return (
    <>
      <Table size="small" aria-label={t.sides(tr(scenario.name))} sx={{ tableLayout: "fixed", "& td, & th": { px: 0.75 } }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: "34%" }} />
            {FACTIONS.map((f) => (
              <TableCell key={f} align="center" sx={{ ...picked(f), pb: 1 }}>
                {onPickFaction ? (
                  <ToggleButton
                    value={f}
                    selected={f === faction}
                    onChange={() => onPickFaction(f)}
                    sx={{ width: "100%", minHeight: 56, fontSize: "1.05rem", gap: 1, flexWrap: "wrap" }}
                  >
                    <FactionInsignia faction={f} size={28} decorative />
                    {labels.factions[f]}
                  </ToggleButton>
                ) : (
                  <Stack direction="row" sx={{ justifyContent: "center", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <FactionInsignia faction={f} size={28} decorative />
                    <Typography variant="subtitle1" component="span" sx={{ fontWeight: 600 }}>
                      {labels.factions[f]}
                    </Typography>
                  </Stack>
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {detailRows(scenario, t, labels, tr).map((row) => (
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
    </>
  );
}

export default ScenarioDetails;
