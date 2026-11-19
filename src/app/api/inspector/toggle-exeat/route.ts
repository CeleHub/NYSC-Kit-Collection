import { NextRequest, NextResponse } from "next/server";
import { getSubmission, updateSubmission, getCorpsMemberByStateCode, addAuditLog } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { stateCode, inspectorPlatoon, unlocked } = body;

    if (!stateCode) {
      return NextResponse.json({ success: false, error: "Missing stateCode." }, { status: 400 });
    }

    const cm = await getCorpsMemberByStateCode(stateCode);
    if (!cm) {
      return NextResponse.json({ success: false, error: "Corps Member not found." }, { status: 404 });
    }

    const sub = await getSubmission(stateCode);

    const updatedExeat = {
      ...sub.exeat,
      unlockedByPi: Boolean(unlocked),
    };

    const updated = await updateSubmission(stateCode, {
      exeat: updatedExeat,
    });

    await addAuditLog(
      `Platoon ${inspectorPlatoon || cm.platoon} Inspector`,
      unlocked ? "EXEAT_UNLOCKED_MEDICAL" : "EXEAT_LOCKED_MEDICAL",
      `Medical Exeat submission ${unlocked ? "unlocked" : "locked"} for ${cm.full_name} (${cm.state_code})`
    );

    return NextResponse.json({
      success: true,
      message: `Medical Exeat submission ${unlocked ? "unlocked" : "locked"} for ${cm.full_name}.`,
      submission: updated,
    });
  } catch (error: any) {
    console.error("toggle-exeat error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
