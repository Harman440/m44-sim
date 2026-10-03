import { ReactNode, useState } from "react";
import { Box, Button, ButtonBase, Stack, Typography } from "@mui/material";
import { CombatCard } from "../../../game-core/combatCard";
import { Faction } from "../../../types/faction";
import { coinsText } from "../../../labels";
import CombatCardComponent from "../../CombatCardComponent";
import CardDialog, { ShownCard } from "../../CardDialog";
import GameIcon from "../../GameIcon";
import CoinCount from "../../CoinCount";

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
  onPlay,
  onUndo,
}: BattleReserveProps) {
  const [looking, setLooking] = useState<CombatCard | null>(null);
  const shown: ShownCard | null = looking && { combat: looking };
  const missing = (card: CombatCard) => card.cost - coins;

  return (
    <Box className="battle-reserve">
      <ButtonBase
        onClick={onShowCoins}
        aria-label={`Suministros: ${coinsText(coins)}`}
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
            {coins === 1 ? "suministro" : "suministros"} · ver cuentas
          </Typography>
        </Stack>
      </ButtonBase>

      {!canPlayCombatCards ? (
        <Typography variant="body2" color="text.secondary">
          En el turno extra no se juegan cartas de combate.
        </Typography>
      ) : (
        <Box component="section" aria-labelledby="battle-combat-title" data-testid="battle-combat-cards" className="battle-reserve__cards">
          <Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="h6" component="h3" id="battle-combat-title">
              Cartas de combate
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {played ? "ya has jugado la de esta batalla" : "1 por batalla · toca una para verla y jugarla"}
            </Typography>
          </Stack>

          {played ? (
            <Stack sx={{ alignItems: "center", gap: 1 }}>
              <CombatCardComponent faction={faction} card={played} onClick={setLooking} selected />
              <Typography variant="body2">
                <strong>Jugada</strong> · pagada: {coinsText(played.cost)}
              </Typography>
              {playedAction}
              {canUndo && (
                <Button variant="outlined" onClick={onUndo} startIcon={<GameIcon name="undo" />}>
                  Deshacer
                </Button>
              )}
            </Stack>
          ) : battleCards.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
              No tienes cartas de combate para la batalla.
            </Typography>
          ) : (
            <Box className="battle-reserve__hand">
              {battleCards.map((card) => (
                <Stack key={card.id} sx={{ alignItems: "center", gap: 0.5 }}>
                  <CombatCardComponent faction={faction} card={card} onClick={setLooking} disabled={missing(card) > 0} />
                  {missing(card) > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      Te {missing(card) === 1 ? "falta" : "faltan"} {coinsText(missing(card))}
                    </Typography>
                  )}
                </Stack>
              ))}
            </Box>
          )}
        </Box>
      )}

      <CardDialog card={shown} faction={faction} onClose={() => setLooking(null)} label="Carta de combate">
        {looking && !played && (
          <>
            {missing(looking) > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mr: "auto" }}>
                Te {missing(looking) === 1 ? "falta" : "faltan"} {coinsText(missing(looking))}
              </Typography>
            )}
            <Button
              onClick={() => onPlay(looking) && setLooking(null)}
              disabled={missing(looking) > 0}
              aria-label={`Jugar ${looking.name}`}
              startIcon={<GameIcon name="cards" />}
            >
              Jugar ({coinsText(looking.cost)})
            </Button>
          </>
        )}
      </CardDialog>
    </Box>
  );
}

export default BattleReserve;
