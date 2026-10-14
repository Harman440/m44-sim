import { useState, useSyncExternalStore } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { MotionConfig } from "motion/react";
import PassAndPlayMatch from "../../../game-core/passAndPlay";
import { UnitType } from "../../../game-core/unit";
import { Faction } from "../../../types/faction";
import Board from "../../Board";
import GameIcon from "../../GameIcon";
import FireDialog from "../../FireDialog";
import HexThumbnail from "../../HexThumbnail";
import FactionInsignia from "../../FactionInsignia";
import BattleReserve from "./BattleReserve";
import CoinsDialog from "../../CoinsDialog";
import { OpponentContext } from "../../OpponentContext";
import { useSound } from "../../../sound";
import { defineMessages, useLabels, useMessages } from "../../../i18n/useI18n";
import "./PhaseLayout.css";

const TEXT = defineMessages({
  es: {
    title: (turn: number) => `Turno ${turn}: la batalla`,
    fires: { Allies: "Disparan los Aliados", Axis: "Dispara el Eje" },
    groups: { unmoved: "Unidades que no se movieron", moved: "Unidades que se movieron" },
    tapUnit: "Toca la unidad que dispara.",
    figures: (n: number) => (n === 1 ? "1 figura" : `${n} figuras`),
    hold: "No disparar",
    holdLabel: (unit: string) => `${unit}: no disparar`,
    nobody: "Ninguna unidad puede disparar ya.",
    choose: (n: number) => `Sacó más resultados que figuras: en el disparo, toca los ${n} dados que aplica.`,
    apply: "Aplicar los resultados",
    cards: { Allies: "Cartas de los Aliados", Axis: "Cartas del Eje" },
    cardsPrivate: "Solo su jugador mira estas cartas.",
    close: "Cerrar",
    end: "Terminar la batalla",
    confirmEndTitle: "¿Terminar la batalla?",
    confirmEndText: (n: number) =>
      n === 1 ? "Una unidad aún puede disparar y perderá su disparo." : `${n} unidades aún pueden disparar y perderán su disparo.`,
    keepFighting: "Seguir",
  },
  en: {
    title: (turn: number) => `Turn ${turn}: the battle`,
    fires: { Allies: "The Allies fire", Axis: "The Axis fires" },
    groups: { unmoved: "Units that didn't move", moved: "Units that moved" },
    tapUnit: "Tap the unit that fires.",
    figures: (n: number) => (n === 1 ? "1 figure" : `${n} figures`),
    hold: "Hold fire",
    holdLabel: (unit: string) => `${unit}: hold fire`,
    nobody: "No unit can fire any more.",
    choose: (n: number) => `It rolled more results than it has figures: in the shot, tap the ${n} dice it applies.`,
    apply: "Apply the results",
    cards: { Allies: "Allied cards", Axis: "Axis cards" },
    cardsPrivate: "Only their player looks at these cards.",
    close: "Close",
    end: "End the battle",
    confirmEndTitle: "End the battle?",
    confirmEndText: (n: number) =>
      n === 1 ? "One unit can still fire and will lose its shot." : `${n} units can still fire and will lose their shot.`,
    keepFighting: "Keep fighting",
  },
});

interface SharedBattleViewProps {
  match: PassAndPlayMatch;
}

const noop = () => {};

/**
 * Pass and play's battle, on one screen for both players: the sides take turns to fire, one unit
 * at a time, and the app deals the hits. Each side's combat cards are behind its own button
 */
