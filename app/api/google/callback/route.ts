import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { isGoogleConfigured } from "@/lib/google/env";
import { exchangeCodeForTokens, fetchGoogleAccountEmail } from "@/lib/google/oauth-client";
import { encryptToken } from "@/lib/google/token-crypto";

export async function GET(request: NextRequest) {
  if (!isGoogleConfigured()) {
    return NextResponse.json(
      { error: "La integración con Google Calendar no está configurada todavía." },
      { status: 501 }
    );
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get("google_oauth_state")?.value;

  const redirectTo = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    response.cookies.delete("google_oauth_state");
    return response;
  };

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectTo("/settings/integrations?google=error");
  }

  const tenant = await getTenantContext();

  try {
    const tokens = await exchangeCodeForTokens(code);
    const googleAccountEmail = await fetchGoogleAccountEmail(tokens.accessToken);

    const supabase = await createClient();
    const { error } = await supabase.from("google_calendar_connections").upsert(
      {
        company_id: tenant.companyId,
        user_id: tenant.userId,
        access_token_encrypted: encryptToken(tokens.accessToken),
        refresh_token_encrypted: encryptToken(tokens.refreshToken),
        token_expiry: tokens.expiryDate,
        google_account_email: googleAccountEmail,
        sync_enabled: true,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error("GOOGLE_CONNECTION_UPSERT_FAILED", error.message);
      return redirectTo("/settings/integrations?google=error");
    }

    return redirectTo("/settings/integrations?google=connected");
  } catch (error) {
    console.error("GOOGLE_OAUTH_CALLBACK_FAILED", error instanceof Error ? error.message : error);
    return redirectTo("/settings/integrations?google=error");
  }
}
