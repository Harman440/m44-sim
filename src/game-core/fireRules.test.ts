import { HexType } from "../types/hex";
import { describe, expect, it } from "vitest";
import { FireContext, FireQuestion, calculateFireDice, nextFireQuestion } from "./fireRules";
import { FIRE_QUESTIONS, fireBonusSteps } from "../data/fireQuestions";
import CommandCard from "./commandCard";
import { UnitType } from "./unit";
import { same } from "../i18n/lang";

const context = (unitType: UnitType, card: CommandCard | null = null): FireContext => ({ unitType, card });

const dice = (unitType: UnitType, answers: Record<string, string>, card: CommandCard | null = null) =>
  calculateFireDice(FIRE_QUESTIONS, context(unitType, card), answers, fireBonusSteps).dice;

describe("fire questionnaire engine", () => {
  const questions: FireQuestion[] = [
    { id: "a", text: same("A?"), options: () => [], effect: () => ({ label: same("a"), dice: 2 }) },
    {
      id: "b",
      text: same("B?"),
      options: () => [],
      appliesTo: (_, answers) => answers.a === "yes",
      effect: () => ({ label: same("b"), dice: -5 }),
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
        { label: same("a"), dice: 2 },
        { label: same("b"), dice: -5 },
      ],
      notes: [],
      blocked: null,
    });
  });

  it("stops asking and rolls nothing once an answer blocks the shot", () => {
    const blocking: FireQuestion[] = [
      { id: "see", text: same("See?"), options: () => [], effect: () => null, blocks: (_, a) => (a === "no" ? same("Can't see") : null) },
      { id: "c", text: same("C?"), options: () => [], effect: () => ({ label: same("c"), dice: 3 }) },
    ];

    expect(nextFireQuestion(blocking, ctx, { see: "no" })).toBeNull();
    expect(calculateFireDice(blocking, ctx, { see: "no" })).toEqual({ dice: 0, steps: [], notes: [], blocked: same("Can't see") });
    expect(nextFireQuestion(blocking, ctx, { see: "yes" })?.id).toBe("c");
  });

  it("collects notes from the answers without changing the dice", () => {
    const noted: FireQuestion[] = [
      { id: "a", text: same("A?"), options: () => [], effect: () => ({ label: same("a"), dice: 2 }), note: (_, a) => (a === "yes" ? same("Remember") : null) },
    ];

    expect(calculateFireDice(noted, ctx, { a: "yes" })).toMatchObject({ dice: 2, notes: [same("Remember")] });
    expect(calculateFireDice(noted, ctx, { a: "no" }).notes).toEqual([]);
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
    [UnitType.INFANTRY, "1", "plains", 3],
    [UnitType.INFANTRY, "3", "plains", 1],
    [UnitType.INFANTRY, "2", "forest", 1],
    [UnitType.INFANTRY, "3", "town", 0],
    [UnitType.TANK, "2", "plains", 3],
    [UnitType.TANK, "1", "forest", 1],
    [UnitType.TANK, "3", "hill", 2],
    [UnitType.ARTILLERY, "5", "plains", 1],
    [UnitType.ARTILLERY, "2", "town", 3], // artillery ignores terrain
    [UnitType.INFANTRY, "1", "bunker", 2],
    [UnitType.TANK, "1", "bunker", 1],
    [UnitType.ARTILLERY, "3", "bunker", 2],
  ])("%s at %s hexes, target in %s: %i dice", (unitType, distance, targetTerrain, expected) => {
    expect(dice(unitType, { distance, targetTerrain })).toBe(expected);
  });

  it("asks distance, target type, terrain and sandbags; line of sight only beyond adjacent hexes", () => {
    const ctx = context(UnitType.TANK);
    const next = (answers: Record<string, string>) => nextFireQuestion(FIRE_QUESTIONS, ctx, answers)?.id ?? null;

    expect(next({})).toBe("distance");
    expect(next({ distance: "1" })).toBe("targetType");
    expect(next({ distance: "2" })).toBe("lineOfSight");
    // Artillery doesn't need line of sight
    expect(nextFireQuestion(FIRE_QUESTIONS, context(UnitType.ARTILLERY), { distance: "2" })?.id).toBe("targetType");
    expect(next({ distance: "2", lineOfSight: "yes" })).toBe("targetType");
    expect(next({ distance: "2", lineOfSight: "yes", targetType: "tank" })).toBe("targetTerrain");
    expect(next({ distance: "2", lineOfSight: "yes", targetType: "tank", targetTerrain: "plains" })).toBe("sandbags");
    expect(
      next({ distance: "2", lineOfSight: "yes", targetType: "tank", targetTerrain: "plains", sandbags: "no" })
    ).toBeNull();
  });

  it("rules out a target out of sight, so the unit keeps its fire", () => {
    const result = calculateFireDice(FIRE_QUESTIONS, context(UnitType.INFANTRY), { distance: "2", lineOfSight: "no" });

    expect(result.blocked?.es).toMatch(/Sin línea de visión/);
    expect(nextFireQuestion(FIRE_QUESTIONS, context(UnitType.INFANTRY), { distance: "2", lineOfSight: "no" })).toBeNull();
  });

  it("reminds that sandbags ignore a flag and, in the open, take a die", () => {
    const answers = { distance: "1", targetTerrain: "plains", sandbags: "yes" };
    const result = calculateFireDice(FIRE_QUESTIONS, context(UnitType.INFANTRY), answers, fireBonusSteps);

    expect(result.dice).toBe(2);
    expect(result.steps).toContainEqual({
      label: { es: "Sacos terreros en campo abierto", en: "Sandbags in the open" },
      dice: -1,
      kind: "sandbags",
    });
    expect(result.notes).toEqual([
      { es: "Sacos terreros: el objetivo ignora 1 bandera.", en: "Sandbags: the target ignores 1 flag." },
    ]);
  });

  it("never takes a die from artillery for sandbags, but the flag is still ignored", () => {
    const answers = { distance: "1", targetTerrain: "plains", sandbags: "yes" };
    const result = calculateFireDice(FIRE_QUESTIONS, context(UnitType.ARTILLERY), answers, fireBonusSteps);

    expect(result.dice).toBe(3);
    expect(result.steps.map((step) => step.label.es)).not.toContain("Sacos terreros en campo abierto");
    expect(result.notes.map((note) => note.es)).toEqual(["Sacos terreros: el objetivo ignora 1 bandera."]);
  });

  it("doesn't take a die for sandbags where the terrain already protects", () => {
    const answers = { distance: "1", targetTerrain: "forest", sandbags: "yes" };
    expect(calculateFireDice(FIRE_QUESTIONS, context(UnitType.INFANTRY), answers, fireBonusSteps).dice).toBe(2);
  });

  it("fires from a hill at a hill as if it were open ground (official hill rule)", () => {
    const answers = { distance: "1", targetTerrain: "hill", sandbags: "no" };
    const fromHill = { ...context(UnitType.INFANTRY), fromTerrain: HexType.HILL };

    expect(calculateFireDice(FIRE_QUESTIONS, context(UnitType.INFANTRY), answers, fireBonusSteps).dice).toBe(2);
    expect(calculateFireDice(FIRE_QUESTIONS, fromHill, answers, fireBonusSteps).dice).toBe(3);
    // …and sandbags there count as in the open
    expect(calculateFireDice(FIRE_QUESTIONS, fromHill, { ...answers, sandbags: "yes" }, fireBonusSteps).dice).toBe(2);
  });

  it("adds the command card's close assault or ranged bonus", () => {
    const card = new CommandCard({
      name: same("Test"),
      fireBonus: [
        { dice: 1, closeAssault: true },
        { dice: 2, closeAssault: false },
      ],
    });

    expect(dice(UnitType.INFANTRY, { distance: "1", targetTerrain: "plains" }, card)).toBe(4);
    expect(dice(UnitType.INFANTRY, { distance: "2", targetTerrain: "plains" }, card)).toBe(4);
  });

  it("adds a card bonus only for the unit types it names, and takes dice away too", () => {
    const card = new CommandCard({
      name: same("Test"),
      fireBonus: [
        { dice: 1, closeAssault: true, unitTypes: [UnitType.TANK] },
        { dice: -1, closeAssault: true },
      ],
    });

    expect(dice(UnitType.TANK, { distance: "1", targetTerrain: "plains" }, card)).toBe(3);
    expect(dice(UnitType.INFANTRY, { distance: "1", targetTerrain: "plains" }, card)).toBe(2);
  });

  it("explains the calculation step by step, leaving out zero changes", () => {
    const { steps } = calculateFireDice(
      FIRE_QUESTIONS,
      context(UnitType.INFANTRY),
      { distance: "2", targetTerrain: "forest" },
      fireBonusSteps
    );

    expect(steps).toEqual([
      { label: { es: "Base: Infantería a 2 casillas", en: "Base: Infantry at 2 hexes" }, dice: 2, kind: "base" },
      { label: { es: "Objetivo en bosque", en: "Target in forest" }, dice: -1, kind: "terrain" },
    ]);
  });
});
