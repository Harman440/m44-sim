import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { Box, Button, IconButton, Stack, Typography } from "@mui/material";
import Board from "../Board";
import BoardManager from "../../game-core/BoardManager";
import { PickedTile, Position, Scenario, Tiles } from "../../types/scenario";
import { HexType } from "../../types/hex";
import { UnitType } from "../../game-core/unit";
import { positionKey } from "../../game-core/position";
import {
  DraftHistory,
  EditorTool,
  Stroke,
  draftCounts,
  isBlank,
  recordStep,
  redoStep,
  dropStep,
  startHistory,
  strokeOf,
  undoStep,
  unitAt,
} from "../../game-core/scenarioDraft";
import { validateScenario } from "../../game-core/scenarioFile";
import { countMedals } from "../../game-core/victory";
import { VictoryContext, VictoryInfo } from "../VictoryContext";
import { drawBoardArt } from "../../boardArt/drawBoard";
import { loadCustomMaps, saveCustomMap } from "../../storage";
import { useHexFlash } from "../useHexFlash";
import GameIcon from "../GameIcon";
import InfoButton from "../InfoButton";
import EditorTools from "./EditorTools";
import NewMapDialog from "./NewMapDialog";
import ScenarioProblems from "../ScenarioProblems";
import ScenarioSettingsDialog from "./ScenarioSettingsDialog";
import { defineMessages, useLabels, useMessages, useTr } from "../../i18n/useI18n";
import { BoardSize, boardSizeOf } from "../../game-core/boardSize";
import BoardSizeDialog from "./BoardSizeDialog";
import "../mainComponents/GameViews/PhaseLayout.css";
import "./MapEditor.css";

const TEXT = defineMessages({
  es: {
    title: "Editor de mapas",
    untitled: "Mapa sin nombre",
    newMap: "Nuevo mapa",
    exit: "Volver al menú",
    undo: "Deshacer",
    redo: "Rehacer",
    finished: "Ver el mapa terminado",
    plain: "Volver al mapa sencillo",
    map: "Mapa",
    move: "Mover el mapa: desliza un dedo para ver el resto",
    onWater: "No puede ir en un río ni en un lago.",
    noUnit: "Ahí no hay ninguna unidad.",
    side: (side: string, infantry: number, tanks: number, artillery: number) =>
      `${side}: ${infantry} inf., ${tanks} tanq., ${artillery} art.`,
    towns: (towns: number) => `Pueblos: ${towns}`,
    settings: "Datos del escenario",
    boardSize: (cols: number, rows: number) => `Tamaño del mapa: ${cols} × ${rows}`,
    instructions: "Instrucciones",
    help: [
      "Elige una herramienta y toca las casillas del mapa. El mapa se ve desde el lado de los Aliados: el Eje empieza arriba.",
      "Zoom: los botones + y − sobre el mapa, la rueda del ratón, o separar y juntar dos dedos; con dos dedos también se mueve el mapa. Con ✥ activado, un dedo mueve el mapa en vez de pintar.",
      "Terreno: toca una casilla para pintarla, y otra vez para dejarla en llano. Desliza el dedo para pintar varias. Los ríos y lagos se unen solos con los de al lado; un puente es un río que se puede cruzar.",
      "Unidades: toca una casilla para poner la unidad, y otra vez para quitarla. No pueden ir en el agua.",
      "Marcas: De élite y Sacos terreros van sobre una unidad; la alambrada, en cualquier casilla de tierra. Borrar deja la casilla vacía.",
      "Objetivos: toca una casilla para que valga una medalla al bando mientras tenga una unidad en ella, y otra vez para quitarla. Las medallas para ganar y los nombres de los objetivos, en Datos del escenario.",
      "Datos del escenario: el nombre y la descripción, quién ataca, las cartas de cada bando, las reglas especiales y la victoria.",
      "Tamaño del mapa: añade o quita casillas por los bordes, del terreno que elijas. Un mapa más grande que el estándar se juega en Pasar y jugar o contra el ordenador.",
      "Debajo, lo que falta para poder jugarlo; si una línea habla de unas casillas, tócala para verlas en el mapa.",
      "El mapa se guarda solo en Mis mapas, en este dispositivo, mientras lo haces.",
    ],
  },
  en: {
    title: "Map editor",
    untitled: "Untitled map",
    newMap: "New map",
    exit: "Back to the menu",
    undo: "Undo",
    redo: "Redo",
    finished: "Show the finished map",
    plain: "Back to the plain map",
    map: "Map",
    move: "Move the map: slide a finger to see the rest of it",
    onWater: "It can't go on a river or a lake.",
    noUnit: "There's no unit there.",
    side: (side: string, infantry: number, tanks: number, artillery: number) =>
      `${side}: ${infantry} inf., ${tanks} tanks, ${artillery} art.`,
    towns: (towns: number) => `Towns: ${towns}`,
    settings: "Scenario details",
    boardSize: (cols: number, rows: number) => `Map size: ${cols} × ${rows}`,
    instructions: "Instructions",
    help: [
      "Pick a tool and tap the hexes on the map. The map is seen from the Allies' side: the Axis starts at the top.",
      "Zoom: the + and − buttons on the map, the mouse wheel, or two fingers apart and together; two fingers also move the map. With ✥ turned on, one finger moves it instead of painting.",
      "Terrain: tap a hex to paint it, and again to leave it as plains. Slide your finger to paint several. Rivers and lakes join up with the ones next to them on their own; a bridge is a river that can be crossed.",
      "Units: tap a hex to put the unit there, and again to take it off. They can't go on water.",
      "Marks: Elite and Sandbags go on a unit; barbed wire on any land hex. Clear empties the hex.",
      "Objectives: tap a hex to make it worth a medal to the side while it has a unit there, and again to take it off. The medals to win and the objectives' names are in Scenario details.",
      "Scenario details: the name and the description, who attacks, each side's cards, the special rules and victory.",
      "Map size: add or take off hexes at the edges, of the terrain you pick. A map bigger than the standard one is played in Pass and play or against the computer.",
      "Below, what's still missing before it can be played; when a line is about some hexes, tap it to see them on the map.",
      "The map is saved in My maps on this device as you make it.",
    ],
  },
});

