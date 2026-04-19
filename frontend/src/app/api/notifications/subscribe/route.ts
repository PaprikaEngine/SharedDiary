import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NOTIFICATIONS_ENABLED } from "@/lib/feature-flags";

export async function POST(request: NextRequest) {
  if (!NOTIFICATIONS_ENABLED) {
    return NextResponse.json({ ok: true, disabled: true });
  }
  try {
    const { subscription } = await request.json();
    if (!subscription) {
      return NextResponse.json({ error: "Missing subscription" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Upsert notification preferences with push subscription
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("notification_preferences")
      .upsert(
        {
          user_id: user.id,
          push_enabled: true,
          push_subscription: subscription,
        },
        { onConflict: "user_id" },
      );

    if (error) {
      console.error("Failed to save subscription:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Subscribe error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
