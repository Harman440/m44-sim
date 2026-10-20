import { act, fireEvent, render, screen, waitFor, waitForElementToBeRemoved, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import GameView from "./components/mainComponents/LazyGameView";
import { DEAL_ANIMATION_MS, DEAL_GAP_MS } from "./components/mainComponents/GameViews/CardsView";
import { same } from "./i18n/lang";
import { scenarios } from "./data/scenarios";
import { toScenarioFile } from "./game-core/scenarioFile";
import { copyDraft, resizeBoard, setText } from "./game-core/scenarioDraft";
import { Scenario } from "./types/scenario";
import { downloadJson } from "./download";

vi.mock("./download", () => ({ downloadJson: vi.fn() }));

// jsdom loads no images, so a map from Mis mapas is never drawn: play it without art
vi.mock("./boardArt/mapArt", () => ({
  boardArtFor: () => Promise.reject(new Error("no canvas")),
  withBoardArt: (scenario: unknown) => Promise.resolve(scenario),
}));

const start = (faction: "Aliados" | "Eje") => {
  fireEvent.click(screen.getByRole("button", { name: /^Forêt d'Écouves/ }));
  fireEvent.click(screen.getByRole("button", { name: faction }));
  fireEvent.click(screen.getByRole("button", { name: `Empezar con ${faction}` }));
};

const menuHeading = () => screen.getByRole("heading", { name: "Elige escenario:" });

const openExitDialog = () => {
  fireEvent.click(screen.getByRole("button", { name: "Menú" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Salir al menú" }));
};

const handTitles = (container: HTMLElement) =>
  Array.from(container.querySelectorAll(".cards-hands .card-title"));

// Each step's timer is only scheduled after React re-renders, so advance them separately
const dealHand = (cards: number) => {
  for (let i = 0; i < cards; i++) {
    act(() => {
      vi.advanceTimersByTime(DEAL_GAP_MS);
    });
    act(() => {
      vi.advanceTimersByTime(DEAL_ANIMATION_MS);
    });
  }
};

// The game screen is its own chunk; load it up front so starting a game renders straight away
beforeAll(async () => {
  await GameView.preload();
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("App menu and game flow", () => {
  it("asks for a scenario, then shows its sides and only starts once one is chosen", () => {
    render(<App />);

    expect(screen.queryByRole("button", { name: "Aliados" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Forêt d'Écouves/ }));
    expect(screen.getByRole("button", { name: "Elige bando" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Eje" }));
    expect(screen.getByRole("button", { name: "Eje" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Empezar con Eje" })).toBeEnabled();
  });

  it("keeps the test rules in Ajustes and warns when one is on", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Ajustes" }));
    fireEvent.click(screen.getByLabelText("Dado de 8 caras a distancia"));
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
    fireEvent.click(screen.getByRole("button", { name: /^Forêt d'Écouves/ }));

    expect(screen.getByText(/Reglas de prueba: dado de 8 caras a distancia/)).toBeInTheDocument();
  });

  it("plays against the computer in fog of war unless it's switched off in Ajustes", async () => {
    const savedFog = () => JSON.parse(localStorage.getItem("m44-sim:saved-match") ?? "null")?.fog;
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^Forêt d'Écouves/ }));
    fireEvent.click(screen.getByRole("button", { name: "Aliados" }));
    fireEvent.click(screen.getByRole("button", { name: "Contra el ordenador" }));
    await waitFor(() => expect(savedFog()).toBe(true));
    unmount();
    localStorage.clear();

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Ajustes" }));
    expect(screen.getByLabelText("Niebla de guerra")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Niebla de guerra"));
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
    fireEvent.click(screen.getByRole("button", { name: /^Forêt d'Écouves/ }));
    fireEvent.click(screen.getByRole("button", { name: "Aliados" }));
    fireEvent.click(screen.getByRole("button", { name: "Contra el ordenador" }));
    await waitFor(() => expect(savedFog()).toBe(false));
  });

  it("opens the rule book from the menu and from the game's menu, keeping the game", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Reglamento" }));
    expect(await screen.findByRole("dialog", { name: "Reglamento" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    start("Aliados");
    fireEvent.click(screen.getByRole("button", { name: "Menú" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Reglamento" }));
    expect(await screen.findByRole("tab", { name: "Reglas de la casa" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByText("Zona de Mando")).toBeInTheDocument();
  });

  it("opens the map editor from the menu, and goes back", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Editor de mapas" }));
    expect(await screen.findByRole("heading", { name: "Editor de mapas · Mapa sin nombre" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Volver al menú" }));
    expect(menuHeading()).toBeInTheDocument();
    // A map left blank isn't kept
    expect(screen.getByText("Los mapas que hagas en el editor aparecen aquí.")).toBeInTheDocument();
  });

  it("starts a game for the chosen side, with the turn and phase in the header", () => {
    render(<App />);

    start("Aliados");

    expect(screen.getByText("Forêt d'Écouves · Aliados")).toBeInTheDocument();
    expect(screen.queryByText("Atacante")).not.toBeInTheDocument(); // the role is in the menu, not the header
    expect(screen.getByText("Turno 1 · extra")).toBeInTheDocument();
    expect(screen.getByText("1. Carta").closest(".MuiChip-root")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Zona de Mando")).toBeInTheDocument();
  });

  it("shows the defender a waiting screen during the attacker's extra turn, then starts at turn 2", () => {
    render(<App />);
    start("Eje");

    expect(screen.queryByText("Defensor")).not.toBeInTheDocument();
    expect(screen.getByText("Los Aliados atacan primero")).toBeInTheDocument();
    expect(screen.queryByText("Zona de Mando")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Empezar turno 2" }));

    expect(screen.getByText("Turno 2")).toBeInTheDocument();
    expect(screen.getByText("Zona de Mando")).toBeInTheDocument();
  });

  it("asks before leaving a game, and goes back to the menu on Salir", async () => {
    render(<App />);
    start("Aliados");

    openExitDialog();
    fireEvent.click(screen.getByRole("button", { name: "Seguir jugando" }));
    // The dialog animates out; the page is inert until it's gone
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
    expect(screen.getByText("Zona de Mando")).toBeInTheDocument();

    openExitDialog();
    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    expect(menuHeading()).toBeInTheDocument();
  });

  it("shows a resumed hand straight away, without dealing it again", () => {
    vi.useFakeTimers();
    const first = render(<App />);
    start("Aliados");
    dealHand(6);
    const hand = handTitles(first.container).map((el) => el.textContent);
    expect(hand).toHaveLength(6);
    first.unmount();

    const { container } = render(<App />);

    expect(handTitles(container).map((el) => el.textContent)).toEqual(hand);
  });

  it("picks the game back up after a reload, at the same turn and phase", () => {
    vi.useFakeTimers();
    const { container, unmount } = render(<App />);
    start("Aliados");
    dealHand(6);
    fireEvent.click(handTitles(container)[0]!); // straight into the empty slot
    fireEvent.click(screen.getByRole("button", { name: "Jugar" }));
    expect(screen.getByText("2. Órdenes").closest(".MuiChip-root")).toHaveAttribute("aria-current", "step");
    unmount();

    render(<App />);

    expect(screen.getByText("Forêt d'Écouves · Aliados")).toBeInTheDocument();
    expect(screen.getByText("2. Órdenes").closest(".MuiChip-root")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Partida recuperada · Turno 1")).toBeInTheDocument();
  });

  it("forgets the game in progress when leaving to the menu", () => {
    const { unmount } = render(<App />);
    start("Aliados");
    openExitDialog();
    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    unmount();

    render(<App />);

    expect(menuHeading()).toBeInTheDocument();
  });

  it("starts from the menu when the saved game can't be read", () => {
    localStorage.setItem("m44-sim:saved-game", JSON.stringify({ version: 999 }));

    render(<App />);

    expect(menuHeading()).toBeInTheDocument();
    expect(localStorage.getItem("m44-sim:saved-game")).toBeNull();
  });

});

describe("Mis mapas", () => {
  // A map made on this device: a copy of Forêt d'Écouves under another name, its id not yet from its name
  const pegasus = scenarios.find((s) => s.id === "pegasus-bridge")!;
  const keepMap = (name: string, id = "map-3f9k", change: (map: Scenario) => Scenario = (map) => map) => {
    const map = change(setText(copyDraft(pegasus, id), "name", "es", name));
    const kept = JSON.parse(localStorage.getItem("m44-sim:custom-maps") ?? "[]");
    localStorage.setItem("m44-sim:custom-maps", JSON.stringify([...kept, toScenarioFile(map)]));
  };
  const pick = (name: string) => fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}`) }));

  it("lists the device's maps after the built-ins, and plays one", async () => {
    keepMap("Puente");
    render(<App />);

    pick("Puente");
    fireEvent.click(screen.getByRole("button", { name: "Aliados" }));
    fireEvent.click(screen.getByRole("button", { name: "Empezar con Aliados" }));

    expect(await screen.findByText("Puente · Aliados")).toBeInTheDocument();
    // Its id came from its name when the menu read it
    expect(JSON.parse(localStorage.getItem("m44-sim:saved-game")!).scenarioId).toBe("pegasus-bridge-copy-3f9k");
  });

  it("plays a map bigger than the standard one only with both sides on the device", async () => {
    keepMap("Llanura", "map-3f9k", (map) => resizeBoard(map, "right", true) as Scenario);
    render(<App />);

    pick("Llanura");
    fireEvent.click(screen.getByRole("button", { name: "Aliados" }));

    expect(screen.queryByRole("button", { name: "Empezar con Aliados" })).not.toBeInTheDocument();
    expect(screen.getByText(/más grande que el estándar \(14 × 9\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pasar y jugar: los dos bandos aquí" }));
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("m44-sim:saved-match") ?? "null")?.sides.allies.scenarioId).toBe("pegasus-bridge-copy-3f9k"),
    );
  });

  it("picks a game on one of Mis mapas back up after a reload", async () => {
    keepMap("Puente");
    const { unmount } = render(<App />);
    pick("Puente");
    fireEvent.click(screen.getByRole("button", { name: "Eje" }));
    fireEvent.click(screen.getByRole("button", { name: "Empezar con Eje" }));
    await screen.findByText("Puente · Eje");
    unmount();

    render(<App />);
    expect(await screen.findByText("Puente · Eje")).toBeInTheDocument();
    // Nothing to edit, duplicate or delete a map with while a game is going on
    fireEvent.click(screen.getByRole("button", { name: "Menú" }));
    expect(screen.queryByRole("menuitem", { name: /Editor|Editar|Duplicar|Borrar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editor de mapas|Borrar/ })).not.toBeInTheDocument();
  });

  it("can't start a map that isn't finished, and says what's missing", () => {
    keepMap("");
    localStorage.setItem(
      "m44-sim:custom-maps",
      JSON.stringify([{ ...JSON.parse(localStorage.getItem("m44-sim:custom-maps")!)[0], name: same("") }]),
    );
    render(<App />);

    pick("Mapa sin nombre");
    fireEvent.click(screen.getByRole("button", { name: "Aliados" }));
    expect(screen.getByText("El escenario no tiene nombre")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Todavía no se puede jugar" })).toBeDisabled();
  });

  it("edits, duplicates and deletes a map, deleting only once it's confirmed", async () => {
    keepMap("Puente");
    render(<App />);
    pick("Puente");

    fireEvent.click(screen.getByRole("button", { name: "Duplicar" }));
    expect(screen.getByRole("heading", { name: "Puente (copia)", level: 2 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
    expect(screen.getByRole("heading", { name: "Puente (copia)", level: 2 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    expect(screen.getByRole("dialog", { name: "¿Borrar «Puente (copia)»?" })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Borrar" }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
    expect(screen.queryByRole("button", { name: /^Puente \(copia\)/ })).not.toBeInTheDocument();

    pick("Puente");
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(await screen.findByRole("heading", { name: "Editor de mapas · Puente" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volver al menú" }));
    // Back on the map just edited
    expect(screen.getByRole("heading", { name: "Puente", level: 2 })).toBeInTheDocument();
  });

  it("exports a map as a file, for the other tablet or the catalog", () => {
    keepMap("Puente");
    render(<App />);
    pick("Puente");

    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));

    const map = JSON.parse(localStorage.getItem("m44-sim:custom-maps")!)[0];
    expect(downloadJson).toHaveBeenLastCalledWith("pegasus-bridge-copy-3f9k.m44map.json", map);
    expect(map.id).toBe("pegasus-bridge-copy-3f9k");
  });

  it("shows a map that has gone into the catalog once, the catalog's, and offers to delete the device's copy", async () => {
    // The device's copy has the catalog's id: it was exported and added with npm run add-scenario
    keepMap("Puente", "pegasus-bridge");
    render(<App />);

    expect(screen.getAllByRole("button", { name: /^(Pegasus Bridge|Puente)/ })).toHaveLength(1);
    expect(screen.getByText("Los mapas que hagas en el editor aparecen aquí.")).toBeInTheDocument();

    pick("Pegasus Bridge");
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Borrar mi copia" }));
    expect(screen.getByRole("dialog", { name: "¿Borrar tu copia de «Pegasus Bridge»?" })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Borrar" }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));

    expect(JSON.parse(localStorage.getItem("m44-sim:custom-maps")!)).toEqual([]);
    expect(screen.queryByRole("button", { name: "Borrar mi copia" })).not.toBeInTheDocument();
    // The catalog's map stays picked
    expect(screen.getByRole("heading", { name: "Pegasus Bridge", level: 2 })).toBeInTheDocument();
  });
});

describe("App settings", () => {
  const look = (container: HTMLElement) => container.querySelector(".app")!.getAttribute("data-look");

  it("switches the look from Ajustes straight away and remembers it", async () => {
    const first = render(<App />);
    expect(look(first.container)).toBe("tent");

    fireEvent.click(screen.getByRole("button", { name: "Ajustes" }));
    fireEvent.click(screen.getByRole("radio", { name: /Caja del juego/ }));

    expect(look(first.container)).toBe("box");
    expect(screen.getByRole("radio", { name: /Caja del juego/ })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));
    first.unmount();

    const { container } = render(<App />);
    expect(look(container)).toBe("box");
  });

  it("changes the look during a game from Ajustes in the game menu, keeping the game", async () => {
    const { container } = render(<App />);
    start("Aliados");

    fireEvent.click(screen.getByRole("button", { name: "Menú" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Ajustes" }));
    fireEvent.click(screen.getByRole("radio", { name: /Mapa de campaña/ }));
    expect(look(container)).toBe("field");
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));

    expect(screen.getByText("Forêt d'Écouves · Aliados")).toBeInTheDocument();
    expect(screen.getByText("Zona de Mando")).toBeInTheDocument();
  });

  it("switches to English from Ajustes straight away, remembers it, and plays the game in English", () => {
    const first = render(<App />);
    expect(document.documentElement.lang).toBe("es");

    fireEvent.click(screen.getByRole("button", { name: "Ajustes" }));
    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    first.unmount();

    render(<App />);
    expect(screen.getByRole("heading", { name: "Pick a scenario:" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Forêt d'Écouves/ }));
    fireEvent.click(screen.getByRole("button", { name: "Allies" }));
    fireEvent.click(screen.getByRole("button", { name: "Start as the Allies" }));
    expect(screen.getByText("Forêt d'Écouves · Allies")).toBeInTheDocument();
  });

  it("turns sound on and off from the game header, and remembers it", () => {
    const first = render(<App />);
    start("Aliados");

    const toggle = screen.getByRole("button", { name: "Activar sonidos" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Silenciar sonidos" })).toHaveAttribute("aria-pressed", "true");
    first.unmount();

    render(<App />);
    expect(screen.getByRole("button", { name: "Silenciar sonidos" })).toBeInTheDocument();
  });
});

describe("App on an old browser", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("says the browser is too old and what to do, and lets the player try anyway", () => {
    // Safari before 16.2: no color-mix()
    vi.stubGlobal("CSS", { supports: () => false });
    render(<App />);

    expect(screen.getByRole("heading", { name: "Este navegador es demasiado antiguo" })).toBeInTheDocument();
    expect(screen.getByText(/Safari 16\.2 o posterior/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Elige escenario:" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Probar de todos modos" }));
    expect(menuHeading()).toBeInTheDocument();
  });
});
