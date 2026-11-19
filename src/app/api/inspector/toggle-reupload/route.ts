import { NextRequest, NextResponse } from "next/server";
import { getSubmission, updateSubmission, getCorpsMemberByStateCode, addAuditLog } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { stateCode, documentKey, canReupload, inspectorPlatoon } = body;

    if (!stateCode || !documentKey) {
      return NextResponse.json({ success: false, error: "Missing stateCode or documentKey." }, { status: 400 });
    }

    const cm = await getCorpsMemberByStateCode(stateCode);
    if (!cm) {
      return NextResponse.json({ success: false, error: "Corps Member not found." }, { status: 404 });
    }

    const sub = await getSubmission(stateCode);
    const existingDoc = sub.documents[documentKey];

    if (!existingDoc) {
      return NextResponse.json({ success: false, error: "Document has not been uploaded yet." }, { status: 404 });
    }

    const updatedDocs = {
      ...sub.documents,
      [documentKey]: {
        ...existingDoc,
        canReupload: Boolean(canReupload),
        status: canReupload ? "NOT_UPLOADED" : existingDoc.status,
      },
    };

    const updated = await updateSubmission(stateCode, {
      documents: updatedDocs,
    });

    await addAuditLog(
      `Platoon ${inspectorPlatoon || cm.platoon} Inspector`,
      canReupload ? "REUPLOAD_ENABLED" : "REUPLOAD_DISABLED",
      `Document ${documentKey} re-upload ${canReupload ? "enabled" : "disabled"} for ${cm.full_name} (${cm.state_code})`
    );

    return NextResponse.json({
      success: true,
      message: `Re-upload ${canReupload ? "unlocked" : "locked"} for ${documentKey}.`,
      submission: updated,
    });
  } catch (error: any) {
    console.error("toggle-reupload error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
