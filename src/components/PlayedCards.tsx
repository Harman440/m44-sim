import { useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import CommandCard, { Section } from "../game-core/commandCard";
import { CombatCard } from "../game-core/combatCard";
import { Faction } from "../types/faction";
import { SECTION_LABELS } from "../labels";
import CommandCardComponent from "./CommandCardComponent";
import CombatCardComponent from "./CombatCardComponent";
import CardDialog, { ShownCard } from "./CardDialog";

interface PlayedCardsProps {
  faction: Faction;
  command: CommandCard | null;
  /** The section a command card was played in, when the player chose it */
  section: Section | null;
  /** The combat card played with the orders */
  combat: CombatCard | null;
}

/**
 * The cards played this turn side by side, for the opponent to read at the
 * table; tapping one shows its full text. Sized by --card-width (PhaseLayout.css).
 */
function PlayedCards({ faction, command, section, combat }: PlayedCardsProps) {
  const [looking, setLooking] = useState<ShownCard | null>(null);

  return (
    <>
      <Box className="played-cards" data-testid="played-cards">
        {command && (
          <Stack sx={{ alignItems: "center", gap: 0.5 }}>
            <CommandCardComponent faction={faction} cardData={command} onClick={() => setLooking({ command, section })} />
            {section && <Typography variant="body2">Sección: {SECTION_LABELS[section]}</Typography>}
          </Stack>
        )}
        {combat && <CombatCardComponent faction={faction} card={combat} onClick={() => setLooking({ combat })} />}
      </Box>
      <CardDialog card={looking} faction={faction} onClose={() => setLooking(null)} label="Carta jugada" />
    </>
  );
}

export default PlayedCards;
