import "server-only";
import { OAuth2Client } from "google-auth-library";
import { getGoogleOAuthConfig } from "@/lib/google/env";

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export function createGoogleOAuthClient(): OAuth2Client {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

export function buildGoogleConsentUrl(state: string): string {
  const client = createGoogleOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [GOOGLE_CALENDAR_SCOPE, "https://www.googleapis.com/auth/userinfo.email"],
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = createGoogleOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    throw new Error("Google no devolvió un refresh_token. Reintenta la conexión (prompt=consent).");
  }
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: new Date(tokens.expiry_date).toISOString(),
  };
}

export async function fetchGoogleAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { email?: string };
    return json.email ?? null;
  } catch {
    return null;
  }
}

export async function refreshAccessToken(refreshToken: string) {
  const client = createGoogleOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token || !credentials.expiry_date) {
    throw new Error("No se pudo refrescar el token de Google.");
  }
  return {
    accessToken: credentials.access_token,
    expiryDate: new Date(credentials.expiry_date).toISOString(),
  };
}
