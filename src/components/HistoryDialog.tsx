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
import { signedCoins } from "../labels";
import { defineMessages, useLabels, useMessages, useTr } from "../i18n/useI18n";
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

const TEXT = defineMessages({
  es: {
    title: "Historial",
    noTurns: "Aún no ha terminado ningún turno.",
    turn: (n: number) => `Turno ${n}`,
    card: (name: string) => `Carta: ${name}`,
    exportTurnLabel: (n: number) => `Exportar turno ${n}`,
    exportTurn: "Exportar turno",
    orders: "Órdenes",
    noOrders: "No se dieron órdenes.",
    holds: (place: string) => `mantiene posición (${place})`,
    advances: (hexes: string, place: string) => `avanza ${hexes} → ${place}`,
    canFire: "puede disparar",
    noFire: "no dispara",
    shots: "Disparos",
    noShots: "Nadie disparó.",
    removedWire: (unit: string, place: string) => `${unit}: quitó la alambrada (${place})`,
    blocked: (unit: string) => `${unit}: no tiró, bloqueado por una carta del rival`,
    dice: (n: number) => (n === 1 ? "1 dado" : `${n} dados`),
    inCollision: " en un choque",
    mapChanges: "Cambios en el mapa",
    noMapChanges: "Sin bajas ni retiradas.",
    wireRemoved: (place: string) => `Alambrada quitada (${place})`,
    fortified: "Fortificar: sacos terreros puestos",
    enemySandbags: "Sacos terreros enemigos puestos",
    sandbagsRemoved: "Sacos terreros quitados",
    removed: (unit: string) => `Eliminada: ${unit}`,
    replacedBy: (unit: string) => `, queda ${unit.toLowerCase()}`,
    reinforcement: (unit: string, place: string) => `Refuerzo: ${unit} (${place})`,
    moved: (unit: string, place: string) => `Movida: ${unit} → ${place}`,
    supplies: "Suministros",
    coinsAfter: (coins: string) => `Al terminar el turno: ${coins}`,
    combatCards: "Cartas de combate",
    played: (name: string) => `Jugada: ${name}`,
    markers: (places: string) => `Marcas en el mapa: ${places}`,
    attack: (n: number) => `Ataque en la casilla ${n}:`,
    empty: "vacía",
    ambush: "Emboscada",
    reinforcements: "Refuerzos",
    noReinforcements: "sin refuerzos",
    drawn: (name: string) => `Robada en la fase final: ${name}`,
    exportGame: "Exportar partida",
    close: "Cerrar",
  },
  en: {
    title: "History",
    noTurns: "No turn has ended yet.",
    turn: (n: number) => `Turn ${n}`,
    card: (name: string) => `Card: ${name}`,
    exportTurnLabel: (n: number) => `Export turn ${n}`,
    exportTurn: "Export turn",
    orders: "Orders",
    noOrders: "No orders were given.",
    holds: (place: string) => `holds position (${place})`,
    advances: (hexes: string, place: string) => `advances ${hexes} → ${place}`,
    canFire: "can fire",
    noFire: "doesn't fire",
    shots: "Shots",
    noShots: "Nobody fired.",
    removedWire: (unit: string, place: string) => `${unit}: removed the barbed wire (${place})`,
    blocked: (unit: string) => `${unit}: no roll, blocked by an enemy card`,
    dice: (n: number) => (n === 1 ? "1 die" : `${n} dice`),
    inCollision: " in a collision",
    mapChanges: "Map changes",
    noMapChanges: "No casualties or retreats.",
    wireRemoved: (place: string) => `Barbed wire removed (${place})`,
    fortified: "Fortify: sandbags placed",
    enemySandbags: "Enemy sandbags placed",
    sandbagsRemoved: "Sandbags removed",
    removed: (unit: string) => `Removed: ${unit}`,
    replacedBy: (unit: string) => `, ${unit.toLowerCase()} stays`,
    reinforcement: (unit: string, place: string) => `Reinforcement: ${unit} (${place})`,
    moved: (unit: string, place: string) => `Moved: ${unit} → ${place}`,
    supplies: "Supplies",
    coinsAfter: (coins: string) => `At the end of the turn: ${coins}`,
    combatCards: "Combat cards",
    played: (name: string) => `Played: ${name}`,
    markers: (places: string) => `Marks on the map: ${places}`,
    attack: (n: number) => `Attack on hex ${n}:`,
    empty: "empty",
    ambush: "Ambush",
    reinforcements: "Reinforcements",
    noReinforcements: "no reinforcements",
    drawn: (name: string) => `Drawn in the final phase: ${name}`,
    exportGame: "Export game",
    close: "Close",
  },
});

