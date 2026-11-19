import crypto from "crypto";

interface OtpEntry {
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

// In-memory rate limiting and OTP store (persists across requests in node runtime)
const otpStore = new Map<string, OtpEntry>(); // key: email or identifier
const lockoutStore = new Map<string, LockoutEntry>(); // key: email or IP

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

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
export function checkLockout(identifier: string): { locked: boolean; remainingSeconds: number } {
  const now = Date.now();
  const entry = lockoutStore.get(identifier.toLowerCase());
  if (!entry) return { locked: false, remainingSeconds: 0 };

  if (entry.lockedUntil > now) {
    const remainingSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
    return { locked: true, remainingSeconds };
  }

  // Lockout expired, reset attempts
  if (entry.lockedUntil > 0) {
    lockoutStore.delete(identifier.toLowerCase());
  }

  return { locked: false, remainingSeconds: 0 };
}

/**
 * Increments failed attempts for an IP and Email. Triggers 2-hour lockout on 5th failure.
 */
export function recordFailedAttempt(
  ip: string,
  email: string
): { locked: boolean; remainingAttempts: number; remainingSeconds: number } {
  const now = Date.now();
  const keys = [ip.toLowerCase(), email.toLowerCase()];

  let maxAttempts = 0;
  for (const k of keys) {
    let entry = lockoutStore.get(k);
    if (!entry) {
      entry = { failedAttempts: 0, lockedUntil: 0 };
    }
    entry.failedAttempts += 1;
    if (entry.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      entry.lockedUntil = now + LOCKOUT_DURATION_MS;
    }
    lockoutStore.set(k, entry);
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
export function resetFailedAttempts(ip: string, email: string): void {
  lockoutStore.delete(ip.toLowerCase());
  lockoutStore.delete(email.toLowerCase());
}

/**
 * Generates a cryptographically secure 6-digit OTP and stores it with 5-minute TTL.
 */
export function generateOtp(
  email: string,
  role: "CORPS_MEMBER" | "PLATOON_INSPECTOR" | "SECRETARIAT" | "ADMIN",
  metadata?: { stateCode?: string; platoon?: number }
): { code: string; expiresAt: number } {
  // 6-digit random code
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + OTP_TTL_MS;

  otpStore.set(email.toLowerCase(), {
    code,
    email: email.toLowerCase(),
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
export function verifyOtp(
  email: string,
  inputCode: string
): { success: boolean; error?: string; entry?: OtpEntry } {
  const cleanEmail = email.toLowerCase().trim();
  const entry = otpStore.get(cleanEmail);

  if (!entry) {
    return { success: false, error: "No OTP was requested for this email or it has expired." };
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(cleanEmail);
    return { success: false, error: "OTP has expired. Please request a new verification code." };
  }

  if (entry.code !== inputCode.trim()) {
    return { success: false, error: "Incorrect verification code." };
  }

  // Consume OTP on success
  otpStore.delete(cleanEmail);
  return { success: true, entry };
}
