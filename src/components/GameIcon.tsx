// Icons from game-icons.net (CC BY 3.0; authors credited in the README).
// Drawn as a mask so they take the surrounding text colour.
import { Box } from "@mui/material";
import cog from "../assets/icons/cog.svg";
import speaker from "../assets/icons/speaker.svg";
import speakerOff from "../assets/icons/speaker-off.svg";
import treasureMap from "../assets/icons/treasure-map.svg";
import crosshair from "../assets/icons/crosshair.svg";
import rollingDices from "../assets/icons/rolling-dices.svg";
import cardDraw from "../assets/icons/card-draw.svg";
import undo from "../assets/icons/anticlockwise-rotation.svg";
import hourglass from "../assets/icons/hourglass.svg";
import checkMark from "../assets/icons/check-mark.svg";
import cancel from "../assets/icons/cancel.svg";
import exitDoor from "../assets/icons/exit-door.svg";
import bugleCall from "../assets/icons/bugle-call.svg";
import scroll from "../assets/icons/scroll-unfurled.svg";
import save from "../assets/icons/save.svg";
import woodenCrate from "../assets/icons/wooden-crate.svg";
import fieldGun from "../assets/icons/field-gun.svg";
import airplane from "../assets/icons/airplane.svg";
import fallingBomb from "../assets/icons/falling-bomb.svg";
import crossedSwords from "../assets/icons/crossed-swords.svg";
import checkedShield from "../assets/icons/checked-shield.svg";
import battleTank from "../assets/icons/battle-tank.svg";
import mortar from "../assets/icons/mortar.svg";
import village from "../assets/icons/village.svg";
import openBook from "../assets/icons/open-book.svg";
import backForth from "../assets/icons/back-forth.svg";
import medal from "../assets/icons/medal.svg";
import type { DeckReason } from "../game-core/combatCard";

const ICONS = {
  settings: cog,
  soundOn: speaker,
  soundOff: speakerOff,
  map: treasureMap,
  fire: crosshair,
  dice: rollingDices,
  cards: cardDraw,
  undo,
  endTurn: hourglass,
  confirm: checkMark,
  cancel,
  exit: exitDoor,
  battle: bugleCall,
  history: scroll,
  download: save,
  /** The supplies ("suministros"; "coins" in the code) */
  coins: woodenCrate,
  /** Heavy artillery (Cortina de Fuego) */
  bigGuns: fieldGun,
  /** Strafing (Poder aéreo) */
  strafe: airplane,
  /** Air bombardment (Bombardeo aéreo) */
  bomb: fallingBomb,
  // Why a combat card is in the deck (DECK_REASON_ICONS)
  offensive: crossedSwords,
  defensive: checkedShield,
  tank: battleTank,
  artillery: mortar,
  town: village,
  /** The rule book */
  ruleBook: openBook,
  /** Pass and play: hand the device to the other player */
  pass: backForth,
  /** Victory medals, and the objective hexes worth one */
  medal,
} as const;

export type GameIconName = keyof typeof ICONS;

/** The icon for why a combat card is in the deck, on the card and on its group in the deck; the shared cards have none */
export const DECK_REASON_ICONS: Partial<Record<DeckReason, GameIconName>> = {
  attacker: "offensive",
  defender: "defensive",
  tanks: "tank",
  artillery: "artillery",
  towns: "town",
  bigGuns: "bigGuns",
  air: "strafe",
};

/** The icon's image, for drawing it inside an SVG (as a mask, so it takes a fill colour) */
export const iconUrl = (name: GameIconName): string => ICONS[name];

interface GameIconProps {
  name: GameIconName;
  /** CSS size; defaults to the text size */
  size?: number | string;
}

function GameIcon({ name, size = "1.25em" }: GameIconProps) {
  // Quoted: Vite inlines small SVGs as data URLs that contain quotes and spaces
  const mask = `url("${ICONS[name]}") center / contain no-repeat`;
  return (
    <Box
      component="span"
      aria-hidden
      data-icon={name}
      sx={{
        display: "inline-block",
        flexShrink: 0,
        width: size,
        height: size,
        bgcolor: "currentColor",
        mask,
        WebkitMask: mask,
      }}
    />
  );
}

export default GameIcon;
