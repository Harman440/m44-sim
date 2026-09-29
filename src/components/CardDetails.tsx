import { ReactNode } from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";

interface CardDetailsProps {
  /** The card itself, drawn at `cardWidth` (pixels, or any CSS length) */
  card: ReactNode;
  cardWidth?: number | string;
  name: string;
  /** Short rule tags, as on the card */
  tags?: readonly string[];
  /** The card's full text, which the card itself may fade out */
  text: string;
  /** Buttons under the text */
  children?: ReactNode;
  /** Put the buttons in their own column beside the text (under it when there's no room), so a wide space stays short */
  actionsBeside?: boolean;
}

/** A card looked at closely: the card, and beside it its name, rules and full text */
function CardDetails({ card, cardWidth = 170, name, tags = [], text, children, actionsBeside = false }: CardDetailsProps) {
  return (
    <Box
      data-testid="card-details"
      sx={{ display: "flex", flexWrap: "wrap", alignItems: actionsBeside ? "center" : "flex-start", justifyContent: "center", gap: 2, width: "100%" }}
    >
      <Box className="card-details__card" sx={{ flex: "none", "--card-width": typeof cardWidth === "number" ? `${cardWidth}px` : cardWidth }}>{card}</Box>
      <Stack sx={{ flex: "1 1 220px", minWidth: 0, maxWidth: actionsBeside ? 560 : 420, gap: 1 }}>
        {/* The card drawn beside it already has the name as a heading */}
        <Typography variant="h6" component="p">
          {name}
        </Typography>
        {tags.length > 0 && (
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5 }}>
            {tags.map((tag) => (
              <Chip key={tag} label={tag} size="small" variant="outlined" />
            ))}
          </Stack>
        )}
        <Typography variant="body1">{text}</Typography>
        {children && !actionsBeside && <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mt: 0.5 }}>{children}</Stack>}
      </Stack>
      {children && actionsBeside && (
        <Stack sx={{ flex: "0 1 220px", minWidth: 180, gap: 1, "& > .MuiButton-root": { width: "100%" } }}>{children}</Stack>
      )}
    </Box>
  );
}

export default CardDetails;
