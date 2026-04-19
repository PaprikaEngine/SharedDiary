// Default masking-tape patterns.
//
// Each tape is rendered by repeating a small offscreen tile via
// CanvasPattern. We generate the tiles at module load (once per browser
// session) so that the editor and exporter share the exact same image —
// no asset files needed for the built-in 6.
//
// Phase 2 will let groups upload custom tape images; that flow plugs in
// here by appending entries to TAPES with a real <img> as the source.

export type TapeId =
  | "check-rose"
  | "check-mint"
  | "check-mustard"
  | "plain-rose"
  | "plain-mint"
  | "plain-mustard";

export type TapeDef = {
  id: TapeId;
  label: string;
  /** Tape width in canvas-space pixels. */
  width: number;
  /** Tile drawn into an offscreen canvas, used as a CSS / Canvas pattern. */
  tile: HTMLCanvasElement | null;
  /** Hex preview color shown in the picker before the tile is generated. */
  preview: string;
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

export const TAPES: Record<TapeId, TapeDef> = {
  "check-rose": {
    id: "check-rose",
    label: "チェック (薔薇)",
    width: TAPE_WIDTH,
    tile: drawCheckTile(COLORS.rose),
    preview: COLORS.rose,
  },
  "check-mint": {
    id: "check-mint",
    label: "チェック (若葉)",
    width: TAPE_WIDTH,
    tile: drawCheckTile(COLORS.mint),
    preview: COLORS.mint,
  },
  "check-mustard": {
    id: "check-mustard",
    label: "チェック (山吹)",
    width: TAPE_WIDTH,
    tile: drawCheckTile(COLORS.mustard),
    preview: COLORS.mustard,
  },
  "plain-rose": {
    id: "plain-rose",
    label: "無地 (薔薇)",
    width: TAPE_WIDTH,
    tile: drawPlainTile(COLORS.rose),
    preview: COLORS.rose,
  },
  "plain-mint": {
    id: "plain-mint",
    label: "無地 (若葉)",
    width: TAPE_WIDTH,
    tile: drawPlainTile(COLORS.mint),
    preview: COLORS.mint,
  },
  "plain-mustard": {
    id: "plain-mustard",
    label: "無地 (山吹)",
    width: TAPE_WIDTH,
    tile: drawPlainTile(COLORS.mustard),
    preview: COLORS.mustard,
  },
};

export const TAPE_IDS: TapeId[] = [
  "check-rose",
  "check-mint",
  "check-mustard",
  "plain-rose",
  "plain-mint",
  "plain-mustard",
];

/** Default tape opacity — paper-tape feel without obscuring the page. */
export const TAPE_ALPHA = 0.85;
