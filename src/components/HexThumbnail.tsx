import { useId } from "react";
import BoardManager from "../game-core/BoardManager";
import { Position } from "../types/scenario";
import { Faction } from "../types/faction";
import { createBoardGeometry } from "./boardGeometry";

interface HexThumbnailProps {
  board: BoardManager;
  position: Position;
  /** The scenario's board art; without it the hex is drawn plain */
  image?: string;
  faction: Faction;
  /** Height in px */
  size?: number;
  /** Read out instead of the picture, e.g. the terrain */
  label?: string;
}

const HEX_SIZE = 50;

/**
 * One hex of the board, cut out of the scenario art: its terrain as the
 * player sees it on the map. Laid out exactly as `Board` lays out the image.
 */
function HexThumbnail({ board, position, image, faction, size = 28, label }: HexThumbnailProps) {
  // useId has characters that break url(#…)
  const clipId = `hex-clip-${useId().replace(/[^\w-]/g, "")}`;
  const geometry = createBoardGeometry(board.width, board.height, HEX_SIZE);
  const { width, height, imageMargin } = geometry;
  const { x, y } = geometry.hexCenter(position);
  // Pointy-top, as in Hexagon
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (i * Math.PI) / 3 + Math.PI / 2;
    return `${x + HEX_SIZE * Math.cos(angle)},${y + HEX_SIZE * Math.sin(angle)}`;
  }).join(" ");
  const halfWidth = (HEX_SIZE * Math.sqrt(3)) / 2;

  return (
    <svg
      viewBox={`${x - halfWidth - 2} ${y - HEX_SIZE - 2} ${2 * halfWidth + 4} ${2 * HEX_SIZE + 4}`}
      height={size}
      width={(size * (2 * halfWidth + 4)) / (2 * HEX_SIZE + 4)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      className="hex-thumbnail"
      style={{ flex: "none" }}
    >
      <defs>
        <clipPath id={clipId}>
          <polygon points={points} />
        </clipPath>
      </defs>
      <polygon points={points} fill="var(--m44-paper-alt)" />
      {image && (
        // The clip goes on a group: on the image itself, the Axis rotation
        // would turn the clip too, onto the hex on the other side of the board
        <g clipPath={`url(#${clipId})`}>
          <image
            href={image}
            x={imageMargin}
            y={imageMargin}
            width={width - 2 * imageMargin}
            height={height - 2 * imageMargin}
            preserveAspectRatio="xMidYMid meet"
            transform={faction === "Axis" ? `rotate(180 ${width / 2} ${height / 2})` : undefined}
          />
        </g>
      )}
      <polygon points={points} fill="none" stroke="var(--m44-border)" strokeWidth={4} />
    </svg>
  );
}

export default HexThumbnail;
