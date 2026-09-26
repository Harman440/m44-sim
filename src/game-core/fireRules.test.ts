import { describe, expect, it } from "vitest";
import { FireContext, FireQuestion, calculateFireDice, nextFireQuestion } from "./fireRules";
import { FIRE_QUESTIONS, fireBonusSteps } from "../data/fireQuestions";
import CommandCard from "./commandCard";
import { UnitType } from "./unit";

const context = (unitType: UnitType, card: CommandCard | null = null): FireContext => ({ unitType, card });

const dice = (unitType: UnitType, answers: Record<string, string>, card: CommandCard | null = null) =>
  calculateFireDice(FIRE_QUESTIONS, context(unitType, card), answers, fireBonusSteps).dice;

describe("fire questionnaire engine", () => {
  const questions: FireQuestion[] = [
    { id: "a", text: "A?", options: () => [], effect: () => ({ label: "a", dice: 2 }) },
    {
      id: "b",
      text: "B?",
      options: () => [],
      appliesTo: (_, answers) => answers.a === "yes",
      effect: () => ({ label: "b", dice: -5 }),
    },
  ];
  const ctx = context(UnitType.INFANTRY);

  it("asks questions in order and skips the ones that don't apply", () => {
    expect(nextFireQuestion(questions, ctx, {})?.id).toBe("a");
    expect(nextFireQuestion(questions, ctx, { a: "yes" })?.id).toBe("b");
    expect(nextFireQuestion(questions, ctx, { a: "no" })).toBeNull();
  });

  it("adds up the answers and never goes below zero", () => {
    expect(calculateFireDice(questions, ctx, { a: "no" }).dice).toBe(2);
    expect(calculateFireDice(questions, ctx, { a: "yes", b: "x" })).toEqual({
      dice: 0,
      steps: [
        { label: "a", dice: 2 },
        { label: "b", dice: -5 },
      ],
    });
  });
});

describe("fire questions (house rules)", () => {
  it("offers distances up to each unit's range", () => {
    const distance = FIRE_QUESTIONS.find((q) => q.id === "distance")!;

    expect(distance.options(context(UnitType.INFANTRY))).toHaveLength(3);
    expect(distance.options(context(UnitType.TANK))).toHaveLength(3);
    expect(distance.options(context(UnitType.ARTILLERY))).toHaveLength(6);
  });

  it.each([
    [UnitType.INFANTRY, "1", "open", 3],
    [UnitType.INFANTRY, "3", "open", 1],
    [UnitType.INFANTRY, "2", "forest", 1],
    [UnitType.INFANTRY, "3", "town", 0],
    [UnitType.TANK, "2", "open", 3],
    [UnitType.TANK, "1", "forest", 1],
    [UnitType.TANK, "3", "hill", 2],
    [UnitType.ARTILLERY, "5", "open", 1],
    [UnitType.ARTILLERY, "2", "town", 3], // artillery ignores terrain
  ])("%s at %s hexes, target in %s: %i dice", (unitType, distance, targetTerrain, expected) => {
    expect(dice(unitType, { distance, targetTerrain })).toBe(expected);
  });

  it("asks distance then target terrain, then is complete", () => {
    const ctx = context(UnitType.TANK);

    expect(nextFireQuestion(FIRE_QUESTIONS, ctx, {})?.id).toBe("distance");
    expect(nextFireQuestion(FIRE_QUESTIONS, ctx, { distance: "1" })?.id).toBe("targetTerrain");
    expect(nextFireQuestion(FIRE_QUESTIONS, ctx, { distance: "1", targetTerrain: "open" })).toBeNull();
  });

  it("adds the command card's close assault or ranged bonus", () => {
    const card = new CommandCard({ name: "Test", closeAssaultAdditionalDice: 1, rangeAdditionalDice: 2 });

    expect(dice(UnitType.INFANTRY, { distance: "1", targetTerrain: "open" }, card)).toBe(4);
    expect(dice(UnitType.INFANTRY, { distance: "2", targetTerrain: "open" }, card)).toBe(4);
  });

  it("explains the calculation step by step, leaving out zero changes", () => {
    const { steps } = calculateFireDice(
      FIRE_QUESTIONS,
      context(UnitType.INFANTRY),
      { distance: "2", targetTerrain: "forest" },
      fireBonusSteps
    );

    expect(steps).toEqual([
      { label: "Base: Infantería a 2 casillas", dice: 2 },
      { label: "Objetivo en bosque", dice: -1 },
    ]);
  });
});
