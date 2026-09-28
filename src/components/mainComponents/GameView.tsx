import { useCallback, useState, useSyncExternalStore } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  IconButton,
  DialogActions,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { MotionConfig } from "motion/react";
import { TurnPhase } from "../../types/gameManager";
import CommandCard from "../../game-core/commandCard";
import GameSession from "../../game-core/gameSession";
import CardsView from "./GameViews/CardsView";
import OrdersView from "./GameViews/OrdersView";
import BattleView from "./GameViews/BattleView";
import WaitingView from "./GameViews/WaitingView";
import ParadropView from "./GameViews/ParadropView";
import MovementView from "./GameViews/MovementView";
import EndOfTurnView from "./GameViews/EndOfTurnView";
import { FACTION_LABELS, coinsText } from "../../labels";
import { useSettings } from "../../settings";
import { useSound } from "../../sound";
import FactionInsignia from "../FactionInsignia";
import GameIcon from "../GameIcon";
import SettingsDialog from "../SettingsDialog";
import HistoryDialog from "../HistoryDialog";
import CoinsDialog from "../CoinsDialog";

export interface GameViewProps {
  /** Owns all game rules; React re-renders when it publishes a new snapshot */
  session: GameSession;
  /** The game was restored from a save (e.g. after a reload) */
  resumed?: boolean;
  /** Leave the game and go back to the menu */
  onExit: () => void;
}

const PHASE_STEPS: { phase: TurnPhase; label: string }[] = [
  { phase: TurnPhase.PICK_CARDS, label: "Carta" },
  { phase: TurnPhase.ORDER_UNITS, label: "Órdenes" },
  { phase: TurnPhase.MOVEMENT, label: "Movimiento" },
  { phase: TurnPhase.BATTLE, label: "Batalla" },
  { phase: TurnPhase.END_OF_TURN, label: "Final" },
];

