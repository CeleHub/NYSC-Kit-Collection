import { NextRequest, NextResponse } from "next/server";
import { getSubmission, updateSubmission, getCorpsMemberByStateCode, addAuditLog } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { stateCode, action, notes } = body;

    if (!stateCode || !action) {
      return NextResponse.json({ success: false, error: "Missing stateCode or action." }, { status: 400 });
    }

    const cm = await getCorpsMemberByStateCode(stateCode);
    if (!cm) {
      return NextResponse.json({ success: false, error: "Corps Member not found." }, { status: 404 });
    }

    const sub = await getSubmission(stateCode);

    if (!sub.exeat || sub.exeat.status === "NONE") {
      return NextResponse.json({ success: false, error: "No exeat application found for this corper." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const updatedExeat = {
      ...sub.exeat,
      status: action === "DELIVER" ? ("DELIVERED" as const) : ("REJECTED" as const),
      actionedAt: now,
      actionNotes: notes || (action === "DELIVER" ? "Exeat slip signed and issued." : "Rejected by Secretariat."),
    };

    const updated = await updateSubmission(stateCode, {
      exeat: updatedExeat,
    });

    await addAuditLog(
      "Secretariat Officer",
      action === "DELIVER" ? "EXEAT_DELIVERED" : "EXEAT_REJECTED",
      `Exeat ${action === "DELIVER" ? "issued" : "rejected"} for ${cm.full_name} (${cm.state_code}). Notes: ${notes || "None"}`
    );

    return NextResponse.json({
      success: true,
      message: `Exeat ${action === "DELIVER" ? "marked as Delivered / Issued" : "Rejected"} for ${cm.full_name}.`,
      submission: updated,
    });
  } catch (error: any) {
    console.error("secretariat action error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
