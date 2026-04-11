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

  useEffect(() => {
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
  }, [url, loop, autoplay]);

  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width, height }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
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
      {error && (
        <div
          className="flex items-center justify-center bg-cream-dark/50 rounded"
          style={{ width, height }}
        >
          <span className="text-xs text-ink-light">!</span>
        </div>
      )}
      <div
        ref={containerRef}
        style={{ width, height, opacity: loaded ? 1 : 0 }}
      />
    </div>
  );
}
