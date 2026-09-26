import { act, fireEvent, render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import GameView from "./components/mainComponents/LazyGameView";
import { DEAL_ANIMATION_MS, DEAL_GAP_MS } from "./components/mainComponents/GameViews/CardsView";

const start = (faction: "Aliados" | "Eje") => {
  fireEvent.click(screen.getByRole("button", { name: faction }));
  fireEvent.click(screen.getByRole("button", { name: "Empezar partida" }));
};

const openExitDialog = () => {
  fireEvent.click(screen.getByRole("button", { name: "Menú" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Salir al menú" }));
};

const handTitles = (container: HTMLElement) =>
  Array.from(container.querySelectorAll(".cards-grid .card-title"));

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
  it("only starts once a side is chosen, and shows its starting hand", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Empezar partida" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Eje" }));
    expect(screen.getByText(/^Empiezas con 3 cartas de mando\. Defiendes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aliados" }));
    expect(screen.getByText(/^Empiezas con 5 cartas de mando\. Atacas/)).toBeInTheDocument();
  });

  it("starts a game for the chosen side, with the turn and phase in the header", () => {
    render(<App />);

    start("Aliados");

    expect(screen.getByText("Forêt d'Écouves · Aliados")).toBeInTheDocument();
    expect(screen.getByText("Atacante")).toBeInTheDocument();
    expect(screen.getByText("Turno 1 · extra")).toBeInTheDocument();
    expect(screen.getByText("1. Carta").closest(".MuiChip-root")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Zona de Mando")).toBeInTheDocument();
  });

  it("shows the defender a waiting screen during the attacker's extra turn, then starts at turn 2", () => {
    render(<App />);
    start("Eje");

    expect(screen.getByText("Defensor")).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Empezar partida" })).toBeInTheDocument();
  });

  it("remembers the last side chosen on this device", () => {
    const { unmount } = render(<App />);
    start("Eje");
    openExitDialog();
    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    unmount();

    render(<App />);

    expect(screen.getByRole("button", { name: "Eje" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Empezar partida" })).toBeEnabled();
  });

  it("shows a resumed hand straight away, without dealing it again", () => {
    vi.useFakeTimers();
    const first = render(<App />);
    start("Aliados");
    dealHand(5);
    const hand = handTitles(first.container).map((el) => el.textContent);
    expect(hand).toHaveLength(5);
    first.unmount();

    const { container } = render(<App />);

    expect(handTitles(container).map((el) => el.textContent)).toEqual(hand);
  });

  it("picks the game back up after a reload, at the same turn and phase", () => {
    vi.useFakeTimers();
    const { container, unmount } = render(<App />);
    start("Aliados");
    dealHand(5);
    fireEvent.click(handTitles(container)[0]!);
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

    expect(screen.getByRole("button", { name: "Empezar partida" })).toBeInTheDocument();
  });

  it("starts from the menu when the saved game can't be read", () => {
    localStorage.setItem("m44-sim:saved-game", JSON.stringify({ version: 999 }));

    render(<App />);

    expect(screen.getByRole("button", { name: "Empezar partida" })).toBeInTheDocument();
    expect(localStorage.getItem("m44-sim:saved-game")).toBeNull();
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