function SharedBattleView({ match }: SharedBattleViewProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const play = useSound();
  const { battle } = useSyncExternalStore(match.subscribe, match.getSnapshot);
  const [firing, setFiring] = useState<{ side: Faction; order: number } | null>(null);
  const [cardsOf, setCardsOf] = useState<Faction | null>(null);
  const [coinsOf, setCoinsOf] = useState<Faction | null>(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  if (!battle) return null;

  // The map as the attacker sees it, with both armies
  const viewer = match.scenario.attacker;
  const viewSession = match.sessions[viewer];
  const view = viewSession.getSnapshot();
  const side = battle.side;
  const session = side ? match.sessions[side] : null;
  const summaries = session?.orderSummaries() ?? [];
  const canStillFire = (["Allies", "Axis"] as const).reduce(
    (sum, faction) => sum + match.sessions[faction].orderSummaries().filter((s) => s.shotsLeft > 0).length,
    0
  );

  const closeFire = () => {
    // A shot whose results are picked is dealt once its dialog closes
    if (battle.pending && !battle.pending.mustChoose) match.applyShot();
    setFiring(null);
  };

  const fireSession = firing ? match.sessions[firing.side] : null;
  const fireSummary = firing && fireSession ? (fireSession.orderSummaries()[firing.order] ?? null) : null;

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
                boardManager={viewSession.board}
                orders={view.orders}
                backgroundImage={viewSession.scenario.image}
                faction={viewer}
                opponent={match.opponentOf(viewer)}
                strength={view.strength}
                firedUnits={new Set(view.orders.filter((_, i) => viewSession.orderSummaries()[i]?.shots.length).map((o) => o.unit))}
              />
            </div>

            <div className="phase-layout__controls">
              <Typography variant="h6" component="h1" sx={{ textAlign: "center" }}>
                {t.title(battle.turn)}
              </Typography>

              {battle.pending ? (
                <Stack spacing={1}>
                  {battle.pending.mustChoose && (
                    <Typography variant="body2" color="warning.main">
                      {t.choose(battle.pending.limit)}
                    </Typography>
                  )}
                  <Button
                    onClick={() => match.applyShot()}
                    disabled={battle.pending.mustChoose}
                    startIcon={<GameIcon name="confirm" />}
                  >
                    {t.apply}
                  </Button>
                </Stack>
              ) : side && session ? (
                <Stack spacing={1} data-testid="fire-turn">
                  <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                    <FactionInsignia faction={side} size={28} decorative />
                    <Typography variant="subtitle1" component="h2">
                      {t.fires[side]}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {t.groups[battle.group!]} · {t.tapUnit}
                  </Typography>
                  {battle.fireable.map((order) => {
                    const summary = summaries[order]!;
                    const figures = session.figuresAt(summary.firingFrom);
                    const unit = labels.units[summary.unitType as UnitType];
                    return (
                      <Stack key={order} direction="row" sx={{ alignItems: "center", gap: 1 }}>
                        <Button
                          variant="outlined"
                          onClick={() => setFiring({ side, order })}
                          sx={{ flex: 1, justifyContent: "flex-start", gap: 1, textTransform: "none" }}
                        >
                          <HexThumbnail
                            board={session.board}
                            position={summary.firingFrom}
                            image={session.scenario.image}
                            faction={side}
                            size={32}
                          />
                          <Box component="span" sx={{ textAlign: "left" }}>
                            {unit}
                            {figures !== null && (
                              <Typography component="span" variant="body2" color="text.secondary" sx={{ display: "block" }}>
                                {t.figures(figures)}
                              </Typography>
                            )}
                          </Box>
                        </Button>
                        <Button variant="text" size="small" aria-label={t.holdLabel(unit)} onClick={() => match.holdFire(order)}>
                          {t.hold}
                        </Button>
                      </Stack>
                    );
                  })}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t.nobody}
                </Typography>
              )}

              <Box sx={{ mt: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
                {(["Allies", "Axis"] as const).map((faction) => (
                  <Button
                    key={faction}
                    variant="outlined"
                    startIcon={<GameIcon name="cards" />}
                    onClick={() => setCardsOf(faction)}
                  >
                    {t.cards[faction]}
                  </Button>
                ))}
                <Button
                  onClick={() => (canStillFire > 0 ? setConfirmingEnd(true) : match.endBattle())}
                  disabled={!!battle.pending}
                  startIcon={<GameIcon name="endTurn" />}
                >
                  {t.end}
                </Button>
              </Box>
            </div>
          </div>
        </Box>

        {firing && fireSession && (
          <OpponentContext.Provider
            value={{ opponent: match.opponentOf(firing.side), strength: fireSession.getSnapshot().strength }}
          >
            <FireDialog
              key={`${firing.side}-${firing.order}`}
              summary={fireSummary}
              card={fireSummary?.extra ? null : fireSession.getSnapshot().activeCard}
              combatBonus={fireSession.combatBonusFor(firing.order)}
              faction={firing.side}
              board={fireSession.board}
              image={fireSession.scenario.image}
              targets={fireSession.fireTargetsFor(firing.order)}
              onFireAt={(choice) => {
                const done = match.fire(firing.order, choice.position, choice.useCombatBonus);
                if (done) play("dice");
                return done;
              }}
              longRangeDie={fireSession.longRangeDie}
              targetKinds={fireSession.targetKinds}
              knownTarget={(position) => {
                const enemy = fireSession.enemyAt(position);
                return enemy && { infantry: enemy.unitType === UnitType.INFANTRY, sandbags: enemy.sandbags };
              }}
              canFireAgain={false}
              onKeepResults={(_, kept) => match.keepShotResults(kept)}
              onClose={closeFire}
            />
          </OpponentContext.Provider>
        )}

        {cardsOf && (
          <Dialog open onClose={() => setCardsOf(null)} fullWidth maxWidth="md">
            <DialogTitle>{t.cards[cardsOf]}</DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>{t.cardsPrivate}</DialogContentText>
              {(() => {
                const owner = match.sessions[cardsOf];
                const game = owner.getSnapshot();
                return (
                  <BattleReserve
                    faction={cardsOf}
                    coins={game.coins}
                    onShowCoins={() => setCoinsOf(cardsOf)}
                    canPlayCombatCards={game.canPlayCombatCards}
                    battleCards={game.combatHand.filter((card) => card.phase === "battle")}
                    played={game.battleCombatCard}
                    canUndo={!game.shots.some((shot) => shot.combatBonus)}
                    onPlay={(card) => {
                      const done = owner.playBattleCombatCard(card);
                      if (done) play("cardPlay");
                      return done;
                    }}
                    onUndo={() => owner.undoBattleCombatCard()}
                  />
                );
              })()}
            </DialogContent>
            <DialogActions>
              <Button variant="text" onClick={() => setCardsOf(null)}>
                {t.close}
              </Button>
            </DialogActions>
          </Dialog>
        )}

        {coinsOf && (
          <CoinsDialog
            open
            onClose={() => setCoinsOf(null)}
            session={match.sessions[coinsOf]}
            game={match.sessions[coinsOf].getSnapshot()}
          />
        )}

        <Dialog open={confirmingEnd} onClose={() => setConfirmingEnd(false)}>
          <DialogTitle>{t.confirmEndTitle}</DialogTitle>
          <DialogContent>
            <DialogContentText>{t.confirmEndText(canStillFire)}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" onClick={() => setConfirmingEnd(false)}>
              {t.keepFighting}
            </Button>
            <Button
              color="error"
              onClick={() => {
                setConfirmingEnd(false);
                match.endBattle();
              }}
            >
              {t.end}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </MotionConfig>
  );
}

export default SharedBattleView;
