"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LottieStamp } from "./lottie-stamp";

type Stamp = {
  id: string;
  name: string;
  type: string;
  url: string;
  thumbnail_url: string | null;
};

type Props = {
  groupId?: string;
  onSelect: (stamp: Stamp) => void;
  onClose: () => void;
  compact?: boolean;
};

export function StampPicker({ groupId, onSelect, onClose, compact = false }: Props) {
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      // Fetch builtin stamps
      const { data: builtinData } = await supabase
        .from("stamps")
        .select("id, name, type, url, thumbnail_url")
        .eq("scope", "builtin")
        .order("name");

      const all: Stamp[] = (builtinData as Stamp[] | null) ?? [];

      // Fetch group stamps if groupId provided
      if (groupId) {
        const { data: groupData } = await supabase
          .from("stamps")
          .select("id, name, type, url, thumbnail_url")
          .eq("scope", "group")
          .eq("group_id", groupId)
          .order("name");

        if (groupData) {
          all.push(...(groupData as Stamp[]));
        }
      }

      setStamps(all);
      setLoading(false);
    };

    load();
  }, [groupId, supabase]);

  const stampSize = compact ? 48 : 56;

  return (
    <div className={`bg-white border border-cream-dark rounded-xl shadow-lg ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-medium text-ink ${compact ? "text-sm" : "text-base"}`}>
          スタンプ
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-ink-light hover:text-ink text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-ink-light py-4 text-center">読み込み中...</p>
      ) : stamps.length === 0 ? (
        <p className="text-sm text-ink-light py-4 text-center">スタンプがありません</p>
      ) : (
        <div className={`grid gap-2 ${compact ? "grid-cols-5" : "grid-cols-5 sm:grid-cols-6"}`}>
          {stamps.map((stamp) => (
            <button
              key={stamp.id}
              type="button"
              onClick={() => onSelect(stamp)}
              className="flex flex-col items-center gap-1 p-1 rounded-lg hover:bg-cream-dark/50 transition-colors"
              title={stamp.name}
            >
              <LottieStamp
                url={stamp.url}
                thumbnailUrl={stamp.thumbnail_url}
                width={stampSize}
                height={stampSize}
              />
              {!compact && (
                <span className="text-xs text-ink-light truncate w-full text-center">
                  {stamp.name}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