type Action =
  | { kind: "edit"; next: Scenario; amend: boolean }
  | { kind: "undo" }
  | { kind: "redo" }
  | { kind: "drop" }
  | { kind: "start"; draft: Scenario };

/** The objectives drawn on the map, each medal solid in its side's colour */
function victoryOnMap(draft: Scenario): VictoryInfo | null {
  if (!draft.victory) return null;
  const objectives = draft.victory.objectives ?? [];
  const hexesOf = (faction: "Allies" | "Axis") => objectives.filter((o) => o.faction === faction).flatMap((o) => o.hexes);
  const none = { Allies: [], Axis: [] };
  return { medals: draft.victory.medals, standing: countMedals(none, none), objectives, held: { Allies: hexesOf("Allies"), Axis: hexesOf("Axis") } };
}

const reducer = (history: DraftHistory, action: Action): DraftHistory => {
  switch (action.kind) {
    case "edit":
      return recordStep(history, action.next, action.amend);
    case "undo":
      return undoStep(history);
    case "redo":
      return redoStep(history);
    case "drop":
      return dropStep(history);
    case "start":
      return startHistory(action.draft);
  }
};

/**
 * The map's board art, drawn again when its terrain, its size or the tiles picked change: the plain art, quick to draw
 * on every tap, unless `finished` asks for the art the menu and the game show (joined hills,
 * terrain blending and spilling over its edges), slower to draw
 */
