"use client";

// Read-only render for the viewer — positioned image/video overlays on
// top of the diary canvas. Mirrors StampOverlayDisplay's scaling model:
// (x, y, baseWidth) are in canvas-space (800×600), we scale to the
// actually-rendered width.

type PlacedMediaRow = {
  id: string;
  type: string;                  // "image" | "video"
  url: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  base_width: number;
  width: number | null;          // natural width in px (for aspect ratio)
  height: number | null;
};

type Props = {
  media: PlacedMediaRow[];
  canvasWidth: number;
  displayWidth: number;
};

export function MediaOverlayDisplay({ media, canvasWidth, displayWidth }: Props) {
  if (media.length === 0) return null;

  const displayScale = displayWidth / canvasWidth;

  return (
    <>
      {media.map((m) => {
        const aspect =
          m.width && m.height && m.width > 0 ? m.height / m.width : 0.75;
        const w = m.base_width * m.scale * displayScale;
        const h = w * aspect;
        return (
          <div
            key={m.id}
            className="absolute pointer-events-auto"
            style={{
              left: m.x * displayScale - w / 2,
              top: m.y * displayScale - h / 2,
              width: w,
              height: h,
              transform: `rotate(${m.rotation}deg)`,
            }}
          >
            {m.type === "video" ? (
              <video
                src={m.url}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-cover rounded-sm shadow-md"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.url}
                alt=""
                className="w-full h-full object-cover rounded-sm shadow-md"
              />
            )}
          </div>
        );
      })}
    </>
  );
}
