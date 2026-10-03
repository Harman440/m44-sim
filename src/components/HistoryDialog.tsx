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
import {
  DIE_FACE_LABELS,
  UNIT_LABELS,
  coinsText,
  describeCoinEntry,
  describePlace,
  describeAppliedFaces,
  describeFaces,
  describeRoll,
  describeTarget,
  signedCoins,
} from "../labels";
import { appliedFaces, readRoll } from "../game-core/rollResult";
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
  const placeOf = (position: Position) => describePlace(session.board.getHex(position));

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
                          ? `mantiene posición (${placeOf(order.end)})`
                          : `avanza ${plural(hexesMoved, "casilla", "casillas")} → ${placeOf(order.end)}`}{" "}
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
                      {shot.removedWire ? (
                        `${UNIT_LABELS[shot.unit]}: quitó la alambrada (${placeOf(shot.removedWire)})`
                      ) : (
                        <>
                          {UNIT_LABELS[shot.unit]}: {plural(shot.dice, "dado", "dados")}
                          {shot.collision && " en un choque"}
                          {" → "}
                          {describeAppliedFaces(shot.faces, shot.kept)}
                          {shot.dice > 0 &&
                            ` (${describeTarget(shot.target).toLowerCase()}: ${describeRoll(
                              readRoll(appliedFaces(shot.faces, shot.kept), shot.target)
                            )})`}
                          {shot.notes.map((note) => ` · ${note}`).join("")}
                        </>
                      )}
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
                      {edit.kind === "wire"
                        ? `Alambrada quitada (${placeOf(edit.position)})`
                        : edit.kind === "remove"
                        ? `Eliminada: ${UNIT_LABELS[edit.unit]} (${placeOf(edit.position)})`
                        : edit.kind === "add"
                          ? `Refuerzo: ${UNIT_LABELS[edit.unit]} (${placeOf(edit.position)})`
                          : `Movida: ${UNIT_LABELS[edit.unit]} → ${placeOf(edit.to)}`}
                    </Typography>
                  ))}
                </Box>
              )}

              <Typography variant="subtitle2" component="h4" sx={{ mt: 1.5 }}>
                Suministros
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2 }} data-testid="turn-coins">
                {record.coins.map((entry, i) => (
                  <Typography component="li" variant="body2" key={i}>
                    {describeCoinEntry(entry)}: {signedCoins(entry.amount)}
                  </Typography>
                ))}
              </Box>
              <Typography variant="body2" color="text.secondary">
                Al terminar el turno: {coinsText(record.coinsAfter)}
              </Typography>

              {(record.combatCardsPlayed.length > 0 || record.combatCardDrawn || record.cardAttacks.length > 0) && (
                <>
                  <Typography variant="subtitle2" component="h4" sx={{ mt: 1.5 }}>
                    Cartas de combate
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2 }} data-testid="turn-combat-cards">
                    {record.combatCardsPlayed.map((card) => (
                      <Typography component="li" variant="body2" key={card.id}>
                        Jugada: {card.name}
                      </Typography>
                    ))}
                    {record.markers.length > 0 && (
                      <Typography component="li" variant="body2">
                        Marcas en el mapa: {record.markers.map(placeOf).join(" · ")}
                      </Typography>
                    )}
                    {record.cardAttacks.map((attack) => (
                      <Typography component="li" variant="body2" key={`attack-${attack.marker}`}>
                        Ataque en la casilla {attack.marker + 1}:{" "}
                        {attack.target
                          ? `${UNIT_LABELS[attack.target.unitType].toLowerCase()} → ${describeFaces(attack.faces)} (${describeRoll(
                              readRoll(attack.faces, attack.target),
                              false
                            )})`
                          : "vacía"}
                      </Typography>
                    ))}
                    {record.ambush && (
                      <Typography component="li" variant="body2">
                        Emboscada: {UNIT_LABELS[record.ambush.unitType].toLowerCase()} ({placeOf(record.ambush.from)}),{" "}
                        {plural(record.ambush.dice, "dado", "dados")} → {describeAppliedFaces(record.ambush.faces, record.ambush.kept)} (
                        {describeTarget(record.ambush.target).toLowerCase()}:{" "}
                        {describeRoll(readRoll(appliedFaces(record.ambush.faces, record.ambush.kept), record.ambush.target))})
                      </Typography>
                    )}
                    {record.reinforcement && (
                      <Typography component="li" variant="body2">
                        Refuerzos: {DIE_FACE_LABELS[record.reinforcement.face].toLowerCase()} →{" "}
                        {record.reinforcement.unitType
                          ? UNIT_LABELS[record.reinforcement.unitType].toLowerCase()
                          : "sin refuerzos"}
                      </Typography>
                    )}
                    {record.combatCardDrawn && (
                      <Typography component="li" variant="body2">
                        Robada en la fase final: {record.combatCardDrawn.name}
                      </Typography>
                    )}
                  </Box>
                </>
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
