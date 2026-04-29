"use client";

// IndexedDB-backed draft persistence for the diary compose page. Users
// can close / reload the page and pick up where they left off. Each
// draft is keyed by a caller-provided string so the composer can scope
// drafts independently — diary drafts use "group:<id>", profile drafts
// use "group:<id>:profile:<memberId>", etc.
//
// IDB handles Blob values natively via structured clone, so placed
// media (images + videos) survive a reload with their file bytes
// intact. The canvas snapshot, stamps, flipbook, and tool settings are
// plain JSON and ride along in the same record.

import type { DiarySnapshot } from "@/components/diary-canvas/diary-canvas";
import type { PlacedStamp } from "@/components/stamps";
import type { PlacedFlipbook, FlipbookData } from "@/components/flipbook";
import type { PlacedTape } from "@/components/placed-tape";
import type { PlacedBlock } from "@/components/placed-block";

const DB_NAME = "shared-diary";
const VERSION = 1;
const STORE = "drafts";

export type DraftMedia = {
  instanceId: string;
  type: "image" | "video";
  /** Public R2 URL — the file is uploaded at paste time, so the
   *  draft only carries references. */
  url: string;
  /** R2 object key, kept so the composer can delete the file when
   *  the user removes the item before submitting. */
  path: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  baseWidth: number;
  baseHeight: number;
  z: number;
};

export type Draft = {
  savedAt: number;
  diary: DiarySnapshot;
  placedStamps: PlacedStamp[];
  /** Optional — added in the tape-overlay refactor. Older draft
   *  records won't have it; consumers should default to []. */
  placedTapes?: PlacedTape[];
  /** Optional — added in the profile-book refactor. Older draft
   *  records won't have it; consumers should default to []. */
  placedBlocks?: PlacedBlock[];
  placedMedia: DraftMedia[];
  flipbookData: FlipbookData | null;
  flipbookPlacement: PlacedFlipbook | null;
  nextBatonHolder?: string | null;
  zCounter: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function promisify<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** Build a draft key for a diary compose session. */
export function diaryDraftKey(groupId: string): string {
  return `group:${groupId}`;
}

/** Build a draft key for a profile-book compose session. Scoped per
 *  (group, member) so a profile draft never collides with the group's
 *  diary draft. */
export function profileDraftKey(groupId: string, memberId: string): string {
  return `group:${groupId}:profile:${memberId}`;
}

export async function saveDraft(key: string, draft: Draft): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    await promisify(tx.objectStore(STORE).put(draft, key));
  } catch (err) {
    // Quota exceeded, private browsing mode, etc. — don't break
    // editing just because persistence failed.
    console.warn("draft save failed:", err);
  }
}

export async function loadDraft(key: string): Promise<Draft | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readonly");
    const result = await promisify(tx.objectStore(STORE).get(key));
    return (result as Draft | undefined) ?? null;
  } catch (err) {
    console.warn("draft load failed:", err);
    return null;
  }
}

export async function clearDraft(key: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    await promisify(tx.objectStore(STORE).delete(key));
  } catch (err) {
    console.warn("draft clear failed:", err);
  }
}
