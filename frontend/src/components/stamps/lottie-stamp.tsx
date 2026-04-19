"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { AnimationItem } from "lottie-web";

type Props = {
  url: string;
  thumbnailUrl?: string | null;
  width?: number;
  height?: number;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  onClick?: () => void;
};

export function LottieStamp({
  url,
  thumbnailUrl,
  width = 64,
  height = 64,
  loop = true,
  autoplay = true,
  className = "",
  onClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Some legacy / seeded stamps store an emoji character in `url` instead
  // of a Lottie JSON path. Detect that early and render as text — passing
  // the emoji to lottie's loader produces an unrecoverable XHR 400 and
  // an uncaught InvalidStateError.
  const isEmoji = !url.startsWith("/") && !url.startsWith("http");

  useEffect(() => {
    if (isEmoji) return;
    const container = containerRef.current;
    if (!container) return;

    let anim: AnimationItem | null = null;

    import("lottie-web/build/player/lottie_svg").then((lottie) => {
      if (!container.isConnected) return;

      anim = lottie.default.loadAnimation({
        container,
        renderer: "svg",
        loop,
        autoplay,
        path: url,
      });

      anim.addEventListener("DOMLoaded", () => setLoaded(true));
      anim.addEventListener("error", () => setError(true));
      animRef.current = anim;
    }).catch(() => setError(true));

    return () => {
      anim?.destroy();
      animRef.current = null;
    };
  }, [url, loop, autoplay, isEmoji]);

  if (isEmoji) {
    // Render the emoji centered. Use a font-size that scales with the box
    // so reaction-bar (20×20) and overlay (≥64×64) both look right.
    return (
      <div
        className={`relative inline-flex items-center justify-center ${className}`}
        style={{ width, height, fontSize: Math.floor(Math.min(width, height) * 0.85), lineHeight: 1 }}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
        aria-label="stamp"
      >
        <span style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.08))" }}>{url}</span>
      </div>
    );
  }

  // All children are absolutely positioned inside the relative parent so
  // that the loading/error overlays can sit ON TOP OF the Lottie container
  // instead of stacking next to it — previously the SVG and the "!" error
  // div rendered in normal flow and the SVG overflowed below the cell,
  // bleeding the stamp into adjacent grid cells in the picker.
  return (
    <div
      className={`relative inline-block overflow-hidden ${className}`}
      style={{ width, height }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ opacity: loaded ? 1 : 0 }}
      />
      {!loaded && !error && thumbnailUrl && (
        <Image
          src={thumbnailUrl}
          alt=""
          width={width}
          height={height}
          className="absolute inset-0"
          unoptimized
        />
      )}
      {!loaded && error && (
        <div className="absolute inset-0 flex items-center justify-center bg-cream-dark/50 rounded">
          <span className="text-xs text-ink-light">!</span>
        </div>
      )}
    </div>
  );
}
