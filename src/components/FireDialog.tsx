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
import CommandCard from "../game-core/commandCard";
import { Faction } from "../types/faction";
import { Shot } from "../game-core/gameSession";
import { FireContext } from "../game-core/fireRules";
import { FireTarget } from "../game-core/fireTargets";
import BoardManager from "../game-core/BoardManager";
import { OrderSummary } from "../game-core/turnSummary";
import { BASE_DICE_BY_DISTANCE } from "../data/fireQuestions";
import ShotDice from "./ShotDice";
import { UNIT_LABELS } from "../labels";
import FireAim, { FireAimChoice } from "./FireAim";
import HexThumbnail from "./HexThumbnail";
import GameIcon from "./GameIcon";
import "./FireDialog.css";

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
  /** Rolls earn coins this turn (not in the attacker's extra first turn) */
  withCoins: boolean;
  /** The game rolls the 8-sided long-range die at targets that aren't adjacent */
  longRangeDie?: boolean;
  /** Take back the unit's last shot (a mistake) */
  onUndoShot: () => boolean;
  /** Apply only some of the dice of the unit's shot `shotNumber` (or all, with null) */
  onKeepResults: (shotNumber: number, kept: number[] | null) => boolean;
  onClose: () => void;
}

const formatDice = (dice: number) => (dice > 0 ? `+${dice}` : `${dice}`);
const diceText = (dice: number, eightSided = false) =>
  `${dice} ${dice === 1 ? "dado" : "dados"}${eightSided ? " de 8 caras" : ""}`;

/** Reminders for resolving the hits on the table, e.g. sandbags */
function ShotNotes({ notes }: { notes: readonly string[] }) {
  if (notes.length === 0) return null;
  return (
    <Stack sx={{ gap: 1, mt: 1.5 }} data-testid="shot-notes">
      {notes.map((note) => (
        <Alert key={note} severity="info">
          {note}
        </Alert>
      ))}
    </Stack>
  );
}

interface ShotResultProps {
  shot: Shot;
  number: number | null;
  faction: Faction;
  withCoins: boolean;
  /** Apply only some of the dice (or all, with null) */
  onKeepResults?: (kept: number[] | null) => boolean;
}

