import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import CardAttackDialog from "./CardAttackDialog";

const props = {
  hex: { index: 0, place: "Llanura" },
  cardName: "Poder aéreo",
  dicePerHex: 2,
  attack: null,
  faction: "Allies" as const,
  targetKinds: { infantry: true, other: true },
  onAttack: () => true,
  onUndo: () => true,
  onClose: () => {},
};

describe("CardAttackDialog", () => {
  it("says which die the card rolls: the attack die, or Air Power's suppressive one", () => {
    const { rerender } = render(<CardAttackDialog {...props} die="suppressive" />);
    expect(screen.getByText(/Se tiran 2 dados de supresión: 1 infantería, 1 granada, 3 banderas y 1 suministro/)).toBeInTheDocument();

    rerender(<CardAttackDialog {...props} cardName="Cortina de Fuego" dicePerHex={4} die="attack" />);
    expect(screen.getByText(/Se tiran 4 dados de ataque/)).toBeInTheDocument();
  });
});
