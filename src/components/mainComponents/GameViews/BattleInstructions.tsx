import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { defineMessages, useMessages } from "../../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    title: "Cómo se juega la batalla",
    intro:
      "La batalla se resuelve en el tablero: la app te dice cuántos dados tirar y lee la tirada. Toca una fila para " +
      "disparar o para ver su tirada. Al disparar, toca en el mapa la casilla del objetivo: solo se marcan las que " +
      "están a su alcance, a la vista y con algún dado. El número de cada casilla son los dados. Una unidad con " +
      "una unidad enemiga al lado solo dispara en asalto cercano, a una adyacente: dilo al disparar y solo quedan esas casillas.",
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
      "La primera bandera de una unidad la inmoviliza: márcala en la mesa (la infantería inmovilizada dispara con 1 " +
      "dado menos, «¿Inmovilizada?» al disparar). Cada bandera más la hace retirarse 1 casilla en el acto, y ya no " +
      "combate más este turno.",
    takeGround: "Tomar terreno",
    takeGroundRule:
      "Si un blindado gana un asalto cercano (el objetivo se retira o es eliminado; una sola bandera solo lo inmoviliza), puede tomar terreno: se mueve " +
      "a la casilla del objetivo y combate otra vez, solo en asalto cercano. Una vez por unidad y turno. La " +
      "infantería no toma terreno.",
    wire: "Alambradas",
    wireRule:
      "La infantería que está en una alambrada elige al disparar: la quita (y no dispara) o dispara con 1 dado " +
      "menos. Un tanque la quita al entrar y dispara como siempre; la artillería también dispara como siempre. Si " +
      "el rival quita una, quítala del mapa en la fase final.",
    combatCards: "Cartas de combate",
    combatCardsRule:
      "Se jugaron con las órdenes y ninguna se juega en la batalla: sus dados se suman solos al disparar. Lo que el rival debe tener en cuenta en la mesa:",
    combatCardsNone: "Se jugaron con las órdenes y ninguna se juega en la batalla: sus dados se suman solos al disparar.",
    gotIt: "Entendido",
  },
  en: {
    title: "How the battle is played",
    intro:
      "The battle is fought on the board: the app tells you how many dice to roll and reads the roll. Tap a row to " +
      "fire or to see its roll. When firing, tap the target's hex on the map: only the hexes in range, in sight " +
      "and with at least one die are marked. The number on each hex is its dice. A unit with an enemy unit " +
      "next to it only fires in close assault, at an adjacent one: say so when firing and only those hexes are left.",
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
      "A unit's first flag pins it: mark it on the table (pinned infantry fires with 1 die less, \"Pinned?\" when " +
      "firing). Each flag after that makes it retreat 1 hex at once, and it doesn't battle again this turn.",
    takeGround: "Take ground",
    takeGroundRule:
      "If an armor unit wins a close assault (the target retreats or is eliminated; a single flag only pins it), it can take ground: it moves " +
      "to the target's hex and fights again, in close assault only. Once per unit per turn. Infantry " +
      "doesn't take ground.",
    wire: "Barbed wire",
    wireRule:
      "Infantry on barbed wire chooses when firing: remove it (and not fire) or fire with 1 die " +
      "less. A tank removes it as it enters and fires as usual; artillery fires as usual too. If the " +
      "opponent removes one, take it off the map in the final phase.",
    combatCards: "Combat cards",
    combatCardsRule:
      "They were played with the orders, and none is played in the battle: their dice are added by themselves when firing. What the opponent must bear in mind at the table:",
    combatCardsNone: "They were played with the orders, and none is played in the battle: their dice are added by themselves when firing.",
    gotIt: "Got it",
  },
});

interface BattleInstructionsProps {
  open: boolean;
  onClose: () => void;
  /** This side attacks, so it fires first */
  attacking: boolean;
  /** What the combat cards played change in the opponent's rolls (Not One Step Back, Personal Armor) */
  reminders?: readonly string[];
}

/** How the battle is played, out of the way of the battle screen until asked for */
function BattleInstructions({ open, onClose, attacking, reminders = [] }: BattleInstructionsProps) {
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
            <Typography variant="body1">{reminders.length > 0 ? t.combatCardsRule : t.combatCardsNone}</Typography>
            {reminders.length > 0 && (
              <Box component="ul" sx={{ m: 0, mt: 1, pl: 3 }} data-testid="battle-reminders">
                {reminders.map((reminder) => (
                  <Typography key={reminder} component="li" variant="body1">
                    {reminder}
                  </Typography>
                ))}
              </Box>
            )}
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
