import { ReactNode, useState } from "react";
import { Box, Button, ButtonBase, Stack, Typography } from "@mui/material";
import { CombatCard } from "../../../game-core/combatCard";
import { Faction } from "../../../types/faction";
import CombatCardComponent from "../../CombatCardComponent";
import CardDialog, { ShownCard } from "../../CardDialog";
import GameIcon from "../../GameIcon";
import CoinCount from "../../CoinCount";
import { defineMessages, useLabels, useMessages, useTr } from "../../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    coinsLabel: (coins: string) => `Suministros: ${coins}`,
    coinsUnit: (n: number) => `${n === 1 ? "suministro" : "suministros"} · ver cuentas`,
    noCardsExtraTurn: "En el turno extra no se juegan cartas de combate.",
    combatCards: "Cartas de combate",
    alreadyPlayed: "ya has jugado la de esta batalla",
    onePerBattle: "1 por batalla · toca una para verla y jugarla",
    played: (cost: string): ReactNode => (
      <>
        <strong>Jugada</strong> · pagada: {cost}
      </>
    ),
    undo: "Deshacer",
    noBattleCards: "No tienes cartas de combate para la batalla.",
    missing: (n: number, coins: string) => `Te ${n === 1 ? "falta" : "faltan"} ${coins}`,
    combatCard: "Carta de combate",
    playLabel: (card: string) => `Jugar ${card}`,
    play: (cost: string) => `Jugar (${cost})`,
  },
  en: {
    coinsLabel: (coins: string) => `Supplies: ${coins}`,
    coinsUnit: (n: number) => `${n === 1 ? "supply" : "supplies"} · see ledger`,
    noCardsExtraTurn: "Combat cards aren't played in the extra turn.",
    combatCards: "Combat cards",
    alreadyPlayed: "you've already played this battle's card",
    onePerBattle: "1 per battle · tap one to see it and play it",
    played: (cost: string): ReactNode => (
      <>
        <strong>Played</strong> · paid: {cost}
      </>
    ),
    undo: "Undo",
    noBattleCards: "You have no combat cards for the battle.",
    missing: (_n: number, coins: string) => `You need ${coins} more`,
    combatCard: "Combat card",
    playLabel: (card: string) => `Play ${card}`,
    play: (cost: string) => `Play (${cost})`,
  },
});

interface BattleReserveProps {
  faction: Faction;
  coins: number;
  /** Open the coin ledger */
  onShowCoins: () => void;
  /** False in the attacker's extra first turn */
  canPlayCombatCards: boolean;
  /** The battle combat cards in hand */
  battleCards: readonly CombatCard[];
  /** The battle combat card played this battle */
  played: CombatCard | null;
  /** The played card can still be taken back (its bonus isn't used yet) */
  canUndo: boolean;
  /** Shown under the played card: what it still lets the player do (Ambush's shot) */
  playedAction?: ReactNode;
  /** Why a card can't be played now, e.g. ¡Fusiles arriba! once a unit has fired; null when it can */
  blockedReason?: (card: CombatCard) => string | null;
  onPlay: (card: CombatCard) => boolean;
  onUndo: () => void;
}

/**
 * What the player can spend in the battle: the coins, large, and the battle
 * combat cards. Tapping a card shows it in full, where it is played.
 */
function BattleReserve({
  faction,
  coins,
  onShowCoins,
  canPlayCombatCards,
  battleCards,
  played,
  canUndo,
  playedAction,
  blockedReason = () => null,
  onPlay,
  onUndo,
}: BattleReserveProps) {
  const [looking, setLooking] = useState<CombatCard | null>(null);
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const shown: ShownCard | null = looking && { combat: looking };
  const missing = (card: CombatCard) => card.cost - coins;
  const blocked = looking ? blockedReason(looking) : null;

  return (
    <Box className="battle-reserve">
      <ButtonBase
        onClick={onShowCoins}
        aria-label={t.coinsLabel(labels.coins(coins))}
        data-testid="coin-counter"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          px: 2,
          py: 1,
          borderRadius: "var(--m44-radius)",
          color: coins < 0 ? "error.main" : "var(--m44-primary)",
          "&:focus-visible": { outline: "3px solid var(--m44-primary)", outlineOffset: 2 },
        }}
      >
        <GameIcon name="coins" size={56} />
        <Stack sx={{ alignItems: "flex-start" }}>
          <Typography component="span" sx={{ fontFamily: "var(--m44-font-display)", fontSize: 64, lineHeight: 1 }}>
            <CoinCount coins={coins} />
          </Typography>
          <Typography component="span" variant="body2" color="text.secondary">
            {t.coinsUnit(coins)}
          </Typography>
        </Stack>
      </ButtonBase>

      {!canPlayCombatCards ? (
        <Typography variant="body2" color="text.secondary">
          {t.noCardsExtraTurn}
        </Typography>
      ) : (
        <Box component="section" aria-labelledby="battle-combat-title" data-testid="battle-combat-cards" className="battle-reserve__cards">
          <Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="h6" component="h3" id="battle-combat-title">
              {t.combatCards}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {played ? t.alreadyPlayed : t.onePerBattle}
            </Typography>
          </Stack>

          {played ? (
            <Stack sx={{ alignItems: "center", gap: 1 }}>
              <CombatCardComponent faction={faction} card={played} onClick={setLooking} selected />
              <Typography variant="body2">
                {t.played(labels.coins(played.cost))}
              </Typography>
              {playedAction}
              {canUndo && (
                <Button variant="outlined" onClick={onUndo} startIcon={<GameIcon name="undo" />}>
                  {t.undo}
                </Button>
              )}
            </Stack>
          ) : battleCards.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
              {t.noBattleCards}
            </Typography>
          ) : (
            <Box className="battle-reserve__hand">
              {battleCards.map((card) => (
                <Stack key={card.id} sx={{ alignItems: "center", gap: 0.5 }}>
                  <CombatCardComponent faction={faction} card={card} onClick={setLooking} disabled={missing(card) > 0} />
                  {missing(card) > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      {t.missing(missing(card), labels.coins(missing(card)))}
                    </Typography>
                  )}
                </Stack>
              ))}
            </Box>
          )}
        </Box>
      )}

      <CardDialog card={shown} faction={faction} onClose={() => setLooking(null)} label={t.combatCard}>
        {looking && !played && (
          <>
            {missing(looking) > 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mr: "auto" }}>
                {t.missing(missing(looking), labels.coins(missing(looking)))}
              </Typography>
            ) : (
              blocked && (
                <Typography variant="body2" color="text.secondary" sx={{ mr: "auto" }}>
                  {blocked}
                </Typography>
              )
            )}
            <Button
              onClick={() => onPlay(looking) && setLooking(null)}
              disabled={missing(looking) > 0 || !!blocked}
              aria-label={t.playLabel(tr(looking.name))}
              startIcon={<GameIcon name="cards" />}
            >
              {t.play(labels.coins(looking.cost))}
            </Button>
          </>
        )}
      </CardDialog>
    </Box>
  );
}

export default BattleReserve;
