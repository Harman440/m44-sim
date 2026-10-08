import { ReactNode, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import CommandCard from "../game-core/commandCard";
import { Faction } from "../types/faction";
import { ShotRoll } from "../game-core/gameSession";
import { Position } from "../types/scenario";
import { FireContext } from "../game-core/fireRules";
import { FireTarget } from "../game-core/fireTargets";
import BoardManager from "../game-core/BoardManager";
import { OrderSummary } from "../game-core/turnSummary";
import { BASE_DICE_BY_DISTANCE } from "../data/fireQuestions";
import ShotDice from "./ShotDice";
import ShotSteps from "./ShotSteps";
import { UnitType } from "../game-core/unit";
import FireAim, { FireAimChoice } from "./FireAim";
import { TargetKinds } from "../data/hitRules";
import HexThumbnail from "./HexThumbnail";
import GameIcon from "./GameIcon";
import { BarbedWireIcon } from "./BarbedWire";
import { DICE_TEXT } from "./DicePool";
import { Localized } from "../i18n/lang";
import { defineMessages, useLabels, useMessages, useTr } from "../i18n/useI18n";
import "./FireDialog.css";

const TEXT = defineMessages({
  es: {
    moreInfo: "Más información",
    shotNumber: (n: number) => `Disparo ${n}`,
    removedWire: (number: number | null) => `${number !== null ? `Disparo ${number}: ` : ""}quitó la alambrada, sin disparar`,
    collision: "Choque",
    noEffect: "0 dados: el disparo no tuvo efecto",
    undoTitle: "¿Anular el último disparo?",
    undoWarning:
      "Anula el último disparo de esta unidad solo si se registró por error. La tirada se borra y la unidad podrá disparar de nuevo.",
    confirmMistake: "Confirmo que fue un error",
    takeGroundInfo:
      "¿El objetivo se retiró o fue eliminado? La unidad puede tomar terreno: se mueve a su casilla y combate otra vez, solo en asalto cercano.",
    takeGround: "Tomar terreno",
    freeHex: "¿Casilla libre?",
    groundTakenInfo: "Ya está en la casilla tomada en el mapa, y combate otra vez desde ahí en asalto cercano.",
    undo: "Deshacer",
    groundTaken: "Terreno tomado",
    opponentFires: "Ahora dispara el rival.",
    opponentFiresRest: " Si no le quedan unidades por disparar en este grupo, vuelves a disparar tú.",
    fireAgain: (left: number) => `Disparar otra vez (queda${left === 1 ? "" : "n"} ${left})`,
    onWire: "La unidad está en una alambrada",
    wireQuestion: "¿La quita (y no dispara este turno) o dispara con 1 dado menos?",
    removeWire: "Quitar alambrada",
    fireFromWire: "Disparar (−1 dado)",
    back: "Volver",
    cancelShot: "Anular disparo",
    goBack: "Atrás",
    close: "Cerrar",
    title: (unit: string) => `Disparo: ${unit}`,
    closeAssaultOnly: (dice: string) => `Solo asalto cercano: ${dice}`,
    range: (range: string) => `Alcance: ${range}`,
  },
  en: {
    moreInfo: "More information",
    shotNumber: (n: number) => `Shot ${n}`,
    removedWire: (number: number | null) => `${number !== null ? `Shot ${number}: ` : ""}removed the barbed wire, without firing`,
    collision: "Collision",
    noEffect: "0 dice: the shot had no effect",
    undoTitle: "Cancel the last shot?",
    undoWarning:
      "Cancel this unit's last shot only if it was recorded by mistake. The roll is erased and the unit can fire again.",
    confirmMistake: "I confirm it was a mistake",
    takeGroundInfo:
      "Did the target retreat or was it eliminated? The unit can take ground: it moves into its hex and battles again, in close assault only.",
    takeGround: "Take ground",
    freeHex: "Hex empty?",
    groundTakenInfo: "It's already on the hex it took on the map, and battles again from there in close assault.",
    undo: "Undo",
    groundTaken: "Ground taken",
    opponentFires: "Now your opponent fires.",
    opponentFiresRest: " If they have no units left to fire in this group, you fire again.",
    fireAgain: (left: number) => `Fire again (${left} left)`,
    onWire: "The unit is on barbed wire",
    wireQuestion: "Does it remove it (and not fire this turn) or fire with 1 die less?",
    removeWire: "Remove barbed wire",
    fireFromWire: "Fire (−1 die)",
    back: "Back",
    cancelShot: "Cancel shot",
    goBack: "Back",
    close: "Close",
    title: (unit: string) => `Fire: ${unit}`,
    closeAssaultOnly: (dice: string) => `Close assault only: ${dice}`,
    range: (range: string) => `Range: ${range}`,
  },
});

interface FireDialogProps {
  /** The firing unit's order; the dialog is closed when null */
  summary: OrderSummary | null;
  card: CommandCard | null;
  /** A battle combat card this unit could use on this shot (Spotter…) */
  combatBonus?: FireContext["combatBonus"];
  faction: Faction;
  board: BoardManager;
  /** The scenario's board art, for the map */
  image?: string;
  /** The hexes the unit can fire at from where it stands */
  targets: readonly FireTarget[];
  /** Fire at a hex picked on the map; the session works out and rolls the dice */
  onFireAt: (choice: FireAimChoice) => boolean;
  /** The last shot was a close assault that lets the unit take ground and fire again */
  canTakeGround?: boolean;
  onTakeGround?: () => boolean;
  onUndoTakeGround?: () => boolean;
  /** The unit stands on barbed wire and may remove it instead of firing (infantry) */
  canRemoveWire?: boolean;
  onRemoveWire?: () => boolean;
  /** The game rolls the 8-sided long-range die at targets that aren't adjacent */
  longRangeDie?: boolean;
  /** What the enemy can have in the scenario */
  targetKinds: TargetKinds;
  /** Take back the unit's last shot (a mistake) */
  onUndoShot: () => boolean;
  /** Apply only some of the dice of the unit's shot `shotNumber` (or all, with null) */
  onKeepResults: (shotNumber: number, kept: number[] | null) => boolean;
  onClose: () => void;
}

/** Reminders for resolving the hits on the table, e.g. sandbags */
function ShotNotes({ notes }: { notes: readonly Localized[] }) {
  const tr = useTr();
  if (notes.length === 0) return null;
  return (
    <Stack sx={{ gap: 0.5, mt: 1 }} data-testid="shot-notes">
      {notes.map((note) => (
        <Alert key={note.es} severity="info" sx={{ py: 0 }}>
          {tr(note)}
        </Alert>
      ))}
    </Stack>
  );
}

/** An "i" in a circle */
function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="7.5" r="1.4" fill="currentColor" />
      <rect x="10.9" y="10.5" width="2.2" height="7" rx="1" fill="currentColor" />
    </svg>
  );
}

