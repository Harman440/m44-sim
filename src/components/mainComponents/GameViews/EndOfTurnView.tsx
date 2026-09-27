import { useState } from "react";
import { Alert, Box, Button, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import GameSession, { GameSnapshot } from "../../../game-core/gameSession";
import CommandCard from "../../../game-core/commandCard";
import { Faction } from "../../../types/faction";
import CommandCardComponent from "../../CommandCardComponent";
import GameIcon from "../../GameIcon";
import EndOfTurnMap from "./EndOfTurnMap";
import { RewardChoice } from "../../../game-core/coins";
import { END_OF_TURN_COINS } from "../../../data/coinRules";

interface EndOfTurnViewProps {
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
  onDrawCard: () => void;
  onKeepCard: (card: CommandCard) => void;
  onDrawAgain: () => void;
  onChooseReward: (choice: RewardChoice) => void;
  onEndTurn: () => void;
}

/**
 * Fase final: make the retreats marked in battle on the table and mirror the
 * casualties, retreats and ground taken on the map, then draw a command card:
 * keep it or swap it once for the next one (Recon: draw 3 and keep 1). Last,
 * take 2 coins or a combat card (Preparations gives both, in its own amounts).
 */
function EndOfTurnView({
  faction,
  session,
  game,
  onDrawCard,
  onKeepCard,
  onDrawAgain,
  onChooseReward,
  onEndTurn,
}: EndOfTurnViewProps) {
  const { drawnCard, drawOptions, chosenCard } = game;
  const drawChoice = chosenCard?.drawChoice ?? 1;
  const reward = chosenCard?.endOfTurnReward;
  const [showMap, setShowMap] = useState(false);

  if (showMap) {
    return <EndOfTurnMap faction={faction} session={session} game={game} onDone={() => setShowMap(false)} />;
  }

  return (
    <Stack spacing={2} sx={{ width: "100%", maxWidth: 640, mx: "auto" }}>
      <Typography variant="h5" component="h2">
        Fase final
      </Typography>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" component="h3">
          1. Retiradas y bajas
        </Typography>
        <Typography variant="body1">
          Haz en la mesa las retiradas marcadas en la batalla. Después refleja en el mapa las unidades
          eliminadas y las que se han movido (retiradas o terreno tomado), de los dos bandos.
        </Typography>
        <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1.5, mt: 1.5 }}>
          <Button variant="outlined" onClick={() => setShowMap(true)} startIcon={<GameIcon name="map" />}>
            Actualizar mapa
          </Button>
          {game.battleEdits > 0 && (
            <Typography variant="body2" color="text.secondary" data-testid="map-edits">
              {game.battleEdits === 1 ? "1 cambio" : `${game.battleEdits} cambios`} en el mapa
            </Typography>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Box>
          <Typography variant="h6" component="h3">
            2. Carta de mando
          </Typography>
          <Typography variant="body1">
            {drawChoice > 1
              ? `${chosenCard!.name}: roba ${drawChoice} cartas de tu mazo y quédate con 1.`
              : "Roba una carta de tu mazo. Puedes descartarla y robar otra, pero entonces tienes que quedarte con la nueva."}
          </Typography>
        </Box>
        {drawnCard ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {game.drewAgain ? "Has descartado la primera y robado:" : "Te quedas:"}
            </Typography>
            <CommandCardComponent cardData={drawnCard} />
          </Box>
        ) : drawOptions.length > 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              {drawOptions.length > 1 ? "Elige la carta que te quedas:" : "Has robado:"}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 2 }}>
              {drawOptions.map((card) => (
                <Box
                  key={card.id}
                  sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", gap: 1 }}
                >
                  <CommandCardComponent cardData={card} />
                  <Button onClick={() => onKeepCard(card)} aria-label={`Quedármela: ${card.name}`}>
                    Quedármela
                  </Button>
                </Box>
              ))}
            </Box>
            {game.canDrawAgain && (
              <Button variant="outlined" onClick={onDrawAgain} startIcon={<GameIcon name="cards" />}>
                Descartar y robar otra
              </Button>
            )}
          </Box>
        ) : (
          <Button onClick={onDrawCard} startIcon={<GameIcon name="cards" />} sx={{ alignSelf: "flex-start" }}>
            {drawChoice > 1 ? `Robar ${drawChoice} cartas` : "Robar carta"}
          </Button>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }} data-testid="end-of-turn-reward">
        <Typography variant="h6" component="h3">
          3. {reward ? chosenCard!.name : "Monedas o carta de combate"}
        </Typography>
        {game.extraTurn ? (
          <Typography variant="body1">En el turno extra no se ganan monedas ni se cogen cartas de combate.</Typography>
        ) : reward ? (
          <Typography variant="body1">
            En lugar de elegir: +{reward.coins} monedas, ya sumadas al contador
            {reward.combatCard ? ", y coge una carta de combate en la mesa" : ""}.
          </Typography>
        ) : (
          <>
            <Typography variant="body1">Elige qué te llevas este turno.</Typography>
            <ToggleButtonGroup
              exclusive
              value={game.rewardChoice}
              onChange={(_, choice: RewardChoice | null) => choice && onChooseReward(choice)}
              aria-label="Monedas o carta de combate"
              sx={{ flexWrap: "wrap" }}
            >
              <ToggleButton value="coins" sx={{ minHeight: 48, gap: 1 }}>
                <GameIcon name="coins" /> {END_OF_TURN_COINS} monedas
              </ToggleButton>
              <ToggleButton value="combatCard" sx={{ minHeight: 48, gap: 1 }}>
                <GameIcon name="cards" /> Carta de combate
              </ToggleButton>
            </ToggleButtonGroup>
            {game.rewardChoice === "combatCard" && (
              <Alert severity="info">
                Coge una carta de combate del mazo en la mesa. Puedes tener 3 como máximo: si ya tienes 3, cambia una
                de tu mano por la nueva.
              </Alert>
            )}
          </>
        )}
        {reward?.combatCard && !game.extraTurn && (
          <Alert severity="info">Puedes tener 3 cartas de combate como máximo: si ya tienes 3, cambia una.</Alert>
        )}
      </Paper>

      {drawnCard && (
        <Button
          size="large"
          onClick={onEndTurn}
          disabled={game.needsRewardChoice && !game.rewardChoice}
          startIcon={<GameIcon name="endTurn" />}
          sx={{ alignSelf: "center" }}
        >
          Empezar turno {game.turn + 1}
        </Button>
      )}
      {drawnCard && game.needsRewardChoice && !game.rewardChoice && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
          Elige monedas o carta de combate para empezar el siguiente turno.
        </Typography>
      )}
    </Stack>
  );
}

export default EndOfTurnView;
