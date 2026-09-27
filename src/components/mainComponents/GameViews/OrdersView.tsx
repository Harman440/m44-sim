import { useState } from "react";
import { Alert, Box, Button, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { Position } from "../../../types/scenario";
import { Faction } from "../../../types/faction";
import { samePosition } from "../../../game-core/position";
import Board from "../../Board";
import { useHexFlash } from "../../useHexFlash";
import { SECTION_LABELS, UNIT_LABELS, coinsText, describeHex, describeMovement } from "../../../labels";
import { EXTRA_SLOT, OrderSlot, sameSlot } from "../../../game-core/orderRules";
import { EXTRA_ORDER_COST } from "../../../data/coinRules";
import CommandCard from "../../../game-core/commandCard";
import { UnitType } from "../../../game-core/unit";
import GameSession, { GameSnapshot, MoveOptions } from "../../../game-core/gameSession";
import GameIcon from "../../GameIcon";
import { useSound } from "../../../sound";
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
  if (slot.extra) return `Orden extra (${EXTRA_ORDER_COST} monedas)`;
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
  const { orders, ordersLeft, ordersCommitted } = game;
  const paidCard = game.activeCard?.paidInCoins ?? false;

  // Selected unit and its highlighted destinations (UI state only)
  const [unitHexPosition, setUnitHexPosition] = useState<Position | null>(null);
  const [moveOptions, setMoveOptions] = useState<MoveOptions | null>(null);
  /** Which of the card's orders the selected unit takes, when it could take more than one */
  const [slot, setSlot] = useState<OrderSlot | null>(null);
  const [slotHint, setSlotHint] = useState(false);
  /** The next unit tapped takes an extra order bought with coins */
  const [extraMode, setExtraMode] = useState(false);
  const canBuyExtra = game.extraOrderable.length > 0;

  const { flash: invalidFlash, flashInvalid } = useHexFlash();
  const play = useSound();

  const clearSelection = () => {
    setUnitHexPosition(null);
    setMoveOptions(null);
    setSlot(null);
    setSlotHint(false);
  };

  const choosingSlot = (moveOptions?.slots.length ?? 0) > 1;

  /** Give the order, once the player has picked the slot where there's a choice */
  const order = (from: Position, to: Position) => {
    if (choosingSlot && !slot) {
      setSlotHint(true);
      flashInvalid(to);
      return;
    }
    if (session.issueOrder(from, to, slot ?? undefined)) {
      clearSelection();
      setExtraMode(false);
    }
  };

  const toggleExtraMode = () => {
    clearSelection();
    setExtraMode((on) => !on);
  };

  const pickSlot = (key: string | null) => {
    const picked = moveOptions?.slots.find((s) => slotKey(s) === key);
    if (!picked || !unitHexPosition) return;
    setSlot(picked);
    setSlotHint(false);
    setMoveOptions(session.getMoveOptions(unitHexPosition, picked));
  };

  // One tap per action so it works the same with a mouse or on a tablet
  const handleTileClick = (position: Position) => {
    if (ordersCommitted) return;

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

  const instructions = () => {
    if (ordersCommitted) return null;
    if (extraMode) {
      return selectedHex
        ? "Orden extra: toca una casilla resaltada para mover la unidad, o elige una acción"
        : `Orden extra (${EXTRA_ORDER_COST} monedas): toca cualquier unidad sin orden. No tiene las ventajas de la carta`;
    }
    if (paidCard && game.cardOrdersLeft > 0 && ordersLeft <= 0 && !selectedHex) {
      return game.orderable.length > 0
        ? `Cada orden de la carta cuesta monedas (${describeCoinCost(game.activeCard!)}): da las que quieras pagar y confirma`
        : "No te llega para más órdenes de la carta: confirma las órdenes o deshaz la última";
    }
    if (game.activeCard?.closeAssaultOnly) {
      return "Esta carta no da órdenes: confírmalas. En la batalla marcarás las unidades en asalto cercano";
    }
    if (ordersLeft <= 0) {
      return "No quedan órdenes: confirma las órdenes o deshaz la última";
    }
    if (selectedHex) {
      return "Toca una casilla resaltada para mover la unidad, o elige una acción";
    }
    return "Toca una unidad resaltada para darle una orden";
  };

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
          locked={ordersCommitted}
          orderablePositions={extraMode ? game.extraOrderable : game.orderable}
          faction={faction}
        />
      </div>

      <div className="phase-layout__controls">
        {game.activeCard && !ordersCommitted && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
            <strong>{game.activeCard.name}:</strong> {game.activeCard.description}
          </Typography>
        )}
        {game.orderCombatCard && (
          <Alert
            severity="info"
            icon={<GameIcon name="cards" />}
            sx={{ width: "100%" }}
            data-testid="order-combat-card"
            action={
              !ordersCommitted && (
                <Button color="inherit" onClick={() => session.cancelOrderCombatCard()}>
                  Quitar
                </Button>
              )
            }
          >
            <strong>Carta de combate: {game.orderCombatCard.name}.</strong> {game.orderCombatCard.description} Anota
            en el mapa sobre qué unidades o casillas la usas.
          </Alert>
        )}
        {ordersCommitted ? (
          <Alert severity="success" sx={{ width: "100%" }}>
            Ya no se pueden cambiar. Pasa a la fase de movimiento.
          </Alert>
        ) : (
          <Typography variant="body1" color="primary" sx={{ textAlign: "center" }}>
            {instructions()} ·{" "}
            {paidCard ? `órdenes de la carta: ${game.cardOrdersLeft}` : `órdenes restantes: ${ordersLeft}`} ·{" "}
            {coinsText(game.coins)}
          </Typography>
        )}

        {selectedHex && (
          <Paper variant="outlined" sx={{ p: 2, width: "100%" }}>
            <Typography variant="body2">Seleccionado: {describeHex(selectedHex)}</Typography>
            {slot?.extra && (
              <Typography variant="body2" color="warning.main">
                Orden extra: cuesta {EXTRA_ORDER_COST} monedas y no tiene las ventajas de la carta
              </Typography>
            )}
            {paidCard && !slot?.extra && !slot?.onTheMove && game.activeCard && selectedHex.unit && (
              <Typography variant="body2" color="warning.main">
                Esta orden cuesta {coinsText(game.activeCard.coinCostOf(selectedHex.unit.getUnitType()))}
              </Typography>
            )}
            {moveOptions && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {describeMovement(moveOptions.limits)}
              </Typography>
            )}
            {/* Legend for the highlighted hexes (no hover on tablets) */}
            <Stack sx={{ gap: 0.5, mb: 1.5 }}>
              {(moveOptions?.moveAndFire.length ?? 0) > 0 && (
                <LegendItem color="var(--m44-move-fire)" label="Mover y disparar" />
              )}
              <LegendItem color="var(--m44-move-only)" label="Solo mover (no podrá disparar)" />
            </Stack>
            {choosingSlot && moveOptions && (
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="body2" color={slotHint ? "error" : "text.primary"} sx={{ mb: 0.5 }}>
                  ¿Qué orden usa esta unidad?
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  value={slot ? slotKey(slot) : null}
                  onChange={(_, key: string | null) => pickSlot(key)}
                  aria-label="Orden que usa la unidad"
                  sx={{ flexWrap: "wrap" }}
                >
                  {moveOptions.slots.map((s) => (
                    <ToggleButton key={slotKey(s)} value={slotKey(s)} sx={{ minHeight: 48 }}>
                      {slotLabel(s)}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            )}
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
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
          {!ordersCommitted && !game.extraTurn && (canBuyExtra || extraMode) && (
            <Button
              variant={extraMode ? "contained" : "outlined"}
              color="warning"
              onClick={toggleExtraMode}
              startIcon={<GameIcon name={extraMode ? "cancel" : "coins"} />}
              aria-pressed={extraMode}
            >
              {extraMode ? "Cancelar orden extra" : `Orden extra (${EXTRA_ORDER_COST} monedas)`}
            </Button>
          )}
          {!ordersCommitted && orders.length > 0 && !unitHexPosition && (
            <Button variant="outlined" onClick={() => session.undoLastOrder()} startIcon={<GameIcon name="undo" />}>
              Volver
            </Button>
          )}
          {!ordersCommitted && ordersLeft <= 0 && (
            <Button
              onClick={() => session.commitOrders() && play("stamp")}
              startIcon={<GameIcon name="confirm" />}
            >
              Confirmar Órdenes
            </Button>
          )}
          {ordersCommitted && (
            <Button onClick={() => session.startMovement()} startIcon={<GameIcon name="map" />}>
              Fase Movimiento
            </Button>
          )}
        </Stack>
      </div>
    </div>
  );
}

export default OrdersView;
