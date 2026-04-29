"use client";

import { useRef, useState, useEffect } from "react";
import { BlockOverlayDisplay, type BlockDisplayData } from "@/components/placed-block";

type Props = {
  blocks: BlockDisplayData[];
  canvasWidth: number;
  canvasHeight: number;
};

// Mirrors EntryTapesDisplay — wraps the placement-aware
// BlockOverlayDisplay in a sized container so it knows the rendered
// canvas width to scale against.
export function EntryBlocksDisplay({ blocks, canvasWidth, canvasHeight }: Props) {
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
        <BlockOverlayDisplay
          blocks={blocks}
          canvasWidth={canvasWidth}
          displayWidth={displayWidth}
        />
      )}
    </div>
  );
}
