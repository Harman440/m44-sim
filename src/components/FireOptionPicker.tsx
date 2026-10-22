import { List, ListItemButton, ListItemText, Typography } from "@mui/material";
import type { FireOptionChoice } from "../game-core/gameSession";
import { defineMessages, useLabels, useMessages, useTr } from "../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    fireOptions: "Cómo dispara",
    closeAssaultOnly: "Solo en asalto cercano",
  },
  en: {
    fireOptions: "How it fires",
    closeAssaultOnly: "Close assault only",
  },
});

interface FireOptionPickerProps {
  options: readonly FireOptionChoice[];
  /** The option picked, by id */
  selected: string;
  onSelect: (id: string) => void;
  /** The shot can only be a close assault (an option that needs one is still offered) */
  closeAssault?: boolean;
}

/**
 * How the unit fires its next shot: its fire options with their cost, one it can't pay for
 * greyed with the reason, and the picked one's description underneath (a tap, not a hover).
 * Nothing when the unit has only one way to fire
 */
function FireOptionPicker({ options, selected, onSelect, closeAssault = false }: FireOptionPickerProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  if (options.length < 2) return null;
  const picked = options.find(({ option }) => option.id === selected)?.option;

  return (
    <>
      {/* In a row that wraps, so the map keeps its room */}
      <List dense aria-label={t.fireOptions} data-testid="fire-options" sx={{ py: 0, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
        {options.map(({ option, refusal }) => (
          <ListItemButton
            key={option.id}
            disabled={refusal !== null}
            selected={option.id === selected}
            onClick={() => onSelect(option.id)}
            sx={{ minHeight: 48, borderRadius: 1, flex: "1 1 180px", border: "1px solid var(--m44-border)" }}
          >
            <ListItemText
              primary={tr(option.name)}
              secondary={[
                refusal === null ? labels.describeCost(option.cost) : labels.actionRefusals[refusal],
                option.closeAssaultOnly && !closeAssault && t.closeAssaultOnly,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          </ListItemButton>
        ))}
      </List>
      {picked && (
        <Typography variant="body2" color="text.secondary" data-testid="fire-option-text">
          {tr(picked.description)}
        </Typography>
      )}
    </>
  );
}

export default FireOptionPicker;
