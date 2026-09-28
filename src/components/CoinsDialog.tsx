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
} from "@mui/material";
import GameSession, { GameSnapshot } from "../game-core/gameSession";
import { describeCoinEntry, signedCoins } from "../labels";
import GameIcon from "./GameIcon";

interface CoinsDialogProps {
  open: boolean;
  onClose: () => void;
  session: GameSession;
  game: GameSnapshot;
}

/**
 * The coin counter: what this turn earned and spent, and paying or adding
 * coins by hand (e.g. a combat card played at the table). Orders and stars
 * add up by themselves; undoing them gives the coins back.
 */
function CoinsDialog({ open, onClose, session, game }: CoinsDialogProps) {
  const [amount, setAmount] = useState(1);
  const { coins, coinEntries, canAdjustCoins } = game;
  const lastAdjustment = coinEntries.findLast((entry) => entry.kind === "adjustment");

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Monedas</DialogTitle>
      <DialogContent dividers>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "center", gap: 1, mb: 2 }}>
          <GameIcon name="coins" size={40} />
          <Typography variant="h3" component="p" data-testid="coin-balance" color={coins < 0 ? "error" : "text.primary"}>
            {coins}
          </Typography>
        </Stack>

        {game.extraTurn && (
          <Alert severity="info" sx={{ mb: 2 }}>
            En el turno extra no se ganan monedas ni se cogen cartas de combate.
          </Alert>
        )}

        <Typography variant="subtitle2" component="h3">
          Este turno
        </Typography>
        {coinEntries.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nada todavía. Las estrellas que no son impacto dan 1 moneda cada una.
          </Typography>
        ) : (
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }} data-testid="coin-ledger">
            {coinEntries.map((entry, i) => (
              <Box component="li" key={i} sx={{ display: "flex", justifyContent: "space-between", gap: 1, py: 0.25 }}>
                <Typography variant="body2">{describeCoinEntry(entry)}</Typography>
                <Typography variant="body2" color={entry.amount < 0 ? "error" : "success.main"}>
                  {signedCoins(entry.amount)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {canAdjustCoins && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" component="h3">
              A mano
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Corrige aquí el contador si hace falta.
            </Typography>
            <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <IconButton
                aria-label="Una moneda menos"
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
                aria-label="Una moneda más"
                onClick={() => setAmount((n) => n + 1)}
                sx={{ width: 48, height: 48, border: 1, borderColor: "divider" }}
              >
                +
              </IconButton>
              <Button color="warning" disabled={amount > coins} onClick={() => session.adjustCoins(-amount)}>
                Pagar {amount}
              </Button>
              <Button variant="outlined" onClick={() => session.adjustCoins(amount)}>
                Añadir {amount}
              </Button>
            </Stack>
            {lastAdjustment && (
              <Button
                variant="text"
                startIcon={<GameIcon name="undo" />}
                onClick={() => session.undoCoinAdjustment()}
                sx={{ mt: 1 }}
              >
                Deshacer {signedCoins(lastAdjustment.amount)}
              </Button>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

export default CoinsDialog;
