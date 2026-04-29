"use client";

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  useReducer,
  useImperativeHandle,
  forwardRef,
} from "react";
import { CanvasToolbar, type Tool, type PenColor } from "./canvas-toolbar";
import { TextBoxOverlay, FONT_OPTIONS, type TextBox, type FontId, type TextAlign } from "./text-box-overlay";
import { TAPES, TAPE_ALPHA, type TapeId } from "./tape-patterns";

// --- Types ---

export type StrokeElement = {
  type: "stroke";
  points: { x: number; y: number }[];
  color: string;
  width: number;
  tool: "pen" | "eraser" | "highlighter" | "neon";
};

export type TextElement = {
  type: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
};

/** Used only as a transient shape during the tape tool drag. Tapes
 *  are no longer persisted as canvas pixels — on pointerup the
 *  finalised endpoints are emitted via `onTapePlaced` so the parent
 *  can promote them to a PlacedTape DOM overlay (see
 *  components/placed-tape). The temporary preview is still drawn into
 *  the draw canvas while the user is dragging. */
export type TapeElement = {
  type: "tape";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  tapeId: TapeId;
};

export type CanvasElement = StrokeElement | TextElement;

/** Serializable snapshot of the DiaryCanvas internal state. Parents
 *  can store this (e.g. in IndexedDB) and rehydrate a fresh canvas
 *  via the `initialSnapshot` prop so the user can resume composing
 *  after a page reload. */
export type DiarySnapshot = {
  canvasElements: CanvasElement[];
  textBoxes: TextBox[];
  tool: Tool;
  penColor: PenColor;
  lineWidthIndex: number;
  fontSizeIndex: number;
  fontFamily: FontId;
  textAlign: TextAlign;
  tapeId: TapeId;
  background: BackgroundType;
};

type Props = {
  width?: number;
  height?: number;
  onScaleChange?: (scale: number) => void;
  stampOverlay?: React.ReactNode;
  onStampClick?: () => void;
  stampCount?: number;
  /** Extra tape IDs (group-uploaded) to show in the tape selector. */
  extraTapeIds?: TapeId[];
  /** Opens the upload / management UI for group tapes. */
  onTapePickerClick?: () => void;
  /** Called when the user starts a pointer interaction on the draw
   *  canvas itself (not on an overlay item). Parents use this to
   *  clear overlay selections so clicking empty canvas deselects. */
  onCanvasInteract?: () => void;
  /** Hydrate the canvas from a saved draft. Applied once at mount;
   *  subsequent changes are ignored — use the imperative handle if
   *  further programmatic mutations are needed. */
  initialSnapshot?: DiarySnapshot;
  /** Emitted whenever any persistable part of the canvas state
   *  changes. Parents typically debounce + save to a draft store. */
  onChange?: (snapshot: DiarySnapshot) => void;
  /** Emitted when the active tool changes. Parents use this to
   *  toggle overlay interactivity (only the select tool lets users
   *  tap/drag placed items; all drawing tools pass through). */
  onToolChange?: (tool: Tool) => void;
  /** Emitted when the user finishes dragging a tape with the tape
   *  tool. Tapes are no longer baked into canvas pixels — the parent
   *  promotes the placement to a PlacedTape DOM overlay and tracks
   *  it alongside stamps / media / flipbooks. */
  onTapePlaced?: (placement: { tapeId: TapeId; x: number; y: number; length: number; rotation: number }) => void;
  /** Opens the profile-block picker. Threaded through to the toolbar
   *  so the parent can render the picker as a modal sibling. */
  onBlockClick?: () => void;
};

// --- History reducer ---

type HistoryState = {
  elements: CanvasElement[];
  undone: CanvasElement[];
};

type HistoryAction =
  | { type: "push"; element: CanvasElement }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "clear" };

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "push":
      return {
        elements: [...state.elements, action.element],
        undone: [],
      };
    case "undo": {
      if (state.elements.length === 0) return state;
      const last = state.elements[state.elements.length - 1];
      return {
        elements: state.elements.slice(0, -1),
        undone: [...state.undone, last],
      };
    }
    case "redo": {
      if (state.undone.length === 0) return state;
      const last = state.undone[state.undone.length - 1];
      return {
        elements: [...state.elements, last],
        undone: state.undone.slice(0, -1),
      };
    }
    case "clear": {
      if (state.elements.length === 0) return state;
      return {
        elements: [],
        undone: [...state.undone, ...state.elements],
      };
    }
  }
}

