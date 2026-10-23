import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MapEditor, { MapEditorProps } from "./MapEditor";
import { scenarios } from "../../data/scenarios";
import { newDraft } from "../../game-core/scenarioDraft";
import { SettingsContext, DEFAULT_SETTINGS } from "../../settings";
import * as drawBoard from "../../boardArt/drawBoard";

const MAPS_KEY = "m44-sim:custom-maps";
/** The maps kept in Mis mapas, as files */
const savedMaps = () => JSON.parse(localStorage.getItem(MAPS_KEY) ?? "[]");
const savedDraft = () => savedMaps().find((map: { id: string }) => map.id === "map-test");
const Editor = (props: Partial<MapEditorProps>) => (
  <MapEditor map={newDraft("map-test")} scenarios={scenarios} onExit={() => {}} {...props} />
);
const hex = (key: string) => document.querySelector(`[data-position="${key}"]`)!;
const tap = (key: string) => {
  fireEvent.pointerDown(hex(key));
  fireEvent.pointerUp(hex(key));
};
const tool = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
// The rest of the screen is hidden from screen readers until the dialog has gone
const dialogClosed = () => waitForElementToBeRemoved(() => screen.queryByRole("dialog"));

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MapEditor", () => {
  it("starts an empty map, and puts either side's units on it", () => {
    render(<Editor />);
    expect(screen.getByRole("heading", { name: "Editor de mapas · Mapa sin nombre" })).toBeInTheDocument();

    tool("Tanque (Eje)");
    tap("0-4");
    tool("Infantería (Aliados)");
    tap("8-4");

    expect(screen.getByText("Aliados: 1 inf., 0 tanq., 0 art.")).toBeInTheDocument();
    expect(screen.getByText("Eje: 0 inf., 1 tanq., 0 art.")).toBeInTheDocument();
    expect(savedDraft().units).toEqual({ allies: { infantry: [{ row: 8, col: 4 }] }, axis: { tank: [{ row: 0, col: 4 }] } });
  });

  it("grows the map at its edges with the terrain picked, moving the map along, and undoes it", async () => {
    render(<Editor />);
    tool("Infantería (Aliados)");
    tap("8-0");
    fireEvent.click(screen.getByRole("button", { name: "Tamaño del mapa: 13 × 9" }));
    const dialog = screen.getByRole("dialog", { name: "Tamaño del mapa" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Bosque" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Añadir por izquierda" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Añadir por arriba" }));

    expect(within(dialog).getByText("14 × 11 casillas")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Quitar por izquierda" })).toBeEnabled();
    expect(savedDraft().board).toEqual({ cols: 14, rows: 11 });
    expect(savedDraft().units.allies.infantry).toEqual([{ row: 10, col: 1 }]);
    expect(savedDraft().tiles.forest).toContainEqual({ row: 0, col: 5 });
    fireEvent.click(within(dialog).getByRole("button", { name: "Listo" }));
    await dialogClosed();
    // The board has the new hexes
    expect(hex("10-13")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(screen.getByRole("button", { name: "Tamaño del mapa: 13 × 9" })).toBeInTheDocument();
    expect(savedDraft().board).toBe("standard");
    expect(savedDraft().units.allies.infantry).toEqual([{ row: 8, col: 0 }]);
  });

  it("takes a unit off when it's tapped again, with undo and redo", () => {
    render(<Editor />);
    tool("Infantería (Aliados)");
    tap("8-4");
    tap("8-4");
    expect(screen.getByText("Aliados: 0 inf., 0 tanq., 0 art.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(screen.getByText("Aliados: 1 inf., 0 tanq., 0 art.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Rehacer" }));
    expect(screen.getByText("Aliados: 0 inf., 0 tanq., 0 art.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rehacer" })).toBeDisabled();
  });

  it("says why a tap can't be done", () => {
    render(<Editor />);
    tool("Lago");
    tap("4-4");
    tool("Infantería (Aliados)");
    tap("4-4");
    expect(screen.getByRole("alert")).toHaveTextContent("No puede ir en un río ni en un lago.");

    tool("De élite");
    tap("5-5");
    expect(screen.getByRole("alert")).toHaveTextContent("Ahí no hay ninguna unidad.");
  });

  it("paints terrain across a stroke of the finger, undone in one go", () => {
    render(<Editor />);
    // jsdom lays nothing out: the hexes the finger passes over, in turn
    const under = ["4-5", "4-5", "4-6"].map(hex);
    document.elementFromPoint = vi.fn(() => under.shift() ?? null);
    const board = screen.getByLabelText("Mapa");

    tool("Bosque");
    fireEvent.pointerDown(hex("4-4"));
    fireEvent.pointerMove(board);
    fireEvent.pointerMove(board);
    fireEvent.pointerMove(board);
    fireEvent.pointerUp(board);

    expect(savedDraft().tiles).toEqual({ forest: [{ row: 4, col: 4 }, { row: 4, col: 5 }, { row: 4, col: 6 }] });
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(savedDraft().tiles).toEqual({});
  });

  it("drops a stroke that a second finger turns into a pinch, with nothing to redo", () => {
    render(<Editor />);
    const board = screen.getByLabelText("Mapa");

    tool("Bosque");
    fireEvent.pointerDown(hex("4-4"), { pointerId: 1, isPrimary: true });
    expect(savedDraft().tiles).toEqual({ forest: [{ row: 4, col: 4 }] });
    fireEvent.pointerDown(hex("4-6"), { pointerId: 2, isPrimary: false });
    fireEvent.pointerUp(board, { pointerId: 2 });
    fireEvent.pointerUp(board, { pointerId: 1 });

    expect(savedDraft().tiles).toEqual({});
    expect(screen.getByRole("button", { name: "Rehacer" })).toBeDisabled();
  });

  it("moves the map instead of painting while ✥ is on", () => {
    render(<Editor />);
    tool("Bosque");
    const move = screen.getByRole("button", { name: "Mover el mapa: desliza un dedo para ver el resto" });

    fireEvent.click(move);
    expect(move).toHaveAttribute("aria-pressed", "true");
    tap("4-4");
    expect(savedDraft()).toBeUndefined();

    fireEvent.click(move);
    tap("4-4");
    expect(savedDraft().tiles).toEqual({ forest: [{ row: 4, col: 4 }] });
  });

  it("puts each side's objectives on the map, and sets the victory in the scenario's details", async () => {
    render(<Editor />);
    tool("Objetivo (Aliados)");
    tap("4-4");
    tool("Objetivo (Eje)");
    tap("4-4");
    tap("2-3");

    expect(document.querySelectorAll('[data-objective="4-4"]')).toHaveLength(2);
    expect(document.querySelector('[data-objective="2-3"]')).toHaveAttribute("data-objective-side", "Axis");
    expect(savedDraft().victory.medals).toBe(5);

    fireEvent.click(screen.getByRole("button", { name: "Datos del escenario" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Medallas para ganar: uno más" }));
    const first = within(dialog).getByRole("group", { name: "Nombre del objetivo 1" });
    fireEvent.change(within(first).getByLabelText("Nombre · Español"), { target: { value: "Puente" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Quitar Objetivo 2" }));

    expect(savedDraft().victory).toEqual({
      medals: 6,
      objectives: [
        { faction: "Allies", name: { es: "Puente", en: "Objective 1" }, hexes: [{ row: 4, col: 4 }] },
        { faction: "Axis", name: { es: "Objetivo 1", en: "Objective 1" }, hexes: [{ row: 4, col: 4 }] },
      ],
    });

    fireEvent.click(within(dialog).getByRole("switch", { name: "Condiciones de victoria" }));
    expect(savedDraft().victory).toBeUndefined();
    fireEvent.click(within(dialog).getByRole("button", { name: "Hecho" }));
    await dialogClosed();
    expect(document.querySelector("[data-objective]")).toBeNull();
  });

  it("starts a new map as a copy of a scenario", async () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "Nuevo mapa" }));
    fireEvent.click(screen.getByRole("button", { name: "Copia de Pegasus Bridge" }));
    await dialogClosed();

    expect(screen.getByRole("heading", { name: "Editor de mapas · Pegasus Bridge (copia)" })).toBeInTheDocument();
    expect(screen.getByText("Aliados: 9 inf., 0 tanq., 0 art.")).toBeInTheDocument();
  });

  it("says the map being made stays in Mis mapas when a new one is started", async () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "Nuevo mapa" }));
    expect(screen.queryByText("El mapa que estás haciendo queda en Mis mapas.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await dialogClosed();

    tool("Bosque");
    tap("4-4");
    fireEvent.click(screen.getByRole("button", { name: "Nuevo mapa" }));
    expect(screen.getByText("El mapa que estás haciendo queda en Mis mapas.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copia de Pegasus Bridge" }));
    await dialogClosed();

    expect(savedMaps().map((map: { name: { es: string } }) => map.name.es)).toEqual(["", "Pegasus Bridge (copia)"]);
  });

  it("keeps the map in Mis mapas as it's made, but not while it's blank", () => {
    render(<Editor />);
    expect(savedMaps()).toEqual([]);

    tool("Artillería (Aliados)");
    tap("7-4");
    expect(savedDraft().units).toEqual({ allies: { artillery: [{ row: 7, col: 4 }] }, axis: {} });

    // Once kept, it's kept even when emptied again
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(savedDraft().units).toEqual({ allies: {}, axis: {} });
  });

  it("draws the plain map while it's made, and the finished one when asked", async () => {
    const draw = vi.spyOn(drawBoard, "drawBoardArt").mockResolvedValue("blob:art");
    render(<Editor />);
    await waitFor(() => expect(draw).toHaveBeenLastCalledWith(expect.anything(), { cols: 13, rows: 9 }, { plain: true }));

    fireEvent.click(screen.getByRole("button", { name: "Ver el mapa terminado" }));

    await waitFor(() => expect(draw).toHaveBeenLastCalledWith(expect.anything(), { cols: 13, rows: 9 }, { plain: false }));
    const back = screen.getByRole("button", { name: "Volver al mapa sencillo" });
    expect(back).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(back);
    await waitFor(() => expect(draw).toHaveBeenLastCalledWith(expect.anything(), { cols: 13, rows: 9 }, { plain: true }));
  });

  it("picks a town's tile, or leaves it to the hex", () => {
    render(<Editor />);
    expect(screen.queryByRole("button", { name: "Al azar" })).not.toBeInTheDocument();

    tool("Pueblo");
    tap("4-4");
    expect(screen.getByRole("button", { name: "Al azar" })).toHaveAttribute("aria-pressed", "true");
    tool("Pueblo (loseta 3)");
    tap("4-5");
    tap("4-4");

    expect(screen.getByRole("button", { name: "Pueblo" })).toHaveAttribute("aria-pressed", "true");
    expect(savedDraft().tiles).toEqual({ town: [{ row: 4, col: 4 }, { row: 4, col: 5 }] });
    expect(savedDraft().pickedTiles).toEqual([
      { row: 4, col: 5, tile: "village-2" },
      { row: 4, col: 4, tile: "village-2" },
    ]);
  });

  it("goes back to the menu", () => {
    const onExit = vi.fn();
    render(<Editor onExit={onExit} />);
    fireEvent.click(screen.getByRole("button", { name: "Volver al menú" }));

    expect(onExit).toHaveBeenCalledWith("map-test");
  });

  it("lists what's still missing before the map can be played", () => {
    render(<Editor />);
    const missing = () => within(screen.getByText("Para poder jugarlo:").parentElement!);
    expect(missing().getByText("El escenario no tiene nombre")).toBeInTheDocument();
    expect(missing().getByText("El Eje no tiene unidades")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Nuevo mapa" }));
    fireEvent.click(screen.getByRole("button", { name: "Copia de Pegasus Bridge" }));
    expect(screen.getByText("Se puede jugar")).toBeInTheDocument();
  });

  it("flashes the hexes a problem is about", async () => {
    // A map with sandbags where no unit starts, which the editor itself doesn't allow
    const pegasus = scenarios.find((s) => s.id === "pegasus-bridge")!;
    render(<Editor map={{ ...pegasus, image: undefined, sandbags: [{ row: 4, col: 4 }] }} />);

    fireEvent.click(screen.getByRole("button", { name: "Hay sacos terreros donde no empieza ninguna unidad: ver en el mapa" }));
    await waitFor(() => expect(hex("4-4").querySelector(".hexagon__flash-invalid")).not.toBeNull());
  });

  it("sets the scenario's name, sides and rules in Datos del escenario", async () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "Datos del escenario" }));
    const dialog = within(await screen.findByRole("dialog"));

    fireEvent.change(dialog.getByLabelText("Nombre · Español"), { target: { value: "Bocage" } });
    fireEvent.click(dialog.getByRole("button", { name: "Defiende" }));
    fireEvent.click(dialog.getByLabelText("Lanzamiento de paracaidistas"));

    expect(dialog.queryByText("El escenario no tiene nombre")).not.toBeInTheDocument();
    // The Axis attack, and drop 4 infantry, so they can start with no units on the map
    expect(dialog.queryByText("El Eje no tiene unidades")).not.toBeInTheDocument();
    expect(savedDraft()).toMatchObject({
      name: { es: "Bocage", en: "" },
      attacker: "Axis",
      paradrop: { faction: "Axis", unitType: "infantry", units: 4 },
    });

    fireEvent.click(dialog.getByRole("button", { name: "Hecho" }));
    await dialogClosed();
    expect(screen.getByRole("heading", { name: "Editor de mapas · Bocage" })).toBeInTheDocument();
  });

  it("makes a card cheaper for one side in Datos del escenario, shown in the menu's panel", async () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "Datos del escenario" }));
    const dialog = within(await screen.findByRole("dialog"));
    const cheaper = dialog.getByLabelText("Coste de Reabastecimiento (Eje): uno menos");

    expect(dialog.getByLabelText("Coste de Reabastecimiento (Eje): uno más")).toBeDisabled();
    fireEvent.click(cheaper);
    fireEvent.click(cheaper);
    expect(dialog.getByLabelText("Reabastecimiento: cuesta 7 en vez de 9")).toBeInTheDocument();

    // A side with no air sorties has no air cards to price
    fireEvent.click(dialog.getByLabelText("Salidas aéreas (Aliados): uno menos"));
    expect(dialog.queryByLabelText("Coste de Poder aéreo (Aliados): uno menos")).not.toBeInTheDocument();
    expect(dialog.getByLabelText("Coste de Poder aéreo (Eje): uno menos")).toBeInTheDocument();
  });

  it("undoes the settings a setting at a time", async () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "Datos del escenario" }));
    const dialog = within(await screen.findByRole("dialog"));
    const name = dialog.getByLabelText("Nombre · Español");
    const moreSorties = dialog.getByLabelText("Salidas aéreas (Eje): uno más");

    fireEvent.change(name, { target: { value: "Boc" } });
    fireEvent.change(name, { target: { value: "Bocage" } });
    fireEvent.click(moreSorties);
    fireEvent.click(moreSorties);
    fireEvent.click(dialog.getByRole("button", { name: "Hecho" }));
    await dialogClosed();

    const undo = screen.getByRole("button", { name: "Deshacer" });
    fireEvent.click(undo);
    // Both taps on the same setting are taken back together
    expect(savedDraft()).toMatchObject({ name: { es: "Bocage" } });
    expect(savedDraft().airPower).toBeUndefined();
    fireEvent.click(undo);
    expect(savedDraft().name.es).toBe("");
    expect(undo).toBeDisabled();
  });

  it("speaks English", () => {
    render(
      <SettingsContext.Provider value={{ settings: { ...DEFAULT_SETTINGS, language: "en" }, updateSettings: () => {} }}>
        <Editor />
      </SettingsContext.Provider>,
    );
    expect(screen.getByRole("heading", { name: "Map editor · Untitled map" })).toBeInTheDocument();

    tool("Tank (Axis)");
    tap("0-4");
    expect(screen.getByText("Axis: 0 inf., 1 tanks, 0 art.")).toBeInTheDocument();
    expect(screen.getByText("Tool: Tank (Axis)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Forest" })).toBeInTheDocument();
    expect(screen.getByText("The scenario has no name")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Scenario details" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByLabelText("Name · English")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Defends" })).toBeInTheDocument();
    expect(dialog.getByRole("switch", { name: "Heavy guns (Axis)" })).toBeChecked();
  });
});