function useBoardArt(tiles: Tiles, { cols, rows }: BoardSize, finished: boolean, picked: PickedTile[] | undefined): string | undefined {
  const [art, setArt] = useState<string>();
  const shown = useRef<string>(undefined);
  useEffect(() => {
    let current = true;
    drawBoardArt(tiles, { cols, rows }, { plain: !finished, picked }).then(
      (url) => {
        if (!current) return URL.revokeObjectURL(url);
        const before = shown.current;
        shown.current = url;
        setArt(url);
        if (before) URL.revokeObjectURL(before);
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, [tiles, cols, rows, finished, picked]);
  useEffect(
    () => () => {
      if (shown.current) URL.revokeObjectURL(shown.current);
    },
    [],
  );
  return art;
}

/** The hex under a point on the screen, or the one an event started on */
const hexAt = (element: Element | null): Position | null => {
  const key = element?.closest("[data-position]")?.getAttribute("data-position");
  if (!key) return null;
  const [row = 0, col = 0] = key.split("-").map(Number);
  return { row, col };
};

export interface MapEditorProps {
  /** The map to edit: a new one, or one from Mis mapas */
  map: Scenario;
  /** Scenarios a new map can start as a copy of */
  scenarios: readonly Scenario[];
  /** Back to the menu, from the map last edited */
  onExit: (mapId: string) => void;
}

/**
 * The map editor: paint terrain and put units, badges, sandbags, wire and objectives on the board, and set
 * the scenario's settings. The map is kept in Mis mapas as it's edited (storage.ts), once it has
 * something on it, so a reload doesn't lose it.
 */
function MapEditor({ map, scenarios, onExit }: MapEditorProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const [history, dispatch] = useReducer(reducer, map, startHistory);
  const draft = history.present;
  const [tool, setTool] = useState<EditorTool>({ kind: "terrain", type: HexType.FOREST });
  const [problem, setProblem] = useState<string | null>(null);
  const [newMapOpen, setNewMapOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  // One finger moves the zoomed map instead of painting
  const [moving, setMoving] = useState(false);
  const { flash, flashInvalid, flashHexes } = useHexFlash();
  const size = boardSizeOf(draft);
  const art = useBoardArt(draft.tiles, size, finished, draft.pickedTiles);
  const board = useMemo(() => new BoardManager(draft, "Allies", { bothSides: true }), [draft]);
  const counts = draftCounts(draft);
  const problems = useMemo(() => validateScenario(draft), [draft]);
  const victory = useMemo(() => victoryOnMap(draft), [draft]);

  // Kept in Mis mapas once there's something on it; a new map left blank isn't
  const kept = useRef<Set<string>>(null);
  kept.current ??= new Set(loadCustomMaps().map(({ id }) => id));
  useEffect(() => {
    if (isBlank(draft) && !kept.current?.has(draft.id)) return;
    saveCustomMap(draft);
    kept.current?.add(draft.id);
  }, [draft]);

  // A stroke's hexes change the map faster than React draws it: each one starts from the last
  const latest = useRef(draft);
  latest.current = draft;
  const stroke = useRef<(Stroke & { done: Set<string>; recorded: boolean }) | null>(null);
  // The fingers on the board: a second one makes the stroke a pinch, which zooms (Board) instead
  const fingers = useRef(new Set<number>());

  const applyAt = (position: Position) => {
    const current = stroke.current;
    if (!current || current.done.has(positionKey(position))) return;
    current.done.add(positionKey(position));
    const next = current.apply(latest.current, position);
    if (next === false) {
      flashInvalid(position);
      setProblem(tool.kind === "elite" || tool.kind === "sandbags" ? t.noUnit : t.onWater);
      return;
    }
    setProblem(null);
    if (next === latest.current) return;
    latest.current = next;
    dispatch({ kind: "edit", next, amend: current.recorded });
    current.recorded = true;
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // The first finger down starts afresh, in case a finger's lift was missed
    if (event.isPrimary) fingers.current.clear();
    fingers.current.add(event.pointerId);
    if (fingers.current.size > 1) {
      // The stroke's first finger was the start of a pinch: what it painted goes
      if (stroke.current?.recorded) dispatch({ kind: "drop" });
      stroke.current = null;
      setProblem(null);
      return;
    }
    if (moving) return;
    const position = hexAt(event.target as Element);
    if (!position) return;
    event.preventDefault();
    stroke.current = { ...strokeOf(tool, latest.current, position), done: new Set(), recorded: false };
    applyAt(position);
  };
  const handlePointerMove = (event: PointerEvent) => {
    if (!stroke.current?.drags) return;
    const position = hexAt(document.elementFromPoint(event.clientX, event.clientY));
    if (position) applyAt(position);
  };
  const endStroke = (event: PointerEvent) => {
    fingers.current.delete(event.pointerId);
    stroke.current = null;
  };

  // The setting last changed in "Datos del escenario": more changes to it go into the same step
  const lastSetting = useRef<string | null>(null);
  const openSettings = () => {
    lastSetting.current = null;
    setSettingsOpen(true);
  };
  const changeSettings = (next: Scenario, field: string) => {
    dispatch({ kind: "edit", next, amend: lastSetting.current === field });
    lastSetting.current = field;
  };

  const sideLine = (faction: "Allies" | "Axis") => {
    const side = counts[faction === "Allies" ? "allies" : "axis"];
    return t.side(labels.factions[faction], side[UnitType.INFANTRY], side[UnitType.TANK], side[UnitType.ARTILLERY]);
  };

  return (
    <Box className="map-editor">
      <Box
        component="header"
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          flex: "none",
          mb: 1.5,
          pb: 1,
          borderBottom: "3px double",
          borderColor: "divider",
        }}
      >
        <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
          <GameIcon name="map" size={30} />
          <Typography variant="h6" component="h1" sx={{ lineHeight: 1.1 }}>
            {t.title} · {tr(draft.name) || t.untitled}
          </Typography>
        </Stack>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
          <Button variant="outlined" onClick={() => setNewMapOpen(true)}>
            {t.newMap}
          </Button>
          <Button variant="text" startIcon={<GameIcon name="exit" />} onClick={() => onExit(draft.id)}>
            {t.exit}
          </Button>
        </Stack>
      </Box>

      <div className="phase-layout map-editor__main">
        <div
          className="phase-layout__board map-editor__board"
          aria-label={t.map}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
        >
          <VictoryContext.Provider value={victory}>
            <Board
              onTileClick={() => {}}
              unitHexPosition={null}
              possibleMovePositions={[]}
              possibleMoveAndFirePositions={[]}
              boardManager={board}
              orders={[]}
              backgroundImage={art}
              invalidFlash={flash}
              faction="Allies"
              unitFactionAt={(position) => unitAt(draft, position)?.faction ?? "Allies"}
              zoomable
              startsWhole
              dragPans={moving}
              zoomTools={
                <IconButton
                  className="board__zoom-button"
                  aria-label={t.move}
                  title={t.move}
                  aria-pressed={moving}
                  onClick={() => setMoving((on) => !on)}
                  sx={moving ? { bgcolor: "action.selected", outline: "3px solid", outlineColor: "primary.main" } : undefined}
                >
                  ✥
                </IconButton>
              }
            />
          </VictoryContext.Provider>
        </div>

        <div className="phase-layout__controls">
          <EditorTools
            tool={tool}
            onTool={(next) => {
              setTool(next);
              setProblem(null);
            }}
          />
          {problem && (
            <Typography variant="body2" color="error" role="alert">
              {problem}
            </Typography>
          )}
          <Stack direction="row" sx={{ gap: 1 }}>
            <Button
              variant="outlined"
              disabled={history.past.length === 0}
              onClick={() => dispatch({ kind: "undo" })}
              startIcon={<GameIcon name="undo" />}
            >
              {t.undo}
            </Button>
            <Button
              variant="outlined"
              disabled={history.future.length === 0}
              onClick={() => dispatch({ kind: "redo" })}
              startIcon={<Box sx={{ display: "flex", transform: "scaleX(-1)" }}><GameIcon name="undo" /></Box>}
            >
              {t.redo}
            </Button>
          </Stack>
          <Button variant={finished ? "contained" : "outlined"} aria-pressed={finished} onClick={() => setFinished(!finished)} startIcon={<GameIcon name="map" />}>
            {finished ? t.plain : t.finished}
          </Button>
          <Box>
            <Typography variant="body2">{sideLine("Allies")}</Typography>
            <Typography variant="body2">{sideLine("Axis")}</Typography>
            <Typography variant="body2">
              {t.towns(counts.towns)}
            </Typography>
          </Box>
          <Button variant="outlined" onClick={openSettings} startIcon={<GameIcon name="history" />}>
            {t.settings}
          </Button>
          <Button variant="outlined" onClick={() => setSizeOpen(true)} startIcon={<GameIcon name="map" />}>
            {t.boardSize(size.cols, size.rows)}
          </Button>
          <ScenarioProblems problems={problems} onShowHexes={(positions) => flashHexes(positions)} />
          <Box sx={{ mt: "auto" }}>
            <InfoButton title={t.title} label={t.instructions}>
              {t.help.map((line) => (
                <Typography key={line} variant="body1" sx={{ mb: 1 }}>
                  {line}
                </Typography>
              ))}
            </InfoButton>
          </Box>
        </div>
      </div>

      <ScenarioSettingsDialog
        open={settingsOpen}
        draft={draft}
        onChange={changeSettings}
        problems={problems}
        onShowHexes={(positions) => {
          setSettingsOpen(false);
          // Once the dialog has gone from over the board
          flashHexes(positions, 300);
        }}
        onClose={() => setSettingsOpen(false)}
      />

      <BoardSizeDialog
        open={sizeOpen}
        draft={draft}
        preview={
          <VictoryContext.Provider value={victory}>
            <Board
              onTileClick={() => {}}
              unitHexPosition={null}
              possibleMovePositions={[]}
              possibleMoveAndFirePositions={[]}
              boardManager={board}
              orders={[]}
              backgroundImage={art}
              faction="Allies"
              unitFactionAt={(position) => unitAt(draft, position)?.faction ?? "Allies"}
            />
          </VictoryContext.Provider>
        }
        onChange={(next) => dispatch({ kind: "edit", next, amend: false })}
        onClose={() => setSizeOpen(false)}
      />

      <NewMapDialog
        open={newMapOpen}
        scenarios={scenarios}
        keeping={!isBlank(draft)}
        onPick={(next) => dispatch({ kind: "start", draft: next })}
        onClose={() => setNewMapOpen(false)}
      />
    </Box>
  );
}

export default MapEditor;
