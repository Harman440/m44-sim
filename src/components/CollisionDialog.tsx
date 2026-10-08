import { useState } from "react";
import {
  Alert,
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
import { OrderSummary } from "../game-core/turnSummary";
import { COLLISION_NOTES, collisionSteps } from "../data/fireQuestions";
import { Faction } from "../types/faction";
import { TargetKinds } from "../data/hitRules";
import type { Labels } from "../labels";
import TargetKindPicker, { TargetChoice, initialChoice } from "./TargetKindPicker";
import ShotDice from "./ShotDice";
import ShotSteps from "./ShotSteps";
import OrderToken from "./OrderToken";
import { defineMessages, useLabels, useMessages, useTr } from "../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    dice: (n: number) => `${n} ${n === 1 ? "dado" : "dados"}`,
    moved: (hexes: number, terrain: string) => `Avanzó ${hexes} ${hexes === 1 ? "casilla" : "casillas"} → ${terrain}`,
    outcomeOpponent: "El rival también tira con su unidad.",
    outcomeRetreat:
      "Si una de las dos se retira o es eliminada, la otra se queda en la casilla del choque y puede seguir hasta su destino.",
    outcomeNoRetreat:
      "Si ninguna se retira, las dos retroceden una casilla por el camino que hicieron (puede estar bloqueada).",
    outcomeMap: "Refleja en el mapa dónde queda tu unidad.",
    noneMoved: "Ninguna de tus unidades se ha movido este turno.",
    whichUnit: "¿Qué unidad ha chocado?",
    noEffect: "0 dados: el choque no tuvo efecto",
    alreadyFired:
      "Esta unidad ya ha disparado, así que no tira en el choque. Resuelve los choques antes que cualquier otro disparo.",
    cantFire: "Esta unidad no puede disparar este turno, así que no tira en el choque: solo tira el rival.",
    total: (dice: string) => `Total: ${dice}`,
    countsAsShot: "La tirada del choque cuenta como el disparo de la unidad este turno.",
    infantry: "¿Ha chocado con infantería?",
    roll: (dice: string) => `Tirar ${dice}`,
    noReroll: "No se puede repetir la tirada.",
    title: (unit: string | null) => `Choque${unit ? `: ${unit}` : ""}`,
    otherUnit: "Otra unidad",
    close: "Cerrar",
  },
  en: {
    dice: (n: number) => `${n} ${n === 1 ? "die" : "dice"}`,
    moved: (hexes: number, terrain: string) => `Advanced ${hexes} ${hexes === 1 ? "hex" : "hexes"} → ${terrain}`,
    outcomeOpponent: "The opponent also rolls with their unit.",
    outcomeRetreat:
      "If one of the two retreats or is eliminated, the other stays on the collision hex and can go on to its destination.",
    outcomeNoRetreat: "If neither retreats, both go back one hex along the path they took (it may be blocked).",
    outcomeMap: "Mirror on the map where your unit ends up.",
    noneMoved: "None of your units moved this turn.",
    whichUnit: "Which unit collided?",
    noEffect: "0 dice: the collision had no effect",
    alreadyFired:
      "This unit has already fired, so it doesn't roll in the collision. Resolve collisions before any other shot.",
    cantFire: "This unit can't fire this turn, so it doesn't roll in the collision: only the opponent rolls.",
    total: (dice: string) => `Total: ${dice}`,
    countsAsShot: "The collision roll counts as the unit's shot this turn.",
    infantry: "Did it collide with infantry?",
    roll: (dice: string) => `Roll ${dice}`,
    noReroll: "The roll can't be repeated.",
    title: (unit: string | null) => `Collision${unit ? `: ${unit}` : ""}`,
    otherUnit: "Another unit",
    close: "Close",
  },
});

interface CollisionDialogProps {
  open: boolean;
  /** This turn's orders; only units that moved can have collided */
  summaries: readonly OrderSummary[];
  card: CommandCard | null;
  faction: Faction;
  /** Roll the collision for this order's unit against the unit it met; the session rolls the dice */
  /** What the enemy can have in the scenario */
  targetKinds: TargetKinds;
  onRoll: (orderIndex: number, infantry: boolean) => boolean;
  /** Apply only some of the dice of the order's shot `shotNumber` (or all, with null) */
  onKeepResults: (orderIndex: number, shotNumber: number, kept: number[] | null) => boolean;
  onClose: () => void;
}

const formatDice = (dice: number) => (dice > 0 ? `+${dice}` : `${dice}`);

const describeMove = (summary: OrderSummary, t: (typeof TEXT)["es"], labels: Labels) =>
  t.moved(summary.hexesMoved, labels.terrain[summary.destinationTerrain]);

/** How a collision ends, from the house rules; the same whoever rolls */
function Outcome() {
  const t = useMessages(TEXT);
  return (
    <Alert severity="info" sx={{ mt: 2 }} data-testid="collision-outcome">
      <Box component="ul" sx={{ m: 0, pl: 2 }}>
        <li>{t.outcomeOpponent}</li>
        <li>{t.outcomeRetreat}</li>
        <li>{t.outcomeNoRetreat}</li>
        <li>{t.outcomeMap}</li>
      </Box>
    </Alert>
  );
}

