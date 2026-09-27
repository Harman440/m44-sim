import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import CommandCard from "../game-core/commandCard";
import { OrderSummary } from "../game-core/turnSummary";
import { SECTION_LABELS, TERRAIN_LABELS, UNIT_LABELS, describeFaces, describeRoll } from "../labels";
import { readRoll } from "../game-core/rollResult";
import { Faction } from "../types/faction";
import OrderToken from "./OrderToken";
import GameIcon from "./GameIcon";
import Stamp from "./Stamp";

interface TurnSummaryProps {
  card: CommandCard | null;
  summaries: readonly OrderSummary[];
  faction: Faction;
  /** Open the fire dialog for a unit: to fire, or to see the shot it fired */
  onFire?: (summary: OrderSummary) => void;
  /** Rolls earn coins this turn (not in the attacker's extra first turn) */
  withCoins?: boolean;
  /** Give up the unfired shots of the units that didn't move, so the moved units can fire */
  onSkipUnmoved?: () => void;
}

/** Battle order: units that didn't move fire first */
const GROUPS = [
  { hold: true, title: "Sin mover", hint: "Disparan primero.", testId: "group-unmoved" },
  { hold: false, title: "Movidas", hint: "Disparan después de las unidades sin mover.", testId: "group-moved" },
] as const;

const describeMove = (summary: OrderSummary) =>
  summary.closeAssaultOnly
    ? "En asalto cercano"
    : summary.hold
    ? "Mantiene posición"
    : `Avanza ${summary.hexesMoved} ${summary.hexesMoved === 1 ? "casilla" : "casillas"} → ${
        TERRAIN_LABELS[summary.destinationTerrain]
      }`;

/** This turn's orders, written for carrying them out on the physical table */
function TurnSummary({ card, summaries, faction, onFire, withCoins = true, onSkipUnmoved }: TurnSummaryProps) {
  const toFire = summaries.filter((s) => s.shots.length === 0 && s.shotsLeft > 0).length;
  const fired = summaries.filter((s) => s.shots.length > 0).length;
  const notFiring = summaries.filter((s) => !s.canFire && !s.removed).length;
  const waiting = summaries.filter((s) => s.waiting).length;
  // Skipping only matters while a moved unit is kept waiting by them
  const skippable = waiting > 0;

  const renderSummary = (summary: OrderSummary) => (
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
      <OrderToken orderIndex={summary.index} unitType={summary.unitType} faction={faction} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body1">
          {UNIT_LABELS[summary.unitType]} · {SECTION_LABELS[summary.section]}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {describeMove(summary)}
        </Typography>
        {summary.shots.length > 0 && (
          <Typography variant="body2" color="success.main">
            Disparó:{" "}
            {summary.shots
              .map(
                (shot) =>
                  `${shot.collision ? "choque, " : ""}${describeFaces(shot.faces)}${
                    shot.dice > 0 ? ` → ${describeRoll(readRoll(shot.faces, shot.target), withCoins)}` : ""
                  }`
              )
              .join(" / ")}
          </Typography>
        )}
      </Box>
      {summary.removed && <Chip label="Eliminada" variant="outlined" />}
      {summary.shots.length > 0 && <Stamp angle={-7}>Disparó</Stamp>}
      {summary.shots.length > 0 && onFire ? (
        <Button variant="outlined" onClick={() => onFire(summary)} startIcon={<GameIcon name="dice" />}>
          Ver tirada
        </Button>
      ) : summary.removed ? null : summary.waiting ? (
        <Chip label="Espera" variant="outlined" />
      ) : summary.shotsLeft > 0 && onFire ? (
        <Button color="success" onClick={() => onFire(summary)} startIcon={<GameIcon name="fire" />}>
          Disparar
        </Button>
      ) : summary.skipped ? (
        <Chip label="Sin disparo" variant="outlined" />
      ) : summary.canFire ? (
        <Chip label="Dispara" color="success" />
      ) : (
        <Chip label="No dispara" color="warning" variant="outlined" />
      )}
    </Box>
  );

  return (
    <Paper variant="outlined" sx={{ p: 2, width: "100%" }}>
      <Typography variant="h5" component="h3">Parte de combate</Typography>
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
          {card?.closeAssaultOnly
            ? "Marca las unidades en asalto cercano para que disparen."
            : "No se dieron órdenes este turno."}
        </Typography>
      ) : (
        <>
          <Typography variant="body2" sx={{ mb: 1 }} data-testid="fire-count">
            {toFire} por disparar · {fired} {fired === 1 ? "disparó" : "dispararon"} · {notFiring}{" "}
            {notFiring === 1 ? "no puede disparar" : "no pueden disparar"}
          </Typography>
          {GROUPS.map((group) => {
            const members = summaries.filter((s) => s.hold === group.hold);
            if (members.length === 0) return null;
            return (
              <Box key={group.title} component="section" sx={{ mt: 2 }} data-testid={group.testId}>
                <Typography variant="h6" component="h4">
                  {group.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {group.hint}
                </Typography>
                <Stack component="ol" sx={{ listStyle: "none", p: 0, m: 0, mt: 1, gap: 1 }}>
                  {members.map(renderSummary)}
                </Stack>
                {!group.hold && waiting > 0 && (
                  <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                    Esperan a que disparen todas las unidades sin mover.
                  </Typography>
                )}
                {group.hold && skippable && onSkipUnmoved && (
                  <Button variant="outlined" color="warning" onClick={onSkipUnmoved} sx={{ mt: 1 }}>
                    Pasar a las unidades movidas
                  </Button>
                )}
              </Box>
            );
          })}
        </>
      )}
    </Paper>
  );
}

export default TurnSummary;