// --- Constants ---

const NOTEBOOK_LINE_GAP = 32;
const NOTEBOOK_MARGIN_LEFT = 48;
const NOTEBOOK_LINE_COLOR = "#C8D8E4";
const NOTEBOOK_MARGIN_COLOR = "#E8A0A0";
const NOTEBOOK_BG = "#FFFEF7";

export type BackgroundType = "ruled" | "plain" | "grid";

export const BACKGROUND_OPTIONS: { id: BackgroundType; label: string }[] = [
  { id: "ruled", label: "罫線" },
  { id: "plain", label: "無地" },
  { id: "grid", label: "方眼" },
];

/** Preset swatches for quick color selection. The full spectrum is
 *  reachable via the color-wheel button in the toolbar. */
export const PEN_COLORS: { value: string; label: string }[] = [
  { value: "#2C2C2C", label: "黒" },
  { value: "#1A5276", label: "青" },
  { value: "#C0392B", label: "赤" },
  { value: "#27AE60", label: "緑" },
  { value: "#E67E22", label: "橙" },
  { value: "#8E44AD", label: "紫" },
];

/** Legacy snapshots stored penColor as an enum id ("black", "blue", ...).
 *  Newer snapshots store the hex value directly. This map lets us keep
 *  old drafts working without a migration step. */
const LEGACY_PEN_COLOR_MAP: Record<string, string> = {
  black: "#2C2C2C",
  blue: "#1A5276",
  red: "#C0392B",
  green: "#27AE60",
  orange: "#E67E22",
  purple: "#8E44AD",
};

function normalizePenColor(v: string | undefined): PenColor {
  if (!v) return "#2C2C2C";
  if (v.startsWith("#")) return v.toUpperCase();
  return LEGACY_PEN_COLOR_MAP[v] ?? "#2C2C2C";
}

/** Stroke thickness per tool. The UI exposes three presets (細 / 中 / 太)
 *  and picks from the appropriate array. Highlighter is much wider than
 *  pen so a single swipe covers a line of text; neon sits in between. */
const PEN_WIDTHS = [2, 4, 6];
const HIGHLIGHTER_WIDTHS = [16, 22, 30];
const NEON_WIDTHS = [3, 5, 8];
const ERASER_WIDTH = 24;
const TEXT_FONT_SIZES = [16, 20, 24];

function widthForTool(tool: Tool, index: number): number {
  if (tool === "highlighter") return HIGHLIGHTER_WIDTHS[index];
  if (tool === "neon") return NEON_WIDTHS[index];
  return PEN_WIDTHS[index];
}

// --- Drawing helpers ---

function drawPaperTexture(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = NOTEBOOK_BG;
  ctx.fillRect(0, 0, w, h);

  // Subtle paper grain
  ctx.fillStyle = "rgba(0,0,0,0.015)";
  for (let i = 0; i < 200; i++) {
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
  }
}

function drawNotebookBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  type: BackgroundType = "ruled"
) {
  drawPaperTexture(ctx, w, h);

  if (type === "plain") return;

  if (type === "ruled") {
    ctx.strokeStyle = NOTEBOOK_LINE_COLOR;
    ctx.lineWidth = 0.5;
    for (let y = NOTEBOOK_LINE_GAP; y < h; y += NOTEBOOK_LINE_GAP) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.strokeStyle = NOTEBOOK_MARGIN_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(NOTEBOOK_MARGIN_LEFT, 0);
    ctx.lineTo(NOTEBOOK_MARGIN_LEFT, h);
    ctx.stroke();
    return;
  }

  if (type === "grid") {
    ctx.strokeStyle = NOTEBOOK_LINE_COLOR;
    ctx.lineWidth = 0.5;
    // Horizontal
    for (let y = NOTEBOOK_LINE_GAP; y < h; y += NOTEBOOK_LINE_GAP) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    // Vertical
    for (let x = NOTEBOOK_LINE_GAP; x < w; x += NOTEBOOK_LINE_GAP) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    return;
  }
}