/**
 * A short line with its action, and an info button that shows the
 * explanation underneath (a tap, not a hover, for the tablet).
 */
function ExplainedAction({
  children,
  info,
  action,
  testId,
}: {
  children: ReactNode;
  info: string;
  action: ReactNode;
  testId?: string;
}) {
  const t = useMessages(TEXT);
  const [open, setOpen] = useState(false);
  return (
    <Box data-testid={testId} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "var(--m44-radius)", px: 1 }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <GameIcon name="battle" size={22} />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {children}
        </Typography>
        <IconButton aria-label={t.moreInfo} aria-expanded={open} onClick={() => setOpen((o) => !o)} sx={{ width: 48, height: 48 }}>
          <InfoIcon />
        </IconButton>
        <Box sx={{ ml: "auto" }}>{action}</Box>
      </Stack>
      <Collapse in={open} unmountOnExit>
        <Typography variant="body2" color="text.secondary" sx={{ pb: 1 }}>
          {info}
        </Typography>
      </Collapse>
    </Box>
  );
}

interface ShotResultProps {
  shot: ShotRoll & { removedWire?: Position };
  number: number | null;
  /** The firing unit's type */
  unitType: UnitType;
  faction: Faction;
  board: BoardManager;
  image?: string;
  /** Just rolled: throw the dice in */
  rolling?: boolean;
  /** Apply only some of the dice (or all, with null) */
  onKeepResults?: (kept: number[] | null) => boolean;
}

