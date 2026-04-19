"use client";

import { useRef, useState, useCallback } from "react";

type Props = {
  value: string;
  onChange: (hex: string) => void;
};

const RING_SIZE = 176;
const RING_THICKNESS = 22;
const SV_W = 176;
const SV_H = 112;

export function ColorWheelPicker({ value, onChange }: Props) {
  // HSV is tracked internally so the user doesn't lose hue information
  // when the current color becomes black/white (where hue is ambiguous
  // in a hex round-trip). When the parent hands us a new `value` that
  // doesn't match our derived hex, we resync during render — this
  // avoids the useEffect-driven setState the lint rule flags.
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const currentHex = hsvToHex(hsv[0], hsv[1], hsv[2]);
  if (currentHex.toUpperCase() !== value.toUpperCase()) {
    setHsv(hexToHsv(value));
  }

  const ringRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);

  const updateHue = useCallback((clientX: number, clientY: number) => {
    const rect = ringRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const hue = (angle + 360 + 90) % 360;
    setHsv(([, s, v]) => {
      const next: [number, number, number] = [hue, s, v];
      onChange(hsvToHex(hue, s, v));
      return next;
    });
  }, [onChange]);

  const updateSv = useCallback((clientX: number, clientY: number) => {
    const rect = svRef.current?.getBoundingClientRect();
    if (!rect) return;
    const s = clamp01((clientX - rect.left) / rect.width) * 100;
    const v = (1 - clamp01((clientY - rect.top) / rect.height)) * 100;
    setHsv(([h]) => {
      const next: [number, number, number] = [h, s, v];
      onChange(hsvToHex(h, s, v));
      return next;
    });
  }, [onChange]);

  const [h, s, v] = hsv;
  const hex = currentHex;
  const hueMarkerAngle = (h - 90) * (Math.PI / 180);
  const hueMarkerR = RING_SIZE / 2 - RING_THICKNESS / 2;
  const hueMarkerX = RING_SIZE / 2 + Math.cos(hueMarkerAngle) * hueMarkerR;
  const hueMarkerY = RING_SIZE / 2 + Math.sin(hueMarkerAngle) * hueMarkerR;
  const svMarkerX = (s / 100) * SV_W;
  const svMarkerY = (1 - v / 100) * SV_H;

  return (
    <div className="flex flex-col gap-2">
      {/* Hue ring */}
      <div
        ref={ringRef}
        className="relative touch-none select-none"
        style={{ width: RING_SIZE, height: RING_SIZE }}
        onPointerDown={(e) => {
          e.preventDefault();
          ringRef.current?.setPointerCapture(e.pointerId);
          updateHue(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          updateHue(e.clientX, e.clientY);
        }}
      >
        <div
          className="absolute inset-0 rounded-full cursor-crosshair"
          style={{
            background:
              "conic-gradient(from -90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
            WebkitMask: `radial-gradient(circle, transparent ${RING_SIZE / 2 - RING_THICKNESS}px, black ${RING_SIZE / 2 - RING_THICKNESS + 1}px)`,
            mask: `radial-gradient(circle, transparent ${RING_SIZE / 2 - RING_THICKNESS}px, black ${RING_SIZE / 2 - RING_THICKNESS + 1}px)`,
          }}
        />
        {/* Hue marker */}
        <div
          className="absolute rounded-full border-2 border-white shadow pointer-events-none"
          style={{
            width: 16,
            height: 16,
            left: hueMarkerX - 8,
            top: hueMarkerY - 8,
            backgroundColor: `hsl(${h}, 100%, 50%)`,
            boxShadow: "0 0 0 1px rgba(0,0,0,0.2)",
          }}
        />
      </div>

      {/* Saturation / value square */}
      <div
        ref={svRef}
        className="relative rounded-md overflow-hidden cursor-crosshair touch-none select-none"
        style={{
          width: SV_W,
          height: SV_H,
          background: `hsl(${h}, 100%, 50%)`,
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          svRef.current?.setPointerCapture(e.pointerId);
          updateSv(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          updateSv(e.clientX, e.clientY);
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, #fff, transparent), linear-gradient(to top, #000, transparent)",
          }}
        />
        <div
          className="absolute rounded-full border-2 border-white pointer-events-none"
          style={{
            width: 14,
            height: 14,
            left: svMarkerX - 7,
            top: svMarkerY - 7,
            backgroundColor: hex,
            boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
          }}
        />
      </div>

      {/* Hex readout */}
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded border border-cream-dark shrink-0"
          style={{ backgroundColor: hex }}
          aria-hidden
        />
        <input
          type="text"
          value={hex}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (/^#?[0-9a-fA-F]{6}$/.test(raw)) {
              const normalized = raw.startsWith("#") ? raw.toUpperCase() : `#${raw.toUpperCase()}`;
              onChange(normalized);
            }
          }}
          className="flex-1 min-w-0 px-2 py-1 text-xs font-mono border border-cream-dark rounded bg-white/60 focus:outline-none focus:border-moss"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(full.substring(0, 2), 16) || 0,
    parseInt(full.substring(2, 4), 16) || 0,
    parseInt(full.substring(4, 6), 16) || 0,
  ];
}

function hexToHsv(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((n) => n / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;
  return [h, s, v];
}

function hsvToHex(h: number, s: number, v: number): string {
  const sFrac = s / 100;
  const vFrac = v / 100;
  const c = vFrac * sFrac;
  const hh = (h % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hh < 1) [r, g, b] = [c, x, 0];
  else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x];
  else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = vFrac - c;
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
