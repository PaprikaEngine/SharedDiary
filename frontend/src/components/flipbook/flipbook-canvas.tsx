"use client";

import {
  useRef, useEffect, useState, useCallback, useReducer,
  useImperativeHandle, forwardRef,
} from "react";
import {
  type StrokeElement, historyReducer, drawStroke,
  PEN_COLORS, LINE_WIDTHS, ERASER_WIDTH,
  CANVAS_W, CANVAS_H, FRAME_BG,
  type PenColorId,
} from "./drawing-utils";

export type FlipbookCanvasHandle = {
  flattenToDataUrl: () => string;
  loadDataUrl: (dataUrl: string | null) => void;
  clear: () => void;
};

type Props = {
  /** Current frame's committed image (drawn strokes flattened to data URL) */
  frameDataUrl: string | null;
  /** Previous frame data URLs for onion skin */
  onionSkinFrames: string[];
  onionSkinEnabled: boolean;
  /** If true, disable drawing (during playback) */
  disabled?: boolean;
  scale: number;
};

export const FlipbookCanvas = forwardRef<FlipbookCanvasHandle, Props>(
  function FlipbookCanvas({ frameDataUrl, onionSkinFrames, onionSkinEnabled, disabled, scale }, ref) {
    const bgCanvasRef = useRef<HTMLCanvasElement>(null);
    const drawCanvasRef = useRef<HTMLCanvasElement>(null);

    const [tool, setTool] = useState<"pen" | "eraser">("pen");
    const [penColor, setPenColor] = useState<PenColorId>("black");
    const [lineWidthIndex, setLineWidthIndex] = useState(1);

    const [history, dispatch] = useReducer(historyReducer, { elements: [], undone: [] });
    const elementsRef = useRef<StrokeElement[]>([]);
    useEffect(() => { elementsRef.current = history.elements; }, [history.elements]);

    const [isDrawing, setIsDrawing] = useState(false);
    const currentStrokeRef = useRef<StrokeElement | null>(null);
    const frameImageRef = useRef<HTMLImageElement | null>(null);

    const colorValue = PEN_COLORS.find((c) => c.id === penColor)?.value ?? "#2C2C2C";

    // --- Background rendering (onion skin + committed frame image) ---
    const renderBackground = useCallback(async () => {
      const ctx = bgCanvasRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = FRAME_BG;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Onion skin (previous frames at low opacity)
      if (onionSkinEnabled && onionSkinFrames.length > 0) {
        for (let i = 0; i < onionSkinFrames.length; i++) {
          const alpha = 0.15 * (i + 1) / onionSkinFrames.length;
          ctx.globalAlpha = alpha;
          const img = await loadImage(onionSkinFrames[i]);
          ctx.drawImage(img, 0, 0);
        }
        ctx.globalAlpha = 1;
      }

      // Committed frame image
      if (frameDataUrl) {
        const img = await loadImage(frameDataUrl);
        frameImageRef.current = img;
        ctx.drawImage(img, 0, 0);
      } else {
        frameImageRef.current = null;
      }
    }, [frameDataUrl, onionSkinFrames, onionSkinEnabled]);

    useEffect(() => { renderBackground(); }, [renderBackground]);

    // Redraw all strokes
    const redraw = useCallback(() => {
      const ctx = drawCanvasRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      for (const el of history.elements) drawStroke(ctx, el);
    }, [history.elements]);

    useEffect(() => { redraw(); }, [redraw]);

    // --- Pointer handlers ---
    const getPoint = (e: React.PointerEvent) => {
      const rect = drawCanvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
      if (disabled || (tool !== "pen" && tool !== "eraser")) return;
      e.preventDefault();
      drawCanvasRef.current?.setPointerCapture(e.pointerId);
      setIsDrawing(true);
      const pt = getPoint(e);
      currentStrokeRef.current = {
        type: "stroke", points: [pt],
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
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      for (const el of elementsRef.current) drawStroke(ctx, el);
      drawStroke(ctx, currentStrokeRef.current);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      if (!isDrawing || !currentStrokeRef.current) return;
      e.preventDefault();
      setIsDrawing(false);
      const finished = currentStrokeRef.current;
      currentStrokeRef.current = null;
      if (finished.points.length >= 2) dispatch({ type: "push", element: finished });
    };

    // --- Imperative handle ---
    useImperativeHandle(ref, () => ({
      flattenToDataUrl(): string {
        const c = document.createElement("canvas");
        c.width = CANVAS_W;
        c.height = CANVAS_H;
        const ctx = c.getContext("2d")!;
        // Draw background (frame image) without onion skin or BG fill
        if (frameImageRef.current) ctx.drawImage(frameImageRef.current, 0, 0);
        // Draw current strokes
        if (drawCanvasRef.current) ctx.drawImage(drawCanvasRef.current, 0, 0);
        return c.toDataURL("image/png");
      },
      loadDataUrl(dataUrl: string | null) {
        dispatch({ type: "clear" });
        // The committed image is set via frameDataUrl prop
        // We just need to reset the stroke history
      },
      clear() {
        dispatch({ type: "clear" });
      },
    }), []);

    return (
      <div className="flex flex-col gap-2">
        {/* Mini toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tool buttons */}
          <div className="flex gap-1">
            <button type="button" onClick={() => setTool("pen")}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${tool === "pen" ? "bg-moss text-white" : "bg-cream-dark/50 text-ink-light"}`}>
              ペン
            </button>
            <button type="button" onClick={() => setTool("eraser")}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${tool === "eraser" ? "bg-moss text-white" : "bg-cream-dark/50 text-ink-light"}`}>
              消しゴム
            </button>
          </div>
          <div className="w-px h-5 bg-cream-dark/50" />
          {/* Colors */}
          <div className="flex gap-1">
            {PEN_COLORS.map((c) => (
              <button key={c.id} type="button" onClick={() => { setPenColor(c.id); setTool("pen"); }}
                className={`size-5 rounded-full border-2 transition-transform ${penColor === c.id && tool === "pen" ? "border-ink scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c.value }} title={c.label} />
            ))}
          </div>
          <div className="w-px h-5 bg-cream-dark/50" />
          {/* Line widths */}
          <div className="flex gap-1 items-center">
            {LINE_WIDTHS.map((w, i) => (
              <button key={w} type="button" onClick={() => { setLineWidthIndex(i); setTool("pen"); }}
                className={`rounded-full transition-colors ${lineWidthIndex === i && tool === "pen" ? "bg-ink" : "bg-ink/30"}`}
                style={{ width: w + 6, height: w + 6 }} />
            ))}
          </div>
          <div className="w-px h-5 bg-cream-dark/50" />
          {/* Undo/Redo */}
          <button type="button" onClick={() => dispatch({ type: "undo" })} disabled={history.elements.length === 0}
            className="text-xs text-ink-light hover:text-ink disabled:opacity-30 transition-colors">戻す</button>
          <button type="button" onClick={() => dispatch({ type: "redo" })} disabled={history.undone.length === 0}
            className="text-xs text-ink-light hover:text-ink disabled:opacity-30 transition-colors">やり直す</button>
        </div>

        {/* Canvas */}
        <div className="relative border border-cream-dark rounded-lg overflow-hidden shadow-sm"
          style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }}>
          <canvas ref={bgCanvasRef} width={CANVAS_W} height={CANVAS_H}
            className="absolute inset-0" style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }} />
          <canvas ref={drawCanvasRef} width={CANVAS_W} height={CANVAS_H}
            className="absolute inset-0"
            style={{
              width: CANVAS_W * scale, height: CANVAS_H * scale,
              cursor: disabled ? "default" : tool === "eraser" ? "cell" : "crosshair",
              touchAction: "none",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>
      </div>
    );
  },
);

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