function GameView({ session, resumed = false, onExit }: GameViewProps) {
  const { scenario, faction } = session;
  const { settings, updateSettings } = useSettings();
  const play = useSound();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [coinsOpen, setCoinsOpen] = useState(false);
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [showResumed, setShowResumed] = useState(resumed);
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);

  // Cards already animated into the hand. Kept here (UI state, not game state)
  // so it survives CardsView unmounting during the other phases.
  // A resumed game's hand was already dealt before the reload.
  const [dealtCardIds, setDealtCardIds] = useState<ReadonlySet<string>>(
    () => new Set(resumed ? session.getSnapshot().hand.map((card) => card.id) : [])
  );

  const handleCardDealt = useCallback((card: CommandCard) => {
    setDealtCardIds((prev) => new Set(prev).add(card.id));
  }, []);

  const handleDrawCard = () => {
    const playedCard = game.chosenCard;
    if (!playedCard || !session.drawCard()) return;
    play("cardPlay");

    // A discarded card can be drawn again later and should animate in again
    setDealtCardIds((prev) => {
      const next = new Set(prev);
      next.delete(playedCard.id);
      return next;
    });
  };

  return (
    // Animations follow the device's "reduce motion" setting. Only the game
    // screens animate, so motion stays out of the menu's download.
    <MotionConfig reducedMotion="user">
      <Box sx={{ width: "100%", maxWidth: 1400 }}>
        <Box
          component="header"
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            mb: 1.5,
            pb: 1,
            borderBottom: "3px double",
            borderColor: "divider",
          }}
        >
          <Stack direction="row" sx={{ alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
            <FactionInsignia faction={faction} size={34} decorative />
            <Typography variant="h6" component="p" sx={{ mr: 1, lineHeight: 1.1 }}>
              {scenario.name} · {FACTION_LABELS[faction]}
            </Typography>
            <Chip label={session.attacking ? "Atacante" : "Defensor"} variant="outlined" />
            <Chip label={game.extraTurn ? "Turno 1 · extra" : `Turno ${game.turn}`} color="secondary" />
            {PHASE_STEPS.map(({ phase, label }, i) => (
              <Chip
                key={phase}
                label={`${i + 1}. ${label}`}
                color={phase === game.phase ? "primary" : "default"}
                variant={phase === game.phase ? "filled" : "outlined"}
                aria-current={phase === game.phase ? "step" : undefined}
                sx={{ fontFamily: "var(--m44-font-display)", letterSpacing: "0.05em", borderRadius: 0.5 }}
              />
            ))}
          </Stack>
          <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
            <Button
              variant="outlined"
              onClick={() => setCoinsOpen(true)}
              startIcon={<GameIcon name="coins" />}
              aria-label={`Monedas: ${coinsText(game.coins)}`}
              data-testid="coin-counter"
              color={game.coins < 0 ? "error" : "primary"}
            >
              {game.coins}
            </Button>
            <IconButton
              aria-label={settings.sound ? "Silenciar sonidos" : "Activar sonidos"}
              aria-pressed={settings.sound}
              onClick={() => updateSettings({ sound: !settings.sound })}
              sx={{ color: "text.primary" }}
            >
              <GameIcon name={settings.sound ? "soundOn" : "soundOff"} size={26} />
            </IconButton>
            <Button
              variant="text"
              id="game-menu-button"
              aria-controls={menuAnchor ? "game-menu" : undefined}
              aria-haspopup="true"
              aria-expanded={menuAnchor ? "true" : undefined}
              onClick={(e) => setMenuAnchor(e.currentTarget)}
            >
              Menú
            </Button>
          </Stack>
          <Menu
            id="game-menu"
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            slotProps={{ list: { "aria-labelledby": "game-menu-button" } }}
          >
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                setHistoryOpen(true);
              }}
              sx={{ minHeight: 48 }}
            >
              <ListItemIcon sx={{ color: "inherit" }}>
                <GameIcon name="history" />
              </ListItemIcon>
              <ListItemText>Historial</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                setSettingsOpen(true);
              }}
              sx={{ minHeight: 48 }}
            >
              <ListItemIcon sx={{ color: "inherit" }}>
                <GameIcon name="settings" />
              </ListItemIcon>
              <ListItemText>Ajustes</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                setConfirmingExit(true);
              }}
              sx={{ minHeight: 48 }}
            >
              <ListItemIcon sx={{ color: "inherit" }}>
                <GameIcon name="exit" />
              </ListItemIcon>
              <ListItemText>Salir al menú</ListItemText>
            </MenuItem>
          </Menu>
        </Box>

        {game.phase === TurnPhase.PARADROP && <ParadropView faction={faction} session={session} game={game} />}

        {game.phase === TurnPhase.AWAIT_ATTACKER && (
          <WaitingView attacker={scenario.attacker} onStart={() => session.startFirstTurn()} />
        )}

        {game.phase === TurnPhase.PICK_CARDS && (
          <CardsView
            handCards={game.hand}
            drawPileCount={game.drawPileCount}
            discardPileCount={game.discardPileCount}
            dealtCardIds={dealtCardIds}
            onCardDealt={handleCardDealt}
            onCardClick={(card, section, combatCard) => session.pickCard(card, section, combatCard) && play("cardPlay")}
            needsSection={(card, combatCard) => session.cardNeedsSection(card, combatCard)}
            combatHand={game.combatHand}
            canPlayCombatCards={game.canPlayCombatCards}
            coins={game.coins}
            faction={faction}
          />
        )}

        {game.phase === TurnPhase.ORDER_UNITS && (
          <OrdersView faction={faction} session={session} game={game} />
        )}

        {game.phase === TurnPhase.MOVEMENT && <MovementView faction={faction} session={session} game={game} />}

        {game.phase === TurnPhase.BATTLE && (
          <BattleView faction={faction} session={session} game={game} onEndBattle={() => session.endBattle()} />
        )}

        {game.phase === TurnPhase.END_OF_TURN && (
          <EndOfTurnView
            faction={faction}
            session={session}
            game={game}
            onDrawCard={handleDrawCard}
            onKeepCard={(card) => session.keepCard(card)}
            onDrawAgain={() => session.drawAgain() && play("cardPlay")}
            onChooseReward={(choice) => session.chooseReward(choice)}
            onEndTurn={() => session.endTurn()}
          />
        )}

        <Snackbar
          open={showResumed}
          autoHideDuration={3000}
          onClose={() => setShowResumed(false)}
          message={`Partida recuperada · Turno ${game.turn}`}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        />

        <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <CoinsDialog open={coinsOpen} onClose={() => setCoinsOpen(false)} session={session} game={game} />
        <HistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} session={session} log={game.log} />

        <Dialog open={confirmingExit} onClose={() => setConfirmingExit(false)}>
          <DialogTitle>¿Salir al menú?</DialogTitle>
          <DialogContent>
            <DialogContentText>Se perderá la partida en curso.</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" onClick={() => setConfirmingExit(false)}>
              Seguir jugando
            </Button>
            <Button color="error" onClick={onExit}>
              Salir
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </MotionConfig>
  );
}

export default GameView;
