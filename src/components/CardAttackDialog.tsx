import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { CardAttack, CARD_ATTACK_NOTE } from "../game-core/gameSession";
import { UnitType } from "../game-core/unit";
import { Faction } from "../types/faction";
import { UNIT_LABELS } from "../labels";
import DiceResult, { rollDuration } from "./DiceResult";
import RollReading from "./RollReading";

interface CardAttackDialogProps {
  /** The marked hex being attacked, or null when closed */
  hex: { index: number; place: string } | null;
  cardName: string;
  dicePerHex: number;
  /** The roll already made on this hex */
  attack: CardAttack | null;
  faction: Faction;
  /** Roll on the hex (null: it was empty) */
  onAttack: (targetType: UnitType | null) => boolean;
  onUndo: () => boolean;
  onClose: () => void;
}

const EMPTY = "empty";

/**
 * An attack combat card's roll on one marked hex (Barrage, Air Power, Air
 * Bombardment): the player says what enemy unit, if any, is on it at the
 * table, and the app rolls. Stars hit; retreats can't be ignored.
 */
function CardAttackDialog({ hex, cardName, dicePerHex, attack, faction, onAttack, onUndo, onClose }: CardAttackDialogProps) {
  const [target, setTarget] = useState<string | null>(null);
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  /** Just rolled here: throw the dice in (the dialog is keyed by hex, so this starts false for each) */
  const [rolled, setRolled] = useState(false);

  const close = () => {
    setTarget(null);
    setConfirmingUndo(false);
    onClose();
  };

  const dice = `${dicePerHex} ${dicePerHex === 1 ? "dado" : "dados"}`;

  return (
    <Dialog open={hex !== null} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>
        {cardName} · casilla {hex ? hex.index + 1 : ""}
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {hex?.place}
        </Typography>
        {attack ? (
          attack.target ? (
            <>
              <DiceResult
                roll={{ faces: [...attack.faces], id: attack.marker + 1 }}
                faction={faction}
                target={attack.target}
                rolling={rolled}
              />
              <RollReading
                faces={attack.faces}
                target={attack.target}
                withCoins={false}
                delay={rolled ? rollDuration(attack.faces.length) : 0}
              />
              <Alert severity="warning" sx={{ mt: 1.5 }}>
                {CARD_ATTACK_NOTE}
              </Alert>
            </>
          ) : (
            <Alert severity="info">No había ninguna unidad enemiga en la casilla: no se tira.</Alert>
          )
        ) : (
          <>
            <Typography variant="h6" sx={{ mb: 1 }}>
              ¿Hay una unidad enemiga en la casilla?
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={target}
              onChange={(_, value: string | null) => value && setTarget(value)}
              aria-label="Unidad enemiga en la casilla"
              sx={{ flexWrap: "wrap" }}
            >
              {Object.values(UnitType).map((type) => (
                <ToggleButton key={type} value={type} sx={{ minHeight: 48 }}>
                  {UNIT_LABELS[type]}
                </ToggleButton>
              ))}
              <ToggleButton value={EMPTY} sx={{ minHeight: 48 }}>
                Vacía
              </ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              Se tiran {dice}. {CARD_ATTACK_NOTE}
            </Typography>
          </>
        )}
        {confirmingUndo && (
          <Alert
            severity="error"
            sx={{ mt: 1.5 }}
            action={
              <Button
                color="error"
                onClick={() => {
                  if (onUndo()) setConfirmingUndo(false);
                }}
              >
                Anular
              </Button>
            }
          >
            Anula esta tirada solo si se registró por error.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        {attack && !confirmingUndo && (
          <Button variant="text" color="error" onClick={() => setConfirmingUndo(true)}>
            Anular tirada
          </Button>
        )}
        <Button variant="outlined" onClick={close}>
          Cerrar
        </Button>
        {!attack && (
          <Button
            disabled={target === null}
            onClick={() => {
              if (onAttack(target === EMPTY ? null : (target as UnitType))) {
                setTarget(null);
                setRolled(true);
              }
            }}
          >
            {target === EMPTY ? "Casilla vacía" : `Tirar ${dice}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default CardAttackDialog;
