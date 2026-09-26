import { useState } from "react";
import { Box, Button, Chip, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { DieFace, countFaces, rollDice } from "../game-core/dice";
import { UnitType } from "../game-core/unit";
import { unitSprite } from "./UnitComponent";
import { DIE_FACE_LABELS } from "./labels";
import "./DiceRoller.css";

const DICE_COUNTS = [1, 2, 3, 4, 5, 6];

/** One die showing `face`; infantry and tank faces reuse the player's unit art */
function DieFaceIcon({ face, faction }: { face: DieFace; faction: string }) {
  const symbol = (() => {
    switch (face) {
      case DieFace.INFANTRY:
        return <image href={unitSprite(faction, UnitType.INFANTRY)} x="8" y="6" width="32" height="36" />;
      case DieFace.TANK:
        return <image href={unitSprite(faction, UnitType.TANK)} x="6" y="6" width="36" height="36" />;
      case DieFace.GRENADE:
        return (
          <g>
            <ellipse cx="24" cy="29" rx="10" ry="12" fill="#4b5320" />
            <rect x="20" y="12" width="8" height="6" rx="1" fill="#333" />
            <path d="M28 14 q9 -3 6 9" stroke="#333" strokeWidth="3" fill="none" />
          </g>
        );
      case DieFace.STAR:
        return (
          <polygon
            points="24,7 28.9,18.6 41.5,19.5 31.9,27.7 34.9,40 24,33.3 13.1,40 16.1,27.7 6.5,19.5 19.1,18.6"
            fill="#d4a017"
          />
        );
      case DieFace.FLAG:
        return (
          <g>
            <rect x="14" y="8" width="3" height="32" fill="#333" />
            <path d="M17 9 L38 15 L17 22 Z" fill="#c62828" />
          </g>
        );
    }
  })();

  return (
    <svg viewBox="0 0 48 48" className="die" role="img" aria-label={DIE_FACE_LABELS[face]}>
      <rect x="1" y="1" width="46" height="46" rx="8" fill="#f5f0e6" stroke="#9ca3af" strokeWidth="2" />
      {symbol}
    </svg>
  );
}

interface DiceRollerProps {
  faction: string;
}

function DiceRoller({ faction }: DiceRollerProps) {
  const [count, setCount] = useState(3);
  const [roll, setRoll] = useState<{ faces: DieFace[]; id: number } | null>(null);

  const handleRoll = () => setRoll((prev) => ({ faces: rollDice(count), id: (prev?.id ?? 0) + 1 }));

  const counts = roll ? countFaces(roll.faces) : null;

  return (
    <Paper variant="outlined" sx={{ p: 2, width: "100%" }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Dados de batalla
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

      {roll && counts && (
        <Box sx={{ mt: 2 }}>
          {/* Keyed by roll so every roll replays the animation */}
          <div key={roll.id} className="dice-result" data-testid="dice-result">
            {roll.faces.map((face, i) => (
              <div key={i} className="dice-result__die">
                <DieFaceIcon face={face} faction={faction} />
                <Typography variant="caption">{DIE_FACE_LABELS[face]}</Typography>
              </div>
            ))}
          </div>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mt: 1.5 }}>
            {Object.values(DieFace)
              .filter((face) => counts[face] > 0)
              .map((face) => (
                <Chip key={face} label={`${counts[face]} × ${DIE_FACE_LABELS[face]}`} />
              ))}
          </Stack>
        </Box>
      )}
    </Paper>
  );
}

export default DiceRoller;
