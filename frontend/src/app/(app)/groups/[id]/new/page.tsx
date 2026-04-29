"use client";

import { useParams } from "next/navigation";
import { EntryComposer } from "../_components/entry-composer";

export default function NewEntryPage() {
  const params = useParams();
  const groupId = params.id as string;
  return <EntryComposer groupId={groupId} mode="diary" />;
}
