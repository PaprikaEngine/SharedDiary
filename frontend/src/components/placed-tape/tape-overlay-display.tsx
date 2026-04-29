"use client";

import { useEffect, useState } from "react";
import {
  TAPES,
  TAPE_ALPHA,
  loadTapeFromUrl,
  registerTape,
  type TapeId,
} from "@/components/diary-canvas/tape-patterns";

// Read-only tape data as it comes back from the database — the
// composer's PlacedTape minus the runtime-only `z` and instanceId
// fields. Group tapes carry their image_url so the viewer can lazy-
// load the tile pattern even on a fresh page load (the tape registry
// is in-memory only).
export type TapeDisplayData = {
  id: string;
  tape_id: string;
  x: number;
  y: number;
  length: number;
  rotation: number;
  /** Optional tape source — present only for group tapes that may
   *  not yet be registered in the runtime TAPES map. Builtin tapes
   *  are always registered. */
  image_url?: string | null;
};

type Props = {
  tapes: TapeDisplayData[];
  canvasWidth: number;
  /** Width of the rendered viewport in screen pixels. */
  displayWidth: number;
};

/** Forces a re-render after async tape registrations land so newly-
 *  available tile data URLs replace the colored placeholder. */
function useTapeRegistryTick(tapes: TapeDisplayData[]): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let didLoad = false;
      for (const t of tapes) {
        if (TAPES[t.tape_id]) continue;
        if (!t.image_url) continue;
        const def = await loadTapeFromUrl({
          id: t.tape_id as TapeId,
          label: t.tape_id,
          url: t.image_url,
          scope: "group",
        });
        if (def && !cancelled) {
          registerTape(def);
          didLoad = true;
        }
      }
      if (didLoad && !cancelled) setTick((n) => n + 1);
    })();
    return () => { cancelled = true; };
  }, [tapes]);

  return tick;
}

export function TapeOverlayDisplay({ tapes, canvasWidth, displayWidth }: Props) {
  // The tick is intentionally read but not directly used — its sole
  // job is to trigger a re-render once async tile loads complete so
  // `TAPES[t.tape_id]` resolves to a real pattern below.
  useTapeRegistryTick(tapes);

  if (tapes.length === 0) return null;

  const displayScale = displayWidth / canvasWidth;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {tapes.map((t) => {
        const def = TAPES[t.tape_id];
        const thickness = def?.width ?? 36;
        const tileUrl = def?.tile?.toDataURL();
        const length = t.length * displayScale;
        const thicknessPx = thickness * displayScale;
        return (
          <div
            key={t.id}
            className="absolute"
            style={{
              left: t.x * displayScale - length / 2,
              top: t.y * displayScale - thicknessPx / 2,
              width: length,
              height: thicknessPx,
              transform: `rotate(${t.rotation}deg)`,
            }}
          >
            <div
              className="w-full h-full"
              style={{
                backgroundImage: tileUrl ? `url(${tileUrl})` : undefined,
                backgroundColor: tileUrl ? undefined : (def?.preview ?? "#E5A6A6"),
                backgroundRepeat: "repeat",
                backgroundSize: "auto 100%",
                opacity: TAPE_ALPHA,
                boxShadow: "inset 0 1px 0 rgba(0,0,0,0.18), inset 0 -1px 0 rgba(0,0,0,0.18)",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
