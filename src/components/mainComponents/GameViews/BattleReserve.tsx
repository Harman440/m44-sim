import { ReactNode, useState } from "react";
import { Box, ButtonBase, Stack, Typography } from "@mui/material";
import { CombatCard } from "../../../game-core/combatCard";
import { UnitType } from "../../../game-core/unit";
import { Faction } from "../../../types/faction";
import CombatCardComponent from "../../CombatCardComponent";
import CardDialog, { ShownCard } from "../../CardDialog";
import GameIcon from "../../GameIcon";
import CoinCount from "../../CoinCount";
import { defineMessages, useLabels, useMessages } from "../../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    coinsLabel: (coins: string) => `Suministros: ${coins}`,
    coinsUnit: (n: number) => `${n === 1 ? "suministro" : "suministros"} · ver cuentas`,
    combatCards: "Cartas de combate jugadas",
    playedWithOrders: "Se jugaron con las órdenes · toca una para verla",
    noCardsPlayed: "No jugaste cartas de combate este turno.",
    givenTo: (unit: string) => `A: ${unit}`,
    combatCard: "Carta de combate",
  },
  en: {
    coinsLabel: (coins: string) => `Supplies: ${coins}`,
    coinsUnit: (n: number) => `${n === 1 ? "supply" : "supplies"} · see ledger`,
    combatCards: "Combat cards played",
    playedWithOrders: "Played with the orders · tap one to see it",
    noCardsPlayed: "You played no combat cards this turn.",
    givenTo: (unit: string) => `To: ${unit}`,
    combatCard: "Combat card",
  },
});

interface BattleReserveProps {
  faction: Faction;
  coins: number;
  /** Open the coin ledger */
  onShowCoins: () => void;
  /** The combat cards played with the orders this turn */
  played: readonly CombatCard[];
  /** The ones given to a unit, and the unit */
  assignments?: readonly { card: CombatCard; unitType: UnitType }[];
  /** Shown under the cards: what they still let the player do (¡Fusiles arriba!: pick the unit that fires first) */
  playedAction?: ReactNode;
}

/**
 * The battle's side panel: the coins, large, and the combat cards played with
 * the orders (none is played in the battle). Tapping a card shows it in full.
 */
function BattleReserve({ faction, coins, onShowCoins, played, assignments = [], playedAction }: BattleReserveProps) {
  const [looking, setLooking] = useState<CombatCard | null>(null);
  const t = useMessages(TEXT);
  const labels = useLabels();
  const shown: ShownCard | null = looking && { combat: looking };

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

      <Box component="section" aria-labelledby="battle-combat-title" data-testid="battle-combat-cards" className="battle-reserve__cards">
        <Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="h6" component="h3" id="battle-combat-title">
            {t.combatCards}
          </Typography>
          {played.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              {t.playedWithOrders}
            </Typography>
          )}
        </Stack>

        {played.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
            {t.noCardsPlayed}
          </Typography>
        ) : (
          <Box className="battle-reserve__hand">
            {played.map((card) => {
              const given = assignments.find((a) => a.card === card);
              return (
                <Stack key={card.id} sx={{ alignItems: "center", gap: 0.5 }}>
                  <CombatCardComponent faction={faction} card={card} onClick={setLooking} />
                  {given && <Typography variant="caption">{t.givenTo(labels.units[given.unitType])}</Typography>}
                </Stack>
              );
            })}
          </Box>
        )}
        {playedAction}
      </Box>

      <CardDialog card={shown} faction={faction} onClose={() => setLooking(null)} label={t.combatCard} />
    </Box>
  );
}

export default BattleReserve;
