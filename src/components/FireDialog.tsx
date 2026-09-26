import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import CommandCard from "../game-core/commandCard";
import { rollDice } from "../game-core/dice";
import { FireContext, calculateFireDice, nextFireQuestion } from "../game-core/fireRules";
import { OrderSummary } from "../game-core/turnSummary";
import { FIRE_QUESTIONS, fireBonusSteps } from "../data/fireQuestions";
import DiceResult, { DiceRoll } from "./DiceResult";
import { SECTION_LABELS, UNIT_LABELS } from "./labels";

interface FireDialogProps {
  /** The firing unit's order; the dialog is closed when null */
  unit: OrderSummary | null;
  card: CommandCard | null;
  faction: string;
  onClose: () => void;
}

const formatDice = (dice: number) => (dice > 0 ? `+${dice}` : `${dice}`);

/**
 * Asks about the situation (distance, target terrain, ...) one question at a
 * time, then works out how many dice the unit rolls and rolls them.
 * Questions and their dice effects live in data/fireQuestions.ts.
 */
function FireDialog({ unit, card, faction, onClose }: FireDialogProps) {
  // Answer order is kept so "Atrás" can undo the last one
  const [answerOrder, setAnswerOrder] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [roll, setRoll] = useState<DiceRoll | null>(null);

  if (!unit) return null;

  const context: FireContext = { unitType: unit.unitType, card };
  const question = nextFireQuestion(FIRE_QUESTIONS, context, answers);
  const result = question ? null : calculateFireDice(FIRE_QUESTIONS, context, answers, fireBonusSteps);

  const answer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setAnswerOrder((prev) => [...prev, questionId]);
  };

  const goBack = () => {
    const last = answerOrder.at(-1);
    if (!last) return;
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[last];
      return next;
    });
    setAnswerOrder((prev) => prev.slice(0, -1));
    setRoll(null);
  };

  const handleRoll = () => {
    if (!result) return;
    setRoll((prev) => ({ faces: rollDice(result.dice), id: (prev?.id ?? 0) + 1 }));
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Disparo: {UNIT_LABELS[unit.unitType]} · {SECTION_LABELS[unit.section]}
      </DialogTitle>

      <DialogContent>
        {question ? (
          <>
            <Typography variant="overline" color="text.secondary">
              Pregunta {answerOrder.length + 1}
            </Typography>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {question.text}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gap: 1,
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              }}
            >
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
          </>
        ) : (
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
                  ? `Total: ${result.dice} ${result.dice === 1 ? "dado" : "dados"}`
                  : "Total: 0 dados. Este disparo no tiene efecto."}
              </Typography>
              {result.dice > 0 && (
                <Button fullWidth size="large" onClick={handleRoll} sx={{ mt: 2 }}>
                  {roll ? "Tirar otra vez" : `Tirar ${result.dice} ${result.dice === 1 ? "dado" : "dados"}`}
                </Button>
              )}
              {roll && <DiceResult roll={roll} faction={faction} />}
            </>
          )
        )}
      </DialogContent>

      <DialogActions>
        {answerOrder.length > 0 && (
          <Button variant="outlined" onClick={goBack}>
            Atrás
          </Button>
        )}
        <Button variant="text" onClick={onClose}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default FireDialog;
