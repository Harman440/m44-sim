import type { ReactNode } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { Position, Scenario } from "../../types/scenario";
import { FACTIONS, Faction } from "../../types/faction";
import { UnitType } from "../../game-core/unit";
import { ScenarioProblem } from "../../game-core/scenarioFile";
import {
  SETTING_LIMITS,
  defaultExtraDraws,
  defaultParadrop,
  setAirSorties,
  setAttacker,
  setBigGuns,
  setExtraDraws,
  setHandSize,
  setParadrop,
  setFordableRivers,
  removeObjective,
  setObjectiveName,
  setText,
  setVictory,
  setVictoryMedals,
} from "../../game-core/scenarioDraft";
import { airSortiesOf, hasBigGuns } from "../../data/combatCards";
import { LANGS, LANG_NAMES, Lang } from "../../i18n/lang";
import FactionInsignia from "../FactionInsignia";
import GameIcon from "../GameIcon";
import InfoButton from "../InfoButton";
import ScenarioDetails from "../mainComponents/ScenarioDetails";
import ScenarioProblems from "../ScenarioProblems";
import { defineMessages, useLabels, useMessages } from "../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    title: "Datos del escenario",
    texts: "Nombre y descripción",
    textsInfo: [
      "El nombre y la descripción se escriben en cada idioma: cada dispositivo enseña los de su idioma, y si uno está vacío, el del otro. Basta con el nombre en un idioma.",
      "La descripción es lo que enseña el menú al tocar el escenario: la situación de cada bando y lo que tiene que hacer para ganar.",
    ],
    name: "Nombre",
    description: "Descripción",
    sides: "Bandos",
    role: "Papel",
    attacks: "Ataca",
    defends: "Defiende",
    roleInfo:
      "El bando que ataca juega un turno extra al empezar, antes de que el rival pueda responder; el que defiende espera ese turno y empieza en el turno 2. " +
      "También cambia sus cartas de combate: el atacante tiene las ofensivas y el defensor las defensivas. Toca «Defiende» para que ataque ese bando.",
    handSize: "Cartas de mando",
    handSizeInfo:
      "Las cartas de mando que tiene en la mano al empezar. Cada turno juega una y en la fase final roba otra. En los escenarios del juego, entre 2 y 6.",
    air: "Salidas aéreas",
    airInfo:
      "Cuántas copias de Poder aéreo y de Bombardeo aéreo hay en su mazo de combate: una de cada por cada salida aérea que el escenario da al bando. " +
      "Con 0 no tiene aviación. Si el escenario no dice nada, 1 cada bando.",
    bigGuns: "Artillería pesada",
    bigGunsInfo:
      "Si tiene la carta Cortina de Fuego en su mazo de combate. Los dos bandos la tienen, salvo que el escenario diga que uno no tiene artillería pesada.",
    yes: "Sí",
    no: "No",
    specialRules: "Reglas especiales",
    extraDraws: "Robo extra de cartas",
    extraDrawsInfo:
      "Un bando roba 2 cartas de mando en vez de 1 en la fase final de sus primeros turnos. En Pegasus Bridge, el Eje, cogido por sorpresa, empieza con 2 cartas y roba 2 en sus 2 primeros turnos.",
    turns: "Primeros turnos",
    paradrop: "Lanzamiento de paracaidistas",
    paradropInfo:
      "Antes del primer turno, el bando deja caer sus paracaidistas sobre el tablero de la mesa y toca en la app la casilla donde ha caído cada uno; " +
      "los que caen fuera del tablero o encima de otra unidad se pierden. Con paracaidistas, el bando puede empezar sin unidades en el mapa. Así empieza Sainte-Mère-Église.",
    fordableRivers: "Ríos vadeables",
    fordableRiversInfo:
      "Los ríos del mapa se pueden vadear (los puentes siguen como siempre). Cualquier unidad puede entrar en el río y se para ahí; puede disparar, con un dado menos, y retirarse a él. Se dispara a ella como en campo abierto.",
    victoryTitle: "Victoria",
    victory: "Condiciones de victoria",
    victoryInfo:
      "Gana el primer bando que llega a las medallas al acabar un turno (con las mismas cada uno, sigue la partida). Cada unidad enemiga destruida es una medalla, " +
      "y cada casilla objetivo de un bando, una medalla para él mientras tenga una unidad en ella. La app las cuenta en Pasar y jugar; en dos tabletas se llevan en la mesa. " +
      "Sin condiciones de victoria, la partida sigue hasta que los jugadores paren.",
    medals: "Medallas para ganar",
    objectives: "Objetivos",
    noObjectives: "Sin objetivos: solo cuentan las unidades destruidas. Ponlos en el mapa con la herramienta Objetivos.",
    objectivesHint: "Se ponen y se quitan en el mapa con la herramienta Objetivos.",
    hexes: (hexes: number) => (hexes === 1 ? "1 casilla" : `${hexes} casillas`),
    objectiveName: (n: number) => `Nombre del objetivo ${n}`,
    removeObjective: (name: string) => `Quitar ${name}`,
    side: "Bando",
    unit: "Unidad",
    units: "Unidades",
    preview: "Así lo verá el menú",
    done: "Hecho",
    ofSide: (setting: string, side: string) => `${setting} (${side})`,
    less: (setting: string) => `${setting}: uno menos`,
    more: (setting: string) => `${setting}: uno más`,
  },
  en: {
    title: "Scenario details",
    texts: "Name and description",
    textsInfo: [
      "The name and the description are written in each language: each device shows its own language's, and the other one when it's empty. A name in one language is enough.",
      "The description is what the menu shows when the scenario is tapped: each side's situation and what it has to do to win.",
    ],
    name: "Name",
    description: "Description",
    sides: "Sides",
    role: "Role",
    attacks: "Attacks",
    defends: "Defends",
    roleInfo:
      "The side that attacks plays an extra turn at the start, before the enemy can answer; the side that defends waits out that turn and starts on turn 2. " +
      "It also changes their combat cards: the attacker gets the offensive ones and the defender the defensive ones. Tap \"Defends\" to make that side attack.",
    handSize: "Command cards",
    handSizeInfo:
      "The command cards in its hand at the start. Each turn it plays one and draws another in the final phase. In the game's scenarios, between 2 and 6.",
    air: "Air sorties",
    airInfo:
      "How many copies of Air Power and Air Bombardment its combat deck has: one of each for each air sortie the scenario gives the side. " +
      "With 0 it has no air power. When the scenario says nothing, 1 for each side.",
    bigGuns: "Heavy guns",
    bigGunsInfo:
      "Whether its combat deck has the Barrage card. Both sides have it, unless the scenario says one has no heavy guns.",
    yes: "Yes",
    no: "No",
    specialRules: "Special rules",
    extraDraws: "Extra card draws",
    extraDrawsInfo:
      "One side draws 2 command cards instead of 1 in the final phase of its first turns. In Pegasus Bridge, the Axis, taken by surprise, start with 2 cards and draw 2 in their first 2 turns.",
    turns: "First turns",
    paradrop: "Paratrooper drop",
    paradropInfo:
      "Before the first turn, the side drops its paratroopers onto the board on the table and taps in the app the hex where each one landed; " +
      "the ones that land off the board or on another unit are lost. With paratroopers, the side can start with no units on the map. Sainte-Mère-Église starts like this.",
    fordableRivers: "Fordable rivers",
    fordableRiversInfo:
      "The map's rivers can be forded (bridges stay as they are). Any unit may enter the river and stops there; it may still fire, with a die fewer, and may retreat into it. It's fired at as on open ground.",
    victoryTitle: "Victory",
    victory: "Victory conditions",
    victoryInfo:
      "The first side to reach the medals at the end of a turn wins (with as many each, the game goes on). Each enemy unit destroyed is a medal, " +
      "and each of a side's objective hexes a medal for it while it has a unit there. The app counts them in Pass and play; on two tablets they're kept on the table. " +
      "Without victory conditions, the game goes on until the players stop.",
    medals: "Medals to win",
    objectives: "Objectives",
    noObjectives: "No objectives: only destroyed units count. Put them on the map with the Objectives tool.",
    objectivesHint: "They're put on and taken off the map with the Objectives tool.",
    hexes: (hexes: number) => (hexes === 1 ? "1 hex" : `${hexes} hexes`),
    objectiveName: (n: number) => `Name of objective ${n}`,
    removeObjective: (name: string) => `Remove ${name}`,
    side: "Side",
    unit: "Unit",
    units: "Units",
    preview: "How the menu will show it",
    done: "Done",
    ofSide: (setting: string, side: string) => `${setting} (${side})`,
    less: (setting: string) => `${setting}: one fewer`,
    more: (setting: string) => `${setting}: one more`,
  },
});

