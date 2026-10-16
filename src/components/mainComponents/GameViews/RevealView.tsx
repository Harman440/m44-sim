import { useState, useSyncExternalStore } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { appliedFaces, readRoll } from "../../../game-core/rollResult";
import InfoButton from "../../InfoButton";
import { MotionConfig } from "motion/react";
import PassAndPlayMatch, { CollisionView, otherSide } from "../../../game-core/passAndPlay";
import { turnedRound } from "../../../game-core/BoardManager";
import { Faction } from "../../../types/faction";
import { Position } from "../../../types/scenario";
import Board from "../../Board";
import GameIcon from "../../GameIcon";
import PlayedCards from "../../PlayedCards";
import ShotDice from "../../ShotDice";
import FactionInsignia from "../../FactionInsignia";
import { defineMessages, useLabels, useMessages } from "../../../i18n/useI18n";
import "../GameView.css";
import "./PhaseLayout.css";

const TEXT = defineMessages({
  es: {
    title: (turn: number) => `Turno ${turn}: las órdenes`,
    help: "Las cartas jugadas y las órdenes de los dos bandos. Toca una carta para leerla entera.",
    move: "Mover las unidades",
    moveHelp: "Todas las unidades avanzan a la vez, casilla a casilla. Las que se encuentran con el enemigo se paran y chocan.",
    moved: (turn: number) => `Turno ${turn}: el movimiento`,
    noCollisions: "Ninguna unidad ha chocado.",
    collisions: (n: number) => (n === 1 ? "Un choque: tiran las dos unidades." : `${n} choques: en cada uno tiran las dos unidades.`),
    collisionRule: "Dados de asalto cercano menos 1, sin contar el terreno. Las retiradas no se pueden ignorar. El choque es el disparo de la unidad este turno.",
    collision: (n: number) => `Choque ${n}`,
    kinds: { "same-hex": "Entran en la misma casilla", crossing: "Se cruzan", standing: "Entra en la casilla enemiga" },
    unit: (unit: string, side: string) => `${unit} · ${side}`,
    roll: "Tirar los dados",
    cantBattle: "No combate: su orden no le deja disparar, o ya se retira.",
    choose: (n: number) => `Sacó más resultados que figuras: toca los ${n} dados que aplica.`,
    apply: "Aplicar los resultados",
    go: { Allies: "Seguir: empiezan los Aliados", Axis: "Seguir: empieza el Eje" },
    rollFirst: "Tira todos los choques para seguir.",
    rules: "Reglas del choque",
    dealt: (hits: number, flags: number) =>
      [hits === 1 ? "1 impacto" : `${hits} impactos`, flags === 1 ? "1 retirada" : `${flags} retiradas`].join(", "),
    noBattle: "no combate",
    seeDice: "Ver dados",
    close: "Cerrar",
  },
  en: {
    title: (turn: number) => `Turn ${turn}: the orders`,
    help: "The cards played and both sides' orders. Tap a card to read all of it.",
    move: "Move the units",
    moveHelp: "Every unit moves at once, one hex at a time. Units that run into the enemy stop and collide.",
    moved: (turn: number) => `Turn ${turn}: the movement`,
    noCollisions: "No unit collided.",
    collisions: (n: number) => (n === 1 ? "One collision: both units roll." : `${n} collisions: both units roll in each.`),
    collisionRule: "Close assault dice minus 1, terrain doesn't count. Retreats can't be ignored. The collision is the unit's shot this turn.",
    collision: (n: number) => `Collision ${n}`,
    kinds: { "same-hex": "They enter the same hex", crossing: "They cross", standing: "It enters the enemy's hex" },
    unit: (unit: string, side: string) => `${unit} · ${side}`,
    roll: "Roll the dice",
    cantBattle: "It doesn't battle: its order doesn't let it fire, or it's already retreating.",
    choose: (n: number) => `It rolled more results than it has figures: tap the ${n} dice it applies.`,
    apply: "Apply the results",
    go: { Allies: "Go on: the Allies start", Axis: "Go on: the Axis starts" },
    rollFirst: "Roll every collision to go on.",
    rules: "Collision rules",
    dealt: (hits: number, flags: number) =>
      [hits === 1 ? "1 hit" : `${hits} hits`, flags === 1 ? "1 retreat" : `${flags} retreats`].join(", "),
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

/** Where a collision is marked, in the viewer's view: the hex fought over, or both units' hexes for a crossing */
const markOf = (collision: CollisionView, viewer: Faction): Position[] => {
  const hexes = collision.hex ? [collision.hex] : collision.units.map((unit) => unit.position);
  return viewer === "Axis" ? hexes.map((hex) => turnedRound(hex)) : hexes;
};

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
  // The units each side gave a combat card to, seen from the viewer
  const cardBadges = [viewer, otherSide(viewer)].flatMap((faction) =>
    match.sessions[faction]
      .getSnapshot()
      .assignments.map((a) => ({ position: a.position && (faction === viewer ? a.position : turnedRound(a.position)) }))
  );

  const roll = (index: number) => {
    if (!match.rollCollision(index)) return;
    setJustRolled((prev) => new Set(prev).add(index));
    setShown(index);
  };

  return (
    <MotionConfig reducedMotion="user">
      <Box className="game-screen" sx={{ width: "100%", maxWidth: 1400 }}>
        <Box component="main" className="game-screen__main">
          <div className="phase-layout">
            <div className="phase-layout__board">
              <Board
                onTileClick={noop}
                unitHexPosition={null}
                possibleMovePositions={[]}
                possibleMoveAndFirePositions={[]}
                boardManager={session.board}
                orders={game.orders}
                markers={game.markers}
                markerKind={game.markerKinds}
                cardBadges={cardBadges}
                camouflaged={game.camouflaged}
                backgroundImage={session.scenario.image}
                faction={viewer}
                opponent={match.opponentOf(viewer)}
                strength={game.strength}
                collisions={moved?.collisions.map((collision) => markOf(collision, viewer)) ?? []}
                // Until "Mover" the armies stand where they started; then they glide to where they stop
                atStart={!moved}
              />
            </div>

            <div className="phase-layout__controls">
              {moved ? (
                <>
                  <Typography variant="h6" component="h1" sx={{ textAlign: "center" }}>
                    {t.moved(turn)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {moved.collisions.length === 0 ? t.noCollisions : t.collisions(moved.collisions.length)}
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
                      {collision.rolled ? (
                        <Button
                          variant={collision.applied ? "text" : "contained"}
                          size="small"
                          onClick={() => setShown(i)}
                          startIcon={<GameIcon name="dice" />}
                        >
                          {collision.applied ? t.seeDice : t.apply}
                        </Button>
                      ) : (
                        <Button onClick={() => roll(i)} startIcon={<GameIcon name="dice" />}>
                          {t.roll}
                        </Button>
                      )}
                    </Stack>
                  ))}
                  <Box sx={{ mt: "auto", display: "flex", flexDirection: "column", gap: 0.5 }}>
                    {!moved.done && (
                      <Typography variant="body2" color="text.secondary">
                        {t.rollFirst}
                      </Typography>
                    )}
                    <Button onClick={() => match.finishReveal()} disabled={!moved.done} startIcon={<GameIcon name="battle" />}>
                      {t.go[match.scenario.attacker]}
                    </Button>
                  </Box>
                </>
              ) : (
                <>
                  <Typography variant="h6" component="h1" sx={{ textAlign: "center" }}>
                    {t.title(turn)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t.help}
                  </Typography>
                  {[viewer, otherSide(viewer)].map((faction) => {
                    const side = match.sessions[faction].getSnapshot();
                    if (!side.chosenCard) return null;
                    return (
                      <Stack key={faction} component="section" className="reveal-side" aria-label={labels.factions[faction]} spacing={0.5}>
                        <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                          <FactionInsignia faction={faction} size={28} decorative />
                          <Typography variant="subtitle1" component="h2">
                            {labels.factions[faction]}
                          </Typography>
                        </Stack>
                        <PlayedCards
                          faction={faction}
                          command={side.chosenCard}
                          section={side.chosenSection}
                          combat={side.combatCardsPlayed}
                          assignments={side.assignments}
                        />
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
        </Box>

        {shown !== null && moved?.collisions[shown] && (() => {
          const collision = moved.collisions[shown]!;
          return (
            <Dialog open onClose={() => setShown(null)} fullWidth maxWidth="sm">
              <DialogTitle>
                {t.collision(shown + 1)} · {t.kinds[collision.kind]}
              </DialogTitle>
              <DialogContent>
                <Stack spacing={2}>
                  {collision.units.map((unit, u) => (
                    <Stack key={unit.side} spacing={0.5}>
                      <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                        <FactionInsignia faction={unit.side} size={22} decorative />
                        <Typography variant="body2">{t.unit(labels.units[unit.unitType], labels.factions[unit.side])}</Typography>
                      </Stack>
                      {unit.mustChoose && (
                        <Typography variant="body2" color="warning.main">
                          {t.choose(unit.limit)}
                        </Typography>
                      )}
                      {unit.roll ? (
                        <ShotDice
                          shot={unit.roll}
                          rollId={shown + 1}
                          faction={unit.side}
                          rolling={justRolled.has(shown)}
                          onKeepResults={
                            collision.applied ? undefined : (kept) => match.keepCollisionResults(shown, u as 0 | 1, kept)
                          }
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
                {collision.applied ? (
                  <Button variant="text" onClick={() => setShown(null)}>
                    {t.close}
                  </Button>
                ) : (
                  <Button
                    onClick={() => match.applyCollision(shown) && setShown(null)}
                    disabled={collision.units.some((unit) => unit.mustChoose)}
                    startIcon={<GameIcon name="confirm" />}
                  >
                    {t.apply}
                  </Button>
                )}
              </DialogActions>
            </Dialog>
          );
        })()}
      </Box>
    </MotionConfig>
  );
}

export default RevealView;
