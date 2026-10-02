import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "voidbans_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h; refreshed on activity, not silently extended forever

function getSigningKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or too short (need >=32 chars). Set it in .env, see .env.example.",
    );
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  discordId: string;
  [key: string]: unknown;
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSigningKey());

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSigningKey());
    return payload as SessionPayload;
  } catch {
    // Expired or tampered, treat as logged out rather than throwing,
    // so a stale cookie never surfaces as a 500.
    return null;
  }
}

export function destroySession(): void {
  cookies().set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}