export function ShotResult({ shot, number, unitType, faction, board, image, rolling, onKeepResults }: ShotResultProps) {
  const t = useMessages(TEXT);
  if (shot.removedWire) {
    return (
      <Stack direction="row" data-testid="shot-result" sx={{ alignItems: "center", gap: 1.5 }}>
        <BarbedWireIcon size={48} />
        <Typography variant="h6">{t.removedWire(number)}</Typography>
      </Stack>
    );
  }
  return (
    <Box data-testid="shot-result">
      {(number !== null || shot.collision) && (
        <Typography variant="overline" color="text.secondary">
          {[number !== null && t.shotNumber(number), shot.collision && t.collision].filter(Boolean).join(" · ")}
        </Typography>
      )}
      <ShotSteps
        shot={shot}
        unitType={unitType}
        faction={faction}
        targetHex={
          shot.targetPosition && (
            <HexThumbnail board={board} position={shot.targetPosition} image={image} faction={faction} size={28} />
          )
        }
      />
      {shot.dice === 0 && (
        <Typography variant="h6" sx={{ mt: 1 }}>
          {t.noEffect}
        </Typography>
      )}
      <ShotDice
        shot={shot}
        rollId={number ?? 1}
        faction={faction}
        rolling={rolling}
        onKeepResults={onKeepResults}
      />
      <ShotNotes notes={shot.notes} />
    </Box>
  );
}

/**
 * Firing with one unit. The target is picked on a map of the hexes the unit
 * can reach (FireAim), which answers the distance and terrain; the player
 * says what unit it is and whether it has sandbags, and the dice are worked
 * out. Once rolled, the shot stands: opening the unit again shows the result, and only
 * a deliberate "Anular disparo" takes it back. After a close assault, armour
 * (or infantry with Fragor del combate) can take ground and fire again.
 */
