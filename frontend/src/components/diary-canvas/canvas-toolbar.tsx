"use client";

import { useEffect, useRef, useState } from "react";
import { PEN_COLORS, BACKGROUND_OPTIONS, type BackgroundType } from "./diary-canvas";
import { FONT_OPTIONS, type FontId, type TextAlign } from "./text-box-overlay";
import { TAPES, BUILTIN_TAPE_IDS, type TapeId } from "./tape-patterns";
import { ColorWheelPicker } from "./color-wheel-picker";

export type Tool = "select" | "pen" | "eraser" | "text" | "tape" | "highlighter" | "neon";
/** Free-form hex string. The preset swatches in `PEN_COLORS` are
 *  convenience shortcuts; the color wheel can produce any hex value. */
export type PenColor = string;
/** Which canvas a stroke tool writes to.
 *  - "below": the paper itself, under placed media (default).
 *  - "above": a foreground layer on top of media so the user can
 *    scribble over a photo. */
export type PenLayer = "below" | "above";

type Props = {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  penColor: PenColor;
  onPenColorChange: (color: PenColor) => void;
  lineWidthIndex: number;
  onLineWidthChange: (index: number) => void;
  fontSizeIndex: number;
  onFontSizeChange: (index: number) => void;
  fontFamily: FontId;
  onFontFamilyChange: (font: FontId) => void;
  textAlign: TextAlign;
  onTextAlignChange: (align: TextAlign) => void;
  tapeId: TapeId;
  onTapeIdChange: (id: TapeId) => void;
  /** Extra (group-uploaded) tape IDs to show after the built-ins. */
  extraTapeIds?: TapeId[];
  /** Opens the upload / management picker for group tapes. */
  onTapePickerClick?: () => void;
  background: BackgroundType;
  onBackgroundChange: (bg: BackgroundType) => void;
  penLayer: PenLayer;
  onPenLayerChange: (layer: PenLayer) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onStampClick?: () => void;
  stampCount?: number;
  /** Opens the profile-block picker. Like onStampClick, the picker
   *  itself lives in the parent so it can be a modal sibling of the
   *  canvas rather than nested inside the toolbar. */
  onBlockClick?: () => void;
};

const LINE_WIDTH_LABELS = ["細", "中", "太"];
const FONT_SIZE_LABELS = ["小", "中", "大"];

