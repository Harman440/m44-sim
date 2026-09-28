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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from "@mui/material";
import CommandCard from "../game-core/commandCard";
import { Faction } from "../types/faction";
import { Shot, canUseBonus } from "../game-core/gameSession";
import { FireContext } from "../game-core/fireRules";
import { FireTarget } from "../game-core/fireTargets";
import BoardManager from "../game-core/BoardManager";
import { OrderSummary } from "../game-core/turnSummary";
import { BASE_DICE_BY_DISTANCE, combatBonusQuestion } from "../data/fireQuestions";
import ShotDice from "./ShotDice";
import { SECTION_LABELS, UNIT_LABELS } from "../labels";
import FireAim, { FireAimChoice } from "./FireAim";
import HexThumbnail from "./HexThumbnail";
import GameIcon from "./GameIcon";
import "./FireDialog.css";
import { UnitType } from "../game-core/unit";
import { ShotTarget } from "../data/hitRules";

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
  /** Fire a number of dice the player worked out themselves, at this target, plus the combat card's dice with `useCombatBonus` */
  onQuickFire: (dice: number, target: ShotTarget, useCombatBonus: boolean) => boolean;
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

const QUICK_DICE = [1, 2, 3, 4, 5, 6];

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
      <Typography variant="body2" color="text.secondary">
        {shot.steps.length > 0
          ? shot.steps.map((step) => `${step.label} ${formatDice(step.dice)}`).join(" · ")
          : "Tirada rápida"}
      </Typography>
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
 * out. Or the number of dice is given straight away ("Tirada rápida"). Once
 * rolled, the shot stands: opening the unit again shows the result, and only
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
  onQuickFire,
  withCoins,
  longRangeDie = false,
  onUndoShot,
  onKeepResults,
  onClose,
}: FireDialogProps) {
  const [quick, setQuick] = useState(false);
  // Small screens get the whole screen for the map and the questions
  const fullScreen = useMediaQuery("(max-width: 899px), (max-height: 599px)");
  const [quickDice, setQuickDice] = useState(3);
  const [quickTarget, setQuickTarget] = useState<UnitType | null>(null);
  const [quickCloseAssault, setQuickCloseAssault] = useState<boolean | null>(null);
  const [quickBonus, setQuickBonus] = useState<boolean | null>(null);
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
  };
  const canFire = summary.shotsLeft > 0 && !summary.waiting;
  // After taking ground the unit fires from the hex it took, and there's no sure map position after a quick roll
  const lastShot = summary.shots.at(-1);
  const takenGround = summary.tookGround && lastShot?.tookGround === true;
  // Taking ground after a quick roll: the hex taken isn't known, so no map
  const quickOnly = takenGround && !lastShot?.targetPosition;
  const showQuick = quick || quickOnly;
  const quickEightSided = longRangeDie && !summary.closeAssaultOnly && quickCloseAssault === false;
  const aiming = canFire && (summary.shots.length === 0 || firingAgain);
  const quickRange = summary.closeAssaultOnly || quickCloseAssault;
  /** The battle combat card's dice can be added to the quick roll: asked once the range is known */
  const askQuickBonus = quickRange !== null && canUseBonus(combatBonus, quickRange);
  const quickTotal = quickDice + (askQuickBonus && quickBonus ? combatBonus!.dice : 0);

  const resetAim = () => {
    setQuick(false);
    setQuickTarget(null);
    setQuickCloseAssault(null);
    setQuickBonus(null);
    setFiringAgain(false);
  };

  const handleFire = (choice: FireAimChoice) => {
    if (!onFireAt(choice)) return;
    resetAim();
    setJustFired(true);
  };

  const handleQuickFire = () => {
    if (quickTarget === null || quickRange === null || (askQuickBonus && quickBonus === null)) return;
    if (!onQuickFire(quickDice, { unitType: quickTarget, closeAssault: quickRange }, askQuickBonus && !!quickBonus)) return;
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

  const noRepeat = (
    <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
      No se puede repetir la tirada.
    </Typography>
  );

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
              ¿El objetivo se retiró o fue eliminado? La unidad puede tomar terreno (moverse a su casilla) y combatir
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
              Ha tomado terreno: combate otra vez en asalto cercano desde la casilla tomada. Refleja el movimiento en
              «Actualizar mapa» en la fase final.
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

    if (showQuick) {
      return (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            ¿Cuántos dados tiras?
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={quickDice}
            onChange={(_, value: number | null) => value && setQuickDice(value)}
            aria-label="Número de dados"
            sx={{ mb: 2, flexWrap: "wrap" }}
          >
            {QUICK_DICE.map((n) => (
              <ToggleButton key={n} value={n} sx={{ minWidth: 48, minHeight: 48, fontSize: "1.1rem" }}>
                {n}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography variant="h6" sx={{ mb: 1 }}>
            ¿Qué tipo de unidad es el objetivo?
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={quickTarget}
            onChange={(_, value: UnitType | null) => value && setQuickTarget(value)}
            aria-label="Tipo de objetivo"
            sx={{ mb: 2, flexWrap: "wrap" }}
          >
            {Object.values(UnitType).map((type) => (
              <ToggleButton key={type} value={type} sx={{ minHeight: 48 }}>
                {UNIT_LABELS[type]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          {/* A unit marked for a Close Assault card only fires at an adjacent enemy */}
          {!summary.closeAssaultOnly && (
            <>
              <Typography variant="h6" sx={{ mb: 1 }}>
                ¿Está adyacente (asalto cercano)?
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={quickCloseAssault}
                onChange={(_, value: boolean | null) => value !== null && setQuickCloseAssault(value)}
                aria-label="Asalto cercano"
                sx={{ mb: 2 }}
              >
                <ToggleButton value={true} sx={{ minWidth: 64, minHeight: 48 }}>
                  Sí
                </ToggleButton>
                <ToggleButton value={false} sx={{ minWidth: 64, minHeight: 48 }}>
                  No
                </ToggleButton>
              </ToggleButtonGroup>
            </>
          )}
          {askQuickBonus && (
            <>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {combatBonusQuestion.textFor!(context)} (+{combatBonus!.dice})
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={quickBonus}
                onChange={(_, value: boolean | null) => value !== null && setQuickBonus(value)}
                aria-label={`Usar ${combatBonus!.name}`}
                sx={{ mb: 2 }}
              >
                <ToggleButton value={true} sx={{ minWidth: 64, minHeight: 48 }}>
                  Sí
                </ToggleButton>
                <ToggleButton value={false} sx={{ minWidth: 64, minHeight: 48 }}>
                  No
                </ToggleButton>
              </ToggleButtonGroup>
            </>
          )}
          <Button
            fullWidth
            size="large"
            onClick={handleQuickFire}
            disabled={quickTarget === null || quickRange === null || (askQuickBonus && quickBonus === null)}
          >
            Disparar {diceText(quickTotal, quickEightSided)}
          </Button>
          {noRepeat}
        </>
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
        onQuick={() => setQuick(true)}
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
    const canGoBack = aiming && ((quick && !quickOnly) || firingAgain);
    return (
      <>
        {!aiming && summary.shots.length > 0 && (
          <Button variant="text" color="error" size="small" onClick={() => setConfirmingUndo(true)} sx={{ mr: "auto" }}>
            Anular disparo
          </Button>
        )}
        {canGoBack && (
          <Button variant="outlined" onClick={quick && !quickOnly ? () => setQuick(false) : resetAim}>
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
  const onMap = aiming && !showQuick && !confirmingUndo;

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
          <span>
            Disparo: {UNIT_LABELS[summary.unitType]} · {SECTION_LABELS[summary.section]}
          </span>
          {/* Where it fires from and what it fires with at each distance */}
          <Stack direction="row" component="span" sx={{ alignItems: "center", gap: 1 }} data-testid="firing-unit">
            <HexThumbnail board={board} position={summary.firingFrom} image={image} faction={faction} size={32} />
            <Typography component="span" variant="body2" color="text.secondary">
              {summary.closeAssaultOnly
                ? `Solo asalto cercano: ${diceText(range[0] ?? 0)}`
                : `Alcance ${range.length}: ${range.join(" / ")} dados`}
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
