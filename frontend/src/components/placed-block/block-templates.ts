// Profile-book block templates. Each block is a structured field
// card placed on the diary canvas (parallel to stamps / tape /
// media). Visual styling and interaction follow the rest of the
// SharedDiary design system.
//
// Each template can only appear once per entry — the picker disables
// already-placed types. Beyond that, blocks are free-form draggable
// items just like stamps; there is no per-page count or area cap.

export type BlockField = {
  key: string;
  label: string;
  placeholder?: string;
  /** Render as a multi-line textarea instead of a single-line input. */
  big?: boolean;
  /** Use the larger height variant (for the closing-message block). */
  tall?: boolean;
};

export type BlockTemplate = {
  /** Stable id, persisted as `entry_blocks.block_type`. */
  id: string;
  title: string;
  /** One-line description shown in the picker. */
  description: string;
  fields: BlockField[];
};

export const BLOCK_TEMPLATES: BlockTemplate[] = [
  {
    id: "basic",
    title: "きほんプロフィール",
    description: "なまえ・たんじょうび・血液型など",
    fields: [
      { key: "nickname", label: "なまえ", placeholder: "みお" },
      { key: "realname", label: "ほんみょう", placeholder: "佐藤美桜" },
      { key: "birthday", label: "たんじょうび", placeholder: "6月14日" },
      { key: "zodiac", label: "せいざ", placeholder: "ふたご座" },
      { key: "blood", label: "けつえきがた", placeholder: "A型" },
      { key: "school", label: "がっこう" },
    ],
  },
  {
    id: "food",
    title: "すきなもの・きらいなもの",
    description: "好きな・嫌いな食べ物",
    fields: [
      { key: "fav_food", label: "すきな食べ物", placeholder: "いちご、プリン" },
      { key: "hate_food", label: "きらいな食べ物", placeholder: "ピーマン..." },
    ],
  },
  {
    id: "school",
    title: "がっこう",
    description: "得意科目・習い事",
    fields: [
      { key: "fav_subj", label: "すきな科目", placeholder: "図工と音楽" },
      { key: "hate_subj", label: "きらいな科目" },
      { key: "club", label: "ぶかつ・ならいごと", placeholder: "ピアノ" },
    ],
  },
  {
    id: "fav",
    title: "すきな人のはなし",
    description: "推し・好きな人",
    fields: [
      { key: "fav_idol", label: "すきな芸能人" },
      { key: "fav_song", label: "すきな曲" },
      { key: "crush", label: "すきな人のイニシャル", placeholder: "?.?" },
    ],
  },
  {
    id: "dream",
    title: "しょうらいの夢",
    description: "将来やりたいこと",
    fields: [
      { key: "dream", label: "", placeholder: "パティシエになりたい！", big: true },
    ],
  },
  {
    id: "myboom",
    title: "MY BOOM",
    description: "いまハマっているもの",
    fields: [
      { key: "myboom", label: "", placeholder: "さいきんハマってること", big: true },
    ],
  },
  {
    id: "manual",
    title: "わたしの取扱説明書",
    description: "機嫌の取り方ガイド",
    fields: [
      { key: "manual_happy", label: "うれしいとき" },
      { key: "manual_angry", label: "おこったとき" },
      { key: "manual_sad", label: "かなしいとき" },
    ],
  },
  {
    id: "message",
    title: "ひとことメッセージ",
    description: "メッセージ",
    fields: [
      { key: "message", label: "", placeholder: "これ読んでくれた人へ", big: true, tall: true },
    ],
  },
];

export const BLOCK_TEMPLATE_BY_ID: Record<string, BlockTemplate> = Object.fromEntries(
  BLOCK_TEMPLATES.map((t) => [t.id, t])
);

export function getBlockTemplate(id: string): BlockTemplate | undefined {
  return BLOCK_TEMPLATE_BY_ID[id];
}
