import { NextRequest, NextResponse } from "next/server";
import { getSubmissions, getCorpsMemberByStateCode, addAuditLog } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tokenOrPin, inspectorPlatoon } = body;

    if (!tokenOrPin || !inspectorPlatoon) {
      return NextResponse.json(
        { success: false, error: "Token/PIN and Inspector Platoon are required." },
        { status: 400 }
      );
    }

    let cleanInput = tokenOrPin.trim();

    // If input is a URL, intelligently extract token, state code, or last path segment
    if (cleanInput.startsWith("http://") || cleanInput.startsWith("https://")) {
      try {
        const parsedUrl = new URL(cleanInput);
        const urlToken =
          parsedUrl.searchParams.get("token") ||
          parsedUrl.searchParams.get("stateCode") ||
          parsedUrl.pathname.split("/").filter(Boolean).pop();
        if (urlToken) {
          cleanInput = decodeURIComponent(urlToken).trim();
        }
      } catch (e) {
        // Fallback to substring matching if URL parsing fails
      }
    }

    const submissions = await getSubmissions();

    // Look for matching submission by qr_token, backup_pin, state_code, or contained token
    let matchedSubmission: any = null;
    for (const sub of Object.values(submissions)) {
      if (
        sub.qr_token === cleanInput ||
        sub.backup_pin === cleanInput ||
        sub.state_code.toUpperCase() === cleanInput.toUpperCase() ||
          (cleanInput.length > 5 && sub.qr_token && cleanInput.includes(sub.qr_token)) ||
          (cleanInput.length > 5 && sub.state_code && cleanInput.toUpperCase().includes(sub.state_code.toUpperCase()))
      ) {
        matchedSubmission = sub;
        break;
      }
    }

    if (!matchedSubmission) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid QR Pass or Verification PIN. No matching record found.",
        },
        { status: 404 }
      );
    }

    const cm = await getCorpsMemberByStateCode(matchedSubmission.state_code);
    if (!cm) {
      return NextResponse.json({ success: false, error: "Corps member record missing." }, { status: 404 });
    }

    // CROSS-PLATOON SECURITY CHECK
    // If corper belongs to a different platoon, loudly reject
    if (cm.platoon !== Number(inspectorPlatoon)) {
      await addAuditLog(
        `Platoon ${inspectorPlatoon} Inspector`,
        "CROSS_PLATOON_BLOCKED",
        `Attempted scan for ${cm.full_name} (${cm.state_code}) who belongs to Platoon ${cm.platoon}`
      );

      return NextResponse.json(
        {
          success: false,
          wrongPlatoon: true,
          actualPlatoon: cm.platoon,
          inspectorPlatoon: Number(inspectorPlatoon),
          error: `WRONG PLATOON! ${cm.full_name} (${cm.state_code}) belongs to PLATOON ${cm.platoon}, NOT Platoon ${inspectorPlatoon}. Kit cannot be disbursed here.`,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      corpsMember: cm,
      submission: matchedSubmission,
    });
  } catch (error: any) {
    console.error("verify-qr error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
