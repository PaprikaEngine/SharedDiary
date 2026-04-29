// Profile-book block templates. Each block is a structured field
// card placed on the diary canvas (parallel to stamps / tape /
// media). The Heisei-prototype concept of a unit-budget is the only
// thing imported from the prototype — visual styling and interaction
// follow the rest of the SharedDiary design system.
//
// `units` is an approximate vertical occupancy in 30 px increments.
// `PAGE_UNIT_BUDGET` is the hard cap enforced by BlockPicker so the
// page doesn't get visually overstuffed.

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
  /** Vertical occupancy in unit-budget terms (1 unit ≈ 30 px). */
  units: number;
  fields: BlockField[];
};

export const PAGE_UNIT_BUDGET = 18;

export const BLOCK_TEMPLATES: BlockTemplate[] = [
  {
    id: "basic",
    title: "きほんプロフィール",
    description: "なまえ・たんじょうび・血液型など",
    units: 9,
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
    units: 4,
    fields: [
      { key: "fav_food", label: "すきな食べ物", placeholder: "いちご、プリン" },
      { key: "hate_food", label: "きらいな食べ物", placeholder: "ピーマン..." },
    ],
  },
  {
    id: "school",
    title: "がっこう",
    description: "得意科目・習い事",
    units: 5,
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
    units: 5,
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
    units: 4,
    fields: [
      { key: "dream", label: "", placeholder: "パティシエになりたい！", big: true },
    ],
  },
  {
    id: "myboom",
    title: "MY BOOM",
    description: "いまハマっているもの",
    units: 5,
    fields: [
      { key: "myboom", label: "", placeholder: "さいきんハマってること", big: true },
    ],
  },
  {
    id: "manual",
    title: "わたしの取扱説明書",
    description: "機嫌の取り方ガイド",
    units: 7,
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
    units: 9,
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

/** Sum of unit costs for a list of block-type ids. Unknown ids
 *  contribute 0 — keeps stale drafts from blowing up the budget if a
 *  template is renamed in a future migration. */
export function unitsConsumed(blockTypes: string[]): number {
  return blockTypes.reduce((sum, id) => {
    const t = BLOCK_TEMPLATE_BY_ID[id];
    return sum + (t?.units ?? 0);
  }, 0);
}
