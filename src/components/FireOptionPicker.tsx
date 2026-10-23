import { Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import type { FireOptionChoice } from "../game-core/gameSession";
import { defineMessages, useLabels, useMessages, useTr } from "../i18n/useI18n";
import { CostIcons } from "./SupplyIcons";

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
 * How the unit fires its next shot: one chip per fire option, its name and its cost as icons, one
 * it can't pay for greyed with the reason, and the picked one's description underneath (a tap, not
 * a hover). Kept to one line each, so the Fire button below stays in sight. Nothing when the unit
 * has only one way to fire
 */
function FireOptionPicker({ options, selected, onSelect, closeAssault = false }: FireOptionPickerProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  if (options.length < 2) return null;
  const picked = options.find(({ option }) => option.id === selected)?.option;

  return (
    <>
      {/* Chips in a row that wraps, so the map and the Fire button keep their room */}
      <ToggleButtonGroup
        exclusive
        size="small"
        value={selected}
        onChange={(_, id: string | null) => id && onSelect(id)}
        aria-label={t.fireOptions}
        data-testid="fire-options"
        sx={{ flexWrap: "wrap", gap: 0.5, border: 0, "& .MuiToggleButtonGroup-grouped": { border: "1px solid var(--m44-border)", borderRadius: 1 } }}
      >
        {options.map(({ option, refusal }) => (
          <ToggleButton
            key={option.id}
            value={option.id}
            disabled={refusal !== null}
            sx={{ minHeight: 48, px: 1, gap: 0.75, textTransform: "none", lineHeight: 1.1 }}
          >
            <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
              {tr(option.name)}
            </Typography>
            {refusal === null ? (
              <CostIcons cost={option.cost} size={16} />
            ) : (
              <Typography component="span" variant="caption" color="text.secondary">
                {labels.actionRefusals[refusal]}
              </Typography>
            )}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {picked && (
        <Stack direction="row" sx={{ gap: 0.5, flexWrap: "wrap" }}>
          <Typography variant="caption" color="text.secondary" data-testid="fire-option-text">
            {tr(picked.description)}
            {picked.closeAssaultOnly && !closeAssault && ` · ${t.closeAssaultOnly}`}
          </Typography>
        </Stack>
      )}
    </>
  );
}

export default FireOptionPicker;