const UNIT_TYPES = [UnitType.INFANTRY, UnitType.TANK, UnitType.ARTILLERY];
const sideKey = (faction: Faction) => (faction === "Axis" ? "axis" : "allies");

/** A whole number with a button either side to change it by one, each 48px for a finger */
function NumberStepper({ value, min, max, label, onChange }: { value: number; min: number; max: number; label: string; onChange: (value: number) => void }) {
  const t = useMessages(TEXT);
  const step = { width: 48, height: 48, border: 1, borderColor: "divider", fontSize: "1.5rem", lineHeight: 1 };
  return (
    <Stack direction="row" role="group" aria-label={label} sx={{ alignItems: "center", justifyContent: "center", gap: 0.5 }}>
      <IconButton aria-label={t.less(label)} disabled={value <= min} onClick={() => onChange(value - 1)} sx={step}>
        −
      </IconButton>
      <Typography component="output" aria-live="polite" sx={{ minWidth: 32, textAlign: "center", fontWeight: 700, fontSize: "1.2rem" }}>
        {value}
      </Typography>
      <IconButton aria-label={t.more(label)} disabled={value >= max} onClick={() => onChange(value + 1)} sx={step}>
        +
      </IconButton>
    </Stack>
  );
}

/** A section's heading, with its explanation behind an "i" */
function Heading({ title, info }: { title: string; info: ReactNode }) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
      <Typography variant="h6" component="h3">
        {title}
      </Typography>
      <InfoButton title={title}>{info}</InfoButton>
    </Stack>
  );
}

