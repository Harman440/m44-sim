import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import GameSession from "../game-core/gameSession";
import { TurnRecord } from "../game-core/turnLog";
import { Position } from "../types/scenario";
import { SECTION_LABELS, TERRAIN_LABELS, UNIT_LABELS, describeFaces, describeRoll, describeTarget } from "../labels";
import { readRoll } from "../game-core/rollResult";
import { downloadJson } from "../download";
import { orderColor } from "./OrderComponent";
import GameIcon from "./GameIcon";

interface HistoryDialogProps {
  open: boolean;
  onClose: () => void;
  session: GameSession;
  /** Finished turns, oldest first (from the snapshot) */
  log: readonly TurnRecord[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function HistoryDialog({ open, onClose, session, log }: HistoryDialogProps) {
  const { scenario, faction } = session;
  const filePrefix = `m44-${scenario.id}-${faction === "Axis" ? "eje" : "aliados"}`;

  /** "bosque, centro": terrain never changes, so the board can describe past positions */
  const describePlace = (position: Position) => {
    const hex = session.board.getHex(position);
    return hex ? `${TERRAIN_LABELS[hex.getType()]}, ${SECTION_LABELS[hex.getSide()]}` : "fuera del mapa";
  };

  const exportGame = () =>
    downloadJson(`${filePrefix}-partida-turno-${session.getSnapshot().turn}.json`, session.save());
  const exportTurn = (record: TurnRecord) => downloadJson(`${filePrefix}-turno-${record.turn}.json`, record);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle>Historial</DialogTitle>
      <DialogContent dividers>
        <Stack sx={{ gap: 2 }}>
          {log.length === 0 && (
            <Typography color="text.secondary">Aún no ha terminado ningún turno.</Typography>
          )}
          {[...log].reverse().map((record) => (
            <Paper component="section" variant="outlined" key={record.turn} sx={{ p: 2 }} data-testid="turn-record">
              <Box
                sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1 }}
              >
                <Box>
                  <Typography variant="h6" component="h3">
                    Turno {record.turn}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Carta: {record.card.name}
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={<GameIcon name="download" />}
                  onClick={() => exportTurn(record)}
                  aria-label={`Exportar turno ${record.turn}`}
                >
                  Exportar turno
                </Button>
              </Box>

              <Typography variant="subtitle2" component="h4" sx={{ mt: 1.5 }}>
                Órdenes
              </Typography>
              {record.orders.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No se dieron órdenes.
                </Typography>
              ) : (
                <Box component="ul" sx={{ m: 0, pl: 0, listStyle: "none" }}>
                  {record.orders.map((order, i) => {
                    const hexesMoved = Math.max(0, order.path.length - 1);
                    return (
                      <Typography
                        component="li"
                        variant="body2"
                        key={i}
                        sx={{ pl: 1, my: 0.5, borderLeft: "4px solid", borderColor: orderColor(i) }}
                      >
                        {UNIT_LABELS[order.unit]} ·{" "}
                        {hexesMoved === 0
                          ? `mantiene posición (${describePlace(order.end)})`
                          : `avanza ${plural(hexesMoved, "casilla", "casillas")} → ${describePlace(order.end)}`}{" "}
                        · {order.canFire ? "puede disparar" : "no dispara"}
                      </Typography>
                    );
                  })}
                </Box>
              )}

              <Typography variant="subtitle2" component="h4" sx={{ mt: 1.5 }}>
                Disparos
              </Typography>
              {record.shots.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nadie disparó.
                </Typography>
              ) : (
                <Box component="ul" sx={{ m: 0, pl: 0, listStyle: "none" }}>
                  {record.shots.map((shot, i) => (
                    <Typography
                      component="li"
                      variant="body2"
                      key={i}
                      sx={{ pl: 1, my: 0.5, borderLeft: "4px solid", borderColor: orderColor(shot.order) }}
                    >
                      {UNIT_LABELS[shot.unit]}: {plural(shot.dice, "dado", "dados")}
                      {shot.collision && " en un choque"}
                      {shot.steps.length === 0 && " (tirada rápida)"} → {describeFaces(shot.faces)}
                      {shot.target &&
                        shot.dice > 0 &&
                        ` (${describeTarget(shot.target).toLowerCase()}: ${describeRoll(
                          readRoll(shot.faces, shot.target),
                          // The attacker's extra first turn earns no coins
                          !(session.attacking && record.turn === 1)
                        )})`}
                      {shot.notes.map((note) => ` · ${note}`).join("")}
                    </Typography>
                  ))}
                </Box>
              )}

              <Typography variant="subtitle2" component="h4" sx={{ mt: 1.5 }}>
                Cambios en el mapa
              </Typography>
              {record.battleEdits.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sin bajas ni retiradas.
                </Typography>
              ) : (
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {record.battleEdits.map((edit, i) => (
                    <Typography component="li" variant="body2" key={i}>
                      {edit.kind === "remove"
                        ? `Eliminada: ${UNIT_LABELS[edit.unit]} (${describePlace(edit.position)})`
                        : `Movida: ${UNIT_LABELS[edit.unit]} → ${describePlace(edit.to)}`}
                    </Typography>
                  ))}
                </Box>
              )}
            </Paper>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        <Button variant="outlined" startIcon={<GameIcon name="download" />} onClick={exportGame}>
          Exportar partida
        </Button>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

export default HistoryDialog;
