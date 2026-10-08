import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import GameSession, { GameSnapshot } from "../game-core/gameSession";
import { Position } from "../types/scenario";
import { includesPosition } from "../game-core/position";
import { Faction } from "../types/faction";
import { BASE_DICE_BY_DISTANCE } from "../data/fireQuestions";
import Board from "./Board";
import FireAim, { FireAimChoice } from "./FireAim";
import { ShotResult } from "./FireDialog";
import HexThumbnail from "./HexThumbnail";
import { useHexFlash } from "./useHexFlash";
import "./FireDialog.css";
import { defineMessages, useLabels, useMessages } from "../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    undoTitle: "¿Anular el disparo de la emboscada?",
    undoWarning: "Anúlalo solo si se registró por error. La tirada se borra y podrás disparar de nuevo.",
    confirmMistake: "Confirmo que fue un error",
    outcome: "Si la unidad enemiga se retira o es eliminada, su ataque no se hace. Si no, ataca como siempre.",
    whichUnit: "¿Qué unidad atacan?",
    pickUnit:
      "Toca tu unidad que la unidad enemiga ataca en asalto cercano. Luego toca la casilla del atacante: tu unidad dispara primero.",
    noUnits: "Ninguna unidad tuya puede disparar en asalto cercano.",
    back: "Volver",
    undoShot: "Anular disparo",
    changeUnit: "Cambiar unidad",
    close: "Cerrar",
    title: (unit: string | null) => `Emboscada${unit ? `: ${unit}` : ""}`,
    closeAssaultDice: (n: number) => `Asalto cercano: ${n} dados`,
  },
  en: {
    undoTitle: "Cancel the ambush shot?",
    undoWarning: "Cancel it only if it was recorded by mistake. The roll is erased and you can fire again.",
    confirmMistake: "I confirm it was a mistake",
    outcome: "If the enemy unit retreats or is eliminated, its attack doesn't happen. If not, it attacks as usual.",
    whichUnit: "Which unit is attacked?",
    pickUnit:
      "Tap your unit that the enemy unit attacks in close assault. Then tap the attacker's hex: your unit fires first.",
    noUnits: "None of your units can fire in close assault.",
    back: "Back",
    undoShot: "Cancel shot",
    changeUnit: "Change unit",
    close: "Close",
    title: (unit: string | null) => `Ambush${unit ? `: ${unit}` : ""}`,
    closeAssaultDice: (n: number) => `Close assault: ${n} dice`,
  },
});

interface AmbushDialogProps {
  open: boolean;
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
  /** The shot was just rolled (for the dice sound) */
  onFired: () => void;
  onClose: () => void;
}

/**
 * Ambush: as soon as the card is played, the player taps their unit that the
 * enemy attacks in close assault, then the attacker's hex, as when firing
 * (FireAim): the dice are worked out and rolled, and this side fires first.
 */
