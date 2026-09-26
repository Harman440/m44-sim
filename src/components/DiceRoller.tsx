import { useState } from "react";
import { Button, Paper, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { rollDice } from "../game-core/dice";
import DiceResult, { DiceRoll } from "./DiceResult";

const DICE_COUNTS = [1, 2, 3, 4, 5, 6];

interface DiceRollerProps {
  faction: string;
}

function DiceRoller({ faction }: DiceRollerProps) {
  const [count, setCount] = useState(3);
  const [roll, setRoll] = useState<DiceRoll | null>(null);

  const handleRoll = () => setRoll((prev) => ({ faces: rollDice(count), id: (prev?.id ?? 0) + 1 }));

  return (
    <Paper variant="outlined" sx={{ p: 2, width: "100%" }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Tirada libre
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Tira los dados que quieras, sin preguntas.
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Número de dados
      </Typography>
      <ToggleButtonGroup
        exclusive
        value={count}
        onChange={(_, value: number | null) => value && setCount(value)}
        aria-label="Número de dados"
        sx={{ mb: 2, flexWrap: "wrap" }}
      >
        {DICE_COUNTS.map((n) => (
          <ToggleButton key={n} value={n} sx={{ minWidth: 48, minHeight: 48, fontSize: "1.1rem" }}>
            {n}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Button onClick={handleRoll} fullWidth size="large">
        Tirar {count} {count === 1 ? "dado" : "dados"}
      </Button>

      {roll && <DiceResult roll={roll} faction={faction} />}
    </Paper>
  );
}

export default DiceRoller;
