import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { Position } from "../../../types/scenario";
import { Faction } from "../../../types/faction";
import { samePosition } from "../../../game-core/position";
import Board from "../../Board";
import { useHexFlash } from "../../useHexFlash";
import { SECTION_LABELS, UNIT_LABELS, coinsText, describeHex, describeMarkerRule, describeMovement, describeReinforcements } from "../../../labels";
import { EXTRA_SLOT, OrderSlot, sameSlot } from "../../../game-core/orderRules";
import { EXTRA_ORDER_COST } from "../../../data/coinRules";
import CommandCard from "../../../game-core/commandCard";
import { UnitType } from "../../../game-core/unit";
import GameSession, { GameSnapshot, MoveOptions } from "../../../game-core/gameSession";
import GameIcon from "../../GameIcon";
import { useSound } from "../../../sound";
import { HexType } from "../../../types/hex";
import InfoButton from "../../InfoButton";
import EndOfTurnMap from "./EndOfTurnMap";
import SandbagsIcon from "../../SandbagsIcon";
import "./PhaseLayout.css";

interface OrdersViewProps {
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
}


function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
      <Box sx={{ width: 18, height: 18, borderRadius: 0.5, bgcolor: color, flexShrink: 0, border: 1, borderColor: "divider" }} />
      <Typography variant="body2">{label}</Typography>
    </Stack>
  );
}

/** What an order slot means, for picking one */
const slotLabel = (slot: OrderSlot) => {
  if (slot.extra) return `Orden extra (${EXTRA_ORDER_COST} suministros)`;
  if (slot.onTheMove) return "En movimiento (no dispara)";
  return slot.section ? `Orden del ${SECTION_LABELS[slot.section]}` : "Orden de la carta";
};

const slotKey = (slot: OrderSlot) => `${slot.section ?? "card"}-${slot.onTheMove}-${!!slot.extra}`;

/** "infantería 1, tanque 2, artillería 2": what each of the card's orders costs */
const describeCoinCost = (card: CommandCard) =>
  Object.values(UnitType)
    .filter((type) => card.coinCostOf(type) > 0)
    .map((type) => `${UNIT_LABELS[type].toLowerCase()} ${card.coinCostOf(type)}`)
    .join(", ");

/** The slot used when the player doesn't pick: the card's only order, else on the move; null when they must pick */
function defaultSlot(slots: readonly OrderSlot[]): OrderSlot | null {
  const cardSlots = slots.filter((slot) => !slot.onTheMove);
  if (cardSlots.length > 1) return null;
  return cardSlots[0] ?? slots[0] ?? null;
}

const holdLabel = (shots: number) => {
  if (shots === 0) return "Mantener (no dispara)";
  return shots === 1 ? "Mantener y disparar" : `Mantener y disparar ${shots} veces`;
};

