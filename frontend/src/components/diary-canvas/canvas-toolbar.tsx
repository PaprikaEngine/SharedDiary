"use client";

import { PEN_COLORS } from "./diary-canvas";

export type Tool = "pen" | "eraser" | "text";
export type PenColor = "black" | "blue" | "red" | "green" | "orange" | "purple";

type Props = {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  penColor: PenColor;
  onPenColorChange: (color: PenColor) => void;
  lineWidthIndex: number;
  onLineWidthChange: (index: number) => void;
  fontSizeIndex: number;
  onFontSizeChange: (index: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
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
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3 p-3 bg-white border border-cream-dark rounded-lg">
      {/* Tools */}
      <div className="flex items-center gap-1">
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
      </div>

      <Separator />

      {/* Colors */}
      <div className="flex items-center gap-1">
        {PEN_COLORS.map((color) => (
          <button
            key={color.id}
            type="button"
            onClick={() => onPenColorChange(color.id)}
            className={`w-7 h-7 rounded-full border-2 transition-transform ${
              penColor === color.id
                ? "border-moss scale-110"
                : "border-transparent hover:scale-105"
            }`}
            style={{ backgroundColor: color.value }}
            title={color.label}
          />
        ))}
      </div>

      <Separator />

      {/* Line width (pen/eraser) or font size (text) */}
      {tool === "text" ? (
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
      ) : (
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
      )}

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
