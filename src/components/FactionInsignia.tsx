import { Faction } from "../types/faction";
import { useLabels } from "../i18n/useI18n";

interface FactionInsigniaProps {
  faction: Faction;
  size?: number;
  /** Next to the side's name already: hide it from screen readers */
  decorative?: boolean;
}

/** Allied white star, or the German Balkenkreuz, as used on the game's pieces */
function FactionInsignia({ faction, size = 32, decorative = false }: FactionInsigniaProps) {
  const labels = useLabels();
  const a11y = decorative ? { "aria-hidden": true } : { role: "img", "aria-label": labels.factions[faction] };
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} {...a11y}>
      {faction === "Allies" ? (
        <>
          <circle cx="20" cy="20" r="19" fill="#3d5a2a" />
          <circle cx="20" cy="20" r="16" fill="#f4efe0" />
          <polygon
            points="20,6 23.4,16.2 34,16.2 25.4,22.5 28.7,32.8 20,26.4 11.3,32.8 14.6,22.5 6,16.2 16.6,16.2"
            fill="#3d5a2a"
          />
        </>
      ) : (
        <>
          <rect x="1" y="1" width="38" height="38" rx="4" fill="#5f6f80" />
          <path d="M15 5h10v10h10v10H25v10H15V25H5V15h10z" fill="#f4efe0" />
          <path d="M17 7h6v10h10v6H23v10h-6V23H7v-6h10z" fill="#111" />
        </>
      )}
    </svg>
  );
}

export default FactionInsignia;
