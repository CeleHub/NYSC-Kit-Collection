import { NextRequest, NextResponse } from "next/server";
import { getCorpsMemberByStateCode, getSubmission } from "@/lib/db";
import { DOCUMENT_DEFINITIONS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const stateCode = searchParams.get("stateCode");

    if (!stateCode) {
      return NextResponse.json({ success: false, error: "State code required." }, { status: 400 });
    }

    const cm = await getCorpsMemberByStateCode(stateCode);
    if (!cm) {
      return NextResponse.json({ success: false, error: "Corps Member not found." }, { status: 404 });
    }

    const submission = await getSubmission(stateCode);

    // Filter document definitions according to corper's profile
    // E.g. HND certificate only needed if institution_type === 'POLYTECHNIC'
    const docs = DOCUMENT_DEFINITIONS.filter((doc) => {
      if (doc.key === "school_certificate_hnd") {
        return cm.institution_type === "POLYTECHNIC";
      }
      return true;
    });

    return NextResponse.json({
      success: true,
      corpsMember: cm,
      submission,
      documentDefinitions: docs,
    });
  } catch (error: any) {
    console.error("profile error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