function tracePath(ctx: CanvasRenderingContext2D, el: StrokeElement) {
  ctx.beginPath();
  ctx.moveTo(el.points[0].x, el.points[0].y);
  for (let i = 1; i < el.points.length - 1; i++) {
    const mx = (el.points[i].x + el.points[i + 1].x) / 2;
    const my = (el.points[i].y + el.points[i + 1].y) / 2;
    ctx.quadraticCurveTo(el.points[i].x, el.points[i].y, mx, my);
  }
  const last = el.points[el.points.length - 1];
  ctx.lineTo(last.x, last.y);
}

function drawStroke(ctx: CanvasRenderingContext2D, el: StrokeElement) {
  if (el.points.length < 2) return;
  ctx.save();
  ctx.lineJoin = "round";

  if (el.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.width;
    ctx.lineCap = "round";
    tracePath(ctx, el);
    ctx.stroke();
  } else if (el.tool === "highlighter") {
    // Translucent, flat caps, drawn atop existing strokes. Overlapping
    // passes darken naturally thanks to alpha compositing, which is
    // exactly how real highlighters behave on paper.
    ctx.globalAlpha = 0.38;
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.width;
    ctx.lineCap = "butt";
    tracePath(ctx, el);
    ctx.stroke();
  } else if (el.tool === "neon") {
    // Two passes produce the "glowing tube" look: a wide, blurred
    // halo in the pen color, then a bright core on top.
    ctx.lineCap = "round";
    ctx.shadowColor = el.color;
    ctx.shadowBlur = Math.max(8, el.width * 2.5);
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.width;
    tracePath(ctx, el);
    ctx.stroke();
    // Re-stroke to intensify the glow
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = Math.max(1, el.width * 0.4);
    ctx.stroke();
  } else {
    // Plain pen
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.width;
    ctx.lineCap = "round";
    tracePath(ctx, el);
    ctx.stroke();
  }

  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, el: TextElement) {
  ctx.save();
  ctx.font = `${el.fontSize}px "Noto Serif JP", serif`;
  ctx.fillStyle = el.color;
  ctx.textBaseline = "top";
  const lines = el.text.split("\n");
  const lineHeight = el.fontSize * 1.5;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], el.x, el.y + i * lineHeight);
  }
  ctx.restore();
}

function drawTape(ctx: CanvasRenderingContext2D, el: TapeElement) {
  const tape = TAPES[el.tapeId];
  if (!tape || !tape.tile) return;
  const dx = el.x2 - el.x1;
  const dy = el.y2 - el.y1;
  const length = Math.hypot(dx, dy);
  if (length < 1) return;
  const angle = Math.atan2(dy, dx);
  const w = tape.width;

  ctx.save();
  ctx.translate(el.x1, el.y1);
  ctx.rotate(angle);
  ctx.translate(0, -w / 2);

  // Pattern-fill the tape body
  const pattern = ctx.createPattern(tape.tile, "repeat");
  if (pattern) {
    ctx.globalAlpha = TAPE_ALPHA;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, length, w);
  }

  // Soft edge shadows so the tape looks "stuck on" the page
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "rgba(0,0,0,1)";
  ctx.fillRect(0, 0, length, 1);
  ctx.fillRect(0, w - 1, length, 1);

  ctx.restore();
}

function drawElement(ctx: CanvasRenderingContext2D, el: CanvasElement) {
  if (!el) return;
  if (el.type === "stroke") drawStroke(ctx, el);
  else if (el.type === "text") drawText(ctx, el);
}

// --- Exported types ---

export type DiaryCanvasHandle = {
  exportImage: () => Promise<Blob | null>;
  isEmpty: () => boolean;
  getBackground: () => BackgroundType;
};

// --- Component ---

