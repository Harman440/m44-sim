import { useSyncExternalStore } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BattleView from "./mainComponents/GameViews/BattleView";
import GameSession from "../game-core/gameSession";
import CommandCard from "../game-core/commandCard";
import { Side } from "../types/hex";
import { Position } from "../types/scenario";
import { samePosition } from "../game-core/position";

const INFANTRY: Position = { row: 7, col: 1 };
const TANK: Position = { row: 7, col: 3 };

/** In battle: the infantry moved too far to fire, the tank moved and can fire; dice show grenades */
const makeSession = ({ tankHolds = false } = {}) => {
  const session = new GameSession({
    scenario: {
      id: "test",
      name: "Test",
      description: "",
      initialHandSize: { allies: 1, axis: 1 },
      attacker: "Allies",
      tiles: {},
      units: { allies: { infantry: [INFANTRY], tank: [TANK] }, axis: {} },
    },
    faction: "Allies",
    initialHandSize: 1,
    commandCards: [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 })],
    random: () => 0.5,
  });
  session.pickCard(session.getSnapshot().hand[0]!);
  const infantryMoves = session.getMoveOptions(INFANTRY)!;
  const tooFar = infantryMoves.moves.find((p) => !infantryMoves.moveAndFire.some((q) => samePosition(p, q)))!;
  session.issueOrder(INFANTRY, tooFar);
  session.issueOrder(TANK, tankHolds ? TANK : session.getMoveOptions(TANK)!.moveAndFire[0]!);
  session.commitOrders();
  session.startBattle();
  return session;
};

function Harness({ session }: { session: GameSession }) {
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return <BattleView faction="Allies" session={session} game={game} onEndBattle={() => {}} onShowCoins={() => {}} />;
}

const openCollision = () => {
  expect(screen.getByTestId("step-collisions")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "¿Ha habido un choque?" }));
  return screen.getByRole("dialog");
};

describe("Collisions in the battle phase", () => {
  it("rolls close assault dice − 1 for the unit that collided and explains the outcome", () => {
    const session = makeSession();
    render(<Harness session={session} />);

    const dialog = openCollision();
    fireEvent.click(within(dialog).getByRole("button", { name: /^Tanque/ }));
    expect(within(dialog).getByTestId("collision-breakdown")).toHaveTextContent("Choque-1");
    expect(within(dialog).getByRole("button", { name: "Tirar 2 dados" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Blindados o artillería" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Tirar 2 dados" }));

    expect(session.getSnapshot().shots).toEqual([expect.objectContaining({ orderIndex: 1, dice: 2, collision: true })]);
    expect(within(dialog).getByTestId("shot-steps")).toHaveAccessibleName(expect.stringContaining("Choque −1"));
    // Grenades hit any unit, and no supply: no coins, even in the attacker's extra first turn
    expect(within(dialog).getByTestId("shot-steps")).toHaveAccessibleName(expect.stringContaining("Contra blindados o artillería · asalto cercano"));
    expect(within(dialog).getByTestId("roll-hits")).toHaveTextContent("2impactos");
    expect(within(dialog).getByTestId("roll-coins")).toHaveTextContent("+0");
    expect(within(dialog).getByTestId("collision-outcome")).toHaveTextContent("retroceden una casilla");
    // The roll is the tank's shot for the turn
    const [, tankRow] = screen.getAllByTestId("order-summary");
    expect(tankRow).toHaveTextContent("Disparó: choque, 2 × Granada → 2 impactos · 0 retiradas");
  });

  it("doesn't roll for a unit that can't fire this turn, but still explains the outcome", () => {
    render(<Harness session={makeSession()} />);

    const dialog = openCollision();
    fireEvent.click(within(dialog).getByRole("button", { name: /^Infantería/ }));

    expect(dialog).toHaveTextContent("no puede disparar este turno");
    expect(within(dialog).queryByRole("button", { name: /^Tirar/ })).not.toBeInTheDocument();
    expect(within(dialog).getByTestId("collision-outcome")).toBeInTheDocument();
  });

  it("only offers collisions when a unit on the board moved", () => {
    // Saves from before Step 19 could remove units during the battle: drop the moved infantry
    const played = makeSession({ tankHolds: true });
    const saved = played.save();
    const moved = played.getSnapshot().orders[0]!.end;
    saved.units = saved.units.map((u) => (u.position && samePosition(u.position, moved) ? { ...u, position: null } : u));
    const session = GameSession.restore(saved, played.scenario, [
      new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 }),
    ]);
    render(<Harness session={session} />);

    expect(screen.queryByRole("button", { name: "¿Ha habido un choque?" })).not.toBeInTheDocument();
  });
});
