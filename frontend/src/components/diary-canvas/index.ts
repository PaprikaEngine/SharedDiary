export { DiaryCanvas } from "./diary-canvas";
export type { DiaryCanvasHandle, BackgroundType } from "./diary-canvas";
export { CanvasBackground } from "./canvas-background";
export { TapePicker } from "./tape-picker";
export type { TapeId } from "./tape-patterns";

// A4 portrait at roughly 96 DPI (210×297mm → ~1:√2). Used for new
// diary entries so the notebook feels like a real sheet of paper.
// Legacy entries that predate this constant rendered at 800×600.
export const DIARY_CANVAS_WIDTH = 800;
export const DIARY_CANVAS_HEIGHT = 1131;