function AmbushDialog({ open, faction, session, game, onFired, onClose }: AmbushDialogProps) {
  const fullScreen = useMediaQuery("(max-width: 899px), (max-height: 599px)");
  const t = useMessages(TEXT);
  const labels = useLabels();
  const [from, setFrom] = useState<Position | null>(null);
  const [justFired, setJustFired] = useState(false);
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const [undoChecked, setUndoChecked] = useState(false);
  const { flash, flashInvalid } = useHexFlash();
  const { board } = session;
  const image = session.scenario.image;
  const { ambush } = game;
  const context = from && !ambush ? session.ambushContext(from) : null;

  const close = () => {
    setFrom(null);
    setJustFired(false);
    setConfirmingUndo(false);
    setUndoChecked(false);
    onClose();
  };

  const pickUnit = (position: Position) => {
    if (includesPosition(game.ambushUnits, position)) setFrom(position);
    else if (board.getHex(position)?.hasUnit()) flashInvalid(position);
  };

  const handleFire = (choice: FireAimChoice) => {
    if (!from || !session.ambushAt(from, choice)) return;
    setJustFired(true);
    onFired();
  };

  const handleUndo = () => {
    if (!session.undoAmbush()) return;
    setConfirmingUndo(false);
    setUndoChecked(false);
    setJustFired(false);
    setFrom(null);
  };

  const content = () => {
    if (ambush && confirmingUndo) {
      return (
        <>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {t.undoTitle}
          </Typography>
          <Alert severity="error" sx={{ mb: 2 }}>
            {t.undoWarning}
          </Alert>
          <FormControlLabel
            control={<Checkbox checked={undoChecked} onChange={(e) => setUndoChecked(e.target.checked)} />}
            label={t.confirmMistake}
            sx={{ minHeight: 48 }}
          />
        </>
      );
    }

    if (ambush) {
      return (
        <Stack sx={{ gap: 2 }}>
          <ShotResult
            shot={ambush}
            number={null}
            unitType={ambush.unitType}
            faction={faction}
            board={board}
            image={image}
            rolling={justFired}
            onKeepResults={(kept) => session.keepAmbushResults(kept)}
          />
          <Alert severity="info">
            {t.outcome}
          </Alert>
        </Stack>
      );
    }

    if (from && context) {
      return (
        <FireAim
          board={board}
          image={image}
          faction={faction}
          from={from}
          targets={session.ambushTargets(from)}
          context={context}
          card={null}
          longRangeDie={false}
          targetKinds={session.targetKinds}
          onFire={handleFire}
        />
      );
    }

    return (
      <Box className="fire-aim">
        <Stack className="fire-aim__map" sx={{ gap: 1 }}>
          <Box className="fire-aim__board" data-testid="ambush-map">
            <Board
              onTileClick={pickUnit}
              unitHexPosition={null}
              possibleMovePositions={[]}
              possibleMoveAndFirePositions={[]}
              boardManager={board}
              orders={[]}
              backgroundImage={image}
              invalidFlash={flash}
              orderablePositions={game.ambushUnits}
              focus={game.ambushUnits}
              faction={faction}
            />
          </Box>
        </Stack>
        <Stack className="fire-aim__questions" sx={{ gap: 1.5 }}>
          <Typography variant="h6" component="h3">
            {t.whichUnit}
          </Typography>
          <Typography>{t.pickUnit}</Typography>
          {game.ambushUnits.length === 0 && (
            <Alert severity="warning">{t.noUnits}</Alert>
          )}
        </Stack>
      </Box>
    );
  };

  const actions = () => {
    if (ambush && confirmingUndo) {
      return (
        <>
          <Button variant="outlined" onClick={() => setConfirmingUndo(false)}>
            {t.back}
          </Button>
          <Button color="error" disabled={!undoChecked} onClick={handleUndo}>
            {t.undoShot}
          </Button>
        </>
      );
    }
    return (
      <>
        {ambush && (
          <Button variant="text" color="error" size="small" onClick={() => setConfirmingUndo(true)} sx={{ mr: "auto" }}>
            {t.undoShot}
          </Button>
        )}
        {!ambush && from && (
          <Button variant="outlined" onClick={() => setFrom(null)}>
            {t.changeUnit}
          </Button>
        )}
        <Button variant="text" onClick={close}>
          {t.close}
        </Button>
      </>
    );
  };

  const firing = ambush ? { position: ambush.from, unitType: ambush.unitType } : context && from && { position: from, unitType: context.unitType };
  const onMap = !ambush;

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      fullScreen={onMap && fullScreen}
      maxWidth={onMap ? "lg" : "sm"}
      slotProps={{ paper: { className: onMap ? "fire-dialog fire-dialog--map" : "fire-dialog" } }}
    >
      <DialogTitle>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <span>{t.title(firing ? labels.units[firing.unitType] : null)}</span>
          {firing && (
            <Stack direction="row" component="span" sx={{ alignItems: "center", gap: 1 }} data-testid="ambush-unit">
              <HexThumbnail board={board} position={firing.position} image={image} faction={faction} size={32} />
              <Typography component="span" variant="body2" color="text.secondary">
                {t.closeAssaultDice(BASE_DICE_BY_DISTANCE[firing.unitType][0]!)}
              </Typography>
            </Stack>
          )}
        </Stack>
      </DialogTitle>
      <DialogContent>{content()}</DialogContent>
      <DialogActions>{actions()}</DialogActions>
    </Dialog>
  );
}

export default AmbushDialog;
