import { useMemo } from "react";
import { Box } from "@mui/material";
import Board from "../Board";
import BoardManager from "../../game-core/BoardManager";
import { Scenario } from "../../types/scenario";
import { Faction } from "../../types/faction";
import { defineMessages, useMessages } from "../../i18n/useI18n";

const TEXT = defineMessages({
  es: { map: (scenario: string) => `Mapa de ${scenario}` },
  en: { map: (scenario: string) => `Map of ${scenario}` },
});

interface ScenarioPreviewProps {
  scenario: Scenario;
  /** The side looking at the map: Axis sees it turned round, as in the game */
  faction: Faction;
}

const noop = () => {};

/**
 * The scenario's map with every unit where it starts, shown in the menu.
 * Lazy-loaded: the board pulls in the game screen's code, which the menu's first download leaves out.
 */
function ScenarioPreview({ scenario, faction }: ScenarioPreviewProps) {
  const t = useMessages(TEXT);
  const board = useMemo(() => new BoardManager(scenario, faction), [scenario, faction]);
  return (
    <Box aria-label={t.map(scenario.name)} role="img" sx={{ pointerEvents: "none", "& svg": { display: "block" } }}>
      <Board
        onTileClick={noop}
        unitHexPosition={null}
        possibleMovePositions={[]}
        possibleMoveAndFirePositions={[]}
        boardManager={board}
        orders={[]}
        backgroundImage={scenario.image}
        faction={faction}
      />
    </Box>
  );
}

export default ScenarioPreview;
