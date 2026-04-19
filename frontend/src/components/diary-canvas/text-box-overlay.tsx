"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export type TextAlign = "left" | "center" | "right";
export type FontId = "serif" | "maru" | "handwriting";

export type TextBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
  fontSize: number;
  fontFamily: FontId;
  align: TextAlign;
  rotation: number; // degrees
};

export const FONT_OPTIONS: { id: FontId; label: string; css: string; canvasFont: string }[] = [
  { id: "serif", label: "明朝", css: "var(--font-noto-serif-jp), serif", canvasFont: '"Noto Serif JP", serif' },
  { id: "maru", label: "丸ゴ", css: "var(--font-zen-maru-gothic), sans-serif", canvasFont: '"Zen Maru Gothic", sans-serif' },
  { id: "handwriting", label: "手書き", css: "var(--font-yomogi), cursive", canvasFont: '"Yomogi", cursive' },
];

type Props = {
  textBoxes: TextBox[];
  onTextBoxesChange: (boxes: TextBox[]) => void;
  canvasScale: number;
  canvasWidth: number;
  canvasHeight: number;
  activeToolIsText: boolean;
  penColor: string;
  fontSize: number;
  fontFamily: FontId;
  align: TextAlign;
  onTextBoxCreated: () => void;
};

type Mode = "idle" | "selected" | "editing";

