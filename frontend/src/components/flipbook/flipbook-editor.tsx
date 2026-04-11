"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Pause, X, Save, Layers } from "lucide-react";
import { FlipbookCanvas, type FlipbookCanvasHandle } from "./flipbook-canvas";
import { FrameTimeline } from "./frame-timeline";
import { CANVAS_W } from "./drawing-utils";

const MAX_FRAMES = 60;

export type FlipbookData = {
  fps: number;
  loop: boolean;
  frames: { order: number; canvasJson: string }[];
};

type FrameState = {
  id: string;
  /** Committed PNG data URL (null = blank) */
  dataUrl: string | null;
};

type Props = {
  initial?: FlipbookData;
  onSave: (data: FlipbookData) => void;
  onClose: () => void;
};

export function FlipbookEditor({ initial, onSave, onClose }: Props) {
  // --- State ---
  const [frames, setFrames] = useState<FrameState[]>(() => {
    if (initial && initial.frames.length > 0) {
      return initial.frames
        .sort((a, b) => a.order - b.order)
        .map((f) => ({ id: crypto.randomUUID(), dataUrl: f.canvasJson }));
    }
    return [{ id: crypto.randomUUID(), dataUrl: null }];
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fps, setFps] = useState(initial?.fps ?? 8);
  const [loop, setLoop] = useState(initial?.loop ?? true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [onionSkin, setOnionSkin] = useState(true);
  const [scale, setScale] = useState(1);

  const canvasRef = useRef<FlipbookCanvasHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scale to fit container
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const maxW = containerRef.current.clientWidth - 32; // padding
      setScale(Math.min(1, maxW / CANVAS_W));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // --- Frame switching: commit current strokes before switching ---
  const commitCurrentFrame = useCallback(() => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.flattenToDataUrl();
    setFrames((prev) => prev.map((f, i) => i === currentIndex ? { ...f, dataUrl } : f));
  }, [currentIndex]);

  const switchToFrame = useCallback((index: number) => {
    if (index === currentIndex) return;
    commitCurrentFrame();
    setCurrentIndex(index);
  }, [currentIndex, commitCurrentFrame]);

  // --- Frame management ---
  const addFrame = useCallback(() => {
    if (frames.length >= MAX_FRAMES) return;
    commitCurrentFrame();
    const newFrame: FrameState = { id: crypto.randomUUID(), dataUrl: null };
    const insertAt = currentIndex + 1;
    setFrames((prev) => [...prev.slice(0, insertAt), newFrame, ...prev.slice(insertAt)]);
    setCurrentIndex(insertAt);
  }, [frames.length, currentIndex, commitCurrentFrame]);

  const duplicateFrame = useCallback((index: number) => {
    if (frames.length >= MAX_FRAMES) return;
    // If duplicating current frame, commit first
    if (index === currentIndex) commitCurrentFrame();
    const src = frames[index];
    const dup: FrameState = { id: crypto.randomUUID(), dataUrl: src.dataUrl };
    const insertAt = index + 1;
    setFrames((prev) => [...prev.slice(0, insertAt), dup, ...prev.slice(insertAt)]);
    setCurrentIndex(insertAt);
  }, [frames, currentIndex, commitCurrentFrame]);

  const deleteFrame = useCallback((index: number) => {
    if (frames.length <= 1) return;
    setFrames((prev) => prev.filter((_, i) => i !== index));
    if (currentIndex >= index && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [frames.length, currentIndex]);

  // --- Playback ---
  useEffect(() => {
    if (isPlaying) {
      commitCurrentFrame();
      playIntervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          const next = prev + 1;
          if (next >= frames.length) {
            if (loop) return 0;
            setIsPlaying(false);
            return prev;
          }
          return next;
        });
      }, 1000 / fps);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, fps, loop, frames.length, commitCurrentFrame]);

  // --- Onion skin frames ---
  const onionSkinFrames: string[] = [];
  if (onionSkin && currentIndex > 0 && !isPlaying) {
    const prev = frames[currentIndex - 1];
    if (prev.dataUrl) onionSkinFrames.push(prev.dataUrl);
  }

  // --- Save ---
  const handleSave = useCallback(() => {
    commitCurrentFrame();
    // Need a tick for state to update
    setTimeout(() => {
      setFrames((currentFrames) => {
        // Also grab latest from canvas for current frame
        const latestDataUrl = canvasRef.current?.flattenToDataUrl() ?? null;
        const finalFrames = currentFrames.map((f, i) =>
          i === currentIndex ? { ...f, dataUrl: latestDataUrl } : f
        );

        onSave({
          fps,
          loop,
          frames: finalFrames.map((f, i) => ({
            order: i,
            canvasJson: f.dataUrl || "",
          })).filter((f) => f.canvasJson),
        });
        return finalFrames;
      });
    }, 0);
  }, [commitCurrentFrame, currentIndex, fps, loop, onSave]);

  const currentFrame = frames[currentIndex];

  return (
    <div className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center">
      <div ref={containerRef} className="bg-cream rounded-2xl w-full max-w-5xl max-h-[95vh] mx-4 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cream-dark/50">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-ink">パラパラアニメ</h2>
            <span className="text-[10px] text-ink-light/50">{frames.length}フレーム</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-moss hover:bg-moss-dark rounded-full transition-colors">
              <Save className="size-3" /> 保存
            </button>
            <button type="button" onClick={onClose}
              className="size-8 flex items-center justify-center text-ink-light hover:text-ink transition-colors">
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Controls bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-cream-dark/30 flex-wrap">
          {/* Play/Pause */}
          <button type="button" onClick={() => setIsPlaying((v) => !v)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
              isPlaying ? "bg-coral/15 text-coral" : "bg-moss/10 text-moss"
            }`}>
            {isPlaying ? <Pause className="size-3" /> : <Play className="size-3" />}
            {isPlaying ? "停止" : "再生"}
          </button>

          {/* FPS */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-ink-light/60">速度</span>
            <input type="range" min={1} max={24} value={fps} onChange={(e) => setFps(Number(e.target.value))}
              className="w-20 h-1 accent-moss" />
            <span className="text-[10px] text-ink-light w-8">{fps}fps</span>
          </div>

          {/* Loop */}
          <button type="button" onClick={() => setLoop((v) => !v)}
            className={`px-2 py-1 text-[10px] rounded-md transition-colors ${
              loop ? "bg-moss/10 text-moss" : "bg-cream-dark/50 text-ink-light"
            }`}>
            ループ{loop ? " ON" : " OFF"}
          </button>

          {/* Onion skin */}
          <button type="button" onClick={() => setOnionSkin((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-md transition-colors ${
              onionSkin ? "bg-purple-100 text-purple-600" : "bg-cream-dark/50 text-ink-light"
            }`}>
            <Layers className="size-3" />
            オニオンスキン
          </button>
        </div>

        {/* Canvas area */}
        <div className="flex-1 flex items-center justify-center p-4 min-h-0 overflow-auto">
          <FlipbookCanvas
            ref={canvasRef}
            frameDataUrl={currentFrame.dataUrl}
            onionSkinFrames={onionSkinFrames}
            onionSkinEnabled={onionSkin}
            disabled={isPlaying}
            scale={scale}
          />
        </div>

        {/* Frame timeline */}
        <div className="px-4 pb-3">
          <FrameTimeline
            frames={frames.map((f) => ({ id: f.id, dataUrl: f.dataUrl }))}
            currentIndex={currentIndex}
            onSelect={isPlaying ? () => {} : switchToFrame}
            onAdd={addFrame}
            onDuplicate={duplicateFrame}
            onDelete={deleteFrame}
            maxFrames={MAX_FRAMES}
          />
        </div>
      </div>
    </div>
  );
}
