import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";

interface BattleInstructionsProps {
  open: boolean;
  onClose: () => void;
  /** This side attacks, so it fires first */
  attacking: boolean;
}

const STEPS = [
  "Choques: una unidad que se movió y chocó con una enemiga tira antes que nada. Cuenta como su disparo.",
  "Ataques de cartas de combate (Barrera, Bombardeo aéreo…): se tiran en cada casilla marcada antes de que dispare ninguna unidad.",
  "Unidades sin mover, de los dos bandos.",
  "Unidades movidas, cuando ya han disparado todas las sin mover.",
];

/** How the battle is played, out of the way of the battle screen until asked for */
function BattleInstructions({ open, onClose, attacking }: BattleInstructionsProps) {
  const heading = (text: string) => (
    <Typography variant="overline" component="h3" color="text.secondary" sx={{ lineHeight: 1.5 }}>
      {text}
    </Typography>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Cómo se juega la batalla</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2 }}>
          <Typography variant="body1">
            La batalla se resuelve en el tablero: la app te dice cuántos dados tirar y lee la tirada. Toca una fila para
            disparar o para ver su tirada. Al disparar, toca en el mapa la casilla del objetivo: solo se marcan las que
            están a su alcance, a la vista y con algún dado. El número de cada casilla son los dados.
          </Typography>

          <Box>
            {heading("Orden de fuego")}
            <Typography variant="body1" sx={{ mb: 1 }} data-testid="fire-order-rule">
              {attacking ? "Eres el bando atacante: disparas primero." : "Dispara primero el rival: es el bando atacante."}{" "}
              Después alternáis, una unidad cada uno.
            </Typography>
            <Box component="ol" sx={{ m: 0, pl: 3, display: "flex", flexDirection: "column", gap: 0.75 }}>
              {STEPS.map((step) => (
                <Typography key={step} component="li" variant="body1">
                  {step}
                </Typography>
              ))}
            </Box>
          </Box>

          <Box>
            {heading("Retiradas")}
            <Typography variant="body1">
              Márcalas en la mesa: se hacen en la fase final. Hasta entonces la unidad marcada puede disparar pero no tomar
              terreno.
            </Typography>
          </Box>

          <Box>
            {heading("Tomar terreno")}
            <Typography variant="body1" data-testid="take-ground-rule">
              Si un blindado gana un asalto cercano (el objetivo se retira o es eliminado), puede tomar terreno: se mueve
              a la casilla del objetivo y combate otra vez, solo en asalto cercano. La infantería también puede, pero solo
              con la carta Fragor del combate. Una vez por unidad y turno.
            </Typography>
          </Box>

          <Box>
            {heading("Cartas de combate")}
            <Typography variant="body1">
              Una por batalla, en cualquier momento; normalmente cuando dispara el rival. Se paga al jugarla.
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Entendido
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default BattleInstructions;
