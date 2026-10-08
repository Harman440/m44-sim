import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { defineMessages, useMessages } from "../../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    title: "Cómo se juega la batalla",
    intro:
      "La batalla se resuelve en el tablero: la app te dice cuántos dados tirar y lee la tirada. Toca una fila para " +
      "disparar o para ver su tirada. Al disparar, toca en el mapa la casilla del objetivo: solo se marcan las que " +
      "están a su alcance, a la vista y con algún dado. El número de cada casilla son los dados.",
    fireOrder: "Orden de fuego",
    fireOrderRule: (attacking: boolean) =>
      `${attacking ? "Eres el bando atacante: disparas primero." : "Dispara primero el rival: es el bando atacante."} ` +
      "Después alternáis, una unidad cada uno.",
    steps: [
      "Choques: una unidad que se movió y chocó con una enemiga tira antes que nada. Cuenta como su disparo.",
      "Ataques de cartas de combate (Cortina de Fuego, Bombardeo aéreo…): se tiran en cada casilla marcada antes de que dispare ninguna unidad.",
      "Unidades sin mover, de los dos bandos.",
      "Unidades movidas, cuando ya han disparado todas las sin mover.",
    ],
    retreats: "Retiradas",
    retreatsRule:
      "Márcalas en la mesa: se hacen en la fase final. Hasta entonces la unidad marcada puede disparar pero no tomar " +
      "terreno.",
    takeGround: "Tomar terreno",
    takeGroundRule:
      "Si un blindado gana un asalto cercano (el objetivo se retira o es eliminado), puede tomar terreno: se mueve " +
      "a la casilla del objetivo y combate otra vez, solo en asalto cercano. La infantería también puede, pero solo " +
      "con la carta Fragor del combate. Una vez por unidad y turno.",
    wire: "Alambradas",
    wireRule:
      "La infantería que está en una alambrada elige al disparar: la quita (y no dispara) o dispara con 1 dado " +
      "menos. Los blindados y la artillería disparan como siempre. Si el rival quita una, quítala del mapa en la " +
      "fase final.",
    combatCards: "Cartas de combate",
    combatCardsRule: "Una por batalla, en cualquier momento; normalmente cuando dispara el rival. Se paga al jugarla.",
    gotIt: "Entendido",
  },
  en: {
    title: "How the battle is played",
    intro:
      "The battle is fought on the board: the app tells you how many dice to roll and reads the roll. Tap a row to " +
      "fire or to see its roll. When firing, tap the target's hex on the map: only the hexes in range, in sight " +
      "and with at least one die are marked. The number on each hex is its dice.",
    fireOrder: "Firing order",
    fireOrderRule: (attacking: boolean) =>
      `${attacking ? "You're the attacking side: you fire first." : "The opponent fires first: they're the attacking side."} ` +
      "Then you take turns, one unit each.",
    steps: [
      "Collisions: a unit that moved and collided with an enemy one rolls before anything else. It counts as its shot.",
      "Combat card attacks (Barrage, Air Bombardment…): rolled on each marked hex before any unit fires.",
      "Units that didn't move, from both sides.",
      "Units that moved, once all the units that didn't move have fired.",
    ],
    retreats: "Retreats",
    retreatsRule:
      "Mark them on the table: they're carried out in the final phase. Until then the marked unit can fire but can't " +
      "take ground.",
    takeGround: "Take ground",
    takeGroundRule:
      "If an armor unit wins a close assault (the target retreats or is eliminated), it can take ground: it moves " +
      "to the target's hex and fights again, in close assault only. Infantry can too, but only " +
      "with the Heat of Battle card. Once per unit per turn.",
    wire: "Barbed wire",
    wireRule:
      "Infantry on barbed wire chooses when firing: remove it (and not fire) or fire with 1 die " +
      "less. Armor and artillery fire as usual. If the opponent removes one, take it off the map in the " +
      "final phase.",
    combatCards: "Combat cards",
    combatCardsRule: "One per battle, at any moment; usually when the opponent fires. You pay when you play it.",
    gotIt: "Got it",
  },
});

interface BattleInstructionsProps {
  open: boolean;
  onClose: () => void;
  /** This side attacks, so it fires first */
  attacking: boolean;
}

/** How the battle is played, out of the way of the battle screen until asked for */
function BattleInstructions({ open, onClose, attacking }: BattleInstructionsProps) {
  const t = useMessages(TEXT);
  const heading = (text: string) => (
    <Typography variant="overline" component="h3" color="text.secondary" sx={{ lineHeight: 1.5 }}>
      {text}
    </Typography>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t.title}</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2 }}>
          <Typography variant="body1">{t.intro}</Typography>

          <Box>
            {heading(t.fireOrder)}
            <Typography variant="body1" sx={{ mb: 1 }} data-testid="fire-order-rule">
              {t.fireOrderRule(attacking)}
            </Typography>
            <Box component="ol" sx={{ m: 0, pl: 3, display: "flex", flexDirection: "column", gap: 0.75 }}>
              {t.steps.map((step) => (
                <Typography key={step} component="li" variant="body1">
                  {step}
                </Typography>
              ))}
            </Box>
          </Box>

          <Box>
            {heading(t.retreats)}
            <Typography variant="body1">{t.retreatsRule}</Typography>
          </Box>

          <Box>
            {heading(t.takeGround)}
            <Typography variant="body1" data-testid="take-ground-rule">
              {t.takeGroundRule}
            </Typography>
          </Box>

          <Box>
            {heading(t.wire)}
            <Typography variant="body1">{t.wireRule}</Typography>
          </Box>

          <Box>
            {heading(t.combatCards)}
            <Typography variant="body1">{t.combatCardsRule}</Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          {t.gotIt}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default BattleInstructions;
