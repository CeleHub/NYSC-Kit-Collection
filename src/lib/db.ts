import fs from "fs/promises";
import path from "path";
import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import {
  CorpsMember,
  PlatoonInspectorAccount,
  SecretariatAccount,
  SubmissionRecord,
  AdminKPIs,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "src", "data");

// ========================================================
// NEON POSTGRES CLIENT & SCHEMA INITIALIZER
// ========================================================
let sqlClient: NeonQueryFunction<false, false> | null = null;
let schemaInitialized = false;

function getNeonClient(): NeonQueryFunction<false, false> | null {
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
 * Initializes Neon Postgres tables and migrates existing JSON seed data
 * automatically on first connection.
 */
async function ensureNeonSchema(sql: NeonQueryFunction<false, false>): Promise<void> {
  if (schemaInitialized) return;

  try {
    // 1. Create tables
    await sql`
      CREATE TABLE IF NOT EXISTS nominal_roll (
        state_code TEXT PRIMARY KEY,
        call_up_no TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        gender TEXT,
        institution TEXT,
        institution_type TEXT,
        course_of_study TEXT,
        is_medical BOOLEAN DEFAULT FALSE,
        platoon INT NOT NULL,
        batch TEXT
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS platoons (
        platoon INT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        active BOOLEAN DEFAULT TRUE
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS secretariat (
        id INT PRIMARY KEY DEFAULT 1,
        email TEXT NOT NULL,
        officer_name TEXT NOT NULL,
        active BOOLEAN DEFAULT TRUE
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS submissions (
        state_code TEXT PRIMARY KEY,
        kit_status TEXT NOT NULL DEFAULT 'INCOMPLETE',
        qr_token TEXT NOT NULL,
        backup_pin TEXT NOT NULL,
        documents JSONB NOT NULL DEFAULT '{}'::jsonb,
        exeat JSONB NOT NULL DEFAULT '{"status": "NONE", "unlockedByPi": false}'::jsonb,
        kit_disbursed_at TIMESTAMPTZ,
        kit_disbursed_by_platoon INT,
        last_updated TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        log_id TEXT UNIQUE,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 2. Check if seeding is required (if nominal_roll is empty)
    const countRes = await sql`SELECT COUNT(*)::int AS count FROM nominal_roll`;
    const count = countRes[0]?.count || 0;

    if (count === 0) {
      console.log("[NEON DB] Seeding initial data from local JSON into Neon...");
      
      // Seed nominal roll
      const seedMembers = await readJsonFile<CorpsMember[]>("nominal_roll.json", []);
      for (const cm of seedMembers) {
        await sql`
          INSERT INTO nominal_roll (
            state_code, call_up_no, full_name, email, phone, gender,
            institution, institution_type, course_of_study, is_medical, platoon, batch
          ) VALUES (
            ${cm.state_code}, ${cm.call_up_no}, ${cm.full_name}, ${cm.email}, ${cm.phone || ""},
            ${cm.gender}, ${cm.institution}, ${cm.institution_type}, ${cm.course_of_study},
            ${cm.is_medical}, ${cm.platoon}, ${cm.batch}
          ) ON CONFLICT (state_code) DO NOTHING;
        `;
      }

      // Seed platoons
      const seedPlatoons = await readJsonFile<Record<string, PlatoonInspectorAccount>>("platoons.json", {});
      for (const p of Object.values(seedPlatoons)) {
        await sql`
          INSERT INTO platoons (platoon, name, email, active)
          VALUES (${p.platoon}, ${p.name}, ${p.email}, ${p.active})
          ON CONFLICT (platoon) DO NOTHING;
        `;
      }

      // Seed secretariat
      const seedSec = await readJsonFile<SecretariatAccount>("secretariat.json", {
        email: "secretariat.lagos@nysc.gov.ng",
        officer_name: "Mrs. O. A. Adeleke (Camp Director)",
        active: true,
      });
      await sql`
        INSERT INTO secretariat (id, email, officer_name, active)
        VALUES (1, ${seedSec.email}, ${seedSec.officer_name}, ${seedSec.active})
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          officer_name = EXCLUDED.officer_name,
          active = EXCLUDED.active;
      `;

      // Seed submissions
      const seedSubs = await readJsonFile<Record<string, SubmissionRecord>>("submissions.json", {});
      for (const sub of Object.values(seedSubs)) {
        await sql`
          INSERT INTO submissions (
            state_code, kit_status, qr_token, backup_pin, documents, exeat, last_updated
          ) VALUES (
            ${sub.state_code}, ${sub.kit_status}, ${sub.qr_token}, ${sub.backup_pin},
            ${JSON.stringify(sub.documents || {})}, ${JSON.stringify(sub.exeat || {})}, NOW()
          ) ON CONFLICT (state_code) DO NOTHING;
        `;
      }

      console.log("[NEON DB] Neon database successfully initialized and seeded!");
    }

    schemaInitialized = true;
  } catch (err) {
    console.error("[NEON DB ERROR] Schema initialization failed:", err);
  }
}

// ========================================================
// LOCAL JSON FALLBACK HELPERS
// ========================================================
async function readJsonFile<T>(filename: string, defaultValue: T): Promise<T> {
  try {
    const filePath = path.join(DATA_DIR, filename);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return defaultValue;
  }
}

async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  const filePath = path.join(DATA_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// ========================================================
// STATE CODE TO PLATOON RULE
// ========================================================
export function derivePlatoonFromStateCode(stateCode: string): number {
  const clean = stateCode.trim().toUpperCase();
  const match = clean.match(/(\d+)$/);
  if (!match) return 1;
  const digits = match[1];
  const lastChar = digits.slice(-1);
  const num = parseInt(lastChar, 10);
  if (num === 0) return 10;
  return num >= 1 && num <= 9 ? num : 1;
}

// ========================================================
// 1. NOMINAL ROLL
// ========================================================
export async function getNominalRoll(): Promise<CorpsMember[]> {
  const sql = getNeonClient();
  if (sql) {
    await ensureNeonSchema(sql);
    const rows = await sql`SELECT * FROM nominal_roll ORDER BY state_code ASC`;
    return rows.map((r: any) => ({
      state_code: r.state_code,
      call_up_no: r.call_up_no,
      full_name: r.full_name,
      email: r.email,
      phone: r.phone || "",
      gender: r.gender as "M" | "F",
      institution: r.institution,
      institution_type: r.institution_type as any,
      course_of_study: r.course_of_study,
      is_medical: Boolean(r.is_medical),
      platoon: Number(r.platoon),
      batch: r.batch,
    }));
  }
  return readJsonFile<CorpsMember[]>("nominal_roll.json", []);
}

export async function getCorpsMemberByStateCode(stateCode: string): Promise<CorpsMember | null> {
  const normalized = stateCode.trim().toUpperCase();
  const sql = getNeonClient();
  if (sql) {
    await ensureNeonSchema(sql);
    const rows = await sql`SELECT * FROM nominal_roll WHERE UPPER(state_code) = ${normalized} LIMIT 1`;
    if (rows.length === 0) return null;
    const r: any = rows[0];
    return {
      state_code: r.state_code,
      call_up_no: r.call_up_no,
      full_name: r.full_name,
      email: r.email,
      phone: r.phone || "",
      gender: r.gender as "M" | "F",
      institution: r.institution,
      institution_type: r.institution_type as any,
      course_of_study: r.course_of_study,
      is_medical: Boolean(r.is_medical),
      platoon: Number(r.platoon),
      batch: r.batch,
    };
  }

  const list = await getNominalRoll();
  return list.find((c) => c.state_code.trim().toUpperCase() === normalized) || null;
}

export async function updateCorpsMember(member: CorpsMember): Promise<void> {
  const sql = getNeonClient();
  if (sql) {
    await ensureNeonSchema(sql);
    await sql`
      INSERT INTO nominal_roll (
        state_code, call_up_no, full_name, email, phone, gender,
        institution, institution_type, course_of_study, is_medical, platoon, batch
      ) VALUES (
        ${member.state_code}, ${member.call_up_no}, ${member.full_name}, ${member.email},
        ${member.phone || ""}, ${member.gender}, ${member.institution}, ${member.institution_type},
        ${member.course_of_study}, ${member.is_medical}, ${member.platoon}, ${member.batch}
      )
      ON CONFLICT (state_code) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        gender = EXCLUDED.gender,
        institution = EXCLUDED.institution,
        institution_type = EXCLUDED.institution_type,
        course_of_study = EXCLUDED.course_of_study,
        is_medical = EXCLUDED.is_medical,
        platoon = EXCLUDED.platoon,
        batch = EXCLUDED.batch;
    `;
    return;
  }

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

// ========================================================
// 2. PLATOONS
// ========================================================
export async function getPlatoons(): Promise<Record<string, PlatoonInspectorAccount>> {
  const sql = getNeonClient();
  if (sql) {
    await ensureNeonSchema(sql);
    const rows = await sql`SELECT * FROM platoons ORDER BY platoon ASC`;
    const result: Record<string, PlatoonInspectorAccount> = {};
    rows.forEach((r: any) => {
      result[String(r.platoon)] = {
        platoon: Number(r.platoon),
        name: r.name,
        email: r.email,
        active: Boolean(r.active),
      };
    });
    return result;
  }
  return readJsonFile<Record<string, PlatoonInspectorAccount>>("platoons.json", {});
}

export async function getPlatoon(platoonNum: number): Promise<PlatoonInspectorAccount | null> {
  const sql = getNeonClient();
  if (sql) {
    await ensureNeonSchema(sql);
    const rows = await sql`SELECT * FROM platoons WHERE platoon = ${platoonNum} LIMIT 1`;
    if (rows.length === 0) return null;
    const r: any = rows[0];
    return {
      platoon: Number(r.platoon),
      name: r.name,
      email: r.email,
      active: Boolean(r.active),
    };
  }

  const platoons = await getPlatoons();
  return platoons[String(platoonNum)] || null;
}

export async function updatePlatoon(
  platoonNum: number,
  updates: Partial<PlatoonInspectorAccount>
): Promise<PlatoonInspectorAccount> {
  const sql = getNeonClient();
  if (sql) {
    await ensureNeonSchema(sql);
    const current = (await getPlatoon(platoonNum)) || {
      platoon: platoonNum,
      name: `Inspector Platoon ${platoonNum}`,
      email: `platoon${platoonNum}.inspector@nysc.gov.ng`,
      active: true,
    };
    const updated = { ...current, ...updates, platoon: platoonNum };
    await sql`
      INSERT INTO platoons (platoon, name, email, active)
      VALUES (${updated.platoon}, ${updated.name}, ${updated.email}, ${updated.active})
      ON CONFLICT (platoon) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        active = EXCLUDED.active;
    `;
    return updated;
  }

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

// ========================================================
// 3. SECRETARIAT
// ========================================================
export async function getSecretariat(): Promise<SecretariatAccount> {
  const sql = getNeonClient();
  if (sql) {
    await ensureNeonSchema(sql);
    const rows = await sql`SELECT * FROM secretariat WHERE id = 1 LIMIT 1`;
    if (rows.length > 0) {
      const r: any = rows[0];
      return {
        email: r.email,
        officer_name: r.officer_name,
        active: Boolean(r.active),
      };
    }
  }

  return readJsonFile<SecretariatAccount>("secretariat.json", {
    email: "secretariat.lagos@nysc.gov.ng",
    officer_name: "Camp Director of Secretariat",
    active: true,
  });
}

export async function updateSecretariat(updates: Partial<SecretariatAccount>): Promise<SecretariatAccount> {
  const sql = getNeonClient();
  if (sql) {
    await ensureNeonSchema(sql);
    const current = await getSecretariat();
    const updated = { ...current, ...updates };
    await sql`
      INSERT INTO secretariat (id, email, officer_name, active)
      VALUES (1, ${updated.email}, ${updated.officer_name}, ${updated.active})
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        officer_name = EXCLUDED.officer_name,
        active = EXCLUDED.active;
    `;
    return updated;
  }

  const current = await getSecretariat();
  const updated = { ...current, ...updates };
  await writeJsonFile("secretariat.json", updated);
  return updated;
}

// ========================================================
// 4. SUBMISSIONS & KIT COLLECTION STATUS
// ========================================================
export async function getSubmissions(): Promise<Record<string, SubmissionRecord>> {
  const sql = getNeonClient();
  if (sql) {
    await ensureNeonSchema(sql);
    const rows = await sql`SELECT * FROM submissions`;
    const result: Record<string, SubmissionRecord> = {};
    rows.forEach((r: any) => {
      result[r.state_code.toUpperCase()] = {
        state_code: r.state_code,
        kit_status: r.kit_status,
        qr_token: r.qr_token,
        backup_pin: r.backup_pin,
        documents: typeof r.documents === "string" ? JSON.parse(r.documents) : (r.documents || {}),
        exeat: typeof r.exeat === "string" ? JSON.parse(r.exeat) : (r.exeat || { status: "NONE", unlockedByPi: false }),
        kit_disbursed_at: r.kit_disbursed_at,
        kit_disbursed_by_platoon: r.kit_disbursed_by_platoon,
        last_updated: r.last_updated,
      };
    });
    return result;
  }

  return readJsonFile<Record<string, SubmissionRecord>>("submissions.json", {});
}

export async function getSubmission(stateCode: string): Promise<SubmissionRecord> {
  const normalized = stateCode.trim().toUpperCase();
  const sql = getNeonClient();
  if (sql) {
    await ensureNeonSchema(sql);
    const rows = await sql`SELECT * FROM submissions WHERE UPPER(state_code) = ${normalized} LIMIT 1`;
    if (rows.length > 0) {
      const r: any = rows[0];
      return {
        state_code: r.state_code,
        kit_status: r.kit_status,
        qr_token: r.qr_token,
        backup_pin: r.backup_pin,
        documents: typeof r.documents === "string" ? JSON.parse(r.documents) : (r.documents || {}),
        exeat: typeof r.exeat === "string" ? JSON.parse(r.exeat) : (r.exeat || { status: "NONE", unlockedByPi: false }),
        kit_disbursed_at: r.kit_disbursed_at,
        kit_disbursed_by_platoon: r.kit_disbursed_by_platoon,
        last_updated: r.last_updated,
      };
    }

    // Generate new record in Neon
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    const cleanCode = normalized.replace(/[^A-Z0-9]/g, "");

    const newRecord: SubmissionRecord = {
      state_code: normalized,
      kit_status: "INCOMPLETE",
      qr_token: `NYSC-PASS-${cleanCode}-${randomSuffix}`,
      backup_pin: randomPin,
      documents: {},
      exeat: { status: "NONE", unlockedByPi: false },
      last_updated: new Date().toISOString(),
    };

    await sql`
      INSERT INTO submissions (
        state_code, kit_status, qr_token, backup_pin, documents, exeat, last_updated
      ) VALUES (
        ${newRecord.state_code}, ${newRecord.kit_status}, ${newRecord.qr_token},
        ${newRecord.backup_pin}, ${JSON.stringify(newRecord.documents)},
        ${JSON.stringify(newRecord.exeat)}, NOW()
      );
    `;
    return newRecord;
  }

  const submissions = await getSubmissions();
  if (submissions[normalized]) {
    return submissions[normalized];
  }

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
  const cleanCode = normalized.replace(/[^A-Z0-9]/g, "");

  const newRecord: SubmissionRecord = {
    state_code: normalized,
    kit_status: "INCOMPLETE",
    qr_token: `NYSC-PASS-${cleanCode}-${randomSuffix}`,
    backup_pin: randomPin,
    documents: {},
    exeat: { status: "NONE", unlockedByPi: false },
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
  const normalized = stateCode.trim().toUpperCase();
  const current = await getSubmission(stateCode);
  const merged: SubmissionRecord = {
    ...current,
    ...updates,
    state_code: normalized,
    last_updated: new Date().toISOString(),
  };

  const sql = getNeonClient();
  if (sql) {
    await ensureNeonSchema(sql);
    await sql`
      INSERT INTO submissions (
        state_code, kit_status, qr_token, backup_pin, documents, exeat,
        kit_disbursed_at, kit_disbursed_by_platoon, last_updated
      ) VALUES (
        ${merged.state_code}, ${merged.kit_status}, ${merged.qr_token}, ${merged.backup_pin},
        ${JSON.stringify(merged.documents || {})}, ${JSON.stringify(merged.exeat || {})},
        ${merged.kit_disbursed_at || null}, ${merged.kit_disbursed_by_platoon || null}, NOW()
      )
      ON CONFLICT (state_code) DO UPDATE SET
        kit_status = EXCLUDED.kit_status,
        qr_token = EXCLUDED.qr_token,
        backup_pin = EXCLUDED.backup_pin,
        documents = EXCLUDED.documents,
        exeat = EXCLUDED.exeat,
        kit_disbursed_at = EXCLUDED.kit_disbursed_at,
        kit_disbursed_by_platoon = EXCLUDED.kit_disbursed_by_platoon,
        last_updated = NOW();
    `;
    return merged;
  }

  const submissions = await getSubmissions();
  submissions[normalized] = merged;
  await writeJsonFile("submissions.json", submissions);
  return merged;
}

/**
 * Resets/clears all uploaded documents and kit statuses across all submissions.
 * Preserves the nominal roll (names, emails, platoons, state codes),
 * platoon inspector accounts, and secretariat configurations completely.
 */
export async function clearAllUploadedDocuments(): Promise<{ clearedCount: number }> {
  const sql = getNeonClient();
  if (sql) {
    await ensureNeonSchema(sql);
    const result = await sql`
      UPDATE submissions
      SET
        documents = '{}'::jsonb,
        kit_status = 'INCOMPLETE',
        exeat = '{"status": "NONE", "unlockedByPi": false}'::jsonb,
        kit_disbursed_at = NULL,
        kit_disbursed_by_platoon = NULL,
        last_updated = NOW();
    `;
    return { clearedCount: (result as any).length || 0 };
  }

  const submissions = await getSubmissions();
  let count = 0;
  for (const key of Object.keys(submissions)) {
    submissions[key].documents = {};
    submissions[key].kit_status = "INCOMPLETE";
    submissions[key].exeat = { status: "NONE", unlockedByPi: false };
    submissions[key].kit_disbursed_at = undefined;
    submissions[key].kit_disbursed_by_platoon = undefined;
    submissions[key].last_updated = new Date().toISOString();
    count++;
  }
  await writeJsonFile("submissions.json", submissions);
  return { clearedCount: count };
}

// ========================================================
// 5. AUDIT LOGS (Real-time Cloud Log Store)
// ========================================================
export interface AuditLogItem {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
}

export async function getAuditLogs(): Promise<AuditLogItem[]> {
  const sql = getNeonClient();
  if (sql) {
    await ensureNeonSchema(sql);
    const rows = await sql`
      SELECT id, log_id, actor, action, details, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 500;
    `;
    return rows.map((r: any) => ({
      id: r.log_id || `log-${r.id}`,
      timestamp: new Date(r.created_at).toISOString(),
      actor: r.actor,
      action: r.action,
      details: r.details,
    }));
  }

  return readJsonFile<AuditLogItem[]>("audit_logs.json", []);
}

export async function addAuditLog(actor: string, action: string, details: string): Promise<void> {
  const logId = `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const sql = getNeonClient();
  if (sql) {
    try {
      await ensureNeonSchema(sql);
      await sql`
        INSERT INTO audit_logs (log_id, actor, action, details, created_at)
        VALUES (${logId}, ${actor}, ${action}, ${details}, NOW());
      `;
      return;
    } catch (err) {
      console.error("[NEON DB] Failed to insert audit log to Neon:", err);
    }
  }

  const logs = await getAuditLogs();
  const newLog: AuditLogItem = {
    id: logId,
    timestamp: new Date().toISOString(),
    actor,
    action,
    details,
  };
  logs.unshift(newLog);
  if (logs.length > 500) logs.length = 500;
  await writeJsonFile("audit_logs.json", logs);
}

// ========================================================
// 6. ADMIN KPIS
// ========================================================
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
