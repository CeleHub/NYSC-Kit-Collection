import { NextResponse } from "next/server";
import { getAdminKPIs, getPlatoons, getSecretariat, getAuditLogs } from "@/lib/db";

export async function GET() {
  try {
    const kpis = await getAdminKPIs();
    const platoons = await getPlatoons();
    const secretariat = await getSecretariat();
    const auditLogs = await getAuditLogs();

    return NextResponse.json({
      success: true,
      kpis,
      platoons,
      secretariat,
      recentAuditLogs: auditLogs.slice(0, 30),
    });
  } catch (error: any) {
    console.error("admin overview error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
