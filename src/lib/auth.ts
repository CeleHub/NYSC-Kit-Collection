import crypto from "crypto";
import { neon, NeonQueryFunction } from "@neondatabase/serverless";

export interface OtpEntry {
  code: string;
  email: string;
  stateCode?: string;
  role: "CORPS_MEMBER" | "PLATOON_INSPECTOR" | "SECRETARIAT" | "ADMIN";
  platoon?: number;
  expiresAt: number; // timestamp in ms
}

interface LockoutEntry {
  failedAttempts: number;
  lockedUntil: number; // timestamp in ms
}

// In-memory fallback
const inMemoryOtpStore = new Map<string, OtpEntry>();
const inMemoryLockoutStore = new Map<string, LockoutEntry>();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

let sqlClient: NeonQueryFunction<false, false> | null = null;
function getSql(): NeonQueryFunction<false, false> | null {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.trim() === "" || dbUrl.includes("<YOUR_NEON")) {
    return null;
  }
  if (!sqlClient) {
    sqlClient = neon(dbUrl.trim());
  }
  return sqlClient;
}

/**
 * Masks an email for privacy, e.g. okonzcelestine1@gmail.com -> ok******@gmail.com
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "******@***.com";
  const [local, domain] = email.split("@");
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  const prefix = local.slice(0, 2);
  return `${prefix}${"*".repeat(Math.max(4, local.length - 2))}@${domain}`;
}

/**
 * Checks if a given IP or Email is currently in lockout.
 */
export async function checkLockout(identifier: string): Promise<{ locked: boolean; remainingSeconds: number }> {
  const now = Date.now();
  const cleanId = identifier.toLowerCase().trim();
  const sql = getSql();

  if (sql) {
    try {
      const rows = await sql`SELECT failed_attempts, locked_until FROM lockouts WHERE identifier = ${cleanId} LIMIT 1`;
      if (rows.length > 0) {
        const lockedUntil = Number(rows[0].locked_until);
        if (lockedUntil > now) {
          const remainingSeconds = Math.ceil((lockedUntil - now) / 1000);
          return { locked: true, remainingSeconds };
        }
      }
      return { locked: false, remainingSeconds: 0 };
    } catch (err) {
      console.warn("[AUTH LOCKOUT] Neon query fallback to memory:", err);
    }
  }

  const entry = inMemoryLockoutStore.get(cleanId);
  if (!entry) return { locked: false, remainingSeconds: 0 };

  if (entry.lockedUntil > now) {
    const remainingSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
    return { locked: true, remainingSeconds };
  }

  if (entry.lockedUntil > 0) {
    inMemoryLockoutStore.delete(cleanId);
  }

  return { locked: false, remainingSeconds: 0 };
}

/**
 * Increments failed attempts for an IP and Email. Triggers 2-hour lockout on 5th failure.
 */
export async function recordFailedAttempt(
  ip: string,
  email: string
): Promise<{ locked: boolean; remainingAttempts: number; remainingSeconds: number }> {
  const now = Date.now();
  const cleanIp = ip.toLowerCase().trim();
  const cleanEmail = email.toLowerCase().trim();
  const keys = [cleanIp, cleanEmail];
  const sql = getSql();

  let maxAttempts = 0;

  if (sql) {
    try {
      for (const k of keys) {
        const rows = await sql`SELECT failed_attempts FROM lockouts WHERE identifier = ${k} LIMIT 1`;
        const currentAttempts = rows.length > 0 ? Number(rows[0].failed_attempts) : 0;
        const newAttempts = currentAttempts + 1;
        const lockedUntil = newAttempts >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_DURATION_MS : 0;

        await sql`
          INSERT INTO lockouts (identifier, failed_attempts, locked_until)
          VALUES (${k}, ${newAttempts}, ${lockedUntil})
          ON CONFLICT (identifier) DO UPDATE SET
            failed_attempts = ${newAttempts},
            locked_until = ${lockedUntil};
        `;

        if (newAttempts > maxAttempts) maxAttempts = newAttempts;
      }

      if (maxAttempts >= MAX_FAILED_ATTEMPTS) {
        return {
          locked: true,
          remainingAttempts: 0,
          remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
        };
      }

      return {
        locked: false,
        remainingAttempts: MAX_FAILED_ATTEMPTS - maxAttempts,
        remainingSeconds: 0,
      };
    } catch (err) {
      console.warn("[AUTH LOCKOUT] Neon record fallback to memory:", err);
    }
  }

  // Fallback to in-memory
  for (const k of keys) {
    let entry = inMemoryLockoutStore.get(k);
    if (!entry) {
      entry = { failedAttempts: 0, lockedUntil: 0 };
    }
    entry.failedAttempts += 1;
    if (entry.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      entry.lockedUntil = now + LOCKOUT_DURATION_MS;
    }
    inMemoryLockoutStore.set(k, entry);
    if (entry.failedAttempts > maxAttempts) {
      maxAttempts = entry.failedAttempts;
    }
  }

  if (maxAttempts >= MAX_FAILED_ATTEMPTS) {
    return {
      locked: true,
      remainingAttempts: 0,
      remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
    };
  }

  return {
    locked: false,
    remainingAttempts: MAX_FAILED_ATTEMPTS - maxAttempts,
    remainingSeconds: 0,
  };
}

