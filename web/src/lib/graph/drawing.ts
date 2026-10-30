// Pure sizing rules for the link-graph canvas (tested without a DOM).

/** Padding in CSS pixels left around the whole graph by zoomToFit. */
export const FIT_PADDING_PX = 40;

/** Canvas height: 300 px on phones, otherwise 40% of the width clamped to 360-480 px. */
export function graphHeight(width: number): number {
  if (width < 500) return 300;
  return Math.round(Math.min(480, Math.max(360, width * 0.4)));
}

/** Label size in graph units so labels stay 12 px on screen at any zoom (never below 1). */
export function labelFontPx(scale: number): number {
  return 12 / Math.max(scale, 0.01);
}
