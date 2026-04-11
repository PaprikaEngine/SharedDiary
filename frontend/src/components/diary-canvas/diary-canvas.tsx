"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { CanvasToolbar, type Tool, type PenColor } from "./canvas-toolbar";

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
};

// --- Constants ---

const NOTEBOOK_LINE_GAP = 32;
const NOTEBOOK_MARGIN_LEFT = 48;
const NOTEBOOK_LINE_COLOR = "#C8D8E4";
const NOTEBOOK_MARGIN_COLOR = "#E8A0A0";
const NOTEBOOK_BG = "#FFFEF7";

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

function drawNotebookBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
) {
  ctx.fillStyle = NOTEBOOK_BG;
  ctx.fillRect(0, 0, w, h);

  // Paper texture
  ctx.fillStyle = "rgba(0,0,0,0.015)";
  for (let i = 0; i < 200; i++) {
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
  }

  // Ruled lines
  ctx.strokeStyle = NOTEBOOK_LINE_COLOR;
  ctx.lineWidth = 0.5;
  for (let y = NOTEBOOK_LINE_GAP; y < h; y += NOTEBOOK_LINE_GAP) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Margin
  ctx.strokeStyle = NOTEBOOK_MARGIN_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(NOTEBOOK_MARGIN_LEFT, 0);
  ctx.lineTo(NOTEBOOK_MARGIN_LEFT, h);
  ctx.stroke();
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

  // Render multiline
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
};

// --- Component ---

export function DiaryCanvas({ width = 800, height = 600 }: Props) {
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [penColor, setPenColor] = useState<PenColor>("black");
  const [lineWidthIndex, setLineWidthIndex] = useState(1);
  const [fontSizeIndex, setFontSizeIndex] = useState(1);

  const [elements, _setElements] = useState<CanvasElement[]>([]);
  const elementsRef = useRef<CanvasElement[]>([]);
  const setElements = (updater: CanvasElement[] | ((prev: CanvasElement[]) => CanvasElement[])) => {
    _setElements((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      elementsRef.current = next;
      return next;
    });
  };
  const [undoneElements, setUndoneElements] = useState<CanvasElement[]>([]);

  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeRef = useRef<StrokeElement | null>(null);

  // Text editing state
  const [editingText, setEditingText] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const [scale, setScale] = useState(1);

  const colorValue =
    PEN_COLORS.find((c) => c.id === penColor)?.value ?? "#2C2C2C";

  // Scale to fit container
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      setScale(Math.min(1, containerRef.current.clientWidth / width));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [width]);

  // Draw notebook background once
  useEffect(() => {
    const ctx = bgCanvasRef.current?.getContext("2d");
    if (ctx) drawNotebookBackground(ctx, width, height);
  }, [width, height]);

  // Redraw all elements
  const redraw = useCallback(() => {
    const ctx = drawCanvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    for (const el of elements) drawElement(ctx, el);
  }, [elements, width, height]);

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
    // If text tool, place a text box
    if (tool === "text") {
      commitEditingText(); // commit any in-progress text
      const pt = getPoint(e);
      setEditingText(pt);
      setEditingValue("");
      return;
    }

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
    // Capture before nulling — React batches updaters and runs them later,
    // so currentStrokeRef.current would be null by the time the updater fires.
    const finished = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (finished.points.length >= 2) {
      setElements((prev) => [...prev, finished]);
      setUndoneElements([]);
    }
  };

  // --- Text editing ---

  const commitEditingText = useCallback(() => {
    if (!editingText || !editingValue.trim()) {
      setEditingText(null);
      setEditingValue("");
      return;
    }
    const textEl: TextElement = {
      type: "text",
      x: editingText.x,
      y: editingText.y,
      text: editingValue,
      color: colorValue,
      fontSize: TEXT_FONT_SIZES[fontSizeIndex],
    };
    setElements((prev) => [...prev, textEl]);
    setUndoneElements([]);
    setEditingText(null);
    setEditingValue("");
  }, [editingText, editingValue, colorValue, fontSizeIndex]);

  // Focus text input when editing starts
  useEffect(() => {
    if (editingText && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [editingText]);

  // --- Undo / Redo / Clear ---

  const handleUndo = () => {
    commitEditingText();
    setElements((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      // Use queueMicrotask to avoid nested setState
      queueMicrotask(() => setUndoneElements((u) => [...u, last]));
      return prev.slice(0, -1);
    });
  };

  const handleRedo = () => {
    setUndoneElements((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      queueMicrotask(() => setElements((s) => [...s, last]));
      return prev.slice(0, -1);
    });
  };

  const handleClear = () => {
    commitEditingText();
    setElements((prev) => {
      if (prev.length === 0) return prev;
      queueMicrotask(() => setUndoneElements((u) => [...u, ...prev]));
      return [];
    });
  };

  // --- Export ---

  const exportImage = useCallback(async (): Promise<Blob | null> => {
    const bg = bgCanvasRef.current;
    const draw = drawCanvasRef.current;
    if (!bg || !draw) return null;

    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(bg, 0, 0);
    ctx.drawImage(draw, 0, 0);

    return new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png"));
  }, [width, height]);

  const isEmpty = useCallback(() => elements.length === 0, [elements]);

  // Expose handle to parent via container element
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    (el as unknown as Record<string, unknown>).__diaryCanvas = {
      exportImage,
      isEmpty,
    };
  }, [exportImage, isEmpty]);

  // --- Tool change: commit text if switching away ---
  const handleToolChange = (t: Tool) => {
    if (tool === "text" && t !== "text") commitEditingText();
    setTool(t);
  };

  return (
    <div ref={containerRef} className="w-full" data-diary-canvas>
      <CanvasToolbar
        tool={tool}
        onToolChange={handleToolChange}
        penColor={penColor}
        onPenColorChange={setPenColor}
        lineWidthIndex={lineWidthIndex}
        onLineWidthChange={setLineWidthIndex}
        fontSizeIndex={fontSizeIndex}
        onFontSizeChange={setFontSizeIndex}
        canUndo={elements.length > 0}
        canRedo={undoneElements.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
      />

      <div
        className="relative border border-cream-dark rounded-lg overflow-hidden shadow-sm"
        style={{
          width: width * scale,
          height: height * scale,
          margin: "0 auto",
        }}
      >
        {/* Background */}
        <canvas
          ref={bgCanvasRef}
          width={width}
          height={height}
          className="absolute inset-0"
          style={{ width: width * scale, height: height * scale }}
        />

        {/* Drawing layer */}
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

        {/* Text input overlay */}
        {editingText && (
          <textarea
            ref={textInputRef}
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={commitEditingText}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEditingText(null);
                setEditingValue("");
              }
            }}
            className="absolute bg-transparent border border-dashed border-moss/50 rounded outline-none resize-none p-1"
            style={{
              left: editingText.x * scale,
              top: editingText.y * scale,
              fontSize: TEXT_FONT_SIZES[fontSizeIndex] * scale,
              lineHeight: 1.5,
              color: colorValue,
              fontFamily: '"Noto Serif JP", serif',
              minWidth: 120 * scale,
              minHeight: TEXT_FONT_SIZES[fontSizeIndex] * 1.5 * scale + 8,
              zIndex: 10,
            }}
            placeholder="テキストを入力..."
          />
        )}
      </div>
    </div>
  );
}
