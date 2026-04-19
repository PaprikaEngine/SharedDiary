"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Download, Loader2 } from "lucide-react";

type Props = {
  groupId: string;
  groupName: string;
};

export function ExportPdfButton({ groupId, groupName }: Props) {
  const [exporting, setExporting] = useState(false);
  const supabase = createClient();

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      // Dynamic import to avoid SSR issues
      const { jsPDF } = await import("jspdf");

      // Fetch all entries for this group
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: entries } = await (supabase as any)
        .from("entries")
        .select("id, body, created_at, author:users(name), media:entry_media(type, url, order)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true });

      if (!entries || entries.length === 0) {
        setExporting(false);
        return;
      }

      type Entry = {
        id: string;
        body: string | null;
        created_at: string;
        author: { name: string } | null;
        media: { type: string; url: string; order: number }[] | null;
      };

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentW = pageW - margin * 2;
      let y = margin;

      // Title page
      doc.setFontSize(24);
      doc.setTextColor(93, 122, 94); // moss
      doc.text(groupName, pageW / 2, 80, { align: "center" });
      doc.setFontSize(12);
      doc.setTextColor(90, 90, 90);
      doc.text("交換日記", pageW / 2, 95, { align: "center" });
      const firstDate = new Date((entries as Entry[])[0].created_at).toLocaleDateString("ja-JP");
      const lastDate = new Date((entries as Entry[])[(entries as Entry[]).length - 1].created_at).toLocaleDateString("ja-JP");
      doc.setFontSize(10);
      doc.text(`${firstDate} 〜 ${lastDate}`, pageW / 2, 110, { align: "center" });
      doc.text(`${(entries as Entry[]).length}ページ`, pageW / 2, 118, { align: "center" });

      // Entries
      for (const entry of entries as Entry[]) {
        doc.addPage();
        y = margin;

        // Date and author
        const date = new Date(entry.created_at).toLocaleDateString("ja-JP", {
          year: "numeric", month: "long", day: "numeric", weekday: "short",
        });
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text(date, margin, y);
        y += 6;

        doc.setFontSize(12);
        doc.setTextColor(44, 44, 44);
        doc.text(entry.author?.name ?? "不明", margin, y);
        y += 10;

        // Red margin line (decorative)
        doc.setDrawColor(232, 160, 160);
        doc.setLineWidth(0.3);
        doc.line(margin + 8, margin - 5, margin + 8, doc.internal.pageSize.getHeight() - margin);

        // Body text
        if (entry.body) {
          doc.setFontSize(11);
          doc.setTextColor(44, 44, 44);
          const lines = doc.splitTextToSize(entry.body, contentW - 12);
          const lineHeight = 6;
          for (const line of lines) {
            if (y > doc.internal.pageSize.getHeight() - margin) {
              doc.addPage();
              y = margin;
            }
            doc.text(line, margin + 12, y);
            y += lineHeight;
          }
        }

        // Media — embed images
        const images = (entry.media ?? [])
          .filter((m) => m.type === "image")
          .sort((a, b) => a.order - b.order);

        for (const media of images) {
          try {
            const response = await fetch(media.url);
            const blob = await response.blob();
            const dataUrl = await blobToDataUrl(blob);

            const imgW = contentW - 12;
            const imgH = imgW * 0.6; // approximate aspect ratio

            if (y + imgH > doc.internal.pageSize.getHeight() - margin) {
              doc.addPage();
              y = margin;
            }

            doc.addImage(dataUrl, "PNG", margin + 12, y, imgW, imgH);
            y += imgH + 5;
          } catch {
            // Skip images that fail to load
          }
        }

        // Note for videos
        const videoCount = (entry.media ?? []).filter((m) => m.type === "video").length;
        if (videoCount > 0) {
          doc.setFontSize(9);
          doc.setTextColor(150, 150, 150);
          doc.text(`[動画 ${videoCount}件 — PDFでは表示できません]`, margin + 12, y + 5);
          y += 10;
        }
      }

      // Save
      const filename = `${groupName.replace(/[/\\?%*:|"<>]/g, "_")}_交換日記.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [groupId, groupName, supabase]);

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-ink-light hover:text-moss border border-cream-dark rounded-full transition-colors disabled:opacity-50"
    >
      {exporting ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
      {exporting ? "書き出し中..." : "PDF書き出し"}
    </button>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
