export class PayPalError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string
  ) {
    super(message);
    this.name = "PayPalError";
  }
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

const tokenCache: TokenCache = {
  accessToken: "",
  expiresAt: 0,
};

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache.accessToken && now < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  const clientId = getEnv("PAYPAL_CLIENT_ID");
  const clientSecret = getEnv("PAYPAL_CLIENT_SECRET");
  const baseUrl = getEnv("PAYPAL_BASE_URL");

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new PayPalError(response.status, body, "Failed to get PayPal access token");
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  tokenCache.accessToken = data.access_token;
  tokenCache.expiresAt = now + data.expires_in * 1000;

  return data.access_token;
}

export async function paypalFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();
  const baseUrl = getEnv("PAYPAL_BASE_URL");
  const method = (options.method || "GET").toUpperCase();

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");

  if (method === "POST" && !headers.has("PayPal-Request-Id")) {
    headers.set("PayPal-Request-Id", crypto.randomUUID());
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    method,
    headers,
  });

  const contentType = response.headers.get("content-type");
  const body = contentType?.includes("application/json")
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => "");

  if (!response.ok) {
    throw new PayPalError(response.status, body, `PayPal API error: ${response.status}`);
  }

  return body as T;
}