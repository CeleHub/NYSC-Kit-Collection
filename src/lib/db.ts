import fs from "fs/promises";
import path from "path";
import {
  CorpsMember,
  PlatoonInspectorAccount,
  SecretariatAccount,
  SubmissionRecord,
  AdminKPIs,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "src", "data");

async function readJsonFile<T>(filename: string, defaultValue: T): Promise<T> {
  try {
    const filePath = path.join(DATA_DIR, filename);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    console.warn(`Could not read ${filename}, using default`, error);
    return defaultValue;
  }
}

async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  const filePath = path.join(DATA_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Derives the Platoon Number (1 to 10) from the State Code.
 * Rule: The last digit is the platoon. If ends in 0, platoon is 10.
 * Examples:
 *   LA/26C/18388 -> 8
 *   LA/26C/10041 -> 1
 *   LA/26C/10040 -> 10
 */
export function derivePlatoonFromStateCode(stateCode: string): number {
  const clean = stateCode.trim().toUpperCase();
  // Find all digits at the end of the state code
  const match = clean.match(/(\d+)$/);
  if (!match) {
    return 1; // fallback
  }
  const digits = match[1];
  const lastChar = digits.slice(-1);
  const num = parseInt(lastChar, 10);
  if (num === 0) return 10;
  return num >= 1 && num <= 9 ? num : 1;
}

// ================= NOMINAL ROLL =================
export async function getNominalRoll(): Promise<CorpsMember[]> {
  return readJsonFile<CorpsMember[]>("nominal_roll.json", []);
}

export async function getCorpsMemberByStateCode(stateCode: string): Promise<CorpsMember | null> {
  const list = await getNominalRoll();
  const normalized = stateCode.trim().toUpperCase();
  return list.find((c) => c.state_code.trim().toUpperCase() === normalized) || null;
}

export async function updateCorpsMember(member: CorpsMember): Promise<void> {
  const list = await getNominalRoll();
  const index = list.findIndex(
    (c) => c.state_code.trim().toUpperCase() === member.state_code.trim().toUpperCase()
  );
  if (index >= 0) {
    list[index] = member;
  } else {
    list.push(member);
  }
  await writeJsonFile("nominal_roll.json", list);
}

// ================= PLATOONS =================
export async function getPlatoons(): Promise<Record<string, PlatoonInspectorAccount>> {
  return readJsonFile<Record<string, PlatoonInspectorAccount>>("platoons.json", {});
}

export async function getPlatoon(platoonNum: number): Promise<PlatoonInspectorAccount | null> {
  const platoons = await getPlatoons();
  return platoons[String(platoonNum)] || null;
}

export async function updatePlatoon(
  platoonNum: number,
  updates: Partial<PlatoonInspectorAccount>
): Promise<PlatoonInspectorAccount> {
  const platoons = await getPlatoons();
  const current = platoons[String(platoonNum)] || {
    platoon: platoonNum,
    name: `Inspector Platoon ${platoonNum}`,
    email: `platoon${platoonNum}.inspector@nysc.gov.ng`,
    active: true,
  };
  const updated = { ...current, ...updates, platoon: platoonNum };
  platoons[String(platoonNum)] = updated;
  await writeJsonFile("platoons.json", platoons);
  return updated;
}

// ================= SECRETARIAT =================
export async function getSecretariat(): Promise<SecretariatAccount> {
  return readJsonFile<SecretariatAccount>("secretariat.json", {
    email: "secretariat.lagos@nysc.gov.ng",
    officer_name: "Camp Director of Secretariat",
    active: true,
  });
}

export async function updateSecretariat(updates: Partial<SecretariatAccount>): Promise<SecretariatAccount> {
  const current = await getSecretariat();
  const updated = { ...current, ...updates };
  await writeJsonFile("secretariat.json", updated);
  return updated;
}

// ================= SUBMISSIONS =================
export async function getSubmissions(): Promise<Record<string, SubmissionRecord>> {
  return readJsonFile<Record<string, SubmissionRecord>>("submissions.json", {});
}

export async function getSubmission(stateCode: string): Promise<SubmissionRecord> {
  const submissions = await getSubmissions();
  const normalized = stateCode.trim().toUpperCase();
  if (submissions[normalized]) {
    return submissions[normalized];
  }

  // Generate default submission record
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
  const cleanCode = normalized.replace(/[^A-Z0-9]/g, "");

  const newRecord: SubmissionRecord = {
    state_code: normalized,
    kit_status: "INCOMPLETE",
    qr_token: `NYSC-PASS-${cleanCode}-${randomSuffix}`,
    backup_pin: randomPin,
    documents: {},
    exeat: {
      status: "NONE",
      unlockedByPi: false,
    },
    last_updated: new Date().toISOString(),
  };

  submissions[normalized] = newRecord;
  await writeJsonFile("submissions.json", submissions);
  return newRecord;
}

export async function updateSubmission(
  stateCode: string,
  updates: Partial<SubmissionRecord>
): Promise<SubmissionRecord> {
  const current = await getSubmission(stateCode);
  const submissions = await getSubmissions();
  const normalized = stateCode.trim().toUpperCase();

  const merged: SubmissionRecord = {
    ...current,
    ...updates,
    state_code: normalized,
    last_updated: new Date().toISOString(),
  };

  submissions[normalized] = merged;
  await writeJsonFile("submissions.json", submissions);
  return merged;
}

// ================= AUDIT LOGS =================
export interface AuditLogItem {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
}

export async function getAuditLogs(): Promise<AuditLogItem[]> {
  return readJsonFile<AuditLogItem[]>("audit_logs.json", []);
}

export async function addAuditLog(actor: string, action: string, details: string): Promise<void> {
  const logs = await getAuditLogs();
  const newLog: AuditLogItem = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    actor,
    action,
    details,
  };
  logs.unshift(newLog); // latest first
  // keep last 500
  if (logs.length > 500) logs.length = 500;
  await writeJsonFile("audit_logs.json", logs);
}

