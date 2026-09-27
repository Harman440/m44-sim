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
  Divider,
  FormControlLabel,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import CommandCard from "../game-core/commandCard";
import { Faction } from "../types/faction";
import { Shot } from "../game-core/gameSession";
import { FireAnswers, FireContext, calculateFireDice, nextFireQuestion } from "../game-core/fireRules";
import { OrderSummary } from "../game-core/turnSummary";
import { FIRE_QUESTIONS, fireBonusSteps } from "../data/fireQuestions";
import ShotDice from "./ShotDice";
import { SECTION_LABELS, UNIT_LABELS } from "../labels";
import { UnitType } from "../game-core/unit";
import { ShotTarget } from "../data/hitRules";

interface FireDialogProps {
  /** The firing unit's order; the dialog is closed when null */
  summary: OrderSummary | null;
  card: CommandCard | null;
  /** A battle combat card this unit could use on this shot (Spotter…) */
  combatBonus?: FireContext["combatBonus"];
  faction: Faction;
  /** Fire using the questionnaire's answers; the session rolls the dice */
  onFire: (answers: FireAnswers) => boolean;
  /** Fire a number of dice the player worked out themselves, at this target */
  onQuickFire: (dice: number, target: ShotTarget) => boolean;
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
 * Firing with one unit. Asks about the situation (distance, target terrain,
 * ...) one question at a time and works out the dice, or takes the number of
 * dice straight away ("Tirada rápida"). Once rolled, the shot stands: opening
 * the unit again shows the result, and only a deliberate "Anular disparo"
 * takes it back. Questions and their dice effects live in data/fireQuestions.ts.
 */
function FireDialog({
  summary,
  card,
  combatBonus,
  faction,
  onFire,
  onQuickFire,
  withCoins,
  longRangeDie = false,
  onUndoShot,
  onKeepResults,
  onClose,
}: FireDialogProps) {
  // Answer order is kept so "Atrás" can undo the last one
  const [answerOrder, setAnswerOrder] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quick, setQuick] = useState(false);
  const [quickDice, setQuickDice] = useState(3);
  const [quickTarget, setQuickTarget] = useState<UnitType | null>(null);
  const [quickCloseAssault, setQuickCloseAssault] = useState<boolean | null>(null);
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
  const question = nextFireQuestion(FIRE_QUESTIONS, context, answers);
  const result = question ? null : calculateFireDice(FIRE_QUESTIONS, context, answers, fireBonusSteps);
  const canFire = summary.shotsLeft > 0 && !summary.waiting;
  // The long-range die is rolled at a target that isn't adjacent
  const eightSided = longRangeDie && answers.distance !== undefined && answers.distance !== "1";
  const quickEightSided = longRangeDie && !summary.closeAssaultOnly && quickCloseAssault === false;
  const aiming = canFire && (summary.shots.length === 0 || firingAgain);

  const resetAim = () => {
    setAnswers({});
    setAnswerOrder([]);
    setQuick(false);
    setQuickTarget(null);
    setQuickCloseAssault(null);
    setFiringAgain(false);
  };

  const answer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setAnswerOrder((prev) => [...prev, questionId]);
  };

  const goBack = () => {
    if (quick) {
      setQuick(false);
      return;
    }
    const last = answerOrder.at(-1);
    if (!last) return;
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[last];
      return next;
    });
    setAnswerOrder((prev) => prev.slice(0, -1));
  };

  const handleFire = () => {
    if (!onFire(answers)) return;
    resetAim();
    setJustFired(true);
  };

  const handleQuickFire = () => {
    const closeAssault = summary.closeAssaultOnly || quickCloseAssault;
    if (quickTarget === null || closeAssault === null) return;
    if (!onQuickFire(quickDice, { unitType: quickTarget, closeAssault })) return;
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
          {justFired && (
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

    if (quick) {
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
          <Button
            fullWidth
            size="large"
            onClick={handleQuickFire}
            disabled={quickTarget === null || (!summary.closeAssaultOnly && quickCloseAssault === null)}
          >
            Disparar {diceText(quickDice, quickEightSided)}
          </Button>
          {noRepeat}
        </>
      );
    }

    if (question) {
      return (
        <>
          <Typography variant="overline" color="text.secondary">
            Pregunta {answerOrder.length + 1}
          </Typography>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {question.textFor?.(context) ?? question.text}
          </Typography>
          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
            {question.options(context).map((option) => (
              <Button
                key={option.value}
                variant="outlined"
                size="large"
                onClick={() => answer(question.id, option.value)}
              >
                {option.label}
              </Button>
            ))}
          </Box>
          <Divider sx={{ my: 2 }} />
          <Button variant="text" fullWidth onClick={() => setQuick(true)}>
            ¿Ya sabes cuántos dados? Tirada rápida
          </Button>
        </>
      );
    }

    if (result?.blocked) {
      return (
        <Alert severity="warning" data-testid="fire-blocked">
          {result.blocked}
        </Alert>
      );
    }

    return (
      result && (
        <>
          <Stack sx={{ gap: 0.5 }} data-testid="fire-breakdown">
            {result.steps.map((step) => (
              <Box key={step.label} sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body1">{step.label}</Typography>
                <Typography variant="body1">{formatDice(step.dice)}</Typography>
              </Box>
            ))}
          </Stack>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="h6" data-testid="fire-total">
            {result.dice > 0
              ? `Total: ${diceText(result.dice, eightSided)}`
              : "Total: 0 dados. Este disparo no tiene efecto."}
          </Typography>
          <ShotNotes notes={result.notes} />
          <Button fullWidth size="large" onClick={handleFire} sx={{ mt: 2 }}>
            {result.dice > 0 ? `Disparar ${diceText(result.dice, eightSided)}` : "Registrar disparo sin efecto"}
          </Button>
          {noRepeat}
        </>
      )
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
    const canGoBack = aiming && (quick || answerOrder.length > 0 || firingAgain);
    return (
      <>
        {!aiming && summary.shots.length > 0 && (
          <Button variant="text" color="error" size="small" onClick={() => setConfirmingUndo(true)} sx={{ mr: "auto" }}>
            Anular disparo
          </Button>
        )}
        {canGoBack && (
          <Button variant="outlined" onClick={quick || answerOrder.length > 0 ? goBack : resetAim}>
            Atrás
          </Button>
        )}
        <Button variant="text" onClick={onClose}>
          Cerrar
        </Button>
      </>
    );
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Disparo: {UNIT_LABELS[summary.unitType]} · {SECTION_LABELS[summary.section]}
      </DialogTitle>
      <DialogContent>{content()}</DialogContent>
      <DialogActions>{actions()}</DialogActions>
    </Dialog>
  );
}

export default FireDialog;
