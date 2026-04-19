// Feature flags for the deployed app.
//
// Notifications (Resend email + Web Push) are temporarily disabled
// while the relevant Cloudflare/Supabase env vars are pending. Re-enable
// by setting NEXT_PUBLIC_NOTIFICATIONS_ENABLED=true and configuring:
//   - RESEND_API_KEY, RESEND_FROM_EMAIL
//   - VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
//   - NEXT_PUBLIC_VAPID_PUBLIC_KEY
//   - CRON_API_KEY (for the reminder route)
// …and applying the notification_preferences migration (00004).
export const NOTIFICATIONS_ENABLED =
  process.env.NEXT_PUBLIC_NOTIFICATIONS_ENABLED === "true";