export const DiaryCanvas = forwardRef<DiaryCanvasHandle, Props>(
  function DiaryCanvas({ width = 800, height = 1131, onScaleChange, stampOverlay, onStampClick, stampCount, extraTapeIds, onTapePickerClick, onCanvasInteract, initialSnapshot, onChange, onToolChange, onTapePlaced, onBlockClick }, ref) {
    const drawCanvasRef = useRef<HTMLCanvasElement>(null);
    const bgCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // `initialSnapshot` is only honoured on first render — React's
    // useState initializer is, too, so reads below give the exact
    // semantics we want (hydrate once, then ignore).
    // Default to the select tool so placed items can be tapped and
    // moved right away; switching to pen/eraser/tape takes a single
    // click in the toolbar.
    const [tool, setTool] = useState<Tool>(initialSnapshot?.tool ?? "select");
    const [penColor, setPenColor] = useState<PenColor>(() =>
      normalizePenColor(initialSnapshot?.penColor)
    );
    const [lineWidthIndex, setLineWidthIndex] = useState(initialSnapshot?.lineWidthIndex ?? 1);
    const [fontSizeIndex, setFontSizeIndex] = useState(initialSnapshot?.fontSizeIndex ?? 1);
    const [fontFamily, setFontFamily] = useState<FontId>(initialSnapshot?.fontFamily ?? "serif");
    const [textAlign, setTextAlign] = useState<TextAlign>(initialSnapshot?.textAlign ?? "left");
    const [tapeId, setTapeId] = useState<TapeId>(initialSnapshot?.tapeId ?? "check-rose");
    const [background, setBackground] = useState<BackgroundType>(initialSnapshot?.background ?? "ruled");

    const [history, dispatch] = useReducer(historyReducer, {
      // Old drafts (pre-tape-overlay refactor) may contain `type:
      // "tape"` entries. Filter them out at hydration so they don't
      // sit as zombies in the history (drawElement won't render them
      // any more, but they'd still consume undo slots and pollute
      // emitted snapshots).
      elements: (initialSnapshot?.canvasElements ?? []).filter(
        (el): el is CanvasElement => !!el && (el.type === "stroke" || el.type === "text")
      ),
      undone: [],
    });
    // Keep a ref in sync for use inside pointer event handlers (avoids stale closures)
    const elementsRef = useRef<CanvasElement[]>([]);
    useEffect(() => {
      elementsRef.current = history.elements;
    }, [history.elements]);

    const [isDrawing, setIsDrawing] = useState(false);
    const currentStrokeRef = useRef<StrokeElement | null>(null);
    const currentTapeRef = useRef<TapeElement | null>(null);

    // Text boxes (managed as objects, not baked into canvas)
    const [textBoxes, setTextBoxes] = useState<TextBox[]>(initialSnapshot?.textBoxes ?? []);

    const [scale, setScale] = useState(1);

    // penColor is already a hex string; kept as `colorValue` for the
    // existing downstream consumers that expect that name.
    const colorValue = penColor;

    // Scale to fit container
    useEffect(() => {
      const update = () => {
        if (!containerRef.current) return;
        const newScale = Math.min(1, containerRef.current.clientWidth / width);
        setScale(newScale);
        onScaleChange?.(newScale);
      };
      update();
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }, [width, onScaleChange]);

    // Draw notebook background (redraws when background type changes)
    useEffect(() => {
      const ctx = bgCanvasRef.current?.getContext("2d");
      if (ctx) drawNotebookBackground(ctx, width, height, background);
    }, [width, height, background]);

    // Emit snapshot whenever any persistable state changes. The
    // parent typically debounces these to avoid hammering IDB while
    // the user is dragging / typing.
    useEffect(() => {
      if (!onChange) return;
      onChange({
        canvasElements: history.elements,
        textBoxes,
        tool,
        penColor,
        lineWidthIndex,
        fontSizeIndex,
        fontFamily,
        textAlign,
        tapeId,
        background,
      });
    }, [onChange, history.elements, textBoxes, tool, penColor, lineWidthIndex, fontSizeIndex, fontFamily, textAlign, tapeId, background]);

    // Redraw all elements
    const redraw = useCallback(() => {
      const ctx = drawCanvasRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      for (const el of history.elements) drawElement(ctx, el);
    }, [history.elements, width, height]);

    useEffect(() => {
      redraw();
    }, [redraw]);

    // --- Pointer helpers ---

    const getPoint = (e: React.PointerEvent) => {
      const rect = drawCanvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
      };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
      // Any interaction on the draw canvas itself clears overlay
      // selections so clicking empty space deselects the current stamp
      // / media / flipbook.
      onCanvasInteract?.();

      // Select tool does nothing on the canvas itself — placed items
      // handle their own pointer events via the overlay. The text
      // tool is likewise handled by TextBoxOverlay.
      if (tool === "select" || tool === "text") return;

      if (tool === "tape") {
        e.preventDefault();
        drawCanvasRef.current?.setPointerCapture(e.pointerId);
        setIsDrawing(true);
        const pt = getPoint(e);
        currentTapeRef.current = {
          type: "tape",
          x1: pt.x, y1: pt.y,
          x2: pt.x, y2: pt.y,
          tapeId,
        };
        return;
      }

      if (
        tool !== "pen" &&
        tool !== "eraser" &&
        tool !== "highlighter" &&
        tool !== "neon"
      ) {
        return;
      }
      e.preventDefault();
      drawCanvasRef.current?.setPointerCapture(e.pointerId);
      setIsDrawing(true);
      const pt = getPoint(e);
      currentStrokeRef.current = {
        type: "stroke",
        points: [pt],
        color: tool === "eraser" ? "#000" : colorValue,
        width:
          tool === "eraser" ? ERASER_WIDTH : widthForTool(tool, lineWidthIndex),
        tool,
      };
    };

    const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDrawing) return;

      if (currentTapeRef.current) {
        e.preventDefault();
        const pt = getPoint(e);
        currentTapeRef.current.x2 = pt.x;
        currentTapeRef.current.y2 = pt.y;
        const ctx = drawCanvasRef.current?.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);
        for (const el of elementsRef.current) drawElement(ctx, el);
        drawTape(ctx, currentTapeRef.current);
        return;
      }

      if (!currentStrokeRef.current) return;
      e.preventDefault();
      currentStrokeRef.current.points.push(getPoint(e));

      const ctx = drawCanvasRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      for (const el of elementsRef.current) drawElement(ctx, el);
      drawStroke(ctx, currentStrokeRef.current);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      if (!isDrawing) return;

      if (currentTapeRef.current) {
        e.preventDefault();
        setIsDrawing(false);
        const finished = currentTapeRef.current;
        currentTapeRef.current = null;
        // Only commit if the user actually dragged — a tap shouldn't
        // create a zero-length tape.
        const dx = finished.x2 - finished.x1;
        const dy = finished.y2 - finished.y1;
        const len = Math.hypot(dx, dy);
        if (len >= 8) {
          // Promote to a DOM-overlay PlacedTape via the parent. Tapes
          // are no longer baked into canvas pixels, so we also clear
          // the live preview the move handler painted.
          const cx = (finished.x1 + finished.x2) / 2;
          const cy = (finished.y1 + finished.y2) / 2;
          const rotationDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
          onTapePlaced?.({
            tapeId: finished.tapeId,
            x: cx,
            y: cy,
            length: len,
            rotation: rotationDeg,
          });
        }
        // Wipe the preview either way — committed tapes show up as a
        // DOM overlay on the next render, and abandoned ones should
        // disappear immediately.
        const ctx = drawCanvasRef.current?.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
          for (const el of elementsRef.current) drawElement(ctx, el);
        }
        return;
      }

      if (!currentStrokeRef.current) return;
      e.preventDefault();
      setIsDrawing(false);
      const finished = currentStrokeRef.current;
      currentStrokeRef.current = null;
      if (finished.points.length >= 2) {
        dispatch({ type: "push", element: finished });
      }
    };

    // --- Undo / Redo / Clear ---

    const handleUndo = () => {
      dispatch({ type: "undo" });
    };

    const handleRedo = () => {
      dispatch({ type: "redo" });
    };

    const handleClear = () => {
      dispatch({ type: "clear" });
      setTextBoxes([]);
    };

    // --- Export ---

    const exportImage = useCallback(async (): Promise<Blob | null> => {
      const draw = drawCanvasRef.current;
      if (!draw) return null;

      // Export a transparent PNG containing only strokes + text. The
      // notebook ruling / grid is rendered with CSS at view time based on
      // the background type stored alongside the entry — see
      // frontend/src/app/(app)/groups/[id]/page-viewer.tsx.
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const ctx = c.getContext("2d");
      if (!ctx) return null;

      ctx.drawImage(draw, 0, 0);

      // Draw text boxes onto export canvas
      for (const box of textBoxes) {
        if (!box.text.trim()) continue;
        ctx.save();

        const canvasFont = FONT_OPTIONS.find((f) => f.id === box.fontFamily)?.canvasFont ?? FONT_OPTIONS[0].canvasFont;
        ctx.font = `${box.fontSize}px ${canvasFont}`;
        ctx.fillStyle = box.color;
        ctx.textBaseline = "top";

        const padding = 8;
        const lineHeight = box.fontSize * 1.5;
        const maxWidth = box.w - padding * 2;

        // Apply rotation around center of the box
        if (box.rotation) {
          const cx = box.x + box.w / 2;
          const cy = box.y + box.h / 2;
          ctx.translate(cx, cy);
          ctx.rotate((box.rotation * Math.PI) / 180);
          ctx.translate(-cx, -cy);
        }

        // Word-wrap text
        const lines: string[] = [];
        for (const paragraph of box.text.split("\n")) {
          if (paragraph === "") {
            lines.push("");
            continue;
          }
          let currentLine = "";
          for (const char of paragraph) {
            const testLine = currentLine + char;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && currentLine) {
              lines.push(currentLine);
              currentLine = char;
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) lines.push(currentLine);
        }

        for (let i = 0; i < lines.length; i++) {
          const lineText = lines[i];
          let drawX = box.x + padding;

          if (box.align === "center") {
            const lineWidth = ctx.measureText(lineText).width;
            drawX = box.x + padding + (maxWidth - lineWidth) / 2;
          } else if (box.align === "right") {
            const lineWidth = ctx.measureText(lineText).width;
            drawX = box.x + padding + (maxWidth - lineWidth);
          }

          ctx.fillText(lineText, drawX, box.y + padding + i * lineHeight);
        }
        ctx.restore();
      }

      return new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png"));
    }, [width, height, textBoxes]);

    const isEmpty = useCallback(
      () => history.elements.length === 0 && textBoxes.every((b) => !b.text.trim()),
      [history.elements, textBoxes]
    );

    // Expose handle to parent via ref
    const getBackground = useCallback(() => background, [background]);
    useImperativeHandle(ref, () => ({ exportImage, isEmpty, getBackground }), [
      exportImage,
      isEmpty,
      getBackground,
    ]);

    const handleToolChange = (t: Tool) => {
      setTool(t);
      onToolChange?.(t);
    };

    return (
      <div ref={containerRef} className="w-full">
        <CanvasToolbar
          tool={tool}
          onToolChange={handleToolChange}
          penColor={penColor}
          onPenColorChange={setPenColor}
          lineWidthIndex={lineWidthIndex}
          onLineWidthChange={setLineWidthIndex}
          fontSizeIndex={fontSizeIndex}
          onFontSizeChange={setFontSizeIndex}
          fontFamily={fontFamily}
          onFontFamilyChange={setFontFamily}
          textAlign={textAlign}
          onTextAlignChange={setTextAlign}
          tapeId={tapeId}
          onTapeIdChange={setTapeId}
          extraTapeIds={extraTapeIds}
          onTapePickerClick={onTapePickerClick}
          background={background}
          onBackgroundChange={setBackground}
          canUndo={history.elements.length > 0}
          canRedo={history.undone.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={handleClear}
          onStampClick={onStampClick}
          stampCount={stampCount}
          onBlockClick={onBlockClick}
        />

        <div
          className="relative border border-cream-dark rounded-lg overflow-hidden shadow-sm"
          style={{
            width: width * scale,
            height: height * scale,
            margin: "0 auto",
          }}
        >
          <canvas
            ref={bgCanvasRef}
            width={width}
            height={height}
            className="absolute inset-0"
            style={{ width: width * scale, height: height * scale }}
          />

          <canvas
            ref={drawCanvasRef}
            width={width}
            height={height}
            className="absolute inset-0"
            style={{
              width: width * scale,
              height: height * scale,
              cursor:
                tool === "select"
                  ? "default"
                  : tool === "text"
                  ? "text"
                  : tool === "eraser"
                  ? "cell"
                  : "crosshair",
              touchAction: "none",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />

          {/* Stamp / media / flipbook overlays. Each overlay's root is
              pointer-events: none so empty space passes events through
              to the draw canvas — only the placed items themselves
              intercept pointer events. */}
          {stampOverlay}

          {/* Text box overlay */}
          <TextBoxOverlay
            textBoxes={textBoxes}
            onTextBoxesChange={setTextBoxes}
            canvasScale={scale}
            canvasWidth={width}
            canvasHeight={height}
            activeToolIsText={tool === "text"}
            penColor={colorValue}
            fontSize={TEXT_FONT_SIZES[fontSizeIndex]}
            fontFamily={fontFamily}
            align={textAlign}
            onTextBoxCreated={() => {}}
          />
        </div>
      </div>
    );
  }
);
