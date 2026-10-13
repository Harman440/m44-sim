import { fireEvent, render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MapEditor from "./MapEditor";
import { scenarios } from "../../data/scenarios";
import { SettingsContext, DEFAULT_SETTINGS } from "../../settings";

const DRAFT_KEY = "m44-sim:map-draft";
const savedDraft = () => JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
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
    render(<MapEditor scenarios={scenarios} onExit={() => {}} />);
    expect(screen.getByRole("heading", { name: "Editor de mapas · Mapa sin nombre" })).toBeInTheDocument();

    tool("Tanque (Eje)");
    tap("0-4");
    tool("Infantería (Aliados)");
    tap("8-4");

    expect(screen.getByText("Aliados: 1 inf., 0 tanq., 0 art.")).toBeInTheDocument();
    expect(screen.getByText("Eje: 0 inf., 1 tanq., 0 art.")).toBeInTheDocument();
    expect(savedDraft().units).toEqual({ allies: { infantry: [{ row: 8, col: 4 }] }, axis: { tank: [{ row: 0, col: 4 }] } });
  });

  it("takes a unit off when it's tapped again, with undo and redo", () => {
    render(<MapEditor scenarios={scenarios} onExit={() => {}} />);
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
    render(<MapEditor scenarios={scenarios} onExit={() => {}} />);
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
    render(<MapEditor scenarios={scenarios} onExit={() => {}} />);
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

  it("starts a new map as a copy of a scenario", async () => {
    render(<MapEditor scenarios={scenarios} onExit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Nuevo mapa" }));
    fireEvent.click(screen.getByRole("button", { name: "Copia de Pegasus Bridge" }));
    await dialogClosed();

    expect(screen.getByRole("heading", { name: "Editor de mapas · Pegasus Bridge (copia)" })).toBeInTheDocument();
    expect(screen.getByText("Aliados: 9 inf., 0 tanq., 0 art.")).toBeInTheDocument();
  });

  it("warns that a new map replaces the one being made", async () => {
    render(<MapEditor scenarios={scenarios} onExit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Nuevo mapa" }));
    expect(screen.queryByText("El mapa que estás haciendo se perderá.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await dialogClosed();

    tool("Bosque");
    tap("4-4");
    fireEvent.click(screen.getByRole("button", { name: "Nuevo mapa" }));
    expect(screen.getByText("El mapa que estás haciendo se perderá.")).toBeInTheDocument();
  });

  it("picks the map back up when it's opened again", () => {
    const { unmount } = render(<MapEditor scenarios={scenarios} onExit={() => {}} />);
    tool("Artillería (Aliados)");
    tap("7-4");
    unmount();

    render(<MapEditor scenarios={scenarios} onExit={() => {}} />);
    expect(screen.getByText("Aliados: 0 inf., 0 tanq., 1 art.")).toBeInTheDocument();
  });

  it("goes back to the menu", () => {
    const onExit = vi.fn();
    render(<MapEditor scenarios={scenarios} onExit={onExit} />);
    fireEvent.click(screen.getByRole("button", { name: "Volver al menú" }));

    expect(onExit).toHaveBeenCalled();
  });

  it("speaks English", () => {
    render(
      <SettingsContext.Provider value={{ settings: { ...DEFAULT_SETTINGS, language: "en" }, updateSettings: () => {} }}>
        <MapEditor scenarios={scenarios} onExit={() => {}} />
      </SettingsContext.Provider>,
    );
    expect(screen.getByRole("heading", { name: "Map editor · Untitled map" })).toBeInTheDocument();

    tool("Tank (Axis)");
    tap("0-4");
    expect(screen.getByText("Axis: 0 inf., 1 tanks, 0 art.")).toBeInTheDocument();
    expect(screen.getByText("Tool: Tank (Axis)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Forest" })).toBeInTheDocument();
  });
});
