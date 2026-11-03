import { useEffect, useState, useSyncExternalStore } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { appliedFaces, readRoll } from "../../../game-core/rollResult";
import InfoButton from "../../InfoButton";
import PassAndPlayMatch, { CollisionView, MovementView, otherSide } from "../../../game-core/passAndPlay";
import { samePosition } from "../../../game-core/position";
import { turnedRound } from "../../../game-core/BoardManager";
import { BoardSize, boardSizeOf } from "../../../game-core/boardSize";
import { Faction } from "../../../types/faction";
import { Position } from "../../../types/scenario";
import Board from "../../Board";
import GameIcon from "../../GameIcon";
import PlayedCards, { playedCardOf } from "../../PlayedCards";
import ShotDice from "../../ShotDice";
import FactionInsignia from "../../FactionInsignia";
import { defineMessages, useLabels, useMessages } from "../../../i18n/useI18n";
import "../GameView.css";
import "./PhaseLayout.css";
import MedalTally from "../../MedalTally";
import { PAINTINGS } from "../../cardPaintings";

const TEXT = defineMessages({
  es: {
    title: (turn: number) => `Turno ${turn}: las órdenes`,
    noCard: "Sin carta",
    help: "Las cartas jugadas y las órdenes de los dos bandos. Toca una carta para leerla entera.",
    move: "Mover las unidades",
    moveHelp: "Todas las unidades avanzan a la vez, casilla a casilla. Las que se encuentran con el enemigo se paran y chocan, y el choque se resuelve antes de la casilla siguiente.",
    stepping: (step: number) => (step === 0 ? "Las unidades se ponen en marcha…" : `Casilla ${step}…`),
    pushing: "Una unidad retrocede, casilla a casilla…",
    pick: (unit: string, side: string) => `${unit} (${side}) no puede volver por donde vino: toca en el mapa la casilla a la que retrocede.`,
    over: "Las unidades han terminado de moverse.",
    moved: (turn: number) => `Turno ${turn}: el movimiento`,
    noCollisions: "Ninguna unidad ha chocado.",
    noCollisionsYet: "Ningún choque por ahora.",
    rollNext: (n: number) => `Tirar el choque ${n}`,
    overruns: (n: number) =>
      n === 1
        ? "Un blindado con Blindados adelante atravesó infantería enemiga: le sale una bandera (queda inmovilizada, o se retira si ya lo estaba)."
        : `${n} veces un blindado con Blindados adelante atravesó infantería enemiga: a cada una le sale una bandera (queda inmovilizada, o se retira si ya lo estaba).`,
    overrun: (armour: string, infantry: string) => `Blindado (${armour}) atravesó infantería (${infantry})`,
    collisions: (n: number) => (n === 1 ? "Un choque: tiran las dos unidades." : `${n} choques: en cada uno tiran las dos unidades.`),
    collisionRule:
      "Las dos unidades se quedan en la casilla hasta resolverlo. Dados de asalto cercano menos 1, sin contar el terreno. Cada bandera inmoviliza y hace retroceder 1 casilla, por donde vino la unidad (si no puede, su jugador elige una casilla que no esté más cerca del enemigo; si no hay ninguna, pierde una figura). Sin banderas, retrocede 1 casilla la que llegó después; si llegaron a la vez, las dos. El choque es el disparo de la unidad este turno, y las dos dejan de moverse.",
    collision: (n: number) => `Choque ${n}`,
    kinds: { "same-hex": "Entran en la misma casilla", crossing: "Se cruzan", standing: "Entra en la casilla enemiga" },
    unit: (unit: string, side: string) => `${unit} · ${side}`,
    cantBattle: "No combate: su orden no le deja disparar, o ya se ha retirado.",
    go: { Allies: "Seguir: empiezan los Aliados", Axis: "Seguir: empieza el Eje" },
    rollFirst: "Tira el choque para seguir moviendo.",
    rules: "Reglas del choque",
    dealt: (hits: number, flags: number) =>
      [hits === 1 ? "1 impacto" : `${hits} impactos`, flags === 1 ? "1 bandera" : `${flags} banderas`].join(", "),
    noBattle: "no combate",
    seeDice: "Ver dados",
    close: "Cerrar",
  },
  en: {
    title: (turn: number) => `Turn ${turn}: the orders`,
    noCard: "No card",
    help: "The cards played and both sides' orders. Tap a card to read all of it.",
    move: "Move the units",
    moveHelp: "Every unit moves at once, one hex at a time. Units that run into the enemy stop and collide, and the collision is settled before the next hex.",
    stepping: (step: number) => (step === 0 ? "The units set off…" : `Hex ${step}…`),
    pushing: "A unit falls back, one hex at a time…",
    pick: (unit: string, side: string) => `${unit} (${side}) can't go back the way it came: tap the hex it falls back to on the map.`,
    over: "The units have finished moving.",
    moved: (turn: number) => `Turn ${turn}: the movement`,
    noCollisions: "No unit collided.",
    noCollisionsYet: "No collision so far.",
    rollNext: (n: number) => `Roll collision ${n}`,
    overruns: (n: number) =>
      n === 1
        ? "Armor with Armor Forward went through enemy infantry: it takes a flag (pinned, or it retreats if it was pinned already)."
        : `${n} times armor with Armor Forward went through enemy infantry: each takes a flag (pinned, or it retreats if it was pinned already).`,
    overrun: (armour: string, infantry: string) => `Armor (${armour}) went through infantry (${infantry})`,
    collisions: (n: number) => (n === 1 ? "One collision: both units roll." : `${n} collisions: both units roll in each.`),
    collisionRule:
      "Both units stay on the hex until it's settled. Close assault dice minus 1, terrain doesn't count. Each flag pins the unit and pushes it back 1 hex, the way it came (if it can't, its player picks a hex that isn't nearer the enemy; if there's none, it loses a figure). With no flag, the unit that got there later goes back 1 hex; if they got there at once, both do. The collision is the unit's shot this turn, and both stop moving.",
    collision: (n: number) => `Collision ${n}`,
    kinds: { "same-hex": "They enter the same hex", crossing: "They cross", standing: "It enters the enemy's hex" },
    unit: (unit: string, side: string) => `${unit} · ${side}`,
    cantBattle: "It doesn't battle: its order doesn't let it fire, or it has already retreated.",
    go: { Allies: "Go on: the Allies start", Axis: "Go on: the Axis starts" },
    rollFirst: "Roll the collision to go on moving.",
    rules: "Collision rules",
    dealt: (hits: number, flags: number) =>
      [hits === 1 ? "1 hit" : `${hits} hits`, flags === 1 ? "1 flag" : `${flags} flags`].join(", "),
    noBattle: "doesn't battle",
    seeDice: "See the dice",
    close: "Close",
  },
});

