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
} as const;

export type GameIconName = keyof typeof ICONS;

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