function HistoryDialog({ open, onClose, session, log }: HistoryDialogProps) {
  const { scenario, faction } = session;
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const filePrefix = `m44-${scenario.id}-${faction === "Axis" ? "eje" : "aliados"}`;

  /** "bosque, centro": terrain never changes, so the board can describe past positions */
  const placeOf = (position: Position) => labels.describePlace(session.board.getHex(position));

  const exportGame = () =>
    downloadJson(`${filePrefix}-partida-turno-${session.getSnapshot().turn}.json`, session.save());
  const exportTurn = (record: TurnRecord) => downloadJson(`${filePrefix}-turno-${record.turn}.json`, record);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle>{t.title}</DialogTitle>
      <DialogContent dividers>
        <Stack sx={{ gap: 2 }}>
          {log.length === 0 && (
            <Typography color="text.secondary">{t.noTurns}</Typography>
          )}
          {[...log].reverse().map((record) => (
            <Paper component="section" variant="outlined" key={record.turn} sx={{ p: 2 }} data-testid="turn-record">
              <Box
                sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1 }}
              >
                <Box>
                  <Typography variant="h6" component="h3">
                    {t.turn(record.turn)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t.card(tr(record.card.name))}
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={<GameIcon name="download" />}
                  onClick={() => exportTurn(record)}
                  aria-label={t.exportTurnLabel(record.turn)}
                >
                  {t.exportTurn}
                </Button>
              </Box>

              <Typography variant="subtitle2" component="h4" sx={{ mt: 1.5 }}>
                {t.orders}
              </Typography>
              {record.orders.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t.noOrders}
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
                        {labels.unitKind(order.unit, order.elite)} ·{" "}
                        {hexesMoved === 0
                          ? t.holds(placeOf(order.end))
                          : t.advances(labels.hexes(hexesMoved), placeOf(order.end))}{" "}
                        · {order.canFire ? t.canFire : t.noFire}
                      </Typography>
                    );
                  })}
                </Box>
              )}

              <Typography variant="subtitle2" component="h4" sx={{ mt: 1.5 }}>
                {t.shots}
              </Typography>
              {record.shots.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t.noShots}
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
                        t.removedWire(labels.unitKind(shot.unit, shot.elite), placeOf(shot.removedWire))
                      ) : shot.blocked ? (
                        t.blocked(labels.unitKind(shot.unit, shot.elite))
                      ) : (
                        <>
                          {labels.unitKind(shot.unit, shot.elite)}: {t.dice(shot.dice)}
                          {shot.collision && t.inCollision}
                          {" → "}
                          {labels.describeAppliedFaces(shot.faces, shot.kept)}
                          {shot.dice > 0 &&
                            ` (${labels.describeTarget(shot.target).toLowerCase()}: ${labels.describeRoll(
                              readRoll(appliedFaces(shot.faces, shot.kept), shot.target)
                            )})`}
                          {shot.notes.map((note) => ` · ${tr(note)}`).join("")}
                        </>
                      )}
                    </Typography>
                  ))}
                </Box>
              )}

              <Typography variant="subtitle2" component="h4" sx={{ mt: 1.5 }}>
                {t.mapChanges}
              </Typography>
              {record.battleEdits.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t.noMapChanges}
                </Typography>
              ) : (
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {record.battleEdits.map((edit, i) => (
                    <Typography component="li" variant="body2" key={i}>
                      {edit.kind === "wire"
                        ? t.wireRemoved(placeOf(edit.position))
                        : edit.kind === "sandbags"
                        ? `${edit.fortify ? t.fortified : edit.placed ? t.enemySandbags : t.sandbagsRemoved} (${placeOf(edit.position)})`
                        : edit.kind === "remove"
                        ? `${t.removed(labels.unitKind(edit.unit, edit.elite))}${
                            edit.replacedBy ? t.replacedBy(labels.units[edit.replacedBy]) : ""
                          } (${placeOf(edit.position)})`
                        : edit.kind === "add"
                          ? t.reinforcement(labels.units[edit.unit], placeOf(edit.position))
                          : t.moved(labels.unitKind(edit.unit, edit.elite), placeOf(edit.to))}
                    </Typography>
                  ))}
                </Box>
              )}

              <Typography variant="subtitle2" component="h4" sx={{ mt: 1.5 }}>
                {t.supplies}
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2 }} data-testid="turn-coins">
                {record.coins.map((entry, i) => (
                  <Typography component="li" variant="body2" key={i}>
                    {labels.describeCoinEntry(entry)}: {signedCoins(entry.amount)}
                  </Typography>
                ))}
              </Box>
              <Typography variant="body2" color="text.secondary">
                {t.coinsAfter(labels.coins(record.coinsAfter))}
              </Typography>

              {(record.combatCardsPlayed.length > 0 || record.combatCardDrawn || record.cardAttacks.length > 0) && (
                <>
                  <Typography variant="subtitle2" component="h4" sx={{ mt: 1.5 }}>
                    {t.combatCards}
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2 }} data-testid="turn-combat-cards">
                    {record.combatCardsPlayed.map((card) => (
                      <Typography component="li" variant="body2" key={card.id}>
                        {t.played(tr(card.name))}
                      </Typography>
                    ))}
                    {record.markers.length > 0 && (
                      <Typography component="li" variant="body2">
                        {t.markers(record.markers.map(placeOf).join(" · "))}
                      </Typography>
                    )}
                    {record.cardAttacks.map((attack) => (
                      <Typography component="li" variant="body2" key={`attack-${attack.marker}`}>
                        {t.attack(attack.marker + 1)}{" "}
                        {attack.target
                          ? `${labels.target(attack.target.infantry).toLowerCase()} → ${labels.describeFaces(attack.faces)} (${labels.describeRoll(
                              readRoll(attack.faces, attack.target),
                              false
                            )})`
                          : t.empty}
                      </Typography>
                    ))}
                    {record.ambush && (
                      <Typography component="li" variant="body2">
                        {t.ambush}: {labels.units[record.ambush.unitType].toLowerCase()} ({placeOf(record.ambush.from)}),{" "}
                        {t.dice(record.ambush.dice)} → {labels.describeAppliedFaces(record.ambush.faces, record.ambush.kept)} (
                        {labels.describeTarget(record.ambush.target).toLowerCase()}:{" "}
                        {labels.describeRoll(readRoll(appliedFaces(record.ambush.faces, record.ambush.kept), record.ambush.target))})
                      </Typography>
                    )}
                    {record.reinforcement && (
                      <Typography component="li" variant="body2">
                        {t.reinforcements}: {labels.dieFaces[record.reinforcement.face].toLowerCase()} →{" "}
                        {record.reinforcement.unitType
                          ? labels.units[record.reinforcement.unitType].toLowerCase()
                          : t.noReinforcements}
                      </Typography>
                    )}
                    {record.combatCardDrawn && (
                      <Typography component="li" variant="body2">
                        {t.drawn(tr(record.combatCardDrawn.name))}
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
          {t.exportGame}
        </Button>
        <Button onClick={onClose}>{t.close}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default HistoryDialog;
