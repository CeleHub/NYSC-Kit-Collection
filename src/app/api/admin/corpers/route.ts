import { NextRequest, NextResponse } from "next/server";
import { getNominalRoll, updateCorpsMember, derivePlatoonFromStateCode, addAuditLog } from "@/lib/db";
import { CorpsMember } from "@/lib/types";

export async function GET() {
  try {
    const list = await getNominalRoll();
    return NextResponse.json({ success: true, nominalRoll: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      state_code,
      call_up_no,
      full_name,
      email,
      phone,
      gender = "M",
      institution,
      institution_type = "UNIVERSITY",
      course_of_study,
      is_medical = false,
      batch = "Batch C, 2026",
    } = body;

    if (!state_code || !full_name || !email) {
      return NextResponse.json(
        { success: false, error: "State code, full name, and email are required." },
        { status: 400 }
      );
    }

    // Auto derive platoon from state code
    const platoon = derivePlatoonFromStateCode(state_code);

    const member: CorpsMember = {
      state_code: state_code.trim().toUpperCase(),
      call_up_no: call_up_no || `NYSC/GEN/${Date.now().toString().slice(-6)}`,
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone || "08000000000",
      gender,
      institution: institution || "Federal University",
      institution_type,
      course_of_study: course_of_study || "General Studies",
      is_medical: Boolean(is_medical),
      platoon,
      batch,
    };

    await updateCorpsMember(member);

    await addAuditLog(
      "Camp Admin",
      "CORPS_MEMBER_SAVED",
      `Saved/Updated Corps Member ${member.full_name} (${member.state_code}) in Platoon ${member.platoon}`
    );

    return NextResponse.json({
      success: true,
      message: `Corps Member ${member.full_name} (${member.state_code}) saved successfully. Platoon assigned: ${member.platoon}`,
      corpsMember: member,
    });
  } catch (error: any) {
    console.error("admin corper update error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
