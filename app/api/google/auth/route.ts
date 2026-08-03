import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { isGoogleConfigured } from "@/lib/google/env";
import { buildGoogleConsentUrl } from "@/lib/google/oauth-client";

export async function GET() {
  if (!isGoogleConfigured()) {
    return NextResponse.json(
      { error: "La integración con Google Calendar no está configurada todavía." },
      { status: 501 }
    );
  }

  // Requires an active session - identity for the callback comes from the
  // live session there, not from this state value. state is only a
  // short-lived anti-CSRF nonce (verified against the cookie set below).
  await getTenantContext();

  const nonce = crypto.randomUUID();
  const response = NextResponse.redirect(buildGoogleConsentUrl(nonce));
  response.cookies.set("google_oauth_state", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
