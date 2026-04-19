// Masking-tape patterns.
//
// Built-in tapes are generated client-side as offscreen-canvas tiles
// (no asset files needed). Group-uploaded tapes are rasterised from
// the user image into the same tile shape so drawTape() can treat
// every tape the same way.

export type TapeId = string;

export type TapeDef = {
  id: TapeId;
  label: string;
  /** Tape width in canvas-space pixels. */
  width: number;
  /** Tile drawn into an offscreen canvas, used as a CSS / Canvas pattern. */
  tile: HTMLCanvasElement | null;
  /** Hex preview color shown in the picker before the tile is generated. */
  preview: string;
  /** "builtin" or "group" — used by the picker to group entries. */
  scope: "builtin" | "group";
};

const TILE_SIZE = 32;
const TAPE_WIDTH = 36;

// Soft, slightly desaturated palette so the tape reads as washi rather
// than printer paper. Cream is the negative space in the check pattern.
const COLORS = {
  cream: "#FBF6E8",
  rose: "#E5A6A6",
  mint: "#A8CDB0",
  mustard: "#E2C271",
};

function makeCanvas(size: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return c;
}

function paintNoise(ctx: CanvasRenderingContext2D, size: number) {
  // Subtle dot-noise so the tape reads as paper, not vector solid color.
  ctx.fillStyle = "rgba(0,0,0,0.04)";
  for (let i = 0; i < 22; i++) {
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = 0; i < 14; i++) {
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }
}

function drawCheckTile(color: string): HTMLCanvasElement | null {
  const c = makeCanvas(TILE_SIZE);
  if (!c) return null;
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  // Background
  ctx.fillStyle = COLORS.cream;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  // 2x2 check — top-left and bottom-right are the colored squares
  const half = TILE_SIZE / 2;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, half, half);
  ctx.fillRect(half, half, half, half);

  // Lighter overlay on the cream squares so the contrast feels softer
  ctx.fillStyle = "rgba(0,0,0,0.025)";
  ctx.fillRect(half, 0, half, half);
  ctx.fillRect(0, half, half, half);

  paintNoise(ctx, TILE_SIZE);
  return c;
}

function drawPlainTile(color: string): HTMLCanvasElement | null {
  const c = makeCanvas(TILE_SIZE);
  if (!c) return null;
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  // Faint horizontal "weave" lines so the tape isn't a flat block.
  ctx.fillStyle = "rgba(0,0,0,0.04)";
  for (let y = 4; y < TILE_SIZE; y += 8) {
    ctx.fillRect(0, y, TILE_SIZE, 1);
  }

  paintNoise(ctx, TILE_SIZE);
  return c;
}

const BUILTIN_TAPES: Record<TapeId, TapeDef> = {
  "check-rose": {
    id: "check-rose",
    label: "チェック (薔薇)",
    width: TAPE_WIDTH,
    tile: drawCheckTile(COLORS.rose),
    preview: COLORS.rose,
    scope: "builtin",
  },
  "check-mint": {
    id: "check-mint",
    label: "チェック (若葉)",
    width: TAPE_WIDTH,
    tile: drawCheckTile(COLORS.mint),
    preview: COLORS.mint,
    scope: "builtin",
  },
  "check-mustard": {
    id: "check-mustard",
    label: "チェック (山吹)",
    width: TAPE_WIDTH,
    tile: drawCheckTile(COLORS.mustard),
    preview: COLORS.mustard,
    scope: "builtin",
  },
  "plain-rose": {
    id: "plain-rose",
    label: "無地 (薔薇)",
    width: TAPE_WIDTH,
    tile: drawPlainTile(COLORS.rose),
    preview: COLORS.rose,
    scope: "builtin",
  },
  "plain-mint": {
    id: "plain-mint",
    label: "無地 (若葉)",
    width: TAPE_WIDTH,
    tile: drawPlainTile(COLORS.mint),
    preview: COLORS.mint,
    scope: "builtin",
  },
  "plain-mustard": {
    id: "plain-mustard",
    label: "無地 (山吹)",
    width: TAPE_WIDTH,
    tile: drawPlainTile(COLORS.mustard),
    preview: COLORS.mustard,
    scope: "builtin",
  },
};

// Mutable registry: built-ins always present, group-uploaded tapes are
// added at runtime once the editor loads them. drawTape() looks up
// every tape here, so registering a new tape immediately makes it
// renderable without prop drilling.
export const TAPES: Record<TapeId, TapeDef> = { ...BUILTIN_TAPES };

export const BUILTIN_TAPE_IDS: TapeId[] = Object.keys(BUILTIN_TAPES);

/** Default tape opacity — paper-tape feel without obscuring the page. */
export const TAPE_ALPHA = 0.85;

/** Hard limits on rasterised tape width so a tall portrait upload
 *  doesn't produce a 200px-wide block of tape. */
export const MIN_TAPE_WIDTH = 24;
export const MAX_TAPE_WIDTH = 64;

/**
 * Build a TapeDef from an image URL. The image is normalised to a
 * canvas tile whose height equals the chosen tape width, repeated
 * horizontally to cover the tape strip. Resolves to null on load
 * failure (caller should skip / log).
 */
export function loadTapeFromUrl(opts: {
  id: TapeId;
  label: string;
  url: string;
  scope?: "builtin" | "group";
}): Promise<TapeDef | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const naturalH = img.naturalHeight || TAPE_WIDTH;
      const naturalW = img.naturalWidth || TAPE_WIDTH;
      const width = Math.min(MAX_TAPE_WIDTH, Math.max(MIN_TAPE_WIDTH, naturalH));
      const tileW = Math.max(1, Math.round((naturalW / naturalH) * width));
      const tile = makeCanvas(Math.max(width, tileW));
      if (!tile) {
        resolve(null);
        return;
      }
      // Force tile to width × tileW (image stretched to that frame),
      // then drawImage normalises height to `width`.
      tile.width = tileW;
      tile.height = width;
      const ctx = tile.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0, tileW, width);
      resolve({
        id: opts.id,
        label: opts.label,
        width,
        tile,
        preview: "#999",
        scope: opts.scope ?? "group",
      });
    };
    img.onerror = () => resolve(null);
    img.src = opts.url;
  });
}

/** Add a TapeDef to the runtime registry. Idempotent. */
export function registerTape(def: TapeDef) {
  TAPES[def.id] = def;
}

/** Remove a TapeDef from the runtime registry. */
export function unregisterTape(id: TapeId) {
  if (BUILTIN_TAPES[id]) return; // never drop built-ins
  delete TAPES[id];
}
