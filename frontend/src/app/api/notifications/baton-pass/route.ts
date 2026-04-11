import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { sendBatonEmail } from "@/lib/resend";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:noreply@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export async function POST(request: NextRequest) {
  try {
    const { groupId, nextHolderId } = await request.json();
    if (!groupId || !nextHolderId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify sender is a member of the group
    const { data: membership } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .single();
    if (!membership) {
      return NextResponse.json({ error: "Not a group member" }, { status: 403 });
    }

    // Verify nextHolderId is also a member of the group
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: nextHolderMembership } = await (supabase as any)
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId)
      .eq("user_id", nextHolderId)
      .single();
    if (!nextHolderMembership) {
      return NextResponse.json({ error: "Next holder is not a group member" }, { status: 400 });
    }

    // Fetch context: group name, sender name, next holder's email & prefs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = supabase as any;
    const [groupRes, senderRes, holderRes, prefsRes] = await Promise.all([
      c.from("groups").select("name").eq("id", groupId).single(),
      c.from("users").select("name").eq("id", user.id).single(),
      c.from("users").select("name, email").eq("id", nextHolderId).single(),
      c.from("notification_preferences").select("*").eq("user_id", nextHolderId).single(),
    ]);

    const groupName = (groupRes.data as { name: string } | null)?.name ?? "交換日記";
    const senderName = (senderRes.data as { name: string } | null)?.name ?? "メンバー";
    const holder = holderRes.data as { name: string; email: string } | null;
    if (!holder) {
      return NextResponse.json({ error: "Next holder not found" }, { status: 404 });
    }

    const prefs = prefsRes.data as { email_enabled: boolean; push_enabled: boolean; push_subscription: unknown } | null;
    // Default: email enabled, push disabled
    const emailEnabled = prefs?.email_enabled ?? true;
    const pushEnabled = prefs?.push_enabled ?? false;
    const pushSubscription = prefs?.push_subscription;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const groupUrl = `${baseUrl}/groups/${groupId}`;

    const results: { email?: string; push?: string } = {};

    // Send email notification
    if (emailEnabled && process.env.RESEND_API_KEY) {
      try {
        await sendBatonEmail({
          to: holder.email,
          senderName,
          groupName,
          groupUrl,
        });
        results.email = "sent";
      } catch (err) {
        console.error("Email notification failed:", err);
        results.email = "failed";
      }
    }

    // Send push notification
    if (pushEnabled && pushSubscription && process.env.VAPID_PUBLIC_KEY) {
      try {
        const payload = JSON.stringify({
          title: `${groupName}`,
          body: `${senderName}さんが日記を書きました。あなたの番です!`,
          url: groupUrl,
        });
        await webpush.sendNotification(
          pushSubscription as unknown as webpush.PushSubscription,
          payload,
        );
        results.push = "sent";
      } catch (err) {
        console.error("Push notification failed:", err);
        results.push = "failed";
        // If subscription expired, clean it up
        if ((err as { statusCode?: number }).statusCode === 410) {
          await c
            .from("notification_preferences")
            .update({ push_enabled: false, push_subscription: null })
            .eq("user_id", nextHolderId);
        }
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("Baton notification error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
