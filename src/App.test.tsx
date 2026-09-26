import { fireEvent, render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";

const start = (faction: "Aliados" | "Eje") => {
  fireEvent.click(screen.getByRole("button", { name: faction }));
  fireEvent.click(screen.getByRole("button", { name: "Empezar partida" }));
};

beforeEach(() => {
  localStorage.clear();
});

describe("App menu and game flow", () => {
  it("only starts once a side is chosen, and shows its starting hand", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Empezar partida" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Eje" }));
    expect(screen.getByText("Empiezas con 3 cartas de mando.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aliados" }));
    expect(screen.getByText("Empiezas con 5 cartas de mando.")).toBeInTheDocument();
  });

  it("starts a game for the chosen side, with the turn and phase in the header", () => {
    render(<App />);

    start("Aliados");

    expect(screen.getByText("Forêt d'Écouves · Aliados")).toBeInTheDocument();
    expect(screen.getByText("Turno 1")).toBeInTheDocument();
    expect(screen.getByText("1. Carta").closest(".MuiChip-root")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Zona de Mando")).toBeInTheDocument();
  });

  it("asks before leaving a game, and goes back to the menu on Salir", async () => {
    render(<App />);
    start("Eje");

    fireEvent.click(screen.getByRole("button", { name: "Menú" }));
    fireEvent.click(screen.getByRole("button", { name: "Seguir jugando" }));
    // The dialog animates out; the page is inert until it's gone
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
    expect(screen.getByText("Zona de Mando")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Menú" }));
    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    expect(screen.getByRole("button", { name: "Empezar partida" })).toBeInTheDocument();
  });

  it("remembers the last side chosen on this device", () => {
    const { unmount } = render(<App />);
    start("Eje");
    unmount();

    render(<App />);

    expect(screen.getByRole("button", { name: "Eje" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Empezar partida" })).toBeEnabled();
  });
});
