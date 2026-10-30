import { describe, expect, it } from "vitest";
import { FIT_PADDING_PX, graphHeight, labelFontPx } from "./drawing";

describe("graph canvas sizing", () => {
  it("is 300 px on phones and 360-480 px (40% of the width) on wider screens", () => {
    expect(graphHeight(335)).toBe(300);
    expect(graphHeight(499)).toBe(300);
    expect(graphHeight(707)).toBe(360);
    expect(graphHeight(1000)).toBe(400);
    expect(graphHeight(1664)).toBe(480);
  });
  it("labels stay 12 px on screen whatever the zoom, and the fit leaves 40 px of padding", () => {
    expect(labelFontPx(1)).toBe(12);
    expect(labelFontPx(2) * 2).toBe(12);
    expect(Number.isFinite(labelFontPx(0))).toBe(true);
    expect(FIT_PADDING_PX).toBe(40);
  });
});