export function CanvasToolbar({
  tool,
  onToolChange,
  penColor,
  onPenColorChange,
  lineWidthIndex,
  onLineWidthChange,
  fontSizeIndex,
  onFontSizeChange,
  fontFamily,
  onFontFamilyChange,
  textAlign,
  onTextAlignChange,
  tapeId,
  onTapeIdChange,
  extraTapeIds = [],
  onTapePickerClick,
  background,
  onBackgroundChange,
  penLayer,
  onPenLayerChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onStampClick,
  stampCount = 0,
  onBlockClick,
}: Props) {
  const [wheelOpen, setWheelOpen] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wheelOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!wheelRef.current) return;
      if (!wheelRef.current.contains(e.target as Node)) setWheelOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [wheelOpen]);

  const isPresetColor = PEN_COLORS.some(
    (c) => c.value.toUpperCase() === penColor.toUpperCase()
  );

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3 p-3 bg-white border border-cream-dark rounded-lg">
      {/* Tools */}
      <div className="flex items-center gap-1">
        <ToolButton
          active={tool === "select"}
          onClick={() => onToolChange("select")}
          title="選択・移動"
        >
          {/* Classic arrow cursor */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            <path d="m13 13 6 6" />
          </svg>
        </ToolButton>
        <ToolButton
          active={tool === "pen"}
          onClick={() => onToolChange("pen")}
          title="ペン"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        </ToolButton>
        <ToolButton
          active={tool === "highlighter"}
          onClick={() => onToolChange("highlighter")}
          title="蛍光ペン"
        >
          {/* Chisel highlighter */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l-4 4v4h4l4-4" />
            <path d="M14 4l6 6-8 8-6-6 8-8z" />
            <path d="M5 19h14" strokeOpacity="0.5" />
          </svg>
        </ToolButton>
        <ToolButton
          active={tool === "neon"}
          onClick={() => onToolChange("neon")}
          title="ネオンペン"
        >
          {/* Pen with a sparkle — implies "glow" */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="M14 6l2 2" strokeOpacity="0.5" />
            <path d="M4 7l.8 1.6L6.4 9.4 4.8 10.2 4 11.8 3.2 10.2 1.6 9.4 3.2 8.6 4 7z" strokeOpacity="0.8" fill="currentColor" />
          </svg>
        </ToolButton>
        <ToolButton
          active={tool === "eraser"}
          onClick={() => onToolChange("eraser")}
          title="消しゴム"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
            <path d="M22 21H7" />
            <path d="m5 11 9 9" />
          </svg>
        </ToolButton>
        <ToolButton
          active={tool === "text"}
          onClick={() => onToolChange("text")}
          title="テキスト"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 7 4 4 20 4 20 7" />
            <line x1="9" y1="20" x2="15" y2="20" />
            <line x1="12" y1="4" x2="12" y2="20" />
          </svg>
        </ToolButton>
        <ToolButton
          active={tool === "tape"}
          onClick={() => onToolChange("tape")}
          title="マスキングテープ"
        >
          {/* A slanted strip of tape */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 14l8-8 10 10-8 8z" />
            <path d="M7 18l10-10" strokeOpacity="0.4" />
          </svg>
        </ToolButton>
        {onStampClick && (
          <ToolButton
            active={false}
            onClick={onStampClick}
            title="スタンプ"
          >
            <span className="relative">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
              {stampCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-moss text-cream text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                  {stampCount}
                </span>
              )}
            </span>
          </ToolButton>
        )}
        {onBlockClick && (
          <ToolButton
            active={false}
            onClick={onBlockClick}
            title="プロフィール項目"
          >
            {/* Card-with-rows — reads as "structured field block" */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="7" y1="9" x2="14" y2="9" />
              <line x1="7" y1="13" x2="17" y2="13" />
              <line x1="7" y1="17" x2="11" y2="17" />
            </svg>
          </ToolButton>
        )}
      </div>

      <Separator />

      {/* Colors */}
      <div className="flex items-center gap-1">
        {PEN_COLORS.map((color) => {
          const active = penColor.toUpperCase() === color.value.toUpperCase();
          return (
            <button
              key={color.value}
              type="button"
              onClick={() => onPenColorChange(color.value)}
              className={`w-7 h-7 rounded-full border-2 transition-transform ${
                active ? "border-moss scale-110" : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: color.value }}
              title={color.label}
            />
          );
        })}
        {/* Color-wheel trigger */}
        <div ref={wheelRef} className="relative">
          <button
            type="button"
            onClick={() => setWheelOpen((v) => !v)}
            className={`w-7 h-7 rounded-full border-2 transition-transform relative overflow-hidden ${
              !isPresetColor || wheelOpen ? "border-moss scale-110" : "border-transparent hover:scale-105"
            }`}
            title="色を自由に選ぶ"
            aria-label="色環で色を選ぶ"
            style={{
              background:
                "conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
            }}
          >
            {!isPresetColor && (
              <span
                className="absolute inset-[5px] rounded-full border border-white"
                style={{ backgroundColor: penColor }}
              />
            )}
          </button>
          {wheelOpen && (
            <div
              className="absolute z-30 mt-2 left-1/2 -translate-x-1/2 p-3 bg-white rounded-lg shadow-xl border border-cream-dark"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <ColorWheelPicker value={penColor} onChange={onPenColorChange} />
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Per-tool secondary controls */}
      {tool === "tape" ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-ink-light mr-1">テープ</span>
          {[...BUILTIN_TAPE_IDS, ...extraTapeIds].map((id) => {
            const t = TAPES[id];
            if (!t) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTapeIdChange(id)}
                className={`w-9 h-6 rounded-sm border transition-transform ${
                  tapeId === id
                    ? "border-moss scale-110 shadow-sm"
                    : "border-cream-dark hover:scale-105"
                }`}
                style={{
                  // Use the generated tile as a CSS background so the
                  // swatch matches the on-canvas appearance exactly.
                  backgroundImage: t.tile ? `url(${t.tile.toDataURL()})` : undefined,
                  backgroundColor: t.preview,
                  backgroundRepeat: "repeat",
                  backgroundSize: "auto 100%",
                }}
                title={t.label}
                aria-label={t.label}
              />
            );
          })}
          {onTapePickerClick && (
            <button
              type="button"
              onClick={onTapePickerClick}
              className="w-9 h-6 rounded-sm border border-dashed border-cream-dark text-ink-light/50 hover:border-moss/40 hover:text-moss transition-colors flex items-center justify-center"
              title="マスキングテープを追加"
              aria-label="マスキングテープを追加"
            >
              +
            </button>
          )}
        </div>
      ) : tool === "text" ? (
        <>
          <div className="flex items-center gap-1">
            <span className="text-xs text-ink-light mr-1">文字</span>
            {FONT_SIZE_LABELS.map((label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onFontSizeChange(i)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  fontSizeIndex === i
                    ? "bg-moss text-cream"
                    : "bg-cream-dark text-ink hover:bg-cream-dark/70"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <Separator />

          {/* Font family */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-ink-light mr-1">書体</span>
            {FONT_OPTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onFontFamilyChange(f.id)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  fontFamily === f.id
                    ? "bg-moss text-cream"
                    : "bg-cream-dark text-ink hover:bg-cream-dark/70"
                }`}
                style={{ fontFamily: f.css }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <Separator />

          {/* Text alignment */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onTextAlignChange("left")}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                textAlign === "left"
                  ? "bg-moss text-cream"
                  : "bg-cream-dark text-ink hover:bg-cream-dark/70"
              }`}
              title="左揃え"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onTextAlignChange("center")}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                textAlign === "center"
                  ? "bg-moss text-cream"
                  : "bg-cream-dark text-ink hover:bg-cream-dark/70"
              }`}
              title="中央揃え"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onTextAlignChange("right")}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                textAlign === "right"
                  ? "bg-moss text-cream"
                  : "bg-cream-dark text-ink hover:bg-cream-dark/70"
              }`}
              title="右揃え"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </>
      ) : tool === "pen" || tool === "eraser" || tool === "highlighter" || tool === "neon" ? (
        <>
          <div className="flex items-center gap-1">
            <span className="text-xs text-ink-light mr-1">線</span>
            {LINE_WIDTH_LABELS.map((label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onLineWidthChange(i)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  lineWidthIndex === i
                    ? "bg-moss text-cream"
                    : "bg-cream-dark text-ink hover:bg-cream-dark/70"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <Separator />

          {/* Stroke layer — paper vs. foreground.
              "紙" writes onto the paper itself, beneath placed media
              (the default behaviour). "前面" writes onto a foreground
              layer that sits on top of media so the user can scribble
              directly over a photo. */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-ink-light mr-1">面</span>
            <button
              type="button"
              onClick={() => onPenLayerChange("below")}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                penLayer === "below"
                  ? "bg-moss text-cream"
                  : "bg-cream-dark text-ink hover:bg-cream-dark/70"
              }`}
              title="紙の上に描く（写真の下）"
            >
              紙
            </button>
            <button
              type="button"
              onClick={() => onPenLayerChange("above")}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                penLayer === "above"
                  ? "bg-moss text-cream"
                  : "bg-cream-dark text-ink hover:bg-cream-dark/70"
              }`}
              title="写真の上に描く"
            >
              前面
            </button>
          </div>
        </>
      ) : (
        // Select tool — no secondary control; a hint is plenty.
        <span className="text-xs text-ink-light">タップで選択 · ドラッグで移動</span>
      )}

      <Separator />

      {/* Paper background */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-ink-light mr-1">紙</span>
        {BACKGROUND_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onBackgroundChange(opt.id)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              background === opt.id
                ? "bg-moss text-cream"
                : "bg-cream-dark text-ink hover:bg-cream-dark/70"
            }`}
            title={opt.label}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Separator />

      {/* Undo / Redo / Clear */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="px-2 py-1.5 rounded text-sm text-ink hover:bg-cream-dark transition-colors disabled:opacity-30"
          title="元に戻す"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="px-2 py-1.5 rounded text-sm text-ink hover:bg-cream-dark transition-colors disabled:opacity-30"
          title="やり直す"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 7v6h-6" />
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={!canUndo}
          className="px-2 py-1.5 rounded text-xs text-ink-light hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
          title="全消し"
        >
          全消し
        </button>
      </div>
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
        active
          ? "bg-moss text-cream"
          : "bg-cream-dark text-ink hover:bg-cream-dark/70"
      }`}
      title={title}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-6 bg-cream-dark" />;
}