/**
 * A collision: two units crossed or landed on the same hex in the movement
 * phase. They battle at once, before any other shot, with close assault dice
 * − 1 and no terrain. The roll uses up the unit's shot.
 */
function CollisionDialog({
  open,
  summaries,
  card,
  faction,
  targetKinds,
  onRoll,
  onKeepResults,
  onClose,
}: CollisionDialogProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const [kind, setKind] = useState<TargetChoice | null>(initialChoice(targetKinds));
  const enemy: Faction = faction === "Allies" ? "Axis" : "Allies";
  /** The collision was just rolled here: throw the dice in */
  const [rolled, setRolled] = useState(false);
  const moved = summaries.filter((s) => !s.hold && !s.removed);
  const summary = selected === null ? null : (summaries[selected] ?? null);

  const select = (index: number | null) => {
    setSelected(index);
    setKind(initialChoice(targetKinds));
    setRolled(false);
  };

  const close = () => {
    select(null);
    onClose();
  };

  const content = () => {
    if (!summary) {
      if (moved.length === 0) {
        return <Typography>{t.noneMoved}</Typography>;
      }
      return (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {t.whichUnit}
          </Typography>
          <Stack sx={{ gap: 1 }}>
            {moved.map((s) => (
              <Button
                key={s.index}
                variant="outlined"
                size="large"
                onClick={() => select(s.index)}
                aria-label={`${labels.unitKind(s.unitType, s.elite)} · ${labels.sections[s.section]} · ${describeMove(s, t, labels)}`}
                sx={{ justifyContent: "flex-start", textAlign: "left", textTransform: "none", gap: 1.5, py: 1 }}
              >
                <OrderToken orderIndex={s.index} unitType={s.unitType} faction={faction} size={44} />
                <Box>
                  <Typography variant="body1" component="span" sx={{ display: "block" }}>
                    {labels.unitKind(s.unitType, s.elite)} · {labels.sections[s.section]}
                  </Typography>
                  <Typography variant="body2" component="span" color="text.secondary" sx={{ display: "block" }}>
                    {describeMove(s, t, labels)}
                  </Typography>
                </Box>
              </Button>
            ))}
          </Stack>
        </>
      );
    }

    const collisionShot = summary.shots.find((shot) => shot.collision);
    if (collisionShot) {
      return (
        <Box data-testid="collision-result">
          <ShotSteps shot={collisionShot} unitType={summary.unitType} faction={faction} />
          {collisionShot.dice === 0 && (
            <Typography variant="h6" sx={{ mt: 1 }}>
              {t.noEffect}
            </Typography>
          )}
          <ShotDice
            shot={collisionShot}
            rollId={1}
            faction={faction}
            rolling={rolled}
            onKeepResults={(kept) => onKeepResults(summary.index, summary.shots.indexOf(collisionShot), kept)}
          />
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {collisionShot.notes.map(tr).join(" ")}
          </Alert>
          <Outcome />
        </Box>
      );
    }

    if (summary.shots.length > 0) {
      return (
        <>
          <Alert severity="warning">
            {t.alreadyFired}
          </Alert>
          <Outcome />
        </>
      );
    }

    if (summary.shotsLeft <= 0) {
      return (
        <>
          <Alert severity="warning">
            {t.cantFire}
          </Alert>
          <Outcome />
        </>
      );
    }

    // An extra order bought with coins gets none of the card's bonuses
    const steps = collisionSteps({ unitType: summary.unitType, card: summary.extra ? null : card });
    const dice = Math.max(0, steps.reduce((sum, step) => sum + step.dice, 0));
    return (
      <>
        <Stack sx={{ gap: 0.5 }} data-testid="collision-breakdown">
          {steps.map((step) => (
            <Box key={step.label.es} sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body1">{tr(step.label)}</Typography>
              <Typography variant="body1">{formatDice(step.dice)}</Typography>
            </Box>
          ))}
        </Stack>
        <Divider sx={{ my: 1.5 }} />
        <Typography variant="h6">{t.total(t.dice(dice))}</Typography>
        {COLLISION_NOTES.map((note) => (
          <Alert key={note.es} severity="info" sx={{ mt: 1.5 }}>
            {tr(note)}
          </Alert>
        ))}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {t.countsAsShot}
        </Typography>
        <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
          {t.infantry}
        </Typography>
        <TargetKindPicker kinds={targetKinds} value={kind} onChange={setKind} enemy={enemy} />
        <Button
          fullWidth
          size="large"
          disabled={kind === null}
          onClick={() => kind && onRoll(summary.index, kind === "infantry") && setRolled(true)}
          sx={{ mt: 2 }}
        >
          {t.roll(t.dice(dice))}
        </Button>
        <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
          {t.noReroll}
        </Typography>
      </>
    );
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>
        {t.title(summary ? `${labels.unitKind(summary.unitType, summary.elite)} · ${labels.sections[summary.section]}` : null)}
      </DialogTitle>
      <DialogContent>{content()}</DialogContent>
      <DialogActions>
        {summary && moved.length > 1 && (
          <Button variant="outlined" onClick={() => select(null)}>
            {t.otherUnit}
          </Button>
        )}
        <Button variant="text" onClick={close}>
          {t.close}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CollisionDialog;
