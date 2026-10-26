import { describe, expect, it, vi } from "vitest";
import { DieFace } from "./dice";
import { sideStats } from "./matchStats";
import type { GameSnapshot } from "./gameSession";
import type { TurnRecord } from "./turnLog";
import { scenarios } from "../data/scenarios";
import { standardBrain } from "./ai/standardBrain";
import { playOut, seeded } from "./ai/selfPlay";
import { FACTIONS } from "../types/faction";

type Stats = Parameters<typeof sideStats>[0];

const shot = (faces: DieFace[], collision = false) => ({ faces, collision }) as unknown as GameSnapshot["shots"][number];
const attack = (faces: DieFace[]) => ({ faces }) as unknown as GameSnapshot["cardAttacks"][number];
const turn = (record: Partial<TurnRecord>) =>
  ({ card: null, shots: [], cardAttacks: [], ...record }) as unknown as TurnRecord;
const name = (es: string) => ({ es, en: es });

describe("sideStats", () => {
  it("counts the dice, the faces and the rolls of the logged turns and the open one", () => {
    const game: Stats = {
      log: [
        turn({ shots: [shot([DieFace.INFANTRY, DieFace.FLAG]) as never], card: { id: "a", name: name("Ataque") } }),
        turn({ shots: [shot([DieFace.TANK], true) as never], cardAttacks: [attack([DieFace.GRENADE, DieFace.GRENADE])] }),
      ],
      shots: [shot([DieFace.INFANTRY, DieFace.SUPPLY, DieFace.INFANTRY])],
      cardAttacks: [],
      playedCard: { name: name("Barrera") } as GameSnapshot["playedCard"],
    };
    const stats = sideStats(game);
    expect(stats.dice).toBe(8);
    expect(stats.faces).toEqual({ infantry: 3, tank: 1, grenade: 2, supply: 1, flag: 1 });
    expect(stats.shots).toBe(2);
    expect(stats.collisions).toBe(1);
    expect(stats.cardAttacks).toBe(1);
    expect(stats.cardsPlayed).toEqual([name("Ataque"), name("Barrera")]);
  });

  it("leaves out rolls with no dice: barbed wire removed, an attack on an empty hex", () => {
    const stats = sideStats({ log: [], shots: [shot([])], cardAttacks: [attack([])], playedCard: null });
    expect(stats).toMatchObject({ dice: 0, shots: 0, cardAttacks: 0, cardsPlayed: [] });
  });

  it("adds up over a played match: every die counted once, by its face", () => {
    const random = seeded(7);
    vi.spyOn(Math, "random").mockImplementation(random);
    const match = playOut(scenarios[0]!, { Allies: standardBrain, Axis: standardBrain }, random, 4);
    vi.restoreAllMocks();
    for (const side of FACTIONS) {
      const stats = sideStats(match.sessions[side].getSnapshot());
      const faces = Object.values(stats.faces).reduce((sum, n) => sum + n, 0);
      expect(faces).toBe(stats.dice);
    }
    const rolled = FACTIONS.map((side) => sideStats(match.sessions[side].getSnapshot()).dice);
    expect(rolled[0]! + rolled[1]!).toBeGreaterThan(0);
  });
});
