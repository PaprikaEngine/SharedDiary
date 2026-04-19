"use client";

import { LottieStamp } from "./lottie-stamp";

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
  displayWidth: number;
  displayHeight: number;
};

const STAMP_BASE_SIZE = 64;

export function StampOverlayDisplay({
  stamps,
  canvasWidth,
  displayWidth,
}: Props) {
  if (stamps.length === 0) return null;

  const displayScale = displayWidth / canvasWidth;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {stamps.map((s) => {
        const size = STAMP_BASE_SIZE * s.scale * displayScale;
        return (
          <div
            key={s.id}
            className="absolute"
            style={{
              left: s.x * displayScale - size / 2,
              top: s.y * displayScale - size / 2,
              width: size,
              height: size,
              transform: `rotate(${s.rotation}deg)`,
            }}
          >
            <LottieStamp
              url={s.stamp.url}
              thumbnailUrl={s.stamp.thumbnail_url}
              width={size}
              height={size}
            />
          </div>
        );
      })}
    </div>
  );
}
