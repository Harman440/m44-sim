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
}

/** A card looked at closely: the card, and beside it its name, rules and full text */
function CardDetails({ card, cardWidth = 170, name, tags = [], text, children }: CardDetailsProps) {
  return (
    <Box
      data-testid="card-details"
      sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "center", gap: 2, width: "100%" }}
    >
      <Box className="card-details__card" sx={{ flex: "none", "--card-width": typeof cardWidth === "number" ? `${cardWidth}px` : cardWidth }}>{card}</Box>
      <Stack sx={{ flex: "1 1 220px", minWidth: 0, maxWidth: 420, gap: 1 }}>
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
        {children && <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mt: 0.5 }}>{children}</Stack>}
      </Stack>
    </Box>
  );
}

export default CardDetails;