// ================= ADMIN KPIS =================
export async function getAdminKPIs(): Promise<AdminKPIs> {
  const nominalRoll = await getNominalRoll();
  const submissions = await getSubmissions();

  const totalMobilized = nominalRoll.length;
  let totalLoggedIn = 0;
  let totalReadyForKit = 0;
  let totalKitsDisbursed = 0;
  let totalMedicalCorpers = 0;
  let totalExeatRequested = 0;
  let totalExeatDelivered = 0;

  // Initialize platoon counters
  const platoonStats: Record<number, { total: number; ready: number; disbursed: number }> = {};
  for (let p = 1; p <= 10; p++) {
    platoonStats[p] = { total: 0, ready: 0, disbursed: 0 };
  }

  for (const cm of nominalRoll) {
    const p = cm.platoon;
    if (platoonStats[p]) {
      platoonStats[p].total += 1;
    }
    if (cm.is_medical) {
      totalMedicalCorpers += 1;
    }

    const sub = submissions[cm.state_code.trim().toUpperCase()];
    if (sub) {
      totalLoggedIn += 1;
      if (sub.kit_status === "READY_FOR_KIT") {
        totalReadyForKit += 1;
        if (platoonStats[p]) platoonStats[p].ready += 1;
      } else if (sub.kit_status === "KIT_DISBURSED") {
        totalKitsDisbursed += 1;
        if (platoonStats[p]) platoonStats[p].disbursed += 1;
      }

      if (sub.exeat && sub.exeat.status !== "NONE") {
        totalExeatRequested += 1;
        if (sub.exeat.status === "DELIVERED") {
          totalExeatDelivered += 1;
        }
      }
    }
  }

  const disbursedPercentage =
    totalMobilized > 0 ? Math.round((totalKitsDisbursed / totalMobilized) * 100) : 0;

  const platoonsProgress = Object.entries(platoonStats).map(([pStr, stats]) => {
    const p = parseInt(pStr, 10);
    const pct = stats.total > 0 ? Math.round((stats.disbursed / stats.total) * 100) : 0;
    return {
      platoon: p,
      total: stats.total,
      ready: stats.ready,
      disbursed: stats.disbursed,
      disbursedPct: pct,
    };
  });

  return {
    totalMobilized,
    totalLoggedIn,
    totalReadyForKit,
    totalKitsDisbursed,
    disbursedPercentage,
    totalMedicalCorpers,
    totalExeatRequested,
    totalExeatDelivered,
    platoonsProgress,
  };
}