export function ShotResult({ shot, number, faction, withCoins, onKeepResults }: ShotResultProps) {
  return (
    <Box data-testid="shot-result">
      {(number !== null || shot.collision) && (
        <Typography variant="overline" color="text.secondary">
          {[number !== null && `Disparo ${number}`, shot.collision && "Choque"].filter(Boolean).join(" · ")}
        </Typography>
      )}
      {shot.steps.length > 0 && (
        <Typography variant="body2" color="text.secondary">
          {shot.steps.map((step) => `${step.label} ${formatDice(step.dice)}`).join(" · ")}
        </Typography>
      )}
      <Typography variant="h6">
        {shot.dice > 0
          ? diceText(shot.dice, shot.target.longRangeFirer !== undefined)
          : "0 dados: el disparo no tuvo efecto"}
      </Typography>
      <ShotDice
        shot={shot}
        rollId={number ?? 1}
        faction={faction}
        withCoins={withCoins}
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
  withCoins,
  longRangeDie = false,
  onUndoShot,
  onKeepResults,
  onClose,
}: FireDialogProps) {
  // Small screens get the whole screen for the map and the questions
  const fullScreen = useMediaQuery("(max-width: 899px), (max-height: 599px)");
  /** Aiming a further shot at a unit that already fired (orders with more than one shot) */
  const [firingAgain, setFiringAgain] = useState(false);
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const [undoChecked, setUndoChecked] = useState(false);
  /** A shot was just rolled here: the opponent fires next */
  const [justFired, setJustFired] = useState(false);

  if (!summary) return null;

  const context: FireContext = {
    unitType: summary.unitType,
    card,
    closeAssaultOnly: summary.closeAssaultOnly,
    combatBonus,
    fromTerrain: board.getHex(summary.firingFrom)?.getType(),
  };
  const canFire = summary.shotsLeft > 0 && !summary.waiting;
  // After taking ground the unit fires again, from the hex it took
  const takenGround = summary.tookGround && summary.shots.at(-1)?.tookGround === true;
  const aiming = canFire && (summary.shots.length === 0 || firingAgain);

  const resetAim = () => setFiringAgain(false);

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
            ¿Anular el último disparo?
          </Typography>
          <Alert severity="error" sx={{ mb: 2 }}>
            Anula el último disparo de esta unidad solo si se registró por error. La tirada se borra y la
            unidad podrá disparar de nuevo.
          </Alert>
          <FormControlLabel
            control={<Checkbox checked={undoChecked} onChange={(e) => setUndoChecked(e.target.checked)} />}
            label="Confirmo que fue un error"
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
              faction={faction}
              withCoins={withCoins}
              onKeepResults={(kept) => onKeepResults(i, kept)}
            />
          ))}
          {canTakeGround && (
            <Alert
              severity="success"
              icon={<GameIcon name="battle" />}
              data-testid="take-ground"
              action={
                <Button color="success" onClick={() => onTakeGround?.() && setJustFired(false)}>
                  Tomar terreno
                </Button>
              }
              sx={{ flexWrap: "wrap", "& .MuiAlert-action": { ml: "auto" } }}
            >
              ¿El objetivo se retiró o fue eliminado? La unidad puede tomar terreno: se mueve a su casilla y combate
              otra vez, solo en asalto cercano.
            </Alert>
          )}
          {takenGround && canFire && (
            <Alert
              severity="info"
              icon={<GameIcon name="battle" />}
              action={
                <Button color="inherit" onClick={() => onUndoTakeGround?.()}>
                  Deshacer
                </Button>
              }
              sx={{ flexWrap: "wrap", "& .MuiAlert-action": { ml: "auto" } }}
            >
              Ha tomado terreno: ya está en la casilla tomada en el mapa, y combate otra vez desde ahí en asalto cercano.
            </Alert>
          )}
          {justFired && !canTakeGround && (
            <Alert severity="warning" data-testid="opponent-turn">
              <strong>Ahora dispara el rival.</strong> Si no le quedan unidades por disparar en este grupo,
              vuelves a disparar tú.
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
              Disparar otra vez (queda{summary.shotsLeft === 1 ? "" : "n"} {summary.shotsLeft})
            </Button>
          )}
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
        onFire={handleFire}
      />
    );
  };

  const actions = () => {
    if (confirmingUndo) {
      return (
        <>
          <Button variant="outlined" onClick={() => setConfirmingUndo(false)}>
            Volver
          </Button>
          <Button color="error" disabled={!undoChecked} onClick={handleUndo}>
            Anular disparo
          </Button>
        </>
      );
    }
    const canGoBack = aiming && firingAgain;
    return (
      <>
        {!aiming && summary.shots.length > 0 && (
          <Button variant="text" color="error" size="small" onClick={() => setConfirmingUndo(true)} sx={{ mr: "auto" }}>
            Anular disparo
          </Button>
        )}
        {canGoBack && (
          <Button variant="outlined" onClick={resetAim}>
            Atrás
          </Button>
        )}
        <Button variant="text" onClick={onClose}>
          Cerrar
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
          <span>Disparo: {UNIT_LABELS[summary.unitType]}</span>
          {/* Where it fires from and what it fires with at each distance */}
          <Stack direction="row" component="span" sx={{ alignItems: "center", gap: 1 }} data-testid="firing-unit">
            <HexThumbnail board={board} position={summary.firingFrom} image={image} faction={faction} size={32} />
            <Typography component="span" variant="body2" color="text.secondary">
              {summary.closeAssaultOnly
                ? `Solo asalto cercano: ${diceText(range[0] ?? 0)}`
                : `Alcance: ${range.join(" / ")}`}
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
