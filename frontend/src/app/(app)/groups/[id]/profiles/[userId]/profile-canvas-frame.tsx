"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { CanvasBackground } from "@/components/diary-canvas";
import { MediaOverlayDisplay } from "@/components/placed-media";
import { TapeOverlayDisplay } from "@/components/placed-tape";
import { BlockOverlayDisplay } from "@/components/placed-block";
import { FlipbookOverlayDisplay } from "@/components/flipbook";
import { EntryStampsDisplay } from "../../entries/[entryId]/entry-stamps-display";

// Mirrors page-viewer.tsx's hasCanvasBox layer stack but pared down to
// just rendering — no diary-specific UI like delete buttons, reactions,
// or baton status. The canvas needs to know its rendered pixel width
// so the overlay components can scale 800-space coordinates correctly,
// hence the ResizeObserver here.

type MediaItem = {
  id: string;
  type: string;
  url: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  base_width: number;
  width: number | null;
  height: number | null;
};

type StampItem = {
  id: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  stamp: { url: string; thumbnail_url: string | null };
};

type TapeItem = {
  id: string;
  tape_id: string;
  x: number;
  y: number;
  length: number;
  rotation: number;
  image_url: string | null;
};

type BlockItem = {
  id: string;
  block_type: string;
  x: number;
  y: number;
  width: number;
  rotation: number;
  data: Record<string, string>;
};

type FlipbookItem = {
  fps: number;
  loop: boolean;
  x: number | null;
  y: number | null;
  scale: number | null;
  rotation: number | null;
  base_width: number | null;
  base_height: number | null;
  frames: { order: number; canvasJson: string }[];
};

type Props = {
  canvasBackground: "ruled" | "plain" | "grid" | null;
  canvasWidth: number;
  canvasHeight: number;
  canvasImageUrl: string | null;
  placedMedia: MediaItem[];
  stamps: StampItem[];
  tapes: TapeItem[];
  blocks: BlockItem[];
  flipbook: FlipbookItem | null;
};

export function ProfileCanvasFrame({
  canvasBackground,
  canvasWidth,
  canvasHeight,
  canvasImageUrl,
  placedMedia,
  stamps,
  tapes,
  blocks,
  flipbook,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [displayWidth, setDisplayWidth] = useState(canvasWidth);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setDisplayWidth(el.clientWidth || canvasWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [canvasWidth]);

  const aspectRatio = `${canvasWidth} / ${canvasHeight}`;
  const flipbookPlaced = flipbook != null
    && flipbook.frames.length > 0
    && flipbook.x != null
    && flipbook.y != null
    && flipbook.base_width != null
    && flipbook.base_height != null;

  return (
    <div
      ref={boxRef}
      className="relative w-full max-w-[800px] mx-auto rounded-lg overflow-hidden border border-cream-dark/40"
      style={{ aspectRatio }}
    >
      <CanvasBackground
        type={canvasBackground ?? "ruled"}
        width={canvasWidth}
        height={canvasHeight}
        className="absolute inset-0 w-full h-full"
      />
      {canvasImageUrl && (
        <Image
          src={canvasImageUrl}
          alt=""
          fill
          className="object-contain"
          sizes="(max-width: 800px) 100vw, 800px"
        />
      )}
      {placedMedia.length > 0 && (
        <div className="absolute inset-0">
          <MediaOverlayDisplay
            media={placedMedia}
            canvasWidth={canvasWidth}
            displayWidth={displayWidth}
          />
        </div>
      )}
      {flipbookPlaced && flipbook && (
        <div className="absolute inset-0">
          <FlipbookOverlayDisplay
            x={flipbook.x as number}
            y={flipbook.y as number}
            scale={flipbook.scale ?? 1}
            rotation={flipbook.rotation ?? 0}
            baseWidth={flipbook.base_width as number}
            baseHeight={flipbook.base_height as number}
            fps={flipbook.fps}
            loop={flipbook.loop}
            frames={flipbook.frames}
            canvasWidth={canvasWidth}
            displayWidth={displayWidth}
          />
        </div>
      )}
      {blocks.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          <BlockOverlayDisplay
            blocks={blocks}
            canvasWidth={canvasWidth}
            displayWidth={displayWidth}
          />
        </div>
      )}
      {stamps.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          <EntryStampsDisplay
            stamps={stamps}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
          />
        </div>
      )}
      {tapes.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          <TapeOverlayDisplay
            tapes={tapes}
            canvasWidth={canvasWidth}
            displayWidth={displayWidth}
          />
        </div>
      )}
    </div>
  );
}
