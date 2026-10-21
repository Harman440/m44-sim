import { useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { motion } from "motion/react";
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

/** The Command Zone's tray and the orders screen share layoutIds with this prefix, so a played card flies between them */
export const PLAY_LAYOUT_PREFIX = "play-";
/** How a played card flies between the tray and the orders screen: slow enough to follow */
export const PLAY_FLIGHT = { type: "spring", stiffness: 140, damping: 22 } as const;

interface PlayedCardsProps {
  faction: Faction;
  command: CommandCard | null;
  /** The section a command card was played in, when the player chose it */
  section: Section | null;
  /** The sections variant: every command card played this turn, each with its section; shown instead of `command` */
  plays?: readonly { card: CommandCard; section: Section }[];
  /** The combat cards played with the orders */
  combat: readonly CombatCard[];
  /** The ones given to a unit, and the unit */
  assignments?: readonly { card: CombatCard; unitType: UnitType; position: Position | null }[];
  /**
   * Each card's motion `layoutId` is this plus its id: a card with the same
   * layoutId on the screen before (the Command Zone's tray) flies here
   */
  layoutPrefix?: string;
  className?: string;
}

/**
 * The cards played this turn side by side, for the opponent to read at the
 * table; tapping one shows its full text. Sized by --card-width (PhaseLayout.css).
 */
function PlayedCards({ faction, command, section, plays = [], combat, assignments = [], layoutPrefix, className }: PlayedCardsProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const [looking, setLooking] = useState<ShownCard | null>(null);

  return (
    <>
      <Box className={`played-cards${className ? ` ${className}` : ""}`} data-testid="played-cards">
        {(plays.length > 0 ? plays : command ? [{ card: command, section }] : []).map(({ card, section: played }) => (
          <Stack key={card.id} sx={{ alignItems: "center", gap: 0.5 }}>
            <motion.div layoutId={layoutPrefix && `${layoutPrefix}${card.id}`} transition={PLAY_FLIGHT}>
              <CommandCardComponent faction={faction} cardData={card} onClick={() => setLooking({ command: card, section: played })} />
            </motion.div>
            {played && <Typography variant="body2">{t.section(labels.sections[played])}</Typography>}
          </Stack>
        ))}
        {combat.map((card) => {
          const given = assignments.find((a) => a.card === card);
          return (
            <Stack key={card.id} sx={{ alignItems: "center", gap: 0.5 }}>
              <motion.div layoutId={layoutPrefix && `${layoutPrefix}combat-${card.id}`} transition={PLAY_FLIGHT}>
                <CombatCardComponent faction={faction} card={card} onClick={() => setLooking({ combat: card })} />
              </motion.div>
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