/**
 * Resets failed attempts after a successful login.
 */
export async function resetFailedAttempts(ip: string, email: string): Promise<void> {
  const cleanIp = ip.toLowerCase().trim();
  const cleanEmail = email.toLowerCase().trim();
  const sql = getSql();

  if (sql) {
    try {
      await sql`DELETE FROM lockouts WHERE identifier IN (${cleanIp}, ${cleanEmail});`;
    } catch (err) {
      console.warn("[AUTH RESET] Neon delete fallback to memory:", err);
    }
  }

  inMemoryLockoutStore.delete(cleanIp);
  inMemoryLockoutStore.delete(cleanEmail);
}

/**
 * Generates a cryptographically secure 6-digit OTP and stores it with 5-minute TTL.
 */
export async function generateOtp(
  email: string,
  role: "CORPS_MEMBER" | "PLATOON_INSPECTOR" | "SECRETARIAT" | "ADMIN",
  metadata?: { stateCode?: string; platoon?: number; fullName?: string }
): Promise<{ code: string; expiresAt: number }> {
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + OTP_TTL_MS;
  const cleanEmail = email.toLowerCase().trim();
  const sql = getSql();

  if (sql) {
    try {
      await sql`
        INSERT INTO otps (email, code, role, metadata, expires_at)
        VALUES (
          ${cleanEmail},
          ${code},
          ${role},
          ${JSON.stringify(metadata || {})},
          ${expiresAt}
        )
        ON CONFLICT (email) DO UPDATE SET
          code = EXCLUDED.code,
          role = EXCLUDED.role,
          metadata = EXCLUDED.metadata,
          expires_at = EXCLUDED.expires_at;
      `;
      return { code, expiresAt };
    } catch (err) {
      console.warn("[AUTH OTP] Neon insert fallback to memory:", err);
    }
  }

  inMemoryOtpStore.set(cleanEmail, {
    code,
    email: cleanEmail,
    role,
    stateCode: metadata?.stateCode,
    platoon: metadata?.platoon,
    expiresAt,
  });

  return { code, expiresAt };
}

/**
 * Verifies the provided OTP code.
 */
export async function verifyOtp(
  email: string,
  inputCode: string
): Promise<{ success: boolean; error?: string; entry?: OtpEntry }> {
  const cleanEmail = email.toLowerCase().trim();
  const trimmedCode = inputCode.trim();
  const now = Date.now();
  const sql = getSql();

  if (sql) {
    try {
      const rows = await sql`
        SELECT email, code, role, metadata, expires_at
        FROM otps
        WHERE email = ${cleanEmail}
        LIMIT 1;
      `;

      if (rows.length === 0) {
        return { success: false, error: "No OTP was requested for this email or it has expired." };
      }

      const r = rows[0];
      const expiresAt = Number(r.expires_at);

      if (now > expiresAt) {
        await sql`DELETE FROM otps WHERE email = ${cleanEmail};`;
        return { success: false, error: "OTP has expired. Please request a new verification code." };
      }

      if (r.code !== trimmedCode) {
        return { success: false, error: "Incorrect verification code." };
      }

      // Consume OTP on success
      await sql`DELETE FROM otps WHERE email = ${cleanEmail};`;

      const meta = typeof r.metadata === "string" ? JSON.parse(r.metadata) : (r.metadata || {});
      const entry: OtpEntry = {
        email: r.email,
        code: r.code,
        role: r.role as any,
        stateCode: meta.stateCode,
        platoon: meta.platoon ? Number(meta.platoon) : undefined,
        expiresAt,
      };

      return { success: true, entry };
    } catch (err) {
      console.warn("[AUTH VERIFY] Neon query fallback to memory:", err);
    }
  }

  // In-memory fallback
  const entry = inMemoryOtpStore.get(cleanEmail);

  if (!entry) {
    return { success: false, error: "No OTP was requested for this email or it has expired." };
  }

  if (now > entry.expiresAt) {
    inMemoryOtpStore.delete(cleanEmail);
    return { success: false, error: "OTP has expired. Please request a new verification code." };
  }

  if (entry.code !== trimmedCode) {
    return { success: false, error: "Incorrect verification code." };
  }

  inMemoryOtpStore.delete(cleanEmail);
  return { success: true, entry };
}
