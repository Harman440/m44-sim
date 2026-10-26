import type { ReactNode } from "react";
import { Box, LinearProgress, Typography } from "@mui/material";

interface StatBarProps {
  /** Before the bar: an icon (or a short name) */
  icon: ReactNode;
  value: number;
  /** A full bar; 0 shows an empty one */
  max: number;
  /** Read by screen readers, with the numbers */
  label: string;
  /** What's written after the bar; by default "value/max" */
  text?: string;
  /** The bar's colour; red when it's empty, by default */
  color?: "primary" | "secondary" | "success" | "warning" | "error" | "info";
}

/** One amount as a bar between its icon and its number: a unit's morale, how many dice showed a face */
function StatBar({ icon, value, max, label, text, color }: StatBarProps) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const empty = value <= 0;
  return (
    <Box role="img" aria-label={label} sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }} data-testid="stat-bar">
      <Box sx={{ display: "inline-flex", flex: "none", color: empty ? "error.main" : "text.secondary" }}>{icon}</Box>
      <LinearProgress
        variant="determinate"
        value={percent}
        color={color ?? (empty ? "error" : percent <= 25 ? "warning" : "primary")}
        sx={{ flex: 1, minWidth: 32, height: 8, borderRadius: 1 }}
      />
      <Typography
        component="span"
        variant="caption"
        sx={{ flex: "none", minWidth: "2.5em", textAlign: "right", fontWeight: 700, lineHeight: 1, color: empty ? "error.main" : "text.secondary" }}
      >
        {text ?? `${value}/${max}`}
      </Typography>
    </Box>
  );
}

export default StatBar;
