import { afterEach, describe, expect, it, vi } from "vitest";
import { ART_WAIT_MS, boardArtFor, withBoardArt } from "./mapArt";
import { newDraft } from "../game-core/scenarioDraft";
import { HexType } from "../types/hex";

const drawBoardArt = vi.fn<(tiles: unknown) => Promise<string>>();
vi.mock("./drawBoard", () => ({ drawBoardArt: (tiles: unknown) => drawBoardArt(tiles) }));

const map = (row: number) => ({ ...newDraft("map-test"), tiles: { [HexType.FOREST]: [{ row, col: 4 }] } });

afterEach(() => {
  vi.useRealTimers();
  drawBoardArt.mockReset();
});

describe("board art for a map from Mis mapas", () => {
  it("is drawn once for each terrain", async () => {
    drawBoardArt.mockResolvedValue("blob:art");
    const scenario = map(1);

    expect(await withBoardArt(scenario)).toEqual({ ...scenario, image: "blob:art" });
    expect(await boardArtFor(scenario.tiles)).toBe("blob:art");
    expect(drawBoardArt).toHaveBeenCalledTimes(1);
  });

  it("keeps a scenario's own painted art", async () => {
    const scenario = { ...map(2), image: "board.webp" };
    expect(await withBoardArt(scenario)).toBe(scenario);
    expect(drawBoardArt).not.toHaveBeenCalled();
  });

  it("leaves the art out when it can't be drawn, and tries again next time", async () => {
    drawBoardArt.mockRejectedValueOnce(new Error("no canvas")).mockResolvedValue("blob:again");
    const scenario = map(3);

    expect((await withBoardArt(scenario)).image).toBeUndefined();
    expect((await withBoardArt(scenario)).image).toBe("blob:again");
  });

  it("stops waiting for it, so the game always starts", async () => {
    vi.useFakeTimers();
    drawBoardArt.mockReturnValue(new Promise(() => {}));
    const drawing = withBoardArt(map(4));

    await vi.advanceTimersByTimeAsync(ART_WAIT_MS);
    expect((await drawing).image).toBeUndefined();
  });
});
