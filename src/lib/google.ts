function envVar(key: string): string | undefined {
  return import.meta.env?.[key] ?? process.env[key];
}

export function googleConfig() {
  const clientId = envVar('GOOGLE_CLIENT_ID');
  const clientSecret = envVar('GOOGLE_CLIENT_SECRET');
  const redirectUri = envVar('GOOGLE_REDIRECT_URI');
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth no está configurado (faltan GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o GOOGLE_REDIRECT_URI)');
  }
  return { clientId, clientSecret, redirectUri };
}

export function buildAuthUrl(state: string) {
  const { clientId, redirectUri } = googleConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    include_granted_scopes: 'true',
    state,
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCode(code: string) {
  const { clientId, clientSecret, redirectUri } = googleConfig();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Token exchange falló: ${res.status}`);
  return res.json() as Promise<{ access_token: string; id_token?: string; token_type: string; expires_in: number }>;
}

export async function fetchUserInfo(accessToken: string) {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`userinfo falló: ${res.status}`);
  return res.json() as Promise<{
    sub: string;
    email: string;
    email_verified: boolean;
    name?: string;
    given_name?: string;
    picture?: string;
  }>;
}
