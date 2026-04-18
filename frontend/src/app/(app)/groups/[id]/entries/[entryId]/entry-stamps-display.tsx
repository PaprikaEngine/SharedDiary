"use client";

import { useRef, useState, useEffect } from "react";
import { StampOverlayDisplay } from "@/components/stamps";

type StampData = {
  id: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  stamp: {
    url: string;
    thumbnail_url: string | null;
  };
};

type Props = {
  stamps: StampData[];
  canvasWidth: number;
  canvasHeight: number;
};

export function EntryStampsDisplay({ stamps, canvasWidth, canvasHeight }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayWidth, setDisplayWidth] = useState(0);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDisplayWidth(containerRef.current.clientWidth);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const displayHeight = displayWidth > 0
    ? (canvasHeight / canvasWidth) * displayWidth
    : 0;

  return (
    <div
      ref={containerRef}
      className="relative mb-6"
      style={{ height: displayHeight || "auto" }}
    >
      {displayWidth > 0 && (
        <StampOverlayDisplay
          stamps={stamps}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          displayWidth={displayWidth}
          displayHeight={displayHeight}
        />
      )}
    </div>
  );
}
