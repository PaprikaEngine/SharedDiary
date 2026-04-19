"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LottieStamp, StampPicker } from "@/components/stamps";
import { Plus } from "lucide-react";

type ReactionData = { stamp_id: string; user_id: string; stamp: { id: string; name: string; url: string; thumbnail_url: string | null } };
type Props = { entryId: string; groupId: string; reactions: ReactionData[]; currentUserId: string | null };
type Grouped = { stampId: string; stampName: string; stampUrl: string; thumbnailUrl: string | null; count: number; reactedByMe: boolean };

export function ReactionBar({ entryId, reactions, currentUserId }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const grouped: Grouped[] = [];
  for (const r of reactions) {
    if (!r.stamp) continue;
    const ex = grouped.find((g) => g.stampId === r.stamp.id);
    if (ex) { ex.count++; if (r.user_id === currentUserId) ex.reactedByMe = true; }
    else grouped.push({ stampId: r.stamp.id, stampName: r.stamp.name, stampUrl: r.stamp.url, thumbnailUrl: r.stamp.thumbnail_url, count: 1, reactedByMe: r.user_id === currentUserId });
  }

  const toggleReaction = useCallback(async (stampId: string, reacted: boolean) => {
    if (!currentUserId || isSubmitting) return;
    setIsSubmitting(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = supabase as any;
    if (reacted) await c.from("reactions").delete().eq("entry_id", entryId).eq("user_id", currentUserId).eq("stamp_id", stampId);
    else await c.from("reactions").insert({ entry_id: entryId, user_id: currentUserId, stamp_id: stampId });
    setIsSubmitting(false);
    router.refresh();
  }, [entryId, currentUserId, isSubmitting, supabase, router]);

  const addReaction = useCallback(async (stamp: { id: string }) => {
    if (!currentUserId || isSubmitting) return;
    if (reactions.some((r) => r.stamp_id === stamp.id && r.user_id === currentUserId)) { setShowPicker(false); return; }
    setIsSubmitting(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("reactions").insert({ entry_id: entryId, user_id: currentUserId, stamp_id: stamp.id });
    setIsSubmitting(false);
    setShowPicker(false);
    router.refresh();
  }, [entryId, currentUserId, isSubmitting, reactions, supabase, router]);

  if (!currentUserId) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {grouped.map((g) => (
          <button key={g.stampId} type="button" onClick={() => toggleReaction(g.stampId, g.reactedByMe)} disabled={isSubmitting}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${g.reactedByMe ? "bg-moss/10 border border-moss/30 text-moss" : "bg-cream-dark/40 border border-transparent text-ink-light hover:border-cream-dark"}`}
            title={g.stampName}
          >
            <LottieStamp url={g.stampUrl} thumbnailUrl={g.thumbnailUrl} width={20} height={20} />
            <span>{g.count}</span>
          </button>
        ))}
        <button type="button" onClick={() => setShowPicker((v) => !v)}
          className="size-7 rounded-full border border-dashed border-cream-dark flex items-center justify-center text-ink-light/40 hover:border-moss/40 hover:text-moss transition-colors"
          title="リアクション"
        >
          <Plus className="size-3" />
        </button>
      </div>
      {showPicker && (
        <div className="mt-3">
          <StampPicker compact onSelect={addReaction} onClose={() => setShowPicker(false)} />
        </div>
      )}
    </div>
  );
}
