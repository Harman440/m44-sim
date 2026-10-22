import { useState } from "react";
import { Box, ButtonBase, Stack, Typography } from "@mui/material";
import type { ActionCard } from "../../../game-core/actionCard";
import { Faction } from "../../../types/faction";
import ActionCardComponent from "../../ActionCardComponent";
import CardDialog, { ShownCard } from "../../CardDialog";
import GameIcon from "../../GameIcon";
import CoinCount from "../../CoinCount";
import { defineMessages, useLabels, useMessages } from "../../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    coinsLabel: (coins: string) => `Suministros: ${coins}`,
    coinsUnit: (n: number) => `${n === 1 ? "suministro" : "suministros"} · ver cuentas`,
    cardPlayed: "Carta jugada",
    tapToSee: "Toca la carta para verla",
    noCardPlayed: "No jugaste carta este turno.",
  },
  en: {
    coinsLabel: (coins: string) => `Supplies: ${coins}`,
    coinsUnit: (n: number) => `${n === 1 ? "supply" : "supplies"} · see ledger`,
    cardPlayed: "Card played",
    tapToSee: "Tap the card to see it",
    noCardPlayed: "You played no card this turn.",
  },
});

interface BattleReserveProps {
  faction: Faction;
  coins: number;
  /** Open the coin ledger */
  onShowCoins: () => void;
  /** The card played this turn, if any */
  card: ActionCard | null;
  /** What it cost the side */
  cost?: number;
}

/**
 * The battle's side panel: the coins, large, and the card played with the orders. Tapping the
 * card shows it in full.
 */
function BattleReserve({ faction, coins, onShowCoins, card, cost }: BattleReserveProps) {
  const [looking, setLooking] = useState(false);
  const t = useMessages(TEXT);
  const labels = useLabels();
  const shown: ShownCard | null = looking && card ? { action: card, cost } : null;

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

      <Box component="section" aria-labelledby="battle-card-title" data-testid="battle-card" className="battle-reserve__cards">
        <Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="h6" component="h3" id="battle-card-title">
            {t.cardPlayed}
          </Typography>
          {card && (
            <Typography variant="body2" color="text.secondary">
              {t.tapToSee}
            </Typography>
          )}
        </Stack>

        {card ? (
          <Box className="battle-reserve__hand">
            <ActionCardComponent card={card} cost={cost} onClick={() => setLooking(true)} />
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
            {t.noCardPlayed}
          </Typography>
        )}
      </Box>

      <CardDialog card={shown} faction={faction} onClose={() => setLooking(false)} label={t.cardPlayed} />
    </Box>
  );
}

export default BattleReserve;
