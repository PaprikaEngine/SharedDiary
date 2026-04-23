"use client";

// IndexedDB-backed draft persistence for the diary compose page. Users
// can close / reload the page and pick up where they left off. Scoped
// per group — each group has its own active draft, cleared when the
// entry is successfully submitted.
//
// IDB handles Blob values natively via structured clone, so placed
// media (images + videos) survive a reload with their file bytes
// intact. The canvas snapshot, stamps, flipbook, and tool settings are
// plain JSON and ride along in the same record.

import type { DiarySnapshot } from "@/components/diary-canvas/diary-canvas";
import type { PlacedStamp } from "@/components/stamps";
import type { PlacedFlipbook, FlipbookData } from "@/components/flipbook";

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

function keyFor(groupId: string) {
  return `group:${groupId}`;
}

export async function saveDraft(groupId: string, draft: Draft): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    await promisify(tx.objectStore(STORE).put(draft, keyFor(groupId)));
  } catch (err) {
    // Quota exceeded, private browsing mode, etc. — don't break
    // editing just because persistence failed.
    console.warn("draft save failed:", err);
  }
}

export async function loadDraft(groupId: string): Promise<Draft | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readonly");
    const result = await promisify(tx.objectStore(STORE).get(keyFor(groupId)));
    return (result as Draft | undefined) ?? null;
  } catch (err) {
    console.warn("draft load failed:", err);
    return null;
  }
}

export async function clearDraft(groupId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    await promisify(tx.objectStore(STORE).delete(keyFor(groupId)));
  } catch (err) {
    console.warn("draft clear failed:", err);
  }
}
