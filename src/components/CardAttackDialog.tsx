import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { CardAttack, CARD_ATTACK_NOTE } from "../game-core/gameSession";
import { Faction } from "../types/faction";
import { TargetKinds } from "../data/hitRules";
import TargetKindPicker, { TargetChoice } from "./TargetKindPicker";
import DiceResult, { rollDuration } from "./DiceResult";
import RollReading from "./RollReading";
import { defineMessages, useMessages, useTr } from "../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    title: (card: string, hex: number | "") => `${card} · casilla ${hex}`,
    dice: (n: number) => `${n} ${n === 1 ? "dado" : "dados"}`,
    noEnemy: "No había ninguna unidad enemiga en la casilla: no se tira.",
    enemyInHex: "¿Hay una unidad enemiga en la casilla?",
    empty: "Vacía",
    explanation: (dice: string, note: string) =>
      `Se tiran ${dice} de ataque: llevan una granada donde el dado normal tiene el suministro. ${note}`,
    undo: "Anular",
    undoWarning: "Anula esta tirada solo si se registró por error.",
    undoRoll: "Anular tirada",
    close: "Cerrar",
    emptyHex: "Casilla vacía",
    roll: (dice: string) => `Tirar ${dice}`,
  },
  en: {
    title: (card: string, hex: number | "") => `${card} · hex ${hex}`,
    dice: (n: number) => `${n} ${n === 1 ? "die" : "dice"}`,
    noEnemy: "There was no enemy unit on the hex: no roll.",
    enemyInHex: "Is there an enemy unit on the hex?",
    empty: "Empty",
    explanation: (dice: string, note: string) =>
      `You roll ${dice} with the attack die: it has a second grenade where the battle die has the supply. ${note}`,
    undo: "Cancel",
    undoWarning: "Cancel this roll only if it was recorded by mistake.",
    undoRoll: "Cancel roll",
    close: "Close",
    emptyHex: "Empty hex",
    roll: (dice: string) => `Roll ${dice}`,
  },
});

interface CardAttackDialogProps {
  /** The marked hex being attacked, or null when closed */
  hex: { index: number; place: string } | null;
  cardName: string;
  dicePerHex: number;
  /** The roll already made on this hex */
  attack: CardAttack | null;
  faction: Faction;
  /** What the enemy can have in the scenario */
  targetKinds: TargetKinds;
  /** Roll on the hex: whether its enemy unit is infantry (null: it was empty) */
  onAttack: (infantry: boolean | null) => boolean;
  onUndo: () => boolean;
  onClose: () => void;
}

/**
 * An attack combat card's roll on one marked hex (Barrage, Air Power, Air
 * Bombardment): the player says what enemy unit, if any, is on it at the
 * table, and the app rolls the attack die (a grenade where the battle die has
 * a supply); retreats can't be ignored.
 */
function CardAttackDialog({ hex, cardName, dicePerHex, attack, faction, targetKinds, onAttack, onUndo, onClose }: CardAttackDialogProps) {
  const [target, setTarget] = useState<TargetChoice | null>(null);
  const enemy: Faction = faction === "Allies" ? "Axis" : "Allies";
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  /** Just rolled here: throw the dice in (the dialog is keyed by hex, so this starts false for each) */
  const [rolled, setRolled] = useState(false);
  const t = useMessages(TEXT);
  const tr = useTr();

  const close = () => {
    setTarget(null);
    setConfirmingUndo(false);
    onClose();
  };

  const dice = t.dice(dicePerHex);

  return (
    <Dialog open={hex !== null} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>
        {t.title(cardName, hex ? hex.index + 1 : "")}
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
                die="attack"
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
                {tr(CARD_ATTACK_NOTE)}
              </Alert>
            </>
          ) : (
            <Alert severity="info">{t.noEnemy}</Alert>
          )
        ) : (
          <>
            <Typography variant="h6" sx={{ mb: 1 }}>
              {t.enemyInHex}
            </Typography>
            <TargetKindPicker kinds={targetKinds} value={target} onChange={setTarget} enemy={enemy} emptyLabel={t.empty} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {t.explanation(dice, tr(CARD_ATTACK_NOTE))}
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
                {t.undo}
              </Button>
            }
          >
            {t.undoWarning}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        {attack && !confirmingUndo && (
          <Button variant="text" color="error" onClick={() => setConfirmingUndo(true)}>
            {t.undoRoll}
          </Button>
        )}
        <Button variant="outlined" onClick={close}>
          {t.close}
        </Button>
        {!attack && (
          <Button
            disabled={target === null}
            onClick={() => {
              if (onAttack(target === "empty" ? null : target === "infantry")) {
                setTarget(null);
                setRolled(true);
              }
            }}
          >
            {target === "empty" ? t.emptyHex : t.roll(dice)}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default CardAttackDialog;
