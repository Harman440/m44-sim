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
import { Shot } from "../game-core/gameSession";
import { FireAnswers, FireContext, calculateFireDice, nextFireQuestion } from "../game-core/fireRules";
import { OrderSummary } from "../game-core/turnSummary";
import { FIRE_QUESTIONS, fireBonusSteps } from "../data/fireQuestions";
import DiceResult from "./DiceResult";
import { SECTION_LABELS, UNIT_LABELS } from "./labels";

interface FireDialogProps {
  /** The firing unit's order; the dialog is closed when null */
  summary: OrderSummary | null;
  card: CommandCard | null;
  faction: string;
  /** Fire using the questionnaire's answers; the session rolls the dice */
  onFire: (answers: FireAnswers) => boolean;
  /** Fire a number of dice the player worked out themselves */
  onQuickFire: (dice: number) => boolean;
  /** Take back the unit's last shot (a mistake) */
  onUndoShot: () => boolean;
  onClose: () => void;
}

const QUICK_DICE = [1, 2, 3, 4, 5, 6];

const formatDice = (dice: number) => (dice > 0 ? `+${dice}` : `${dice}`);
const diceText = (dice: number) => `${dice} ${dice === 1 ? "dado" : "dados"}`;

function ShotResult({ shot, number, faction }: { shot: Shot; number: number | null; faction: string }) {
  return (
    <Box data-testid="shot-result">
      {number !== null && (
        <Typography variant="overline" color="text.secondary">
          Disparo {number}
        </Typography>
      )}
      <Typography variant="body2" color="text.secondary">
        {shot.steps.length > 0
          ? shot.steps.map((step) => `${step.label} ${formatDice(step.dice)}`).join(" · ")
          : "Tirada rápida"}
      </Typography>
      <Typography variant="h6">
        {shot.dice > 0 ? diceText(shot.dice) : "0 dados: el disparo no tuvo efecto"}
      </Typography>
      {shot.dice > 0 && <DiceResult roll={{ faces: [...shot.faces], id: number ?? 1 }} faction={faction} />}
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
function FireDialog({ summary, card, faction, onFire, onQuickFire, onUndoShot, onClose }: FireDialogProps) {
  // Answer order is kept so "Atrás" can undo the last one
  const [answerOrder, setAnswerOrder] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quick, setQuick] = useState(false);
  const [quickDice, setQuickDice] = useState(3);
  /** Aiming a further shot at a unit that already fired (cards with numFireTimes > 1) */
  const [firingAgain, setFiringAgain] = useState(false);
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const [undoChecked, setUndoChecked] = useState(false);

  if (!summary) return null;

  const context: FireContext = { unitType: summary.unitType, card };
  const question = nextFireQuestion(FIRE_QUESTIONS, context, answers);
  const result = question ? null : calculateFireDice(FIRE_QUESTIONS, context, answers, fireBonusSteps);
  const aiming = summary.shotsLeft > 0 && (summary.shots.length === 0 || firingAgain);

  const resetAim = () => {
    setAnswers({});
    setAnswerOrder([]);
    setQuick(false);
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
    if (onFire(answers)) resetAim();
  };

  const handleQuickFire = () => {
    if (onQuickFire(quickDice)) resetAim();
  };

  const handleUndo = () => {
    if (!onUndoShot()) return;
    setConfirmingUndo(false);
    setUndoChecked(false);
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
            <ShotResult key={i} shot={shot} number={numbered ? i + 1 : null} faction={faction} />
          ))}
          {summary.shotsLeft > 0 && (
            <Button fullWidth size="large" onClick={() => setFiringAgain(true)}>
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
          <Button fullWidth size="large" onClick={handleQuickFire}>
            Disparar {diceText(quickDice)}
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
            {question.text}
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
              ? `Total: ${diceText(result.dice)}`
              : "Total: 0 dados. Este disparo no tiene efecto."}
          </Typography>
          <Button fullWidth size="large" onClick={handleFire} sx={{ mt: 2 }}>
            {result.dice > 0 ? `Disparar ${diceText(result.dice)}` : "Registrar disparo sin efecto"}
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
