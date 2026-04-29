import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

const isDemo = process.env.NEXT_PUBLIC_SUPABASE_URL === "https://demo.supabase.co";

// /groups/[id]/profiles is just a routing convenience — there's no
// dedicated index UI. We send the visitor to the first member in
// baton order. Falls back to the group home if the group is empty.
export default async function ProfilesIndexPage({ params }: Props) {
  const { id: groupId } = await params;

  if (isDemo) redirect(`/groups/${groupId}`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membership } = await (supabase as any)
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();
  if (!membership) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: first } = await (supabase as any)
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .order("member_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (first) {
    redirect(`/groups/${groupId}/profiles/${(first as { user_id: string }).user_id}`);
  }
  redirect(`/groups/${groupId}`);
}
