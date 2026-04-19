"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";
import { CANVAS_W, CANVAS_H } from "./drawing-utils";

type Props = {
  frames: { order: number; canvasJson: string }[];
  fps: number;
  loop: boolean;
  width?: number;
  autoPlay?: boolean;
};

export function FlipbookPlayer({ frames, fps, loop, width, autoPlay = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentIndex, setCurrentIndex] = useState(0);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const [loaded, setLoaded] = useState(false);

  const sorted = frames.sort((a, b) => a.order - b.order);
  const displayW = width ?? CANVAS_W;
  const displayH = (displayW / CANVAS_W) * CANVAS_H;

  // Preload all frame images
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const images = await Promise.all(
        sorted.map((f) =>
          new Promise<HTMLImageElement>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(img); // still resolve to avoid blocking
            img.src = f.canvasJson;
          }),
        ),
      );
      if (!cancelled) {
        imagesRef.current = images;
        setLoaded(true);
      }
    };
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames]);

  // Draw current frame
  const drawFrame = useCallback((index: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !imagesRef.current[index]) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.drawImage(imagesRef.current[index], 0, 0);
  }, []);

  // Draw initial frame
  useEffect(() => {
    if (loaded) drawFrame(currentIndex);
  }, [loaded, currentIndex, drawFrame]);

  // Playback
  useEffect(() => {
    if (!isPlaying || !loaded || sorted.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= sorted.length) {
          if (loop) return 0;
          setIsPlaying(false);
          return prev;
        }
        return next;
      });
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [isPlaying, loaded, fps, loop, sorted.length]);

  if (sorted.length === 0) return null;

  return (
    <div className="relative group inline-block">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="rounded-lg"
        style={{ width: displayW, height: displayH }}
      />
      {/* Play/Pause overlay */}
      <button
        type="button"
        onClick={() => {
          if (!isPlaying && currentIndex >= sorted.length - 1 && !loop) {
            setCurrentIndex(0);
          }
          setIsPlaying((v) => !v);
        }}
        className="absolute inset-0 flex items-center justify-center bg-ink/0 group-hover:bg-ink/10 transition-colors rounded-lg"
      >
        <div className={`size-10 rounded-full bg-cream/80 shadow flex items-center justify-center transition-opacity ${
          isPlaying ? "opacity-0 group-hover:opacity-80" : "opacity-80"
        }`}>
          {isPlaying ? <Pause className="size-4 text-ink" /> : <Play className="size-4 text-ink ml-0.5" />}
        </div>
      </button>
      {/* Frame counter */}
      <span className="absolute bottom-1 right-2 text-[10px] text-ink-light/40 bg-cream/60 px-1 rounded">
        {currentIndex + 1}/{sorted.length}
      </span>
    </div>
  );
}
