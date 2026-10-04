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
import TargetKindPicker, { TargetChoice, initialChoice } from "./TargetKindPicker";
import { SECTION_LABELS, TERRAIN_LABELS, UNIT_LABELS } from "../labels";
import ShotDice from "./ShotDice";
import ShotSteps from "./ShotSteps";
import OrderToken from "./OrderToken";

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
const diceText = (dice: number) => `${dice} ${dice === 1 ? "dado" : "dados"}`;

const describeMove = (summary: OrderSummary) =>
  `Avanzó ${summary.hexesMoved} ${summary.hexesMoved === 1 ? "casilla" : "casillas"} → ${
    TERRAIN_LABELS[summary.destinationTerrain]
  }`;

/** How a collision ends, from the house rules; the same whoever rolls */
function Outcome() {
  return (
    <Alert severity="info" sx={{ mt: 2 }} data-testid="collision-outcome">
      <Box component="ul" sx={{ m: 0, pl: 2 }}>
        <li>El rival también tira con su unidad.</li>
        <li>
          Si una de las dos se retira o es eliminada, la otra se queda en la casilla del choque y puede seguir
          hasta su destino.
        </li>
        <li>
          Si ninguna se retira, las dos retroceden una casilla por el camino que hicieron (puede estar
          bloqueada).
        </li>
        <li>Refleja en el mapa dónde queda tu unidad.</li>
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
        return <Typography>Ninguna de tus unidades se ha movido este turno.</Typography>;
      }
      return (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            ¿Qué unidad ha chocado?
          </Typography>
          <Stack sx={{ gap: 1 }}>
            {moved.map((s) => (
              <Button
                key={s.index}
                variant="outlined"
                size="large"
                onClick={() => select(s.index)}
                aria-label={`${UNIT_LABELS[s.unitType]} · ${SECTION_LABELS[s.section]} · ${describeMove(s)}`}
                sx={{ justifyContent: "flex-start", textAlign: "left", textTransform: "none", gap: 1.5, py: 1 }}
              >
                <OrderToken orderIndex={s.index} unitType={s.unitType} faction={faction} size={44} />
                <Box>
                  <Typography variant="body1" component="span" sx={{ display: "block" }}>
                    {UNIT_LABELS[s.unitType]} · {SECTION_LABELS[s.section]}
                  </Typography>
                  <Typography variant="body2" component="span" color="text.secondary" sx={{ display: "block" }}>
                    {describeMove(s)}
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
              0 dados: el choque no tuvo efecto
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
            {collisionShot.notes.join(" ")}
          </Alert>
          <Outcome />
        </Box>
      );
    }

    if (summary.shots.length > 0) {
      return (
        <>
          <Alert severity="warning">
            Esta unidad ya ha disparado, así que no tira en el choque. Resuelve los choques antes que cualquier
            otro disparo.
          </Alert>
          <Outcome />
        </>
      );
    }

    if (summary.shotsLeft <= 0) {
      return (
        <>
          <Alert severity="warning">
            Esta unidad no puede disparar este turno, así que no tira en el choque: solo tira el rival.
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
            <Box key={step.label} sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body1">{step.label}</Typography>
              <Typography variant="body1">{formatDice(step.dice)}</Typography>
            </Box>
          ))}
        </Stack>
        <Divider sx={{ my: 1.5 }} />
        <Typography variant="h6">Total: {diceText(dice)}</Typography>
        {COLLISION_NOTES.map((note) => (
          <Alert key={note} severity="info" sx={{ mt: 1.5 }}>
            {note}
          </Alert>
        ))}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          La tirada del choque cuenta como el disparo de la unidad este turno.
        </Typography>
        <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
          ¿Ha chocado con infantería?
        </Typography>
        <TargetKindPicker kinds={targetKinds} value={kind} onChange={setKind} enemy={enemy} />
        <Button
          fullWidth
          size="large"
          disabled={kind === null}
          onClick={() => kind && onRoll(summary.index, kind === "infantry") && setRolled(true)}
          sx={{ mt: 2 }}
        >
          Tirar {diceText(dice)}
        </Button>
        <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
          No se puede repetir la tirada.
        </Typography>
      </>
    );
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>Choque{summary ? `: ${UNIT_LABELS[summary.unitType]} · ${SECTION_LABELS[summary.section]}` : ""}</DialogTitle>
      <DialogContent>{content()}</DialogContent>
      <DialogActions>
        {summary && moved.length > 1 && (
          <Button variant="outlined" onClick={() => select(null)}>
            Otra unidad
          </Button>
        )}
        <Button variant="text" onClick={close}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CollisionDialog;
