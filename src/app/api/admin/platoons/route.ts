import { NextRequest, NextResponse } from "next/server";
import { updatePlatoon, addAuditLog } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platoon, email, active, name } = body;

    if (!platoon) {
      return NextResponse.json({ success: false, error: "Platoon number is required." }, { status: 400 });
    }

    const platoonNum = Number(platoon);
    const updates: any = {};
    if (email !== undefined) updates.email = email.trim();
    if (active !== undefined) updates.active = Boolean(active);
    if (name !== undefined) updates.name = name.trim();

    const updated = await updatePlatoon(platoonNum, updates);

    await addAuditLog(
      "Camp Admin",
      "PLATOON_INSPECTOR_UPDATED",
      `Platoon ${platoonNum} Inspector updated: email=${updated.email}, active=${updated.active}`
    );

    return NextResponse.json({
      success: true,
      message: `Platoon ${platoonNum} Inspector updated successfully.`,
      platoon: updated,
    });
  } catch (error: any) {
    console.error("admin platoon update error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
