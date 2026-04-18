import type { BackgroundType } from "./diary-canvas";

// Mirror of the constants in diary-canvas.tsx — kept here so the visual
// is produced identically whether we're drawing into an offscreen canvas
// (DiaryCanvas editor) or rendering SVG (page-viewer). Changes must stay
// in sync in both places.
const LINE_GAP = 32;
const MARGIN_LEFT = 48;
const LINE_COLOR = "#C8D8E4";
const MARGIN_COLOR = "#E8A0A0";
const BG_COLOR = "#FFFEF7";

type Props = {
  type: BackgroundType;
  /** Canvas-space dimensions. Default to legacy 800×600 for entries
   *  that predate per-entry canvas sizing. */
  width?: number;
  height?: number;
  className?: string;
};

// Renders the notebook background as SVG so it scales exactly with the
// displayed canvas size — pixel-perfect alignment with the strokes drawn
// on the same viewBox.
export function CanvasBackground({ type, width = 800, height = 600, className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <rect width={width} height={height} fill={BG_COLOR} />

      {type === "ruled" && (
        <>
          {Array.from({ length: Math.floor(height / LINE_GAP) }, (_, i) => {
            const y = (i + 1) * LINE_GAP;
            return <line key={`h${i}`} x1={0} y1={y} x2={width} y2={y} stroke={LINE_COLOR} strokeWidth={0.5} />;
          })}
          <line x1={MARGIN_LEFT} y1={0} x2={MARGIN_LEFT} y2={height} stroke={MARGIN_COLOR} strokeWidth={1} />
        </>
      )}

      {type === "grid" && (
        <>
          {Array.from({ length: Math.floor(height / LINE_GAP) }, (_, i) => {
            const y = (i + 1) * LINE_GAP;
            return <line key={`h${i}`} x1={0} y1={y} x2={width} y2={y} stroke={LINE_COLOR} strokeWidth={0.5} />;
          })}
          {Array.from({ length: Math.floor(width / LINE_GAP) }, (_, i) => {
            const x = (i + 1) * LINE_GAP;
            return <line key={`v${i}`} x1={x} y1={0} x2={x} y2={height} stroke={LINE_COLOR} strokeWidth={0.5} />;
          })}
        </>
      )}
    </svg>
  );
}
