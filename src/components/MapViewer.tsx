import { Box, Dialog, IconButton } from "@mui/material";
import type GameSession from "../game-core/gameSession";
import type { ArmyView } from "../game-core/passAndPlay";
import type { UnitStrength } from "../game-core/gameSession";
import type { BoardFog } from "./OpponentContext";
import { Faction } from "../types/faction";
import Board from "./Board";
import GameIcon from "./GameIcon";
import { defineMessages, useMessages } from "../i18n/useI18n";
import "./MapViewer.css";

const TEXT = defineMessages({
  es: { map: "Mapa", close: "Volver a la partida" },
  en: { map: "Map", close: "Back to the game" },
});

const noop = () => {};

export interface MapOnlyProps {
  session: GameSession;
  faction: Faction;
  /** The other army; left out, the game screen's (`OpponentContext`) */
  opponent?: ArmyView | null;
  /** Fog of war; left out, the game screen's */
  fog?: BoardFog | null;
  /** This side's figures; left out, the game screen's */
  strength?: readonly UnitStrength[] | null;
  /** In portrait, as tall as the board is for the width, not filling the box (the box has no set height) */
  portraitNatural?: boolean;
}

/**
 * The map alone, as it stands, to look at: zoomable, nothing to tap, no order arrows, filling the
 * box it's given with the whole board in sight
 */
export function MapOnly({ session, faction, opponent, fog, strength, portraitNatural = false }: MapOnlyProps) {
  const game = session.getSnapshot();
  return (
    <Box className={portraitNatural ? "map-only map-only--natural" : "map-only"} data-testid="map-only">
      <Board
        zoomable
        startsWhole
        onTileClick={noop}
        unitHexPosition={null}
        possibleMovePositions={[]}
        possibleMoveAndFirePositions={[]}
        boardManager={session.board}
        orders={[]}
        backgroundImage={session.scenario.image}
        faction={faction}
        opponent={opponent && { ...opponent, orders: [] }}
        fog={fog}
        strength={strength}
        camouflaged={game.camouflaged}
      />
    </Box>
  );
}

interface MapViewerProps extends Omit<MapOnlyProps, "portraitNatural"> {
  open: boolean;
  onClose: () => void;
}

/** The map over the whole screen, with every panel and button out of the way but the one that closes it */
function MapViewer({ open, onClose, ...map }: MapViewerProps) {
  const t = useMessages(TEXT);
  return (
    <Dialog fullScreen open={open} onClose={onClose} aria-label={t.map} slotProps={{ paper: { className: "map-viewer" } }}>
      {open && <MapOnly {...map} />}
      <IconButton className="map-viewer__corner" aria-label={t.close} title={t.close} onClick={onClose}>
        <GameIcon name="cancel" size={28} />
      </IconButton>
    </Dialog>
  );
}

export default MapViewer;
