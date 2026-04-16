import crypto from "node:crypto";
import { parse as parseCookie } from "cookie";
import type { Response } from "express";

const ADMIN_COOKIE_NAME = "inspection_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 12;

function getSecret() {
  return process.env.JWT_SECRET || "inspection-booking-fallback-secret";
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await new Promise<string>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(key.toString("hex"));
    });
  });

  return `${salt}:${derivedKey}`;
}

export async function verifyPassword(password: string, hashedPassword: string) {
  const [salt, storedKey] = hashedPassword.split(":");
  if (!salt || !storedKey) return false;

  const derivedKey = await new Promise<string>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(key.toString("hex"));
    });
  });

  return crypto.timingSafeEqual(Buffer.from(storedKey, "hex"), Buffer.from(derivedKey, "hex"));
}

function signPayload(payload: string) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function buildCookie(value: string, maxAge: number) {
  return `${ADMIN_COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`;
}

export function setAdminSessionCookie(res: Response, username: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payload = `${username}.${expiresAt}`;
  const signature = signPayload(payload);
  const value = `${payload}.${signature}`;

  res.setHeader("Set-Cookie", buildCookie(value, SESSION_MAX_AGE));
}

export function clearAdminSessionCookie(res: Response) {
  res.setHeader("Set-Cookie", buildCookie("", 0));
}

export function getAdminSessionFromHeader(cookieHeader?: string | null) {
  if (!cookieHeader) return null;
  const cookies = parseCookie(cookieHeader);
  const raw = cookies[ADMIN_COOKIE_NAME];
  if (!raw) return null;

  const [username, expiresAt, signature] = raw.split(".");
  if (!username || !expiresAt || !signature) return null;

  const payload = `${username}.${expiresAt}`;
  const expectedSignature = signPayload(payload);
  if (!crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSignature, "hex"))) {
    return null;
  }

  if (Number(expiresAt) < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return { username };
}

export { ADMIN_COOKIE_NAME };
