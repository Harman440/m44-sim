import { useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import CommandCard, { Section } from "../game-core/commandCard";
import { CombatCard } from "../game-core/combatCard";
import { Faction } from "../types/faction";
import { Position } from "../types/scenario";
import { UnitType } from "../game-core/unit";
import { defineMessages, useLabels, useMessages } from "../i18n/useI18n";
import CommandCardComponent from "./CommandCardComponent";
import CombatCardComponent from "./CombatCardComponent";
import CardDialog, { ShownCard } from "./CardDialog";

const TEXT = defineMessages({
  es: {
    section: (name: string) => `Sección: ${name}`,
    givenTo: (unit: string) => `A: ${unit}`,
    played: "Carta jugada",
  },
  en: {
    section: (name: string) => `Section: ${name}`,
    givenTo: (unit: string) => `To: ${unit}`,
    played: "Card played",
  },
});

interface PlayedCardsProps {
  faction: Faction;
  command: CommandCard | null;
  /** The section a command card was played in, when the player chose it */
  section: Section | null;
  /** The combat cards played with the orders */
  combat: readonly CombatCard[];
  /** The ones given to a unit, and the unit */
  assignments?: readonly { card: CombatCard; unitType: UnitType; position: Position | null }[];
}

/**
 * The cards played this turn side by side, for the opponent to read at the
 * table; tapping one shows its full text. Sized by --card-width (PhaseLayout.css).
 */
function PlayedCards({ faction, command, section, combat, assignments = [] }: PlayedCardsProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const [looking, setLooking] = useState<ShownCard | null>(null);

  return (
    <>
      <Box className="played-cards" data-testid="played-cards">
        {command && (
          <Stack sx={{ alignItems: "center", gap: 0.5 }}>
            <CommandCardComponent faction={faction} cardData={command} onClick={() => setLooking({ command, section })} />
            {section && <Typography variant="body2">{t.section(labels.sections[section])}</Typography>}
          </Stack>
        )}
        {combat.map((card) => {
          const given = assignments.find((a) => a.card === card);
          return (
            <Stack key={card.id} sx={{ alignItems: "center", gap: 0.5 }}>
              <CombatCardComponent faction={faction} card={card} onClick={() => setLooking({ combat: card })} />
              {given && (
                <Typography variant="body2" data-testid="card-given-to">
                  {t.givenTo(labels.units[given.unitType])}
                </Typography>
              )}
            </Stack>
          );
        })}
      </Box>
      <CardDialog card={looking} faction={faction} onClose={() => setLooking(null)} label={t.played} />
    </>
  );
}

export default PlayedCards;
