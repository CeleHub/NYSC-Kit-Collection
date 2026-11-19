import { NextRequest, NextResponse } from "next/server";
import { updateSecretariat, addAuditLog } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, officer_name, active } = body;

    const updates: any = {};
    if (email !== undefined) updates.email = email.trim();
    if (officer_name !== undefined) updates.officer_name = officer_name.trim();
    if (active !== undefined) updates.active = Boolean(active);

    const updated = await updateSecretariat(updates);

    await addAuditLog(
      "Camp Admin",
      "SECRETARIAT_UPDATED",
      `Secretariat updated: email=${updated.email}, officer=${updated.officer_name}, active=${updated.active}`
    );

    return NextResponse.json({
      success: true,
      message: "Secretariat details updated successfully.",
      secretariat: updated,
    });
  } catch (error: any) {
    console.error("admin secretariat update error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
