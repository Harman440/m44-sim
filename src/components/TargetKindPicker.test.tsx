import { describe, expect, it } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import TargetKindPicker, { TargetChoice, initialChoice } from "./TargetKindPicker";
import { TargetKinds } from "../data/hitRules";
import { same } from "../i18n/lang";

function Harness({ kinds, emptyLabel }: { kinds: TargetKinds; emptyLabel?: string }) {
  const [value, setValue] = useState<TargetChoice | null>(initialChoice(kinds, emptyLabel));
  return (
    <>
      <TargetKindPicker kinds={kinds} value={value} onChange={setValue} enemy="Axis" emptyLabel={emptyLabel} />
      <output>{value ?? "none"}</output>
    </>
  );
}

describe("TargetKindPicker", () => {
  it("asks infantry or not when the enemy started with both", () => {
    render(<Harness kinds={{ infantry: true, other: true }} />);

    expect(screen.getByRole("status")).toHaveTextContent("none");
    fireEvent.click(screen.getByRole("button", { name: "Blindados o artillería" }));
    expect(screen.getByRole("status")).toHaveTextContent("other");
  });

  it("doesn't ask when the enemy started with one kind, but can still change it", () => {
    render(<Harness kinds={{ infantry: true, other: false }} />);

    expect(screen.getByTestId("target-kind-fixed")).toHaveTextContent("Infantería: el rival no empezó con blindados ni artillería");
    expect(screen.getByRole("status")).toHaveTextContent("infantry");

    fireEvent.click(screen.getByRole("button", { name: "Cambiar" }));
    fireEvent.click(screen.getByRole("button", { name: "Blindados o artillería" }));
    expect(screen.getByRole("status")).toHaveTextContent("other");
  });

  it("offers both kinds and the empty hex when there's an empty option", () => {
    render(<Harness kinds={{ infantry: false, other: true }} emptyLabel="Vacía" />);

    expect(screen.getByRole("status")).toHaveTextContent("none");
    expect(screen.getByRole("button", { name: "Infantería" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Vacía" }));
    expect(screen.getByRole("status")).toHaveTextContent("empty");
  });
});
