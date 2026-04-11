// Shared drawing primitives — extracted from DiaryCanvas for reuse in FlipbookCanvas

export type StrokeElement = {
  type: "stroke";
  points: { x: number; y: number }[];
  color: string;
  width: number;
  tool: "pen" | "eraser";
};

export type HistoryState = {
  elements: StrokeElement[];
  undone: StrokeElement[];
};

export type HistoryAction =
  | { type: "push"; element: StrokeElement }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "clear" };

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "push":
      return { elements: [...state.elements, action.element], undone: [] };
    case "undo": {
      if (state.elements.length === 0) return state;
      const last = state.elements[state.elements.length - 1];
      return { elements: state.elements.slice(0, -1), undone: [...state.undone, last] };
    }
    case "redo": {
      if (state.undone.length === 0) return state;
      const last = state.undone[state.undone.length - 1];
      return { elements: [...state.elements, last], undone: state.undone.slice(0, -1) };
    }
    case "clear": {
      if (state.elements.length === 0) return state;
      return { elements: [], undone: [...state.undone, ...state.elements] };
    }
  }
}

export function drawStroke(ctx: CanvasRenderingContext2D, el: StrokeElement) {
  if (el.points.length < 2) return;
  ctx.save();
  if (el.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
  }
  ctx.strokeStyle = el.color;
  ctx.lineWidth = el.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(el.points[0].x, el.points[0].y);
  for (let i = 1; i < el.points.length - 1; i++) {
    const mx = (el.points[i].x + el.points[i + 1].x) / 2;
    const my = (el.points[i].y + el.points[i + 1].y) / 2;
    ctx.quadraticCurveTo(el.points[i].x, el.points[i].y, mx, my);
  }
  const last = el.points[el.points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.restore();
}

export const PEN_COLORS = [
  { id: "black", value: "#2C2C2C", label: "黒" },
  { id: "blue", value: "#1A5276", label: "青" },
  { id: "red", value: "#C0392B", label: "赤" },
  { id: "green", value: "#27AE60", label: "緑" },
  { id: "orange", value: "#E67E22", label: "橙" },
  { id: "purple", value: "#8E44AD", label: "紫" },
] as const;

export type PenColorId = (typeof PEN_COLORS)[number]["id"];

export const LINE_WIDTHS = [2, 4, 6];
export const ERASER_WIDTH = 24;

export const CANVAS_W = 800;
export const CANVAS_H = 600;

export const FRAME_BG = "#FFFEF7";
