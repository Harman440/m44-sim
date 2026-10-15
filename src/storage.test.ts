import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSavedGame,
  clearSavedMatch,
  deleteCustomMap,
  loadCustomMaps,
  loadLastSetup,
  loadSavedGame,
  loadSavedMatch,
  loadSettings,
  saveCustomMap,
  saveGame,
  saveMatch,
  saveLastSetup,
  saveSettings,
  savedGameScenarioId,
  savedMatchScenarioId,
  settleMapIds,
} from "./storage";
import { newDraft, paintTerrain, placeUnit, setAttacker, setHandSize, setText } from "./game-core/scenarioDraft";
import { validateScenario } from "./game-core/scenarioFile";
import { UnitType } from "./game-core/unit";
import { HexType } from "./types/hex";
import { combatDeckFor } from "./data/combatCards";
import { DEFAULT_SETTINGS } from "./settings";
import GameSession from "./game-core/gameSession";
import PassAndPlayMatch from "./game-core/passAndPlay";
import { Faction } from "./types/faction";
import { commandDeckFor } from "./data/commandCards";
import { TurnPhase } from "./types/gameManager";
import { Scenario } from "./types/scenario";
import { same } from "./i18n/lang";

const SAVED_GAME_KEY = "m44-sim:saved-game";

const scenario: Scenario = {
  id: "test",
  name: { es: "Test", en: "Test" },
  description: same(""),
  initialHandSize: { allies: 2, axis: 2 },
  attacker: "Axis",
  tiles: {},
  units: { allies: { infantry: [{ row: 7, col: 1 }] }, axis: {} },
};

// The saved game is read back with the side's own deck
const newSession = () =>
  new GameSession({ scenario, faction: "Axis", initialHandSize: 2, commandCards: commandDeckFor(scenario, "Axis") });

