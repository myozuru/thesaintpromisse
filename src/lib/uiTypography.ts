/** Absolute UI typography floors. Keep these aligned with the CSS tokens in styles.css. */
export const UI_TEXT_FLOOR_PX = 14;
export const UI_READING_FLOOR_PX = 16;

/**
 * Keep canvas text readable after the map camera scales its drawing context.
 * targetWorldPx is the preferred size before the transform; the returned size
 * guarantees at least floorPx on screen.
 */
export function canvasFontSizeAtScale(
  targetWorldPx: number,
  scale: number,
  floorPx = UI_READING_FLOOR_PX,
): number {
  const safeScale = Math.max(Math.abs(scale), 0.01);
  return Math.max(targetWorldPx, floorPx / safeScale);
}
