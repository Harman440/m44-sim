import { describe, expect, it } from "vitest";
import { combatDeckFor } from "./combatCards";
import { scenarios } from "./scenarios";
import { Scenario } from "../types/scenario";
import { Faction } from "../types/faction";

const scenario = (id: string): Scenario => scenarios.find((s) => s.id === id)!;
const names = (s: Scenario, faction: Faction) => combatDeckFor(s, faction).map((card) => card.name);
const copies = (s: Scenario, faction: Faction, name: string) => names(s, faction).filter((n) => n === name).length;

const ALWAYS = [
  "Tras las líneas enemigas", "Emboscada", "Médico", "Sin munición", "Refuerzos",
  "Lucha callejera", "Táctico", "Blindaje personal", "Explosivos", "¡Fusiles arriba!",
];
const DEFENSIVE = ["Fortificar", "Ni un paso atrás", "Camuflaje", "Repliegue"];
const OFFENSIVE = ["Motorizado", "Sin tregua", "Fragor del combate"];

describe("combat card data", () => {
  it("gives every card a unique id, a Spanish text and a cost", () => {
    for (const s of scenarios) {
      for (const faction of ["Allies", "Axis"] as const) {
        const deck = combatDeckFor(s, faction);
        expect(new Set(deck.map((card) => card.id)).size).toBe(deck.length);
        deck.forEach((card) => {
          expect(card.name).not.toBe("");
          expect(card.description).not.toBe("");
          expect(card.cost).toBeGreaterThan(0);
        });
      }
    }
  });

  it("gives both sides 1 copy of each card for everyone", () => {
    for (const faction of ["Allies", "Axis"] as const) {
      ALWAYS.forEach((name) => expect(copies(scenario("arracourt"), faction, name)).toBe(1));
    }
  });

  it("gives the defensive cards to the defender and the offensive ones to the attacker, Sin tregua twice", () => {
    const arracourt = scenario("arracourt"); // the Axis attacks
    DEFENSIVE.forEach((name) => {
      expect(copies(arracourt, "Allies", name)).toBe(1);
      expect(copies(arracourt, "Axis", name)).toBe(0);
    });
    OFFENSIVE.forEach((name) => expect(copies(arracourt, "Allies", name)).toBe(0));
    expect(copies(arracourt, "Axis", "Motorizado")).toBe(1);
    expect(copies(arracourt, "Axis", "Fragor del combate")).toBe(1);
    expect(copies(arracourt, "Axis", "Sin tregua")).toBe(2);
  });

  it("deals the unit cards by the side's units and the enemy's armour", () => {
    const pegasus = scenario("pegasus-bridge"); // infantry only
    ["Mecánico", "Blindados adelante", "Observador", "Reposicionamiento", "Sin combustible", "Escasez de proyectiles"]
      .forEach((name) => expect(names(pegasus, "Allies")).not.toContain(name));

    const ecouves = scenario("foret-decouves"); // both sides have tanks and artillery
    ["Mecánico", "Blindados adelante", "Observador", "Reposicionamiento", "Sin combustible", "Escasez de proyectiles"]
      .forEach((name) => expect(copies(ecouves, "Axis", name)).toBe(1));

    const sme = scenario("sainte-mere-eglise"); // only the Axis has a tank
    expect(names(sme, "Allies")).toContain("Sin combustible");
    expect(names(sme, "Axis")).not.toContain("Sin combustible");
    expect(names(sme, "Axis")).toContain("Mecánico");
  });

  it("gives Rattenkrieg only on a map with towns", () => {
    const ecouves = scenario("foret-decouves");
    expect(copies(ecouves, "Allies", "Rattenkrieg")).toBe(1);
    expect(names({ ...ecouves, tiles: { forest: ecouves.tiles.forest } }, "Allies")).not.toContain("Rattenkrieg");
  });

  it("gives Cortina de Fuego to the sides with big guns, both when the scenario doesn't say", () => {
    expect(names(scenario("arracourt"), "Allies")).toContain("Cortina de Fuego");
    expect(names(scenario("arracourt"), "Axis")).not.toContain("Cortina de Fuego");
    expect(names(scenario("pegasus-bridge"), "Allies")).not.toContain("Cortina de Fuego");
    const unsaid = { ...scenario("pegasus-bridge"), bigGuns: undefined };
    expect(names(unsaid, "Allies")).toContain("Cortina de Fuego");
    expect(names(unsaid, "Axis")).toContain("Cortina de Fuego");
  });

  it("deals the air cards by air power: 1 each by default, none against air superiority, more with more sorties", () => {
    const sme = scenario("sainte-mere-eglise");
    expect(copies(sme, "Axis", "Poder aéreo")).toBe(1);
    expect(copies(sme, "Axis", "Bombardeo aéreo")).toBe(1);
    expect(names(scenario("arracourt"), "Axis")).not.toContain("Poder aéreo");
    expect(names(scenario("pegasus-bridge"), "Allies")).not.toContain("Poder aéreo");
    const sorties = { ...sme, airPower: { allies: 2, axis: 0 } };
    expect(copies(sorties, "Allies", "Poder aéreo")).toBe(2);
    expect(copies(sorties, "Allies", "Bombardeo aéreo")).toBe(2);
    expect(names(sorties, "Axis")).not.toContain("Bombardeo aéreo");
  });
});
