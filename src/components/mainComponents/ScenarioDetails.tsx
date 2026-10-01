import { Box, Chip, Stack, Typography } from "@mui/material";
import FactionInsignia from "../FactionInsignia";
import { Scenario } from "../../types/scenario";
import { FACTIONS, Faction } from "../../types/faction";
import { FACTION_LABELS, UNIT_LABELS } from "../../labels";
import { UnitType } from "../../game-core/unit";
import { combatDeckFor } from "../../data/combatCards";

const sideKey = (faction: Faction) => (faction === "Axis" ? "axis" : "allies");

/** "6 Infantería, 1 Tanque", counting the paratroopers dropped before the game */
function unitsText(scenario: Scenario, faction: Faction): string {
  const units = scenario.units[sideKey(faction)];
  return Object.values(UnitType)
    .map((type) => {
      const dropped = scenario.paradrop?.faction === faction && scenario.paradrop.unitType === type ? scenario.paradrop.units : 0;
      return [type, (units[type]?.length ?? 0) + dropped] as const;
    })
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `${count} ${UNIT_LABELS[type]}`)
    .join(", ");
}

function airText(scenario: Scenario, faction: Faction): string {
  const air = scenario.airPower?.[sideKey(faction)] ?? 1;
  if (air === 0) return "Sin aviación";
  return air === 1 ? "Sí: 1 carta de cada aérea" : `Sí: ${air} cartas de cada aérea`;
}

/** The combat deck's cards with their copies, in deck order */
function deckCards(scenario: Scenario, faction: Faction): { name: string; copies: number }[] {
  const copies = new Map<string, number>();
  combatDeckFor(scenario, faction).forEach((card) => copies.set(card.name, (copies.get(card.name) ?? 0) + 1));
  return [...copies].map(([name, count]) => ({ name, copies: count }));
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", gap: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 150, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2">{children}</Typography>
    </Box>
  );
}

/** What each side starts with in the chosen scenario, shown in the menu */
function ScenarioDetails({ scenario }: { scenario: Scenario }) {
  return (
    <Box
      aria-label={`Detalles de ${scenario.name}`}
      sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}
    >
      {FACTIONS.map((faction) => {
        const deck = deckCards(scenario, faction);
        const total = deck.reduce((sum, card) => sum + card.copies, 0);
        const extra = scenario.extraDraws?.faction === faction ? scenario.extraDraws : null;
        return (
          <Box
            key={faction}
            component="section"
            aria-label={FACTION_LABELS[faction]}
            sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
              <FactionInsignia faction={faction} size={24} decorative />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {FACTION_LABELS[faction]}
              </Typography>
            </Stack>
            <Stack spacing={0.5}>
              <Row label="Papel">{scenario.attacker === faction ? "Ataca" : "Defiende"}</Row>
              <Row label="Cartas de mando">
                {scenario.initialHandSize[sideKey(faction)] + " al empezar"}
                {extra && `; roba 2 tras cada uno de sus ${extra.turns} primeros turnos`}
              </Row>
              <Row label="Unidades">
                {unitsText(scenario, faction)}
                {scenario.paradrop?.faction === faction && ` (${scenario.paradrop.units} en paracaídas)`}
              </Row>
              <Row label="Artillería pesada">
                {(scenario.bigGuns?.includes(faction) ?? true) ? "Sí: Cortina de Fuego" : "No"}
              </Row>
              <Row label="Aviación">{airText(scenario, faction)}</Row>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 0.5 }}>
              Mazo de combate: {total} cartas
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {deck.map(({ name, copies }) => (
                <Chip key={name} size="small" variant="outlined" label={copies > 1 ? `${name} ×${copies}` : name} />
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export default ScenarioDetails;
