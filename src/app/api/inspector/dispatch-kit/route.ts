import { NextRequest, NextResponse } from "next/server";
import { getSubmission, updateSubmission, getCorpsMemberByStateCode, addAuditLog } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { stateCode, inspectorPlatoon } = body;

    if (!stateCode || !inspectorPlatoon) {
      return NextResponse.json({ success: false, error: "Missing stateCode or inspectorPlatoon." }, { status: 400 });
    }

    const cm = await getCorpsMemberByStateCode(stateCode);
    if (!cm) {
      return NextResponse.json({ success: false, error: "Corps Member not found." }, { status: 404 });
    }

    if (cm.platoon !== Number(inspectorPlatoon)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cross-platoon disbursement prohibited. Corper belongs to Platoon ${cm.platoon}.`,
        },
        { status: 403 }
      );
    }

    const sub = await getSubmission(stateCode);

    // Double collection guard
    if (sub.kit_status === "KIT_DISBURSED") {
      return NextResponse.json(
        {
          success: false,
          error: `Kit was already disbursed on ${new Date(sub.kit_disbursed_at || "").toLocaleString()}. Cannot disburse twice!`,
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const updated = await updateSubmission(stateCode, {
      kit_status: "KIT_DISBURSED",
      kit_disbursed_at: now,
      kit_disbursed_by_platoon: Number(inspectorPlatoon),
    });

    // Simulated email dispatch
    console.log(`[EMAIL DISPATCH] To: ${cm.email}`);
    console.log(
      `Subject: Official NYSC Kit Collection Confirmation - ${cm.state_code}\n` +
      `Dear ${cm.full_name},\n` +
      `Your official NYSC orientation kit (khakis, boots, crested vest, cap, and accessories) has been successfully marked as DISBURSED by Platoon ${inspectorPlatoon} Inspector.\n\n` +
      `If you have NOT physically received your kit, please report this immediately to your Platoon Inspector or Camp Directorate.`
    );

    await addAuditLog(
      `Platoon ${inspectorPlatoon} Inspector`,
      "KIT_DISBURSED",
      `Dispatched kit to ${cm.full_name} (${cm.state_code}). Confirmation email sent to ${cm.email}`
    );

    return NextResponse.json({
      success: true,
      message: `Kit successfully disbursed to ${cm.full_name}! Confirmation email sent.`,
      submission: updated,
    });
  } catch (error: any) {
    console.error("dispatch-kit error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