interface RevealViewProps {
  match: PassAndPlayMatch;
  turn: number;
  /** The side whose view of the map is shown */
  viewer: Faction;
}

const noop = () => {};

/** Between two steps of the movement: a little longer than a unit's glide to its next hex */
const STEP_MS = 800;
/** Between two hexes of a unit pushed back */
const PUSH_MS = 600;

/** The unit of a collision standing on this hex, for its name (a unit pushed is always in one) */
const collisionUnitAt = (movement: MovementView, position: Position, side: Faction) =>
  movement.collisions.flatMap((collision) => collision.units).find((unit) => unit.side === side && samePosition(unit.position, position)) ?? null;

/** Where a collision is marked, in the viewer's view: the hex fought over, or both units' hexes for a crossing */
const markOf = (collision: CollisionView, viewer: Faction, size: BoardSize): Position[] =>
  inView(collision.hex ? [collision.hex] : collision.units.map((unit) => unit.position), viewer, size);

/** Hexes in the Allies' view, turned to the viewer's */
const inView = (hexes: Position[], viewer: Faction, size: BoardSize): Position[] =>
  viewer === "Axis" ? hexes.map((hex) => turnedRound(hex, size)) : hexes;

/**
 * Pass and play, once both sides have given their orders (in the extra first turn, the
 * attacker): both cards played and both armies' orders on one map; then the app moves every
 * unit at once and both units of each collision roll, before the turn goes on
 */
