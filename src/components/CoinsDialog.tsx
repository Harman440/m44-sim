import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import GameSession, { GameSnapshot } from "../game-core/gameSession";
import { signedCoins } from "../labels";
import { defineMessages, useLabels, useMessages } from "../i18n/useI18n";
import GameIcon from "./GameIcon";
import CoinCount from "./CoinCount";
import { AnimatePresence, motion } from "motion/react";

const TEXT = defineMessages({
  es: {
    title: "Suministros",
    extraTurn: "En el turno extra los dados de suministro dan suministros, pero no se gastan hasta el turno siguiente.",
    thisTurn: "Este turno",
    nothingYet: "Nada todavía. Cada dado de suministro que no es impacto da 1 suministro.",
    byHand: "A mano",
    byHandHint: "Corrige aquí el contador si hace falta.",
    oneLess: "Un suministro menos",
    oneMore: "Un suministro más",
    pay: (n: number) => `Pagar ${n}`,
    add: (n: number) => `Añadir ${n}`,
    undo: (amount: string) => `Deshacer ${amount}`,
    close: "Cerrar",
  },
  en: {
    title: "Supplies",
    extraTurn: "In the extra turn the supply dice give supplies, but they can't be spent until the next turn.",
    thisTurn: "This turn",
    nothingYet: "Nothing yet. Each supply die that isn't a hit gives 1 supply.",
    byHand: "By hand",
    byHandHint: "Fix the counter here if needed.",
    oneLess: "One supply less",
    oneMore: "One supply more",
    pay: (n: number) => `Pay ${n}`,
    add: (n: number) => `Add ${n}`,
    undo: (amount: string) => `Undo ${amount}`,
    close: "Close",
  },
});

interface CoinsDialogProps {
  open: boolean;
  onClose: () => void;
  session: GameSession;
  game: GameSnapshot;
}

/**
 * The coin counter: what this turn earned and spent, and paying or adding
 * coins by hand (e.g. a combat card played at the table). Orders and supply faces
 * add up by themselves; undoing them gives the coins back.
 */
function CoinsDialog({ open, onClose, session, game }: CoinsDialogProps) {
  const [amount, setAmount] = useState(1);
  const t = useMessages(TEXT);
  const labels = useLabels();
  const { palette } = useTheme();
  const { coins, coinEntries, canAdjustCoins } = game;
  const lastAdjustment = coinEntries.findLast((entry) => entry.kind === "adjustment");

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t.title}</DialogTitle>
      <DialogContent dividers>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "center", gap: 1, mb: 2 }}>
          <GameIcon name="coins" size={40} />
          <Typography variant="h3" component="p" data-testid="coin-balance" color={coins < 0 ? "error" : "text.primary"}>
            <CoinCount coins={coins} />
          </Typography>
        </Stack>

        {game.extraTurn && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t.extraTurn}
          </Alert>
        )}

        <Typography variant="subtitle2" component="h3">
          {t.thisTurn}
        </Typography>
        {coinEntries.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t.nothingYet}
          </Typography>
        ) : (
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }} data-testid="coin-ledger">
            {/* New lines slide in and undone ones slide out; the lines already there when it opens stay still */}
            <AnimatePresence initial={false}>
              {coinEntries.map((entry, i) => (
                <motion.li
                  key={i}
                  layout
                  initial={{ opacity: 0, x: entry.amount < 0 ? -24 : 24, backgroundColor: alpha(palette.warning.main, 0.35) }}
                  animate={{ opacity: 1, x: 0, backgroundColor: alpha(palette.warning.main, 0) }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.35, backgroundColor: { duration: 1.2 } }}
                  style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "2px 0", overflow: "hidden" }}
                >
                  <Typography variant="body2">{labels.describeCoinEntry(entry)}</Typography>
                  <Typography variant="body2" color={entry.amount < 0 ? "error" : "success.main"}>
                    {signedCoins(entry.amount)}
                  </Typography>
                </motion.li>
              ))}
            </AnimatePresence>
          </Box>
        )}

        {canAdjustCoins && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" component="h3">
              {t.byHand}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t.byHandHint}
            </Typography>
            <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <IconButton
                aria-label={t.oneLess}
                onClick={() => setAmount((n) => Math.max(1, n - 1))}
                disabled={amount <= 1}
                sx={{ width: 48, height: 48, border: 1, borderColor: "divider" }}
              >
                −
              </IconButton>
              <Typography variant="h6" component="p" sx={{ minWidth: 32, textAlign: "center" }} aria-live="polite">
                {amount}
              </Typography>
              <IconButton
                aria-label={t.oneMore}
                onClick={() => setAmount((n) => n + 1)}
                sx={{ width: 48, height: 48, border: 1, borderColor: "divider" }}
              >
                +
              </IconButton>
              <Button color="warning" disabled={amount > coins} onClick={() => session.adjustCoins(-amount)}>
                {t.pay(amount)}
              </Button>
              <Button variant="outlined" onClick={() => session.adjustCoins(amount)}>
                {t.add(amount)}
              </Button>
            </Stack>
            {lastAdjustment && (
              <Button
                variant="text"
                startIcon={<GameIcon name="undo" />}
                onClick={() => session.undoCoinAdjustment()}
                sx={{ mt: 1 }}
              >
                {t.undo(signedCoins(lastAdjustment.amount))}
              </Button>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t.close}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default CoinsDialog;