function FireDialog({
  summary,
  card,
  combatBonus,
  faction,
  board,
  image,
  targets,
  onFireAt,
  canTakeGround = false,
  onTakeGround,
  onUndoTakeGround,
  longRangeDie = false,
  targetKinds,
  canRemoveWire = false,
  onRemoveWire,
  onUndoShot,
  onKeepResults,
  onClose,
}: FireDialogProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const diceText = useMessages(DICE_TEXT).dice;
  // Small screens get the whole screen for the map and the questions
  const fullScreen = useMediaQuery("(max-width: 899px), (max-height: 599px)");
  /** Aiming a further shot at a unit that already fired (orders with more than one shot) */
  const [firingAgain, setFiringAgain] = useState(false);
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const [undoChecked, setUndoChecked] = useState(false);
  /** A shot was just rolled here: the opponent fires next */
  const [justFired, setJustFired] = useState(false);
  /** Infantry on barbed wire chose to fire (with a die less) rather than remove it */
  const [firingFromWire, setFiringFromWire] = useState(false);

  if (!summary) return null;

  const context: FireContext = {
    unitType: summary.unitType,
    card,
    closeAssaultOnly: summary.closeAssaultOnly,
    combatBonus,
    fromTerrain: board.getHex(summary.firingFrom)?.getType(),
    fromWire: board.getHex(summary.firingFrom)?.wire ?? false,
  };
  const canFire = summary.shotsLeft > 0 && !summary.waiting;
  // After taking ground the unit fires again, from the hex it took
  const takenGround = summary.tookGround && summary.shots.at(-1)?.tookGround === true;
  const aiming = canFire && (summary.shots.length === 0 || firingAgain);

  const resetAim = () => {
    setFiringAgain(false);
    setFiringFromWire(false);
  };

  const handleFire = (choice: FireAimChoice) => {
    if (!onFireAt(choice)) return;
    resetAim();
    setJustFired(true);
  };

  const handleUndo = () => {
    if (!onUndoShot()) return;
    setConfirmingUndo(false);
    setUndoChecked(false);
    setJustFired(false);
    resetAim();
  };

  const content = () => {
    if (confirmingUndo) {
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

    if (!aiming) {
      const numbered = summary.shots.length > 1;
      return (
        <Stack sx={{ gap: 2 }}>
          {summary.shots.map((shot, i) => (
            <ShotResult
              key={i}
              shot={shot}
              number={numbered ? i + 1 : null}
              unitType={summary.unitType}
              faction={faction}
              board={board}
              image={image}
              rolling={justFired && i === summary.shots.length - 1}
              onKeepResults={(kept) => onKeepResults(i, kept)}
            />
          ))}
          {canTakeGround && (
            <ExplainedAction
              testId="take-ground"
              info={t.takeGroundInfo}
              action={
                <Button color="success" onClick={() => onTakeGround?.() && setJustFired(false)}>
                  {t.takeGround}
                </Button>
              }
            >
              {t.freeHex}
            </ExplainedAction>
          )}
          {takenGround && canFire && (
            <ExplainedAction
              info={t.groundTakenInfo}
              action={
                <Button variant="text" onClick={() => onUndoTakeGround?.()}>
                  {t.undo}
                </Button>
              }
            >
              {t.groundTaken}
            </ExplainedAction>
          )}
          {justFired && !canTakeGround && (
            <Alert severity="warning" data-testid="opponent-turn">
              <strong>{t.opponentFires}</strong>
              {t.opponentFiresRest}
            </Alert>
          )}
          {canFire && (
            <Button
              fullWidth
              size="large"
              onClick={() => {
                setFiringAgain(true);
                setJustFired(false);
              }}
            >
              {t.fireAgain(summary.shotsLeft)}
            </Button>
          )}
        </Stack>
      );
    }

    if (canRemoveWire && !firingFromWire) {
      return (
        <Stack sx={{ gap: 2, alignItems: "flex-start" }} data-testid="wire-choice">
          <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
            <BarbedWireIcon size={56} />
            <Typography variant="h6">{t.onWire}</Typography>
          </Stack>
          <Typography>{t.wireQuestion}</Typography>
          <Stack direction="row" sx={{ gap: 1.5, flexWrap: "wrap" }}>
            <Button
              size="large"
              startIcon={<BarbedWireIcon size={32} />}
              onClick={() => {
                if (onRemoveWire?.()) setJustFired(true);
              }}
            >
              {t.removeWire}
            </Button>
            <Button size="large" variant="outlined" startIcon={<GameIcon name="fire" />} onClick={() => setFiringFromWire(true)}>
              {t.fireFromWire}
            </Button>
          </Stack>
        </Stack>
      );
    }

    return (
      <FireAim
        board={board}
        image={image}
        faction={faction}
        from={summary.firingFrom}
        targets={targets}
        context={context}
        card={card}
        longRangeDie={longRangeDie}
        targetKinds={targetKinds}
        onFire={handleFire}
      />
    );
  };

  const actions = () => {
    if (confirmingUndo) {
      return (
        <>
          <Button variant="outlined" onClick={() => setConfirmingUndo(false)}>
            {t.back}
          </Button>
          <Button color="error" disabled={!undoChecked} onClick={handleUndo}>
            {t.cancelShot}
          </Button>
        </>
      );
    }
    const canGoBack = aiming && (firingAgain || (canRemoveWire && firingFromWire));
    return (
      <>
        {!aiming && summary.shots.length > 0 && (
          <Button variant="text" color="error" size="small" onClick={() => setConfirmingUndo(true)} sx={{ mr: "auto" }}>
            {t.cancelShot}
          </Button>
        )}
        {canGoBack && (
          <Button variant="outlined" onClick={firingFromWire ? () => setFiringFromWire(false) : resetAim}>
            {t.goBack}
          </Button>
        )}
        <Button variant="text" onClick={onClose}>
          {t.close}
        </Button>
      </>
    );
  };

  const range = summary.closeAssaultOnly ? [BASE_DICE_BY_DISTANCE[summary.unitType][0]] : BASE_DICE_BY_DISTANCE[summary.unitType];
  const onMap = aiming && !confirmingUndo;

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      fullScreen={onMap && fullScreen}
      maxWidth={onMap ? "lg" : "sm"}
      slotProps={{ paper: { className: onMap ? "fire-dialog fire-dialog--map" : "fire-dialog" } }}
    >
      <DialogTitle>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <span>{t.title(labels.units[summary.unitType])}</span>
          {/* Where it fires from and what it fires with at each distance */}
          <Stack direction="row" component="span" sx={{ alignItems: "center", gap: 1 }} data-testid="firing-unit">
            <HexThumbnail board={board} position={summary.firingFrom} image={image} faction={faction} size={32} />
            <Typography component="span" variant="body2" color="text.secondary">
              {summary.closeAssaultOnly
                ? t.closeAssaultOnly(diceText(range[0] ?? 0))
                : t.range(range.join(" / "))}
            </Typography>
          </Stack>
        </Stack>
      </DialogTitle>
      <DialogContent>{content()}</DialogContent>
      <DialogActions>{actions()}</DialogActions>
    </Dialog>
  );
}

export default FireDialog;