const newMatch = () => {
  const side = (faction: Faction) =>
    new GameSession({ scenario, faction, initialHandSize: 2, commandCards: commandDeckFor(scenario, faction), figures: true });
  return new PassAndPlayMatch(scenario, { Allies: side("Allies"), Axis: side("Axis") });
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("last setup", () => {
  it("remembers the last scenario and side", () => {
    expect(loadLastSetup()).toBeUndefined();

    saveLastSetup({ scenarioId: "test", faction: "Axis", longRangeDie: true });

    expect(loadLastSetup()).toEqual({ scenarioId: "test", faction: "Axis", longRangeDie: true });
  });

  it("ignores a setup it can't read", () => {
    localStorage.setItem("m44-sim:last-setup", "{not json");

    expect(loadLastSetup()).toBeUndefined();
  });
});

describe("settings", () => {
  it("remembers the look and sound, with defaults until something is saved", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);

    saveSettings({ look: "field", sound: true, language: "es" });

    expect(loadSettings()).toEqual({ look: "field", sound: true, language: "es" });
  });

  it("uses the defaults when the saved settings can't be read", () => {
    localStorage.setItem("m44-sim:settings", "{oops");

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe("saved game", () => {
  it("saves a game and picks it up again", () => {
    const session = newSession();
    session.pickCard(session.getSnapshot().hand[0]!);
    saveGame(session);

    const restored = loadSavedGame([scenario]);

    expect(restored?.faction).toBe("Axis");
    expect(restored?.getSnapshot().phase).toBe(TurnPhase.ORDER_UNITS);
    expect(restored?.getSnapshot().chosenCard?.id).toBe(session.getSnapshot().chosenCard?.id);
  });

  it("has nothing to load when no game was saved", () => {
    expect(loadSavedGame([scenario])).toBeNull();
  });

  it.each([
    ["isn't JSON", "{not json"],
    ["is from an older app version", JSON.stringify({ version: 0 })],
  ])("drops a save that %s", (_, json) => {
    localStorage.setItem(SAVED_GAME_KEY, json);

    expect(loadSavedGame([scenario])).toBeNull();
    expect(localStorage.getItem(SAVED_GAME_KEY)).toBeNull();
  });

  it("drops a save for a scenario that no longer exists", () => {
    saveGame(newSession());

    expect(loadSavedGame([{ ...scenario, id: "other" }])).toBeNull();
    expect(localStorage.getItem(SAVED_GAME_KEY)).toBeNull();
  });

  it("forgets the game on exit", () => {
    saveGame(newSession());

    clearSavedGame();

    expect(loadSavedGame([scenario])).toBeNull();
  });

  it("keeps going quietly when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(() => saveGame(newSession())).not.toThrow();
    expect(() => saveLastSetup({ scenarioId: "test", faction: "Allies", longRangeDie: false })).not.toThrow();
    expect(loadSavedGame([scenario])).toBeNull();
    expect(loadLastSetup()).toBeUndefined();
  });
});

describe("Mis mapas", () => {
  const KEY = "m44-sim:custom-maps";
  const named = (id: string, name: string) => setText(newDraft(id), "name", "es", name);

  /** A map made in the editor: terrain, both sides' units, a name and the settings */
  const madeMap = () =>
    [
      (d: Scenario) => paintTerrain(d, { row: 4, col: 6 }, HexType.FOREST),
      (d: Scenario) => paintTerrain(d, { row: 3, col: 4 }, HexType.TOWN),
      (d: Scenario) => placeUnit(d, { row: 7, col: 2 }, "Allies", UnitType.INFANTRY),
      (d: Scenario) => placeUnit(d, { row: 7, col: 6 }, "Allies", UnitType.TANK),
      (d: Scenario) => placeUnit(d, { row: 8, col: 10 }, "Allies", UnitType.INFANTRY),
      (d: Scenario) => placeUnit(d, { row: 1, col: 4 }, "Axis", UnitType.INFANTRY),
      (d: Scenario) => placeUnit(d, { row: 2, col: 8 }, "Axis", UnitType.ARTILLERY),
      (d: Scenario) => setText(d, "name", "es", "Bocage normando"),
      (d: Scenario) => setAttacker(d, "Axis"),
      (d: Scenario) => setHandSize(d, "Allies", 4),
    ].reduce((draft, step) => {
      const next = step(draft);
      if (!next) throw new Error("edit not allowed");
      return next;
    }, newDraft("map-3f9k"));

  it("keeps the device's maps in the order they were made, playable or not yet", () => {
    saveCustomMap(madeMap());
    saveCustomMap(named("map-aaaa", "Half made"));
    saveCustomMap(setText(madeMap(), "name", "es", "Bocage"));

    expect(loadCustomMaps().map((map) => [map.id, map.name.es])).toEqual([
      ["map-3f9k", "Bocage"],
      ["map-aaaa", "Half made"],
    ]);
    deleteCustomMap("map-3f9k");
    expect(loadCustomMaps().map((map) => map.id)).toEqual(["map-aaaa"]);
  });

  it("leaves out a map it can't read, and keeps the rest", () => {
    saveCustomMap(madeMap());
    const files = JSON.parse(localStorage.getItem(KEY)!);
    localStorage.setItem(KEY, JSON.stringify([{ version: 1, board: "standard", id: "map-x", units: "lots" }, ...files]));

    expect(loadCustomMaps().map((map) => map.id)).toEqual(["map-3f9k"]);
  });

  it("gives a map that has left the editor with a name its id from the name, keeping the random part", () => {
    saveCustomMap(madeMap());
    saveCustomMap(newDraft("map-zzzz"));
    saveCustomMap({ ...named("map-bbbb", "Forêt d'Écouves"), name: { es: "Bosque", en: "Forêt d'Écouves" } });
    saveCustomMap(named("arracourt-1a2b", "Renamed"));

    const renamed = settleMapIds(["foret-d-ecouves-bbbb"]);

    expect(renamed.get("map-3f9k")).toBe("bocage-normando-3f9k");
    // The English name first; a new random part where the id is taken
    expect(renamed.get("map-bbbb")).toMatch(/^foret-d-ecouves-[a-z0-9]{4}$/);
    expect(renamed.get("map-bbbb")).not.toBe("foret-d-ecouves-bbbb");
    expect(loadCustomMaps().map((map) => map.id)).toEqual([
      "bocage-normando-3f9k",
      "map-zzzz", // no name yet
      renamed.get("map-bbbb"),
      "arracourt-1a2b", // an id from a name stays when the map is renamed
    ]);
    expect(settleMapIds([]).size).toBe(0);
  });

  it("makes the editor's one map from before Mis mapas the first of them", () => {
    saveCustomMap(named("map-aaaa", "Older"));
    localStorage.setItem("m44-sim:map-draft", JSON.stringify({ version: 1, board: "standard", ...madeMap() }));

    expect(loadCustomMaps().map((map) => map.id)).toEqual(["map-3f9k", "map-aaaa"]);
    expect(localStorage.getItem("m44-sim:map-draft")).toBeNull();
  });

  it("plays a turn on a map made in the editor, saves it and picks it back up", () => {
    saveCustomMap(madeMap());
    settleMapIds([]);
    const [map] = loadCustomMaps();
    expect(validateScenario(map!)).toEqual([]);

    const session = new GameSession({
      scenario: map!,
      faction: "Allies",
      initialHandSize: map!.initialHandSize.allies,
      commandCards: commandDeckFor(map!, "Allies"),
      combatCards: combatDeckFor(map!, "Allies"),
    });
    // The Axis attack: the Allies wait out their extra turn and start on turn 2
    expect(session.getSnapshot().phase).toBe(TurnPhase.AWAIT_ATTACKER);
    expect(session.startFirstTurn()).toBe(true);
    const card = session.getSnapshot().hand.find((each) => !session.cardNeedsSection(each))!;
    expect(session.pickCard(card)).toBe(true);
    while (session.getSnapshot().ordersLeft > 0 && session.getSnapshot().orderable.length > 0) {
      const position = session.getSnapshot().orderable[0]!;
      expect(session.issueOrder(position, position)).toBe(true);
    }
    expect(session.commitOrders()).toBe(true);
    expect(session.startBattle()).toBe(true);
    expect(session.endBattle()).toBe(true);
    // What the final phase asks depends on the card played: keep one of Probe's cards, take Preparations' combat card
    const kept = session.getSnapshot().drawOptions[0];
    if (kept) expect(session.keepCard(kept)).toBe(true);
    if (session.getSnapshot().combatCardDue) expect(session.drawCombatCard()).toBe(true);
    if (session.getSnapshot().needsRewardChoice) expect(session.chooseReward("coins")).toBe(true);
    expect(session.endTurn()).toBe(true);
    saveGame(session);

    expect(savedGameScenarioId()).toBe("bocage-normando-3f9k");
    const restored = loadSavedGame([...loadCustomMaps()]);
    expect(restored?.getSnapshot()).toMatchObject({
      turn: session.getSnapshot().turn,
      phase: TurnPhase.PICK_CARDS,
      log: session.getSnapshot().log,
    });
    expect(restored?.scenario.id).toBe("bocage-normando-3f9k");
  });

  it("drops a game whose map is gone from the device", () => {
    saveCustomMap(madeMap());
    const [map] = loadCustomMaps();
    saveGame(new GameSession({ scenario: map!, faction: "Axis", initialHandSize: 5, commandCards: commandDeckFor(map!, "Axis") }));
    deleteCustomMap(map!.id);

    expect(loadSavedGame(loadCustomMaps())).toBeNull();
    expect(savedGameScenarioId()).toBeNull();
  });
});

describe("saved pass and play match", () => {
  it("saves a match and picks it up again behind the cover screen", () => {
    const match = newMatch();
    match.uncover();
    const axis = match.activeSession();
    axis.pickCard(axis.getSnapshot().hand[0]!);
    saveMatch(match);

    expect(savedMatchScenarioId()).toBe(scenario.id);
    const restored = loadSavedMatch([scenario]);

    expect(restored?.getSnapshot()).toMatchObject({ active: "Axis", covered: true, revealTurn: null });
    expect(restored?.sessions.Axis.getSnapshot().phase).toBe(TurnPhase.ORDER_UNITS);
    expect(restored?.sessions.Allies.getSnapshot().phase).toBe(TurnPhase.AWAIT_ATTACKER);
  });

  it("is kept apart from the one-side game, and dropped when it can't be read", () => {
    saveGame(newSession());
    expect(loadSavedMatch([scenario])).toBeNull();

    saveMatch(newMatch());
    expect(loadSavedMatch([{ ...scenario, id: "other" }])).toBeNull();
    expect(localStorage.getItem("m44-sim:saved-match")).toBeNull();
    expect(loadSavedGame([scenario])).not.toBeNull();
  });

  it("forgets the match on exit", () => {
    saveMatch(newMatch());

    clearSavedMatch();

    expect(loadSavedMatch([scenario])).toBeNull();
    expect(savedMatchScenarioId()).toBeNull();
  });
});
