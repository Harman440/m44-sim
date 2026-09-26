import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import CommandCard from "../game-core/commandCard";
import { OrderSummary } from "../game-core/turnSummary";
import { orderColor } from "./OrderComponent";
import { SECTION_LABELS, TERRAIN_LABELS, UNIT_LABELS } from "./labels";

interface TurnSummaryProps {
  card: CommandCard | null;
  summaries: readonly OrderSummary[];
  /** Open the fire questionnaire for a unit that can fire */
  onFire?: (summary: OrderSummary) => void;
}

const describeMove = (summary: OrderSummary) =>
  summary.hold
    ? "Mantiene posición"
    : `Avanza ${summary.hexesMoved} ${summary.hexesMoved === 1 ? "casilla" : "casillas"} → ${
        TERRAIN_LABELS[summary.destinationTerrain]
      }`;

/** This turn's orders, written for carrying them out on the physical table */
function TurnSummary({ card, summaries, onFire }: TurnSummaryProps) {
  const firing = summaries.filter((s) => s.canFire && !s.removed).length;
  const notFiring = summaries.filter((s) => !s.canFire && !s.removed).length;

  return (
    <Paper variant="outlined" sx={{ p: 2, width: "100%" }}>
      <Typography variant="h6">Resumen del turno</Typography>
      {card && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="body1">Carta jugada: {card.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {card.description}
          </Typography>
        </Box>
      )}

      {summaries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No se dieron órdenes este turno.
        </Typography>
      ) : (
        <>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {firing} {firing === 1 ? "unidad dispara" : "unidades disparan"} · {notFiring}{" "}
            {notFiring === 1 ? "no puede disparar" : "no pueden disparar"}
          </Typography>
          <Stack component="ol" sx={{ listStyle: "none", p: 0, m: 0, gap: 1 }}>
            {summaries.map((summary) => (
              <Box
                component="li"
                key={summary.index}
                data-testid="order-summary"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  py: 1,
                  borderTop: "1px solid",
                  borderColor: "divider",
                  opacity: summary.removed ? 0.6 : 1,
                }}
              >
                {/* Same colour as this order's arrow on the map */}
                <Box
                  sx={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    flexShrink: 0,
                    bgcolor: orderColor(summary.index),
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body1">
                    {UNIT_LABELS[summary.unitType]} · {SECTION_LABELS[summary.section]}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {describeMove(summary)}
                  </Typography>
                </Box>
                {summary.removed ? (
                  <Chip label="Eliminada" variant="outlined" />
                ) : summary.canFire && onFire ? (
                  <Button color="success" onClick={() => onFire(summary)}>
                    Disparar
                  </Button>
                ) : summary.canFire ? (
                  <Chip label="Dispara" color="success" />
                ) : (
                  <Chip label="No dispara" color="warning" variant="outlined" />
                )}
              </Box>
            ))}
          </Stack>
        </>
      )}
    </Paper>
  );
}

export default TurnSummary;
