import { describe, expect, it } from "vitest";
import { HOUSE_RULES, TUTORIAL } from "./ruleBook";
import { CARD_COOLDOWN_TURNS } from "./actionCards";
import { TurnPhase } from "../types/gameManager";
import { FIGURES } from "./figures";
import { FULL_SUPPLIES, RESTING_ENERGY_PER_TURN } from "./unitSupplies";
import { UnitType } from "../game-core/unit";
import { LANGS, Localized } from "../i18n/lang";

const texts = (): Localized[] => [
  ...TUTORIAL.flatMap((step) => [step.title, ...step.points]),
  ...HOUSE_RULES.flatMap((group) => [
    group.title,
    ...group.rules.flatMap((rule) => [rule.title, rule.house, ...(rule.official ? [rule.official] : [])]),
  ]),
];

describe("rule book", () => {
  it("has every text in every language", () => {
    for (const text of texts()) {
      for (const lang of LANGS) expect(text[lang].trim(), text.es).not.toBe("");
    }
  });

  it("has a tutorial page for each phase of the turn, in the order they're played", () => {
    const phases = TUTORIAL.flatMap((step) => (step.phase === undefined ? [] : [step.phase]));
    expect(phases).toEqual([TurnPhase.PICK_CARDS, TurnPhase.ORDER_UNITS, TurnPhase.MOVEMENT, TurnPhase.BATTLE, TurnPhase.END_OF_TURN]);
  });

  it("names pages, groups and rules uniquely", () => {
    expect(new Set(TUTORIAL.map((step) => step.id)).size).toBe(TUTORIAL.length);
    expect(new Set(HOUSE_RULES.map((group) => group.id)).size).toBe(HOUSE_RULES.length);
    const rules = HOUSE_RULES.flatMap((group) => group.rules.map((rule) => rule.title.en));
    expect(new Set(rules).size).toBe(rules.length);
  });

  it("takes its numbers from the rules' data", () => {
    const rule = (title: string) => HOUSE_RULES.flatMap((group) => group.rules).find((r) => r.title.en === title)!;
    expect(rule("One card a turn, or none").house.en).toContain(`waits ${CARD_COOLDOWN_TURNS} turns`);
    expect(rule("One card a turn, or none").house.es).toContain(`vuelve en el turno ${2 + CARD_COOLDOWN_TURNS}`);
    expect(rule("Rest").house.en).toContain(`${RESTING_ENERGY_PER_TURN} if it rested`);
    expect(rule("Each unit's actions and supplies").house.es).toContain(`energía ${FULL_SUPPLIES[UnitType.INFANTRY].energy}`);
    const figures = FIGURES[UnitType.INFANTRY].figures;
    expect(rule("Figures").house.en).toContain(`Infantry ${figures} figures`);
  });
});
