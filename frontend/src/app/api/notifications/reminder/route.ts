import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { escapeHtml } from "@/lib/resend";
import { NOTIFICATIONS_ENABLED } from "@/lib/feature-flags";

if (NOTIFICATIONS_ENABLED && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:noreply@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

// Called by cron/external trigger to send reminders for overdue batons
// Protected by a simple API key check
export async function POST(request: NextRequest) {
  if (!NOTIFICATIONS_ENABLED) {
    return NextResponse.json({ ok: true, disabled: true });
  }
  const authHeader = request.headers.get("authorization");
  const apiKey = process.env.CRON_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "CRON_API_KEY not configured" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = supabase as any;

    // Find groups where baton is overdue
    const { data: groups } = await c
      .from("groups")
      .select("id, name, baton_deadline_days, baton_passed_at, current_baton_holder_id")
      .not("current_baton_holder_id", "is", null)
      .not("baton_passed_at", "is", null);

    if (!groups || groups.length === 0) {
      return NextResponse.json({ ok: true, reminders: 0 });
    }

    const now = Date.now();
    type GroupRow = { id: string; name: string; baton_deadline_days: number; baton_passed_at: string; current_baton_holder_id: string };
    const overdueGroups = (groups as GroupRow[]).filter((g) => {
      const deadline = new Date(g.baton_passed_at).getTime() + g.baton_deadline_days * 86400000;
      return now > deadline;
    });

    let sent = 0;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    for (const g of overdueGroups) {
      // Fetch holder's info and prefs
      const { data: holder } = await c.from("users").select("name, email").eq("id", g.current_baton_holder_id).single();
      const { data: prefs } = await c.from("notification_preferences").select("*").eq("user_id", g.current_baton_holder_id).single();
      if (!holder) continue;

      const holderData = holder as { name: string; email: string };
      const prefsData = prefs as { email_enabled: boolean; push_enabled: boolean; push_subscription: unknown } | null;
      const safeGroupName = escapeHtml(g.name);
      const safeGroupUrl = encodeURI(`${baseUrl}/groups/${g.id}`);

      // Send reminder email
      if ((prefsData?.email_enabled ?? true) && process.env.RESEND_API_KEY) {
        try {
          const from = process.env.RESEND_FROM_EMAIL || "交換日記 <onboarding@resend.dev>";
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from,
            to: holderData.email,
            subject: `${safeGroupName} — 楽しみに待ってるよ!`,
            html: `
              <div style="font-family: 'Noto Serif JP', Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #FDF8F0; border-radius: 12px;">
                <h2 style="color: #2D2D2D; font-size: 18px; margin: 0 0 16px;">そろそろ書く番だよ!</h2>
                <p style="color: #5A5A5A; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
                  「<strong>${safeGroupName}</strong>」のバトンを持ったまま${g.baton_deadline_days}日が経ちました。<br/>
                  みんな楽しみに待ってるよ!
                </p>
                <a href="${safeGroupUrl}" style="display: inline-block; background: #5B7A5E; color: white; text-decoration: none; padding: 10px 24px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                  日記を書く
                </a>
              </div>
            `,
          });
          sent++;
        } catch (err) {
          console.error("Reminder email failed:", err);
        }
      }

      // Send push notification
      if (prefsData?.push_enabled && prefsData.push_subscription && process.env.VAPID_PUBLIC_KEY) {
        try {
          await webpush.sendNotification(
            prefsData.push_subscription as unknown as webpush.PushSubscription,
            JSON.stringify({
              title: g.name,
              body: "楽しみに待ってるよ! そろそろ日記を書こう",
              url: safeGroupUrl,
            }),
          );
          sent++;
        } catch (err) {
          console.error("Reminder push failed:", err);
        }
      }
    }

    return NextResponse.json({ ok: true, reminders: sent, overdueGroups: overdueGroups.length });
  } catch (err) {
    console.error("Reminder error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