const paragraphs = (lines: readonly string[]) =>
  lines.map((line) => (
    <Typography key={line} variant="body1" sx={{ mb: 1 }}>
      {line}
    </Typography>
  ));

interface ScenarioSettingsDialogProps {
  open: boolean;
  draft: Scenario;
  /**
   * A changed map. `field` names the setting changed, so that typing in one box, or
   * tapping one counter several times, can be undone in one go
   */
  onChange: (next: Scenario, field: string) => void;
  /** What keeps the map from being played (validateScenario) */
  problems: readonly ScenarioProblem[];
  /** Close the dialog and point some hexes out on the map */
  onShowHexes: (positions: readonly Position[]) => void;
  onClose: () => void;
}

/**
 * "Datos del escenario": everything about a map but its hexes. The name and description in each
 * language, the attacker, each side's starting cards, air sorties and big guns, the special
 * rules and the victory conditions (the medals and the objectives' names; the objectives
 * themselves are put on the map); then the sides as the menu will show them, and what's still wrong
 */
function ScenarioSettingsDialog({ open, draft, onChange, problems, onShowHexes, onClose }: ScenarioSettingsDialogProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const change = (next: Scenario | false, field: string) => {
    if (next !== false && next !== draft) onChange(next, field);
  };

  const textField = (field: "name" | "description", lang: Lang) => (
    <TextField
      key={`${field}-${lang}`}
      label={`${t[field]} · ${LANG_NAMES[lang]}`}
      value={draft[field][lang]}
      onChange={(event) => change(setText(draft, field, lang, event.target.value), `${field}.${lang}`)}
      multiline={field === "description"}
      minRows={field === "description" ? 3 : undefined}
      fullWidth
      slotProps={{ htmlInput: { lang, maxLength: field === "name" ? 60 : 2000 } }}
    />
  );

  const sideRows: { label: string; info: string; cell: (faction: Faction) => ReactNode }[] = [
    {
      label: t.role,
      info: t.roleInfo,
      cell: (faction) => {
        const attacks = draft.attacker === faction;
        return (
          <ToggleButton
            value={faction}
            selected={attacks}
            onChange={() => change(setAttacker(draft, faction), "attacker")}
            sx={{ width: "100%", gap: 1 }}
          >
            <GameIcon name={attacks ? "offensive" : "defensive"} size={24} />
            {attacks ? t.attacks : t.defends}
          </ToggleButton>
        );
      },
    },
    {
      label: t.handSize,
      info: t.handSizeInfo,
      cell: (faction) => (
        <NumberStepper
          value={draft.initialHandSize[sideKey(faction)]}
          {...SETTING_LIMITS.handSize}
          label={t.ofSide(t.handSize, labels.factions[faction])}
          onChange={(cards) => change(setHandSize(draft, faction, cards), `handSize.${faction}`)}
        />
      ),
    },
    {
      label: t.air,
      info: t.airInfo,
      cell: (faction) => (
        <NumberStepper
          value={airSortiesOf(draft, faction)}
          {...SETTING_LIMITS.airSorties}
          label={t.ofSide(t.air, labels.factions[faction])}
          onChange={(sorties) => change(setAirSorties(draft, faction, sorties), `air.${faction}`)}
        />
      ),
    },
    {
      label: t.bigGuns,
      info: t.bigGunsInfo,
      cell: (faction) => {
        const on = hasBigGuns(draft, faction);
        return (
          <FormControlLabel
            control={
              <Switch
                checked={on}
                onChange={() => change(setBigGuns(draft, faction, !on), `bigGuns.${faction}`)}
                slotProps={{ input: { "aria-label": t.ofSide(t.bigGuns, labels.factions[faction]) } }}
              />
            }
            label={on ? t.yes : t.no}
            sx={{ minHeight: 48, mx: 0 }}
          />
        );
      },
    },
  ];

  const sidePicker = (faction: Faction, onPick: (faction: Faction) => void) => (
    <ToggleButtonGroup exclusive value={faction} onChange={(_, picked: Faction | null) => picked && onPick(picked)} aria-label={t.side}>
      {FACTIONS.map((f) => (
        <ToggleButton key={f} value={f} sx={{ gap: 1, px: 1.5 }}>
          <FactionInsignia faction={f} size={22} decorative />
          {labels.factions[f]}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );

  const labelled = (label: string, control: ReactNode) => (
    <Stack sx={{ gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      {control}
    </Stack>
  );

  const ruleSwitch = (title: string, info: string, on: boolean, onToggle: () => void) => (
    <Stack direction="row" sx={{ alignItems: "center" }}>
      <FormControlLabel control={<Switch checked={on} onChange={onToggle} />} label={title} sx={{ minHeight: 48, mr: 0 }} />
      <InfoButton title={title}>
        <Typography variant="body1">{info}</Typography>
      </InfoButton>
    </Stack>
  );

  const extraDraws = draft.extraDraws;
  const paradrop = draft.paradrop;
  const victory = draft.victory;
  const objectives = victory?.objectives ?? [];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <GameIcon name="history" size={28} />
        {t.title}
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          // The option picked stands out from the rest
          "& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover": {
            bgcolor: "primary.main",
            color: "primary.contrastText",
          },
        }}
      >
        <Stack sx={{ gap: 3 }}>
          <Stack component="section" aria-label={t.texts} sx={{ gap: 1.5 }}>
            <Heading title={t.texts} info={paragraphs(t.textsInfo)} />
            <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
              {LANGS.map((lang) => textField("name", lang))}
              {LANGS.map((lang) => textField("description", lang))}
            </Box>
          </Stack>

          <Box component="section" aria-label={t.sides}>
            <Typography variant="h6" component="h3">
              {t.sides}
            </Typography>
            <Table size="small" sx={{ tableLayout: "fixed", "& td, & th": { px: 0.75 } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: "34%" }} />
                  {FACTIONS.map((f) => (
                    <TableCell key={f} align="center">
                      <Stack direction="row" sx={{ justifyContent: "center", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <FactionInsignia faction={f} size={28} decorative />
                        <Typography variant="subtitle1" component="span" sx={{ fontWeight: 600 }}>
                          {labels.factions[f]}
                        </Typography>
                      </Stack>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {sideRows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell component="th" scope="row">
                      <Stack direction="row" sx={{ alignItems: "center" }}>
                        <Typography variant="body2" color="text.secondary" component="span" sx={{ minWidth: 0 }}>
                          {row.label}
                        </Typography>
                        <InfoButton title={row.label}>
                          <Typography variant="body1">{row.info}</Typography>
                        </InfoButton>
                      </Stack>
                    </TableCell>
                    {FACTIONS.map((f) => (
                      <TableCell key={f} align="center">
                        {row.cell(f)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>

          <Stack component="section" aria-label={t.specialRules} sx={{ gap: 1 }}>
            <Typography variant="h6" component="h3">
              {t.specialRules}
            </Typography>
            {ruleSwitch(t.extraDraws, t.extraDrawsInfo, !!extraDraws, () =>
              change(setExtraDraws(draft, extraDraws ? null : defaultExtraDraws(draft)), "extraDraws"),
            )}
            {extraDraws && (
              <Stack direction="row" sx={{ gap: 2, flexWrap: "wrap", alignItems: "flex-end", pl: { sm: 6 } }}>
                {labelled(
                  t.side,
                  sidePicker(extraDraws.faction, (faction) => change(setExtraDraws(draft, { ...extraDraws, faction }), "extraDraws.faction")),
                )}
                {labelled(
                  t.turns,
                  <NumberStepper
                    value={extraDraws.turns}
                    {...SETTING_LIMITS.extraDrawTurns}
                    label={`${t.extraDraws}: ${t.turns}`}
                    onChange={(turns) => change(setExtraDraws(draft, { ...extraDraws, turns }), "extraDraws.turns")}
                  />,
                )}
              </Stack>
            )}
            {ruleSwitch(t.paradrop, t.paradropInfo, !!paradrop, () =>
              change(setParadrop(draft, paradrop ? null : defaultParadrop(draft)), "paradrop"),
            )}
            {paradrop && (
              <Stack direction="row" sx={{ gap: 2, flexWrap: "wrap", alignItems: "flex-end", pl: { sm: 6 } }}>
                {labelled(
                  t.side,
                  sidePicker(paradrop.faction, (faction) => change(setParadrop(draft, { ...paradrop, faction }), "paradrop.faction")),
                )}
                {labelled(
                  t.unit,
                  <ToggleButtonGroup
                    exclusive
                    value={paradrop.unitType}
                    onChange={(_, unitType: UnitType | null) =>
                      unitType && change(setParadrop(draft, { ...paradrop, unitType }), "paradrop.unitType")
                    }
                    aria-label={`${t.paradrop}: ${t.unit}`}
                  >
                    {UNIT_TYPES.map((type) => (
                      <ToggleButton key={type} value={type} sx={{ px: 1.5 }}>
                        {labels.units[type]}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>,
                )}
                {labelled(
                  t.units,
                  <NumberStepper
                    value={paradrop.units}
                    {...SETTING_LIMITS.paradropUnits}
                    label={`${t.paradrop}: ${t.units}`}
                    onChange={(units) => change(setParadrop(draft, { ...paradrop, units }), "paradrop.units")}
                  />,
                )}
              </Stack>
            )}
            {ruleSwitch(t.fordableRivers, t.fordableRiversInfo, !!draft.fordableRivers, () =>
              change(setFordableRivers(draft, !draft.fordableRivers), "fordableRivers"),
            )}
          </Stack>

          <Stack component="section" aria-label={t.victoryTitle} sx={{ gap: 1 }}>
            <Typography variant="h6" component="h3">
              {t.victoryTitle}
            </Typography>
            {ruleSwitch(t.victory, t.victoryInfo, !!victory, () => change(setVictory(draft, !victory), "victory"))}
            {victory && (
              <Stack sx={{ gap: 1.5, pl: { sm: 6 } }}>
                {labelled(
                  t.medals,
                  <Box sx={{ alignSelf: "flex-start" }}>
                    <NumberStepper
                      value={victory.medals}
                      {...SETTING_LIMITS.victoryMedals}
                      label={t.medals}
                      onChange={(medals) => change(setVictoryMedals(draft, medals), "victory.medals")}
                    />
                  </Box>,
                )}
                <Stack sx={{ gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t.objectives}
                  </Typography>
                  {objectives.length === 0 && <Typography variant="body2">{t.noObjectives}</Typography>}
                  {objectives.map((objective, i) => (
                    <Stack
                      key={i}
                      direction="row"
                      role="group"
                      aria-label={t.objectiveName(i + 1)}
                      sx={{ alignItems: "center", gap: 1, flexWrap: { xs: "wrap", sm: "nowrap" } }}
                    >
                      <FactionInsignia faction={objective.faction} size={28} />
                      <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, flex: 1, minWidth: 200 }}>
                        {LANGS.map((lang) => (
                          <TextField
                            key={lang}
                            size="small"
                            label={`${t.name} · ${LANG_NAMES[lang]}`}
                            value={objective.name[lang]}
                            onChange={(event) => change(setObjectiveName(draft, i, lang, event.target.value), `objective.${i}.${lang}`)}
                            slotProps={{ htmlInput: { lang, maxLength: 60 } }}
                          />
                        ))}
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                        {t.hexes(objective.hexes.length)}
                      </Typography>
                      <IconButton
                        aria-label={t.removeObjective(objective.name.es || objective.name.en || String(i + 1))}
                        onClick={() => change(removeObjective(draft, i), `objective.${i}.remove`)}
                        sx={{ width: 48, height: 48 }}
                      >
                        <GameIcon name="cancel" size={24} />
                      </IconButton>
                    </Stack>
                  ))}
                  {objectives.length > 0 && (
                    <Typography variant="body2" color="text.secondary">
                      {t.objectivesHint}
                    </Typography>
                  )}
                </Stack>
              </Stack>
            )}
          </Stack>

          <Box component="section" aria-label={t.preview}>
            <Typography variant="h6" component="h3">
              {t.preview}
            </Typography>
            <ScenarioDetails scenario={draft} faction={null} />
          </Box>

          <ScenarioProblems problems={problems} onShowHexes={onShowHexes} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose} startIcon={<GameIcon name="confirm" />}>
          {t.done}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ScenarioSettingsDialog;