export function TextBoxOverlay({
  textBoxes,
  onTextBoxesChange,
  canvasScale,
  canvasWidth,
  canvasHeight,
  activeToolIsText,
  penColor,
  fontSize,
  fontFamily,
  align,
  onTextBoxCreated,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Drag state
  const dragRef = useRef<{
    type: "move" | "resize";
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (editingId && textareaRef.current) {
      textareaRef.current.focus();
      // Place cursor at end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editingId]);

  // Keyboard handler for delete
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (selectedId && !editingId && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        onTextBoxesChange(textBoxes.filter((b) => b.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, editingId, textBoxes, onTextBoxesChange]);

  const updateBox = useCallback(
    (id: string, updates: Partial<TextBox>) => {
      onTextBoxesChange(
        textBoxes.map((b) => (b.id === id ? { ...b, ...updates } : b))
      );
    },
    [textBoxes, onTextBoxesChange]
  );

  const commitEditing = useCallback(() => {
    if (!editingId) return;
    const box = textBoxes.find((b) => b.id === editingId);
    if (box && !box.text.trim()) {
      // Remove empty text box
      onTextBoxesChange(textBoxes.filter((b) => b.id !== editingId));
      setSelectedId(null);
    }
    setEditingId(null);
  }, [editingId, textBoxes, onTextBoxesChange]);

  // Click on canvas empty space — create new text box or deselect
  const handleBackgroundPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only handle direct clicks on the overlay background
      if (e.target !== e.currentTarget) return;

      if (editingId) {
        commitEditing();
      }

      if (activeToolIsText) {
        // Create new text box at click position
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / canvasScale;
        const y = (e.clientY - rect.top) / canvasScale;
        const w = Math.min(320, canvasWidth - x - 8);
        const newBox: TextBox = {
          id: crypto.randomUUID(),
          x,
          y,
          w: Math.max(160, w),
          h: fontSize * 1.5 * 3 + 16,
          text: "",
          color: penColor,
          fontSize,
          fontFamily,
          align,
          rotation: 0,
        };
        onTextBoxesChange([...textBoxes, newBox]);
        setSelectedId(newBox.id);
        setEditingId(newBox.id);
        onTextBoxCreated();
      } else {
        setSelectedId(null);
      }
    },
    [
      activeToolIsText,
      editingId,
      commitEditing,
      canvasScale,
      canvasWidth,
      penColor,
      fontSize,
      fontFamily,
      align,
      textBoxes,
      onTextBoxesChange,
      onTextBoxCreated,
    ]
  );

  const getMode = (id: string): Mode => {
    if (editingId === id) return "editing";
    if (selectedId === id) return "selected";
    return "idle";
  };

  // --- Move / Resize pointer handlers ---
  const startDrag = (
    e: React.PointerEvent,
    box: TextBox,
    type: "move" | "resize"
  ) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      origX: box.x,
      origY: box.y,
      origW: box.w,
      origH: box.h,
    };
  };

  const handleDragMove = (e: React.PointerEvent, box: TextBox) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const dx = (e.clientX - dragRef.current.startX) / canvasScale;
    const dy = (e.clientY - dragRef.current.startY) / canvasScale;

    if (dragRef.current.type === "move") {
      updateBox(box.id, {
        x: Math.max(0, Math.min(canvasWidth - box.w, dragRef.current.origX + dx)),
        y: Math.max(0, Math.min(canvasHeight - 40, dragRef.current.origY + dy)),
      });
    } else {
      // resize
      updateBox(box.id, {
        w: Math.max(80, dragRef.current.origW + dx),
        h: Math.max(fontSize * 1.5 + 16, dragRef.current.origH + dy),
      });
    }
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <div
      className="absolute inset-0"
      style={{
        zIndex: 15,
        pointerEvents: activeToolIsText || selectedId ? "auto" : "none",
      }}
      onPointerDown={handleBackgroundPointerDown}
    >
      {textBoxes.map((box) => {
        const mode = getMode(box.id);
        const sx = box.x * canvasScale;
        const sy = box.y * canvasScale;
        const sw = box.w * canvasScale;
        const sh = box.h * canvasScale;
        const scaledFontSize = box.fontSize * canvasScale;
        const fontCss = FONT_OPTIONS.find((f) => f.id === box.fontFamily)?.css ?? FONT_OPTIONS[0].css;

        return (
          <div
            key={box.id}
            className="absolute"
            style={{
              left: sx,
              top: sy,
              width: sw,
              minHeight: sh,
              pointerEvents: "auto",
              transform: box.rotation ? `rotate(${box.rotation}deg)` : undefined,
              transformOrigin: "center center",
            }}
          >
            {/* Selection border */}
            {mode === "selected" && (
              <div className="absolute inset-0 border-2 border-moss rounded pointer-events-none" />
            )}

            {mode === "editing" ? (
              /* --- Editing mode --- */
              <div>
                {/* Toolbar: drag handle row + controls row */}
                <div className="bg-moss text-cream rounded-t select-none text-[11px]">
                  {/* Row 1: Drag handle + actions */}
                  <div
                    className="flex items-center justify-between px-2 py-1 cursor-move border-b border-cream/15"
                    onPointerDown={(e) => startDrag(e, box, "move")}
                    onPointerMove={(e) => handleDragMove(e, box)}
                    onPointerUp={endDrag}
                    onPointerLeave={endDrag}
                  >
                    <span className="text-cream/70 text-[10px]">⠿ ドラッグで移動</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        className="hover:text-cream/70 px-1"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTextBoxesChange(textBoxes.filter((b) => b.id !== box.id));
                          setEditingId(null);
                          setSelectedId(null);
                        }}
                        title="削除"
                      >
                        &times;
                      </button>
                      <button
                        type="button"
                        className="hover:text-cream/70 px-1"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          commitEditing();
                        }}
                        title="確定"
                      >
                        &#x2713;
                      </button>
                    </div>
                  </div>
                  {/* Row 2: Font / Align / Rotate */}
                  <div className="flex items-center gap-0.5 px-2 py-1">
                    {/* Font selector */}
                    {FONT_OPTIONS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={`px-1.5 py-0.5 rounded transition-colors ${box.fontFamily === f.id ? "bg-cream/20 font-bold" : "hover:bg-cream/10"}`}
                        onClick={(e) => { e.stopPropagation(); updateBox(box.id, { fontFamily: f.id }); }}
                        title={f.label}
                      >
                        {f.label}
                      </button>
                    ))}
                    <span className="w-px h-3 bg-cream/20 mx-1" />
                    {/* Alignment */}
                    {(["left", "center", "right"] as TextAlign[]).map((a) => (
                      <button
                        key={a}
                        type="button"
                        className={`p-1 rounded transition-colors ${box.align === a ? "bg-cream/20" : "hover:bg-cream/10"}`}
                        onClick={(e) => { e.stopPropagation(); updateBox(box.id, { align: a }); }}
                        title={a === "left" ? "左揃え" : a === "center" ? "中央揃え" : "右揃え"}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          {a === "left" ? (
                            <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" /></>
                          ) : a === "center" ? (
                            <><line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></>
                          ) : (
                            <><line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" /></>
                          )}
                        </svg>
                      </button>
                    ))}
                    <span className="w-px h-3 bg-cream/20 mx-1" />
                    {/* Rotation */}
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-cream/10 transition-colors"
                      onClick={(e) => { e.stopPropagation(); updateBox(box.id, { rotation: (box.rotation - 15 + 360) % 360 }); }}
                      title="左に回転"
                    >
                      ↺
                    </button>
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-cream/10 transition-colors"
                      onClick={(e) => { e.stopPropagation(); updateBox(box.id, { rotation: (box.rotation + 15) % 360 }); }}
                      title="右に回転"
                    >
                      ↻
                    </button>
                    {box.rotation !== 0 && (
                      <span className="text-cream/50 text-[9px] ml-0.5">{box.rotation}°</span>
                    )}
                  </div>
                </div>
                {/* Textarea */}
                <textarea
                  ref={editingId === box.id ? textareaRef : undefined}
                  value={box.text}
                  onChange={(e) => updateBox(box.id, { text: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      commitEditing();
                    }
                    e.stopPropagation();
                  }}
                  className="block w-full outline-none border-x-2 border-b-2 border-moss/60 rounded-b bg-white/90 p-2"
                  style={{
                    fontSize: scaledFontSize,
                    lineHeight: 1.5,
                    color: box.color,
                    fontFamily: fontCss,
                    textAlign: box.align,
                    minHeight: sh,
                    resize: "none",
                  }}
                  placeholder="ここにテキストを入力..."
                />
                {/* Resize handle */}
                <div
                  className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
                  onPointerDown={(e) => startDrag(e, box, "resize")}
                  onPointerMove={(e) => handleDragMove(e, box)}
                  onPointerUp={endDrag}
                  onPointerLeave={endDrag}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" className="text-moss/60">
                    <path d="M10 2L2 10M10 6L6 10" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  </svg>
                </div>
              </div>
            ) : mode === "selected" ? (
              /* --- Selected mode --- */
              <div>
                {/* Move handle (top bar) */}
                <div
                  className="absolute -top-5 left-0 right-0 h-5 flex items-center justify-between px-1 bg-moss/80 text-cream text-[10px] rounded-t cursor-move select-none"
                  onPointerDown={(e) => startDrag(e, box, "move")}
                  onPointerMove={(e) => handleDragMove(e, box)}
                  onPointerUp={endDrag}
                  onPointerLeave={endDrag}
                >
                  <div className="flex items-center gap-1 truncate">
                    <span className="truncate">{box.text.split("\n")[0] || "テキスト"}</span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      className="hover:text-cream/70 px-0.5"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateBox(box.id, { rotation: (box.rotation - 15 + 360) % 360 });
                      }}
                      title="左に回転"
                    >
                      ↺
                    </button>
                    <button
                      type="button"
                      className="hover:text-cream/70 px-0.5"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateBox(box.id, { rotation: (box.rotation + 15) % 360 });
                      }}
                      title="右に回転"
                    >
                      ↻
                    </button>
                    <button
                      type="button"
                      className="hover:text-cream/70 px-1 shrink-0"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTextBoxesChange(textBoxes.filter((b) => b.id !== box.id));
                        setSelectedId(null);
                      }}
                      title="削除"
                    >
                      &times;
                    </button>
                  </div>
                </div>
                {/* Text display (click to select, double-click to edit) */}
                <div
                  className="p-2 cursor-pointer select-none"
                  style={{
                    fontSize: scaledFontSize,
                    lineHeight: 1.5,
                    color: box.color,
                    fontFamily: fontCss,
                    textAlign: box.align,
                    minHeight: sh,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingId(box.id);
                  }}
                >
                  {box.text || <span className="text-ink-light/40 italic">ダブルクリックで編集</span>}
                </div>
                {/* Resize handle */}
                <div
                  className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize flex items-end justify-end p-0.5"
                  onPointerDown={(e) => startDrag(e, box, "resize")}
                  onPointerMove={(e) => handleDragMove(e, box)}
                  onPointerUp={endDrag}
                  onPointerLeave={endDrag}
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" className="text-moss">
                    <path d="M10 2L2 10M10 6L6 10" stroke="currentColor" strokeWidth="2" fill="none" />
                  </svg>
                </div>
              </div>
            ) : (
              /* --- Idle mode --- */
              <div
                className="p-2 cursor-pointer rounded hover:outline hover:outline-1 hover:outline-moss/30"
                style={{
                  fontSize: scaledFontSize,
                  lineHeight: 1.5,
                  color: box.color,
                  fontFamily: fontCss,
                  textAlign: box.align,
                  minHeight: sh,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(box.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(box.id);
                  setEditingId(box.id);
                }}
              >
                {box.text}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
