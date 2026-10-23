import { describe, expect, it } from "vitest";
import { MAX_ZOOM, minScale, zoomAround, zoomToShow, zoomedView } from "./boardZoom";

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

  it("brings points out of sight into it, zooming out only as far as it takes", () => {
    const zoomed = { scale: 4, cx: 125, cy: 75 };
    // In sight already: nothing moves
    expect(zoomToShow(full, zoomed, [{ x: 100, y: 70 }], 10)).toBe(zoomed);
    // One out of sight: centred on it, as zoomed in as before
    const one = zoomToShow(full, zoomed, [{ x: 800, y: 500 }], 10);
    expect(one).toEqual({ scale: 4, cx: 800, cy: 500 });
    // Two far apart: zoomed out until both fit, with their margins
    const view = zoomedView(full, zoomToShow(full, zoomed, [{ x: 100, y: 100 }, { x: 700, y: 100 }], 50));
    expect(view.x).toBeLessThanOrEqual(50);
    expect(view.x + view.width).toBeGreaterThanOrEqual(750);
    expect(view.width).toBeCloseTo(700);
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
