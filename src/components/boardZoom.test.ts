import { describe, expect, it } from "vitest";
import { MAX_ZOOM, minScale, zoomAround, zoomedView } from "./boardZoom";

const full = { x: 0, y: 0, width: 1000, height: 600 };
const whole = { scale: 1, cx: 500, cy: 300 };

describe("board zoom", () => {
  it("shows the whole board unzoomed", () => {
    expect(zoomedView(full, whole)).toEqual(full);
  });

  it("keeps the point zoomed at in place", () => {
    const zoom = zoomAround(full, whole, 2, 250, 150);
    const view = zoomedView(full, zoom);
    expect(view.width).toBe(500);
    // 250 was a quarter of the way across, and still is
    expect((250 - view.x) / view.width).toBeCloseTo(0.25);
    expect((150 - view.y) / view.height).toBeCloseTo(0.25);
  });

  it("never shows past the board's edge", () => {
    const view = zoomedView(full, { scale: 2, cx: 0, cy: 10_000 });
    expect(view).toEqual({ x: 0, y: 300, width: 500, height: 300 });
  });

  it("zooms between the whole board and the closest zoom", () => {
    expect(zoomAround(full, whole, 0.5, 500, 300).scale).toBe(1);
    expect(zoomAround(full, whole, 100, 500, 300).scale).toBe(MAX_ZOOM);
  });

  describe("in a box wider than the board", () => {
    const wide = 2.5; // 1000 × 400

    it("fills the box unzoomed, cropping top and bottom", () => {
      expect(zoomedView(full, whole, wide)).toEqual({ x: 0, y: 100, width: 1000, height: 400 });
    });

    it("pans only within the board", () => {
      expect(zoomedView(full, { ...whole, cy: 0 }, wide).y).toBe(0);
      expect(zoomedView(full, { ...whole, cy: 600 }, wide).y).toBe(200);
    });

    it("zooms out down to the whole board", () => {
      expect(minScale(full, wide)).toBeCloseTo(400 / 600);
      const out = zoomAround(full, whole, 0.1, 500, 300, wide);
      expect(out.scale).toBeCloseTo(400 / 600);
      expect(zoomedView(full, out, wide)).toEqual(full);
    });
  });
});
