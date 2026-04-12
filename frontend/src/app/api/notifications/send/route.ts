import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { targetUserId, groupId, groupName } = await request.json();

  // Use admin client to read another user's notification preferences (bypasses RLS)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("push_subscription, push_enabled")
    .eq("user_id", targetUserId)
    .single();

  if (!prefs?.push_enabled || !prefs?.push_subscription) {
    return NextResponse.json({ sent: false, reason: "no_subscription" });
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail = process.env.VAPID_EMAIL ?? "mailto:noreply@example.com";

  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ sent: false, reason: "vapid_not_configured" });
  }

  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

  const payload = JSON.stringify({
    title: "バトンが届きました!",
    body: `「${groupName}」であなたの番です。楽しみに待ってるよ!`,
    url: `/groups/${groupId}`,
  });

  try {
    await webpush.sendNotification(
      prefs.push_subscription as unknown as webpush.PushSubscription,
      payload
    );
    return NextResponse.json({ sent: true });
  } catch (err: unknown) {
    if ((err as { statusCode?: number }).statusCode === 410) {
      await (admin as any)
        .from("notification_preferences")
        .update({ push_enabled: false, push_subscription: null })
        .eq("user_id", targetUserId);
    }
    return NextResponse.json({ sent: false, reason: "push_failed" });
  }
}
