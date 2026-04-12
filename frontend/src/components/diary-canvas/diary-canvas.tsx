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

// --- Types ---

type StrokeElement = {
  type: "stroke";
  points: { x: number; y: number }[];
  color: string;
  width: number;
  tool: "pen" | "eraser";
};

type TextElement = {
  type: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
};

type CanvasElement = StrokeElement | TextElement;

type Props = {
  width?: number;
  height?: number;
  onScaleChange?: (scale: number) => void;
  stampOverlay?: React.ReactNode;
  onStampClick?: () => void;
  stampCount?: number;
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

export const PEN_COLORS: { id: PenColor; value: string; label: string }[] = [
  { id: "black", value: "#2C2C2C", label: "黒" },
  { id: "blue", value: "#1A5276", label: "青" },
  { id: "red", value: "#C0392B", label: "赤" },
  { id: "green", value: "#27AE60", label: "緑" },
  { id: "orange", value: "#E67E22", label: "橙" },
  { id: "purple", value: "#8E44AD", label: "紫" },
];

const LINE_WIDTHS = [2, 4, 6];
const ERASER_WIDTH = 24;
const TEXT_FONT_SIZES = [16, 20, 24];

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

function drawStroke(ctx: CanvasRenderingContext2D, el: StrokeElement) {
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

function drawElement(ctx: CanvasRenderingContext2D, el: CanvasElement) {
  if (!el) return;
  if (el.type === "stroke") drawStroke(ctx, el);
  else drawText(ctx, el);
}

// --- Exported types ---

export type DiaryCanvasHandle = {
  exportImage: () => Promise<Blob | null>;
  isEmpty: () => boolean;
  getBackground: () => BackgroundType;
};

// --- Component ---

export const DiaryCanvas = forwardRef<DiaryCanvasHandle, Props>(
  function DiaryCanvas({ width = 800, height = 600, onScaleChange, stampOverlay, onStampClick, stampCount }, ref) {
    const drawCanvasRef = useRef<HTMLCanvasElement>(null);
    const bgCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [tool, setTool] = useState<Tool>("pen");
    const [penColor, setPenColor] = useState<PenColor>("black");
    const [lineWidthIndex, setLineWidthIndex] = useState(1);
    const [fontSizeIndex, setFontSizeIndex] = useState(1);
    const [fontFamily, setFontFamily] = useState<FontId>("serif");
    const [textAlign, setTextAlign] = useState<TextAlign>("left");
    const [background, setBackground] = useState<BackgroundType>("ruled");

    const [history, dispatch] = useReducer(historyReducer, {
      elements: [],
      undone: [],
    });
    // Keep a ref in sync for use inside pointer event handlers (avoids stale closures)
    const elementsRef = useRef<CanvasElement[]>([]);
    useEffect(() => {
      elementsRef.current = history.elements;
    }, [history.elements]);

    const [isDrawing, setIsDrawing] = useState(false);
    const currentStrokeRef = useRef<StrokeElement | null>(null);

    // Text boxes (managed as objects, not baked into canvas)
    const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);

    const [scale, setScale] = useState(1);

    const colorValue =
      PEN_COLORS.find((c) => c.id === penColor)?.value ?? "#2C2C2C";

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
      // Text tool is handled by TextBoxOverlay
      if (tool === "text") return;

      if (tool !== "pen" && tool !== "eraser") return;
      e.preventDefault();
      drawCanvasRef.current?.setPointerCapture(e.pointerId);
      setIsDrawing(true);
      const pt = getPoint(e);
      currentStrokeRef.current = {
        type: "stroke",
        points: [pt],
        color: tool === "eraser" ? "#000" : colorValue,
        width: tool === "eraser" ? ERASER_WIDTH : LINE_WIDTHS[lineWidthIndex],
        tool,
      };
    };

    const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDrawing || !currentStrokeRef.current) return;
      e.preventDefault();
      currentStrokeRef.current.points.push(getPoint(e));

      const ctx = drawCanvasRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      for (const el of elementsRef.current) drawElement(ctx, el);
      drawStroke(ctx, currentStrokeRef.current);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      if (!isDrawing || !currentStrokeRef.current) return;
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
          background={background}
          onBackgroundChange={setBackground}
          canUndo={history.elements.length > 0}
          canRedo={history.undone.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={handleClear}
          onStampClick={onStampClick}
          stampCount={stampCount}
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
                tool === "text"
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

          {/* Stamp overlay — disable interaction when text tool is active */}
          <div style={{ pointerEvents: tool === "text" ? "none" : "auto" }}>
            {stampOverlay}
          </div>

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