function RevealView({ match, turn, viewer }: RevealViewProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const { movement } = useSyncExternalStore(match.subscribe, match.getSnapshot);
  // Collisions rolled on this screen, so their dice are thrown in once
  const [justRolled, setJustRolled] = useState<ReadonlySet<number>>(new Set());
  /** The collision whose dice are on show */
  const [shown, setShown] = useState<number | null>(null);
  const session = match.sessions[viewer];
  const game = session.getSnapshot();
  const moved = movement?.turn === turn ? movement : null;

  const roll = (index: number) => {
    if (!match.rollCollision(index)) return;
    setJustRolled((prev) => new Set(prev).add(index));
    setShown(index);
  };

  // The units go on by themselves, a hex at a time, slow enough to follow each one glide (the
  // board's 700 ms); they wait for a collision's roll, and for its dice to be closed
  // (each change to the match is a new snapshot, so a new `moved`: the next timer)
  const waiting = moved?.waiting ?? null;
  useEffect(() => {
    if (!moved || (waiting !== "step" && waiting !== "push") || shown !== null) return;
    const timer = setTimeout(() => match.advanceMovement(), waiting === "push" ? PUSH_MS : STEP_MS);
    return () => clearTimeout(timer);
  }, [match, moved, waiting, shown]);

  const size = boardSizeOf(match.scenario);
  const choice = moved?.choice ?? null;
  const choiceOptions = choice ? inView([...choice.options], viewer, size) : [];
  const pickHex = (position: Position) => {
    if (!choice) return;
    match.choosePush(inView([position], viewer, size)[0]!);
  };
  const choosing = choice && collisionUnitAt(moved!, choice.position, choice.side);
  const nextToRoll = moved?.collisions.findIndex((collision) => !collision.rolled) ?? -1;

  return (
    // GameView's header is above it, and its MotionConfig round it
    <>
          <div className="phase-layout">
            <div className="phase-layout__board">
              <Board
                zoomable
                onTileClick={choice ? pickHex : noop}
                unitHexPosition={null}
                possibleMovePositions={choiceOptions}
                possibleMoveAndFirePositions={[]}
                boardManager={session.board}
                orders={game.orders}
                markers={game.markers}
                markerKind={game.markerKinds}
                camouflaged={game.camouflaged}
                backgroundImage={session.scenario.image}
                faction={viewer}
                opponent={match.opponentOf(viewer)}
                fog={match.fogOn(viewer)}
                strength={game.strength}
                collisions={[
                  ...(moved?.collisions.map((collision) => markOf(collision, viewer, boardSizeOf(match.scenario))) ?? []),
                  ...(moved?.overruns.map((overrun) => inView([overrun.hex], viewer, boardSizeOf(match.scenario))) ?? []),
                ]}
                // Until "Mover" the armies stand where they started; then they glide a hex at a time
                atStart={!moved}
                unitPositions={match.unitsNow(viewer)}
              />
            </div>

            <div className="phase-layout__controls">
              {moved ? (
                <>
                  {/* Units that collide fight it out at close quarters: the Close Assault painting heads the column */}
                  {moved.collisions.length > 0 && (
                    <Box
                      component="img"
                      src={PAINTINGS["close-assault"]}
                      alt=""
                      data-testid="collision-painting"
                      sx={{ display: "block", width: "100%", aspectRatio: "3 / 2", objectFit: "contain", borderRadius: 1, bgcolor: "var(--m44-paper-alt)" }}
                    />
                  )}
                  <Typography variant="h6" component="h1" sx={{ textAlign: "center" }}>
                    {t.moved(turn)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {moved.collisions.length > 0 ? t.collisions(moved.collisions.length) : moved.done ? t.noCollisions : t.noCollisionsYet}
                  </Typography>
                  {moved.collisions.length > 0 && (
                    <InfoButton title={t.rules} label={t.rules}>
                      <Typography variant="body1">{t.collisionRule}</Typography>
                    </InfoButton>
                  )}
                  {/* One line per collision; its dice in a dialog, opened as it's rolled */}
                  {moved.collisions.map((collision, i) => (
                    <Stack key={i} component="section" aria-label={t.collision(i + 1)} spacing={0.5} data-testid="collision">
                      <Typography variant="subtitle2" component="h2">
                        {t.collision(i + 1)} · {t.kinds[collision.kind]}
                      </Typography>
                      {collision.units.map((unit) => {
                        const result = unit.roll && readRoll(appliedFaces(unit.roll.faces, unit.roll.kept), unit.roll.target);
                        return (
                          <Stack key={unit.side} direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
                            <FactionInsignia faction={unit.side} size={20} decorative />
                            <Typography variant="body2">
                              {labels.units[unit.unitType]}
                              {collision.rolled && ` · ${result ? t.dealt(result.hits, result.retreats) : t.noBattle}`}
                            </Typography>
                          </Stack>
                        );
                      })}
                      {/* A collision to roll has its button at the foot of the column, always in sight */}
                      {collision.rolled && (
                        <Button variant="text" size="small" onClick={() => setShown(i)} startIcon={<GameIcon name="dice" />}>
                          {t.seeDice}
                        </Button>
                      )}
                    </Stack>
                  ))}
                  {/* Armor Forward through infantry: no roll, the infantry takes a flag */}
                  {moved.overruns.length > 0 && (
                    <Stack component="section" spacing={0.5} data-testid="overruns">
                      <Typography variant="body2" color="text.secondary">
                        {t.overruns(moved.overruns.length)}
                      </Typography>
                      {moved.overruns.map((overrun, i) => (
                        <Stack key={i} direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
                          <FactionInsignia faction={overrun.armour} size={20} decorative />
                          <Typography variant="body2">
                            {t.overrun(labels.factions[overrun.armour], labels.factions[overrun.infantry])}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                  {/* Kept in sight at the foot of the column, however long the list of collisions */}
                  <Box sx={{ mt: "auto", display: "flex", flexDirection: "column", gap: 0.5, position: "sticky", bottom: 0, pt: 1, bgcolor: "background.default" }}>
                    {/* What the movement is doing, or waiting for */}
                    <Typography variant="body2" color={waiting === "choice" ? "warning.main" : "text.secondary"} data-testid="movement-status" aria-live="polite">
                      {moved.done
                        ? t.over
                        : waiting === "collision"
                          ? t.rollFirst
                          : waiting === "choice" && choosing
                            ? t.pick(labels.units[choosing.unitType], labels.factions[choosing.side])
                            : waiting === "push"
                              ? t.pushing
                              : t.stepping(moved.step)}
                    </Typography>
                    {waiting === "collision" && nextToRoll >= 0 ? (
                      <Button onClick={() => roll(nextToRoll)} startIcon={<GameIcon name="dice" />}>
                        {t.rollNext(nextToRoll + 1)}
                      </Button>
                    ) : (
                      <Button onClick={() => match.finishReveal()} disabled={!moved.done} startIcon={<GameIcon name="battle" />}>
                        {t.go[match.scenario.attacker]}
                      </Button>
                    )}
                  </Box>
                </>
              ) : (
                <>
                  <Typography variant="h6" component="h1" sx={{ textAlign: "center" }}>
                    {t.title(turn)}
                  </Typography>
                  <MedalTally />
                  <Typography variant="body2" color="text.secondary">
                    {t.help}
                  </Typography>
                  {[viewer, otherSide(viewer)].map((faction) => {
                    const side = match.sessions[faction].getSnapshot();
                    return (
                      <Stack key={faction} component="section" className="reveal-side" aria-label={labels.factions[faction]} spacing={0.5}>
                        <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                          <FactionInsignia faction={faction} size={28} decorative />
                          <Typography variant="subtitle1" component="h2">
                            {labels.factions[faction]}
                          </Typography>
                        </Stack>
                        {side.playedCard ? (
                          <PlayedCards {...playedCardOf(side)} />
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {t.noCard}
                          </Typography>
                        )}
                      </Stack>
                    );
                  })}
                  <Box sx={{ mt: "auto", display: "flex", flexDirection: "column", gap: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t.moveHelp}
                    </Typography>
                    <Button onClick={() => match.moveUnits()} startIcon={<GameIcon name="map" />}>
                      {t.move}
                    </Button>
                  </Box>
                </>
              )}
            </div>
          </div>

        {shown !== null && moved?.collisions[shown] && (() => {
          const collision = moved.collisions[shown]!;
          return (
            <Dialog open onClose={() => setShown(null)} fullWidth maxWidth="sm">
              <DialogTitle>
                {t.collision(shown + 1)} · {t.kinds[collision.kind]}
              </DialogTitle>
              <DialogContent>
                <Stack spacing={2}>
                  {collision.units.map((unit) => (
                    <Stack key={unit.side} spacing={0.5}>
                      <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                        <FactionInsignia faction={unit.side} size={22} decorative />
                        <Typography variant="body2">{t.unit(labels.units[unit.unitType], labels.factions[unit.side])}</Typography>
                      </Stack>
                      {unit.roll ? (
                        <ShotDice
                          shot={unit.roll}
                          rollId={shown + 1}
                          faction={unit.side}
                          rolling={justRolled.has(shown)}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          {t.cantBattle}
                        </Typography>
                      )}
                    </Stack>
                  ))}
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button variant="text" onClick={() => setShown(null)}>
                  {t.close}
                </Button>
              </DialogActions>
            </Dialog>
          );
        })()}
    </>
  );
}

export default RevealView;
