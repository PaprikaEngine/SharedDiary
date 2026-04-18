import { NextRequest, NextResponse } from "next/server";
import { GATE_COOKIE, hashPassphrase } from "@/lib/gate";

export async function POST(request: NextRequest) {
  const { passphrase } = await request.json();
  const expected = process.env.GATE_PASSPHRASE;

  if (!expected || !passphrase || passphrase !== expected) {
    return NextResponse.json({ error: "合言葉が違います" }, { status: 403 });
  }

  const token = await hashPassphrase(expected);
  const response = NextResponse.json({ ok: true });

  response.cookies.set(GATE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90, // 90 days
  });

  return response;
}
