"use client";

// Read-only flipbook overlay for the viewer. Positions a FlipbookPlayer
// on the 800×600 diary canvas using (x, y, base_width) in canvas-space,
// then scales to the actually-rendered canvas width. Mirrors the model
// used by MediaOverlayDisplay and EntryStampsDisplay.

import { FlipbookPlayer } from "./flipbook-player";

type Props = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  baseWidth: number;
  baseHeight: number;
  fps: number;
  loop: boolean;
  frames: { order: number; canvasJson: string }[];
  canvasWidth: number;
  displayWidth: number;
};

export function FlipbookOverlayDisplay({
  x, y, scale, rotation, baseWidth, baseHeight,
  fps, loop, frames, canvasWidth, displayWidth,
}: Props) {
  const displayScale = displayWidth / canvasWidth;
  const w = baseWidth * scale * displayScale;
  const h = baseHeight * scale * displayScale;

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        left: x * displayScale - w / 2,
        top: y * displayScale - h / 2,
        width: w,
        height: h,
        transform: `rotate(${rotation}deg)`,
      }}
    >
      <FlipbookPlayer
        frames={frames}
        fps={fps}
        loop={loop}
        width={w}
      />
    </div>
  );
}
