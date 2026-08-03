import "server-only";

/**
 * Google Calendar OAuth is optional infrastructure: the agenda module must
 * work fully without it. Every Google-touching code path checks this first
 * and no-ops/soft-fails when credentials haven't been configured yet.
 */
export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY
  );
}

export function getAppUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

export function getGoogleOAuthConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUri: `${getAppUrl()}/api/google/callback`,
  };
}
