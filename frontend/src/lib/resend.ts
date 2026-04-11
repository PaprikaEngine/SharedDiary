import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/** Escape HTML special characters to prevent XSS in email templates */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendBatonEmail({
  to,
  senderName,
  groupName,
  groupUrl,
}: {
  to: string;
  senderName: string;
  groupName: string;
  groupUrl: string;
}) {
  const from = process.env.RESEND_FROM_EMAIL || "交換日記 <onboarding@resend.dev>";
  const safeSender = escapeHtml(senderName);
  const safeGroup = escapeHtml(groupName);
  const safeUrl = encodeURI(groupUrl);

  return resend.emails.send({
    from,
    to,
    subject: `${safeGroup} — バトンが届きました!`,
    html: `
      <div style="font-family: 'Noto Serif JP', Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #FDF8F0; border-radius: 12px;">
        <h2 style="color: #2D2D2D; font-size: 18px; margin: 0 0 16px;">あなたの番です!</h2>
        <p style="color: #5A5A5A; font-size: 15px; line-height: 1.7; margin: 0 0 8px;">
          <strong style="color: #2D2D2D;">${safeSender}</strong>さんが「<strong>${safeGroup}</strong>」に日記を書きました。
        </p>
        <p style="color: #5A5A5A; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
          楽しみに待ってたよ! 次はあなたの番です。
        </p>
        <a href="${safeUrl}" style="display: inline-block; background: #5B7A5E; color: white; text-decoration: none; padding: 10px 24px; border-radius: 20px; font-size: 14px; font-weight: 600;">
          日記を書く
        </a>
        <p style="color: #B0B0B0; font-size: 11px; margin-top: 32px;">
          このメールは交換日記サービスから送信されています。
          通知設定は設定ページから変更できます。
        </p>
      </div>
    `,
  });
}
