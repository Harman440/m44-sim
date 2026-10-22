import { lazy, Suspense, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
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
import type { ActionCard } from "../../game-core/actionCard";
import GameSession from "../../game-core/gameSession";
import CardsView from "./GameViews/CardsView";
import OrdersView from "./GameViews/OrdersView";
import BattleView from "./GameViews/BattleView";
import WaitingView from "./GameViews/WaitingView";
import ParadropView from "./GameViews/ParadropView";
import MovementView from "./GameViews/MovementView";
import EndOfTurnView from "./GameViews/EndOfTurnView";
import LargeMap from "./GameViews/LargeMap";
import { OpponentContext } from "../OpponentContext";
import { defineMessages, useLabels, useMessages, useTr } from "../../i18n/useI18n";
import { useSettings } from "../../settings";
import { useSound } from "../../sound";
import FactionInsignia from "../FactionInsignia";
import GameIcon from "../GameIcon";
import CoinCount from "../CoinCount";
import SettingsDialog from "../SettingsDialog";
import HistoryDialog from "../HistoryDialog";
import CoinsDialog from "../CoinsDialog";
import "./GameView.css";
import MedalTally from "../MedalTally";

const RuleBookDialog = lazy(() => import("../RuleBookDialog"));

export interface GameViewProps {
  /** Owns all game rules; React re-renders when it publishes a new snapshot */
  session: GameSession;
  /** The game was restored from a save (e.g. after a reload) */
  resumed?: boolean;
  /** Leave the game and go back to the menu */
  onExit: () => void;
  /** Pass and play: hand the device to the other player */
  onPass?: () => void;
  /** The hand on show was already dealt (pass and play: this side's player has seen it before) */
  handDealt?: boolean;
}

const TEXT = defineMessages({
  es: {
    phases: { card: "Carta", orders: "Órdenes", movement: "Movimiento", battle: "Batalla", final: "Final" },
    testMode: "Modo prueba",
    extraTurn: "Turno 1 · extra",
    turn: (n: number) => `Turno ${n}`,
    coinsLabel: (coins: string) => `Suministros: ${coins}`,
    mute: "Silenciar sonidos",
    unmute: "Activar sonidos",
    menu: "Menú",
    history: "Historial",
    ruleBook: "Reglamento",
    settings: "Ajustes",
    exitToMenu: "Salir al menú",
    resumed: (n: number) => `Partida recuperada · Turno ${n}`,
    confirmExitTitle: "¿Salir al menú?",
    confirmExitText: "Se perderá la partida en curso.",
    keepPlaying: "Seguir jugando",
    exit: "Salir",
    pass: "Pasar",
    passLabel: "Pasar el dispositivo al rival",
  },
  en: {
    phases: { card: "Card", orders: "Orders", movement: "Movement", battle: "Battle", final: "Final" },
    testMode: "Test mode",
    extraTurn: "Turn 1 · extra",
    turn: (n: number) => `Turn ${n}`,
    coinsLabel: (coins: string) => `Supplies: ${coins}`,
    mute: "Mute sounds",
    unmute: "Turn sounds on",
    menu: "Menu",
    history: "History",
    ruleBook: "Rule book",
    settings: "Settings",
    exitToMenu: "Exit to menu",
    resumed: (n: number) => `Game resumed · Turn ${n}`,
    confirmExitTitle: "Exit to menu?",
    confirmExitText: "The game in progress will be lost.",
    keepPlaying: "Keep playing",
    exit: "Exit",
    pass: "Pass",
    passLabel: "Pass the device to the opponent",
  },
});

const PHASE_STEPS: { phase: TurnPhase; label: keyof (typeof TEXT)["es"]["phases"] }[] = [
  { phase: TurnPhase.PICK_CARDS, label: "card" },
  { phase: TurnPhase.ORDER_UNITS, label: "orders" },
  { phase: TurnPhase.MOVEMENT, label: "movement" },
  { phase: TurnPhase.BATTLE, label: "battle" },
  { phase: TurnPhase.END_OF_TURN, label: "final" },
];

function GameView({ session, resumed = false, onExit, onPass, handDealt = false }: GameViewProps) {
  const { scenario, faction } = session;
  const { settings, updateSettings } = useSettings();
  const play = useSound();
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [coinsOpen, setCoinsOpen] = useState(false);
  const [ruleBookOpen, setRuleBookOpen] = useState(false);
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [showResumed, setShowResumed] = useState(resumed);
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);
  /**
   * The card just played: the orders screen slides the rest of the hand away
   * (`handLeaving`), and "Cambiar carta" puts it back in the Command Zone's tray
   */
  const [lastPlay, setLastPlay] = useState<ActionCard | null>(null);
  const [handLeaving, setHandLeaving] = useState(false);
  const pickingOrOrdering = game.phase === TurnPhase.PICK_CARDS || game.phase === TurnPhase.ORDER_UNITS;
  useEffect(() => {
    if (!pickingOrOrdering) setLastPlay(null);
  }, [pickingOrOrdering]);

  // Pass and play: both armies are in the app
  const shared = useContext(OpponentContext) !== null;

  // Cards already animated into the hand. Kept here (UI state, not game state)
  // so it survives CardsView unmounting during the other phases.
  // A resumed game's hand was already dealt before the reload.
  const [dealtCardIds, setDealtCardIds] = useState<ReadonlySet<string>>(
    () => new Set(resumed || handDealt ? session.getSnapshot().cards.map(({ card }) => card.id) : [])
  );

  const handleCardDealt = useCallback((card: ActionCard) => {
    setDealtCardIds((prev) => new Set(prev).add(card.id));
  }, []);

  return (
    // Animations follow the device's "reduce motion" setting. Only the game
    // screens animate, so motion stays out of the menu's download.
    <MotionConfig reducedMotion="user">
      <Box className="game-screen" sx={{ width: "100%", maxWidth: 1400 }}>
        <Box
          component="header"
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            flex: "none",
            mb: 1.5,
            pb: 1,
            borderBottom: "3px double",
            borderColor: "divider",
          }}
        >
          <Stack direction="row" sx={{ alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
            <FactionInsignia faction={faction} size={34} decorative />
            <Typography variant="h6" component="p" sx={{ mr: 1, lineHeight: 1.1 }}>
              {tr(scenario.name)} · {labels.factions[faction]}
            </Typography>
            {session.testMode && <Chip label={t.testMode} color="warning" size="small" />}
            <Chip label={game.extraTurn ? t.extraTurn : t.turn(game.turn)} color="secondary" size="small" />
            {PHASE_STEPS.map(({ phase, label }, i) => (
              <Chip
                key={phase}
                label={`${i + 1}. ${t.phases[label]}`}
                color={phase === game.phase ? "primary" : "default"}
                variant={phase === game.phase ? "filled" : "outlined"}
                size="small"
                aria-current={phase === game.phase ? "step" : undefined}
                sx={{ fontFamily: "var(--m44-font-display)", letterSpacing: "0.05em", borderRadius: 0.5 }}
              />
            ))}
          </Stack>
          <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
            {/* Pass and play: each side's medals */}
            <MedalTally />
            {/* The battle shows the coins large in its own screen */}
            {game.phase !== TurnPhase.BATTLE && (
              <Button
                variant="outlined"
                onClick={() => setCoinsOpen(true)}
                startIcon={<GameIcon name="coins" />}
                aria-label={t.coinsLabel(labels.coins(game.coins))}
                data-testid="coin-counter"
                color={game.coins < 0 ? "error" : "primary"}
              >
                <CoinCount coins={game.coins} />
              </Button>
            )}
            <IconButton
              aria-label={settings.sound ? t.mute : t.unmute}
              aria-pressed={settings.sound}
              onClick={() => updateSettings({ sound: !settings.sound })}
              sx={{ color: "text.primary" }}
            >
              <GameIcon name={settings.sound ? "soundOn" : "soundOff"} size={26} />
            </IconButton>
            {onPass && (
              <Button variant="outlined" onClick={onPass} startIcon={<GameIcon name="pass" />} aria-label={t.passLabel}>
                {t.pass}
              </Button>
            )}
            <Button
              variant="text"
              id="game-menu-button"
              aria-controls={menuAnchor ? "game-menu" : undefined}
              aria-haspopup="true"
              aria-expanded={menuAnchor ? "true" : undefined}
              onClick={(e) => setMenuAnchor(e.currentTarget)}
            >
              {t.menu}
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
              <ListItemText>{t.history}</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                setRuleBookOpen(true);
              }}
              sx={{ minHeight: 48 }}
            >
              <ListItemIcon sx={{ color: "inherit" }}>
                <GameIcon name="ruleBook" />
              </ListItemIcon>
              <ListItemText>{t.ruleBook}</ListItemText>
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
              <ListItemText>{t.settings}</ListItemText>
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
              <ListItemText>{t.exitToMenu}</ListItemText>
            </MenuItem>
          </Menu>
        </Box>

        <Box component="main" className="game-screen__main">
          {game.phase === TurnPhase.PARADROP && <ParadropView faction={faction} session={session} game={game} />}

          {game.phase === TurnPhase.AWAIT_ATTACKER && (
            <WaitingView attacker={scenario.attacker} onStart={() => session.startFirstTurn()} />
          )}

          {game.phase === TurnPhase.PICK_CARDS && (
            <CardsView
              cards={game.cards}
              dealtCardIds={dealtCardIds}
              onCardDealt={handleCardDealt}
              onPlay={(card) => {
                if (!session.pickCard(card)) return;
                if (card) play("cardPlay");
                setLastPlay(card);
                setHandLeaving(card !== null);
              }}
              coins={game.coins}
              extraTurn={game.extraTurn}
              largeMap={shared ? <LargeMap session={session} faction={faction} /> : undefined}
              initialPick={lastPlay}
            />
          )}

          {game.phase === TurnPhase.ORDER_UNITS && (
            <OrdersView
              faction={faction}
              session={session}
              game={game}
              handLeaving={handLeaving}
              onHandGone={() => setHandLeaving(false)}
            />
          )}

          {game.phase === TurnPhase.MOVEMENT && <MovementView faction={faction} session={session} game={game} />}

          {game.phase === TurnPhase.BATTLE && (
            <BattleView
              faction={faction}
              session={session}
              game={game}
              onEndBattle={() => session.endBattle()}
              onShowCoins={() => setCoinsOpen(true)}
            />
          )}

          {game.phase === TurnPhase.END_OF_TURN && (
            <EndOfTurnView faction={faction} session={session} game={game} onEndTurn={() => session.endTurn()} />
          )}
        </Box>

        <Snackbar
          open={showResumed}
          autoHideDuration={3000}
          onClose={() => setShowResumed(false)}
          message={t.resumed(game.turn)}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        />

        <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <CoinsDialog open={coinsOpen} onClose={() => setCoinsOpen(false)} session={session} game={game} />
        <HistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} session={session} log={game.log} />
        {ruleBookOpen && (
          <Suspense fallback={null}>
            <RuleBookDialog open onClose={() => setRuleBookOpen(false)} />
          </Suspense>
        )}

        <Dialog open={confirmingExit} onClose={() => setConfirmingExit(false)}>
          <DialogTitle>{t.confirmExitTitle}</DialogTitle>
          <DialogContent>
            <DialogContentText>{t.confirmExitText}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" onClick={() => setConfirmingExit(false)}>
              {t.keepPlaying}
            </Button>
            <Button color="error" onClick={onExit}>
              {t.exit}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </MotionConfig>
  );
}

export default GameView;