function OrdersView({ faction, session, game }: OrdersViewProps) {
  const boardManager = session.board;
  const { orders, ordersLeft } = game;
  const paidCard = game.activeCard?.paidInCoins ?? false;

  // Selected unit and its highlighted destinations (UI state only)
  const [unitHexPosition, setUnitHexPosition] = useState<Position | null>(null);
  const [moveOptions, setMoveOptions] = useState<MoveOptions | null>(null);
  /** Which of the card's orders the selected unit takes, when it could take more than one */
  const [slot, setSlot] = useState<OrderSlot | null>(null);
  const [slotHint, setSlotHint] = useState(false);
  /** The selected unit uses the order combat card's movement (Frozen Ground…) */
  const [boost, setBoost] = useState(false);
  const moveEffect = game.orderCombatCard?.effect?.kind === "move" ? game.orderCombatCard.effect : null;
  const boostsLeft = moveEffect ? moveEffect.units - orders.filter((o) => o.boosted).length : 0;
  /** The next unit tapped takes an extra order bought with coins */
  const [extraMode, setExtraMode] = useState(false);
  const canBuyExtra = game.extraOrderable.length > 0;
  const markerRule = game.orderCombatCard?.marker ?? null;
  const markersLeft = markerRule ? markerRule.count - game.markers.length : 0;
  /** Taps mark hexes for the combat card instead of ordering units */
  const [markMode, setMarkMode] = useState(false);
  const marking = markMode && markersLeft > 0;

  const { flash: invalidFlash, flashInvalid } = useHexFlash();
  const play = useSound();
  /** Fixing the map before any order: asked first, then the map editor of the final phase */
  const [confirmMapFix, setConfirmMapFix] = useState(false);
  const [fixingMap, setFixingMap] = useState(false);
  /** The last order moved a unit off its sandbags: said for a moment */
  const [leftSandbags, setLeftSandbags] = useState(false);

  const clearSelection = () => {
    setUnitHexPosition(null);
    setMoveOptions(null);
    setSlot(null);
    setSlotHint(false);
    setBoost(false);
  };

  const toggleBoost = () => {
    if (!unitHexPosition) return;
    const next = !boost;
    const options = session.getMoveOptions(unitHexPosition, slot ?? undefined, next);
    if (!options) return;
    setBoost(next);
    setMoveOptions(options);
  };

  const choosingSlot = (moveOptions?.slots.length ?? 0) > 1;

  /** Give the order, once the player has picked the slot where there's a choice */
  const order = (from: Position, to: Position) => {
    if (choosingSlot && !slot) {
      setSlotHint(true);
      flashInvalid(to);
      return;
    }
    const hadSandbags = !samePosition(from, to) && !!boardManager.getHex(from)?.sandbags;
    if (session.issueOrder(from, to, slot ?? undefined, boost)) {
      clearSelection();
      setExtraMode(false);
      setLeftSandbags(hadSandbags);
    }
  };

  const toggleExtraMode = () => {
    clearSelection();
    setMarkMode(false);
    setExtraMode((on) => !on);
  };

  const toggleMarkMode = () => {
    clearSelection();
    setExtraMode(false);
    setMarkMode((on) => !on);
  };

  const pickSlot = (key: string | null) => {
    const picked = moveOptions?.slots.find((s) => slotKey(s) === key);
    if (!picked || !unitHexPosition) return;
    setSlot(picked);
    setSlotHint(false);
    // The card's movement may not apply to this slot (Rattenkrieg on the move): drop it
    const boosted = boost ? session.getMoveOptions(unitHexPosition, picked, true) : null;
    if (boost && !boosted) setBoost(false);
    setMoveOptions(boosted ?? session.getMoveOptions(unitHexPosition, picked, false));
  };

  // One tap per action so it works the same with a mouse or on a tablet
  const handleTileClick = (position: Position) => {
    if (marking) {
      if (!session.markHex(position)) flashInvalid(position);
      return;
    }

    if (unitHexPosition) {
      // Tapping the selected unit again deselects it
      if (samePosition(unitHexPosition, position)) {
        clearSelection();
        return;
      }
      // Tapping a highlighted hex moves the selected unit there
      if (moveOptions?.moves.some((p) => samePosition(p, position))) {
        order(unitHexPosition, position);
        return;
      }
    }

    // Select a unit, or switch to another one
    const options = session.getMoveOptions(position, extraMode ? EXTRA_SLOT : undefined);
    if (options) {
      setUnitHexPosition(position);
      setMoveOptions(options);
      setSlot(extraMode ? EXTRA_SLOT : defaultSlot(options.slots));
      setSlotHint(false);
      setBoost(false);
      return;
    }

    // A unit that can't be ordered, or a hex the selected unit can't reach
    if (unitHexPosition || boardManager.getHex(position)?.hasUnit()) {
      flashInvalid(position);
    }
  };

  const handleHold = () => {
    if (unitHexPosition) order(unitHexPosition, unitHexPosition);
  };

  const selectedHex = unitHexPosition ? boardManager.getHex(unitHexPosition) : null;

  /** What to do now, in a few words: always in sight */
  const prompt = () => {
    if (marking && markerRule) return `Marca en el mapa: faltan ${markersLeft}`;
    if (extraMode) return selectedHex ? "Toca una casilla resaltada" : "Orden extra: toca cualquier unidad sin orden";
    if (paidCard && game.cardOrdersLeft > 0 && ordersLeft <= 0 && !selectedHex) {
      return game.orderable.length > 0
        ? "Da las órdenes que quieras pagar y confirma"
        : "No te llega para más órdenes de la carta";
    }
    if (game.activeCard?.closeAssaultOnly) return "Esta carta no da órdenes: confírmalas";
    if (ordersLeft <= 0 && markersLeft > 0) return `Marca las casillas de ${game.orderCombatCard!.name}`;
    if (ordersLeft <= 0) return "No quedan órdenes: confirma";
    if (selectedHex) return "Toca una casilla resaltada";
    return "Toca una unidad resaltada";
  };

  /** The same, explained: behind "Instrucciones" */
  const instructions = () => {
    if (marking && markerRule) {
      return `${describeMarkerRule(markerRule)} Faltan ${markersLeft}.`;
    }
    if (extraMode) {
      return selectedHex
        ? "Orden extra: toca una casilla resaltada para mover la unidad, o elige una acción."
        : `Orden extra (${EXTRA_ORDER_COST} suministros): toca cualquier unidad sin orden. No tiene las ventajas de la carta.`;
    }
    if (paidCard && game.cardOrdersLeft > 0 && ordersLeft <= 0 && !selectedHex) {
      return game.orderable.length > 0
        ? `Cada orden de la carta cuesta suministros (${describeCoinCost(game.activeCard!)}): da las que quieras pagar y confirma.`
        : "No te llega para más órdenes de la carta: confirma las órdenes o deshaz la última.";
    }
    if (game.activeCard?.closeAssaultOnly) {
      return "Esta carta no da órdenes: confírmalas. En la batalla marcarás las unidades en asalto cercano.";
    }
    if (ordersLeft <= 0 && markersLeft > 0) {
      return `Marca en el mapa las casillas de ${game.orderCombatCard!.name} para poder confirmar.`;
    }
    if (ordersLeft <= 0) {
      return "No quedan órdenes: confirma las órdenes o deshaz la última.";
    }
    if (selectedHex) {
      return "Toca una casilla resaltada para mover la unidad, o elige una acción: mantenerla en su casilla o cancelar.";
    }
    return "Toca una unidad resaltada para darle una orden; después, la casilla adonde se mueve.";
  };

  if (fixingMap && game.canEditMap) {
    return (
      <EndOfTurnMap
        faction={faction}
        session={session}
        game={game}
        title="Órdenes: actualizar mapa"
        hint="Corrige el mapa para que coincida con la mesa: toca una unidad"
        onDone={() => setFixingMap(false)}
      />
    );
  }

  return (
    <div className="phase-layout">
      <div className="phase-layout__board">
        <Board
          onTileClick={handleTileClick}
          unitHexPosition={unitHexPosition}
          possibleMovePositions={moveOptions?.moves ?? []}
          possibleMoveAndFirePositions={moveOptions?.moveAndFire ?? []}
          boardManager={boardManager}
          orders={orders}
          backgroundImage={session.scenario.image}
          invalidFlash={invalidFlash}
          orderablePositions={marking ? [] : extraMode ? game.extraOrderable : game.orderable}
          markers={game.markers}
          markerKind={markerRule?.kind}
          markablePositions={marking ? game.markable : []}
          faction={faction}
        />
      </div>

      <div className="phase-layout__controls">
        {game.activeCard && (
          <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
            <Typography variant="subtitle1" component="h2" sx={{ flex: 1, fontWeight: 700, lineHeight: 1.25 }}>
              {game.activeCard.name}
            </Typography>
            <InfoButton title={game.activeCard.name}>
              <Typography variant="body1">{game.activeCard.description}</Typography>
            </InfoButton>
          </Stack>
        )}
        {game.canUnpickCard && (
          <Button variant="outlined" onClick={() => session.unpickCard()} startIcon={<GameIcon name="undo" />}>
            Cambiar carta
          </Button>
        )}
        {game.orderCombatCard && (
          <Paper variant="outlined" sx={{ p: 1.5, width: "100%" }} data-testid="order-combat-card">
            <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
              <GameIcon name="cards" />
              <Typography variant="body2" sx={{ flex: 1, fontWeight: 700 }}>
                {game.orderCombatCard.name}
              </Typography>
              <InfoButton title={`Carta de combate: ${game.orderCombatCard.name}`}>
                <Typography variant="body1">{game.orderCombatCard.description}</Typography>
                {!markerRule && (
                  <Typography variant="body1" sx={{ mt: 1 }}>
                    Si hace falta, anota en papel sobre qué unidades la usas.
                  </Typography>
                )}
                {game.orderCombatCard.effect?.kind === "reinforcements" && session.scenario.reinforcements && (
                  <Typography variant="body1" sx={{ mt: 1 }} data-testid="reinforcements-table">
                    <strong>Refuerzos en este mapa:</strong> {describeReinforcements(session.scenario.reinforcements)}
                  </Typography>
                )}
              </InfoButton>
            </Stack>
            {markerRule && (
              <Typography variant="body2" color="text.secondary">
                {describeMarkerRule(markerRule)} ({game.markers.length}/{markerRule.count})
              </Typography>
            )}
            <Stack sx={{ gap: 1, mt: 1 }}>
              {markerRule && (markersLeft > 0 || marking) && (
                <Button
                  variant={marking ? "contained" : "outlined"}
                  color="warning"
                  onClick={toggleMarkMode}
                  startIcon={<GameIcon name={marking ? "cancel" : "fire"} />}
                  aria-pressed={marking}
                >
                  {marking ? "Dejar de marcar" : "Marcar en el mapa"}
                </Button>
              )}
              {markerRule && game.markers.length > 0 && (
                <Button variant="text" color="inherit" onClick={() => session.undoMarker()} startIcon={<GameIcon name="undo" />}>
                  Borrar última marca
                </Button>
              )}
              <Button variant="text" color="inherit" onClick={() => session.cancelOrderCombatCard()} startIcon={<GameIcon name="cancel" />}>
                Quitar
              </Button>
            </Stack>
          </Paper>
        )}
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="body1" color="primary">
            {prompt()}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {paidCard ? `Órdenes de la carta: ${game.cardOrdersLeft}` : `Órdenes restantes: ${ordersLeft}`} ·{" "}
            {coinsText(game.coins)}
          </Typography>
        </Box>

        {selectedHex && (
          <Paper variant="outlined" sx={{ p: 1.5, width: "100%" }}>
            <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
              <Typography variant="body2" sx={{ flex: 1, fontWeight: 700 }}>
                {describeHex(selectedHex)}
              </Typography>
              <InfoButton title="Unidad seleccionada">
                <Stack sx={{ gap: 1 }}>
                  <Typography variant="body1">{describeHex(selectedHex)}.</Typography>
                  {moveOptions && (
                    <Typography variant="body1">
                      {describeMovement(moveOptions.limits)}
                      {selectedHex.getType() === HexType.HEDGEROW && moveOptions.limits.maxMove > 1 && (
                        <>. Al salir de un seto solo avanza 1 casilla</>
                      )}
                      .
                    </Typography>
                  )}
                  {slot?.extra && (
                    <Typography variant="body1">
                      Orden extra: cuesta {EXTRA_ORDER_COST} suministros y no tiene las ventajas de la carta.
                    </Typography>
                  )}
                </Stack>
              </InfoButton>
            </Stack>
            {slot?.extra && (
              <Typography variant="body2" color="warning.main">
                Orden extra: cuesta {coinsText(EXTRA_ORDER_COST)}
              </Typography>
            )}
            {selectedHex.sandbags && (moveOptions?.moves.length ?? 0) > 0 && (
              <Alert severity="warning" icon={<SandbagsIcon size={26} />} sx={{ mt: 1, py: 0 }} data-testid="sandbags-warning">
                Tiene sacos terreros: si se mueve, los pierde.
              </Alert>
            )}
            {paidCard && !slot?.extra && !slot?.onTheMove && game.activeCard && selectedHex.unit && (
              <Typography variant="body2" color="warning.main">
                Esta orden cuesta {coinsText(game.activeCard.coinCostOf(selectedHex.unit.getUnitType()))}
              </Typography>
            )}
            {/* Legend for the highlighted hexes (no hover on tablets) */}
            <Stack sx={{ gap: 0.5, my: 1 }}>
              {(moveOptions?.moveAndFire.length ?? 0) > 0 && (
                <LegendItem color="var(--m44-move-fire)" label="Mover y disparar" />
              )}
              <LegendItem color="var(--m44-move-only)" label="Solo mover" />
            </Stack>
            {game.orderCombatCard && moveEffect && (moveOptions?.canBoost || boost) && (
              <ToggleButton
                value="boost"
                selected={boost}
                onChange={toggleBoost}
                color="warning"
                fullWidth
                sx={{ minHeight: 48, gap: 1, mb: 1 }}
              >
                <GameIcon name="cards" /> Usar {game.orderCombatCard.name} (
                {boostsLeft === 1 ? "queda 1" : `quedan ${boostsLeft}`})
              </ToggleButton>
            )}
            {choosingSlot && moveOptions && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color={slotHint ? "error" : "text.primary"} sx={{ mb: 0.5 }}>
                  ¿Qué orden usa esta unidad?
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  orientation="vertical"
                  fullWidth
                  value={slot ? slotKey(slot) : null}
                  onChange={(_, key: string | null) => pickSlot(key)}
                  aria-label="Orden que usa la unidad"
                >
                  {moveOptions.slots.map((s) => (
                    <ToggleButton key={slotKey(s)} value={slotKey(s)} sx={{ minHeight: 48 }}>
                      {slotLabel(s)}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            )}
            <Stack sx={{ gap: 1 }}>
              <Button onClick={handleHold} startIcon={<GameIcon name={moveOptions?.limits.holdShots ? "fire" : "confirm"} />}>
                {holdLabel(moveOptions?.limits.holdShots ?? 1)}
              </Button>
              <Button variant="outlined" onClick={clearSelection} startIcon={<GameIcon name="cancel" />}>
                Cancelar
              </Button>
            </Stack>
          </Paper>
        )}

        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, justifyContent: "center" }}>
          {!marking && !game.extraTurn && (canBuyExtra || extraMode) && (
            <Button
              variant={extraMode ? "contained" : "outlined"}
              color="warning"
              onClick={toggleExtraMode}
              startIcon={<GameIcon name={extraMode ? "cancel" : "coins"} />}
              aria-pressed={extraMode}
            >
              {extraMode ? "Cancelar orden extra" : `Orden extra (${EXTRA_ORDER_COST} suministros)`}
            </Button>
          )}
          {orders.length > 0 && !unitHexPosition && (
            <Button variant="outlined" onClick={() => session.undoLastOrder()} startIcon={<GameIcon name="undo" />}>
              Volver
            </Button>
          )}
          {ordersLeft <= 0 && markersLeft <= 0 && (
            <Button
              onClick={() => session.commitOrders() && play("stamp")}
              startIcon={<GameIcon name="confirm" />}
            >
              Confirmar Órdenes
            </Button>
          )}
        </Stack>

        <Stack sx={{ mt: "auto", gap: 0.5 }}>
          <InfoButton title="Cómo dar órdenes" label="Instrucciones">
            <Stack sx={{ gap: 1.5 }}>
              <Typography variant="body1" color="primary">
                {instructions()}
              </Typography>
              <Typography variant="body1">
                Las casillas resaltadas son adonde puede ir la unidad; la leyenda dice en cuáles aún podrá disparar.
                Tocar otra vez la unidad la deselecciona. «Volver» deshace la última orden.
              </Typography>
              {!game.extraTurn && (
                <Typography variant="body1">
                  Una orden extra cuesta {coinsText(EXTRA_ORDER_COST)} y no tiene las ventajas de la carta.
                </Typography>
              )}
            </Stack>
          </InfoButton>
          {/* Out of the way, and asked first: only when the map doesn't match the table */}
          {game.canEditMap && !unitHexPosition && !marking && !extraMode && (
            <Button
              variant="text"
              color="inherit"
              size="small"
              onClick={() => setConfirmMapFix(true)}
              startIcon={<GameIcon name="map" />}
              sx={{ color: "text.secondary" }}
            >
              Actualizar mapa
            </Button>
          )}
        </Stack>
      </div>

      <Snackbar
        open={leftSandbags}
        autoHideDuration={4000}
        onClose={() => setLeftSandbags(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="warning" icon={<SandbagsIcon size={26} />} onClose={() => setLeftSandbags(false)} data-testid="sandbags-left">
          La unidad deja sus sacos terreros: quítalos de la mesa al moverla.
        </Alert>
      </Snackbar>

      <Dialog open={confirmMapFix} onClose={() => setConfirmMapFix(false)}>
        <DialogTitle>¿Actualizar el mapa?</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Solo si el mapa no coincide con la mesa: por ejemplo, si se cambió una tirada o falta una retirada del
            turno anterior. Se puede hacer mientras no hayas dado ninguna orden.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setConfirmMapFix(false)}>
            Cancelar
          </Button>
          <Button
            color="warning"
            onClick={() => {
              setConfirmMapFix(false);
              setFixingMap(true);
            }}
            startIcon={<GameIcon name="map" />}
          >
            Actualizar mapa
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default OrdersView;
